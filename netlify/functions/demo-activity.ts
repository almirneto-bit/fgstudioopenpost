import { getDeployStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { isV09PasswordOnlyPreview } from '../../lib/v09NetlifyPreview';

export type ActivityEvent = {
  id: string; kind:'created'|'saved'|'exported'; projectId:string;
  projectName:string; templateId:string; format:string;
  slideCount:number; at:string;
};
export type ProjectSummary = {
  id:string; name:string; slides:number; templateIds:string[];
  createdAt:string; updatedAt:string; lastFormat?:string; saves:number; exports:number;
};
export const storeName='fgstudio-v09-demo-overview';

function validate(payload:Record<string,unknown>) {
  const kind = String(payload.kind??'');
  if(!['created','saved','exported'].includes(kind))throw new Error('Evento desconhecido');
  const projectId=String(payload.projectId??'');
  if(!/^project-[a-z0-9-]{8,90}$/i.test(projectId))throw new Error('ID inválido');
  const projectName=String(payload.projectName??'').slice(0,160);
  const templateId=String(payload.templateId??'').slice(0,100);
  const format=String(payload.format??'').slice(0,12);
  const slideCount=Number(payload.slideCount??1);
  if(!projectName||!Number.isFinite(slideCount)||slideCount<1||slideCount>100)throw new Error('Dados inválidos');
  return {kind:kind as ActivityEvent['kind'],projectId,projectName,templateId,format,slideCount};
}
export default async function demoActivity(request:Request,context:Context){
  if(!isV09PasswordOnlyPreview(request,context))return Response.json({error:'Disponível somente no preview'}, {status:403});
  if(request.method!=='POST')return new Response('Método não permitido',{status:405});
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return Response.json({error:'Origem não permitida'},{status:403});
  if(Number(request.headers.get('content-length')??0)>15_000)
    return Response.json({error:'Dados excessivos'},{status:413});
  try{
    const payload=validate(await request.json() as Record<string,unknown>);
    const store=getDeployStore(storeName);
    const [eventsRaw,projectsRaw]=await Promise.all([
      store.get('events',{type:'json'}) as Promise<ActivityEvent[]|null>,
      store.get('projects',{type:'json'}) as Promise<ProjectSummary[]|null>,
    ]);
    const now=new Date().toISOString();
    const event:ActivityEvent={id:crypto.randomUUID(),kind:payload.kind,projectId:payload.projectId,projectName:payload.projectName,
      templateId:payload.templateId,format:payload.format,slideCount:payload.slideCount,at:now};
    const events=[event,...(eventsRaw??[])].slice(0,1500);
    const projects=projectsRaw??[];
    let project=projects.find(p=>p.id===payload.projectId);
    if(!project){
      project={id:payload.projectId,name:payload.projectName,slides:payload.slideCount,
        templateIds:payload.templateId?[payload.templateId]:[],createdAt:now,updatedAt:now,saves:0,exports:0};
      projects.unshift(project);
    }
    project.name=payload.projectName;
    project.slides=payload.slideCount;
    project.updatedAt=now;
    if(payload.templateId&&!project.templateIds.includes(payload.templateId))project.templateIds.push(payload.templateId);
    if(payload.kind==='saved')project.saves++;
    if(payload.kind==='exported'){project.exports++;project.lastFormat=payload.format;}
    await Promise.all([
      store.setJSON('events',events),
      store.setJSON('projects',projects.slice(0,1000)),
    ]);
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Erro ao registrar atividade'},{status:400})}
}
