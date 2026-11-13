import { getDatabase } from '@netlify/database';
import { getDeployStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import type { Context } from '@netlify/functions';
import { isV09PasswordOnlyPreview } from '../../lib/v09NetlifyPreview';

export default async function adminHealth(request:Request, context:Context){
  if(request.method!=='GET')return new Response('Método não permitido',{status:405});
  const demo=isV09PasswordOnlyPreview(request,context);
  if(!demo&&!((await getUser())?.roles?.includes('admin')))return Response.json({error:'Acesso restrito'},{status:403});
  let db: {state:'ok'|'unavailable';projects?:number;templates?:number;note?:string}={state:'unavailable'};
  let blobs: {state:'ok'|'unavailable';templateObjects?:number}={state:'unavailable'};
  try{
    const client=getDatabase();
    const [p,t]=await Promise.all([
      client.sql`SELECT COUNT(*)::int AS total FROM fg_projects`,
      client.sql`SELECT COUNT(*)::int AS total FROM fg_templates`,
    ]);
    db={state:'ok',projects:Number(p[0]?.total??0),templates:Number(t[0]?.total??0)};
  }catch{
    db={state:'unavailable',note:'Netlify Database ainda não está disponível ou as migrações não foram aplicadas.'};
  }
  try{
    const catalog=await getDeployStore('fgstudio-v09-demo-templates').list();
    blobs={state:'ok',templateObjects:catalog.blobs.length};
  }catch{
    blobs={state:'unavailable'};
  }
  return Response.json({
    mode:demo?'preview':'production',database:db,blobs,
    historyMigration:'not_started',
    authentication:demo?'site_password_only':'identity_required',
    largeMediaUpload:'pending',
  },{headers:{'Cache-Control':'no-store'}});
}
