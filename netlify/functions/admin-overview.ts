import { getDeployStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import type { Context } from '@netlify/functions';
import { isV09PasswordOnlyPreview } from '../../lib/v09NetlifyPreview';
import { storeName, type ActivityEvent, type ProjectSummary } from './demo-activity';

type TemplateBase = {id:string;title:string;category:string;is_published:boolean;sort_order:number};
type PsdTemplate = {id:string;title:string;category:string;published:boolean;updatedAt:string};
function catalogStore(){return getDeployStore('fgstudio-v09-demo-templates');}
async function psdList() {
  const store=getDeployStore('fgstudio-v09-demo-psd');
  const rows:PsdTemplate[]=[];
  let cursor:string|undefined;
  do {
    const page=await store.list({prefix:'psd:',...(cursor?{cursor}:{})});
    for(const entry of page.blobs){
      const raw=await store.get(entry.key,{type:'json'}) as PsdTemplate|null;
      if(raw)rows.push({id:raw.id,title:raw.title,category:raw.category,published:raw.published,updatedAt:raw.updatedAt});
    }
    cursor=page.nextCursor;
  }while(cursor);
  return rows;
}
const defaults:TemplateBase[]=[
  ['classic','Clássico com tag','Título e imagem',10],
  ['kanit-left','Texto à esquerda','Título e imagem',20],
  ['kanit-right','Texto à direita','Título e imagem',30],
  ['vina-left','Título à esquerda','Título e imagem',40],
  ['vina-right','Título à direita','Título e imagem',50],
  ['kanit-center','Texto centralizado','Destaque central',60],
  ['post-7','Imagem na base','Destaque central',70],
  ['post-8','Imagem no topo','Destaque central',80],
  ['post-9','Comunicado em card','Comunicados',90],
].map(([id,title,category,order])=>({id:String(id),title:String(title),category:String(category),is_published:true,sort_order:Number(order)}));

export default async function adminOverview(request:Request,context:Context){
  if(request.method!=='GET')return new Response('Método não permitido',{status:405});
  const demo=isV09PasswordOnlyPreview(request,context);
  if(!demo){
    const user=await getUser();
    if(!user?.roles?.includes('admin'))return Response.json({error:'Somente administradores'},{status:403});
    // O histórico do Supabase não foi migrado. Não apresentar números falsos.
    return Response.json({error:'O dashboard unificado depende da migração de projetos históricos para Netlify Database.'},{status:503});
  }
  try{
    const storage=getDeployStore(storeName);
    const [events,projects,templates,psds]=await Promise.all([
      storage.get('events',{type:'json'}) as Promise<ActivityEvent[]|null>,
      storage.get('projects',{type:'json'}) as Promise<ProjectSummary[]|null>,
      catalogStore().get('catalog',{type:'json'}) as Promise<TemplateBase[]|null>,
      psdList(),
    ]);
    const items=events??[], creations=projects??[];
    const allTemplates=templates??defaults;
    const days=Array.from({length:7},(_,i)=>{
      const date=new Date(Date.now()-(6-i)*86400000).toISOString().slice(0,10);
      return {date,created:items.filter(e=>e.kind==='created'&&e.at.startsWith(date)).length,
        saved:items.filter(e=>e.kind==='saved'&&e.at.startsWith(date)).length,
        exported:items.filter(e=>e.kind==='exported'&&e.at.startsWith(date)).length};
    });
    const formats=Object.fromEntries(['png','gif','mp4','zip'].map(f=>[f,items.filter(e=>e.kind==='exported'&&e.format===f).length]));
    const usage=new Map<string,number>();
    for(const row of creations)for(const id of row.templateIds)usage.set(id,(usage.get(id)??0)+1);
    const templatesUsage=[...allTemplates,...psds.map(p=>({id:p.id,title:p.title,category:p.category,is_published:p.published,sort_order:0}))]
      .map(t=>({id:t.id,title:t.title,category:t.category,uses:usage.get(t.id)??0}))
      .sort((a,b)=>b.uses-a.uses).slice(0,12);
    const now=new Date();
    const month=now.toISOString().slice(0,7);
    return Response.json({
      scope:'deploy-preview',historyComplete:false,legacyMigration:'pending',
      stats:{
        projects:creations.length,
        slides:creations.reduce((sum,p)=>sum+p.slides,0),
        exports:items.filter(e=>e.kind==='exported').length,
        monthCreated:creations.filter(p=>p.createdAt.startsWith(month)).length,
        publishedTemplates:allTemplates.filter(t=>t.is_published).length+psds.filter(p=>p.published).length,
        templates:allTemplates.length+psds.length,
        importedPsd:psds.length,
        drafts:allTemplates.filter(t=>!t.is_published).length+psds.filter(p=>!p.published).length,
      },
      formats,days,templatesUsage,
      projects:creations.slice(0,300),
      recent:items.slice(0,35),
    },{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'Não foi possível abrir os indicadores.'},{status:503});
  }
}
