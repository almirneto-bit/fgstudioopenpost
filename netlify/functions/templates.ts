import { getUser } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import type { Context } from '@netlify/functions';
import { getDeployStore } from '@netlify/blobs';
import { isV09PasswordOnlyPreview } from '../../lib/v09NetlifyPreview';

// Catálogo provisório isolado do deploy. Não modifica o banco nem o Supabase.
type DemoRow = {
  id: string; slug: string; title: string; category: string; description: string;
  is_published: boolean; sort_order: number; version: number; template_definition: { layoutId: string };
};
const DEFAULT_DEMO_TEMPLATES: DemoRow[] = [
  ['classic', 'Clássico com tag', 'Título e imagem', 10],
  ['kanit-left', 'Texto à esquerda', 'Título e imagem', 20],
  ['kanit-right', 'Texto à direita', 'Título e imagem', 30],
  ['vina-left', 'Título à esquerda', 'Título e imagem', 40],
  ['vina-right', 'Título à direita', 'Título e imagem', 50],
  ['kanit-center', 'Texto centralizado', 'Destaque central', 60],
  ['post-7', 'Imagem na base', 'Destaque central', 70],
  ['post-8', 'Imagem no topo', 'Destaque central', 80],
  ['post-9', 'Comunicado em card', 'Comunicados', 90],
].map(([id, title, category, order]) => ({
  id: String(id), slug: String(id), title: String(title), category: String(category),
  description: '', is_published: true, sort_order: Number(order), version: 1,
  template_definition: { layoutId: String(id) },
}));
function demoStore() { return getDeployStore('fgstudio-v09-demo-templates'); }
function versionKey(id:string) {return 'versions:'+id;}
async function rememberVersion(row:DemoRow) {
  const key=versionKey(row.id);
  const versions=await demoStore().get(key,{type:'json'}) as DemoRow[]|null;
  await demoStore().setJSON(key,[row,...(versions??[])].slice(0,20));
}
async function readDemoTemplates(): Promise<DemoRow[]> {
  const stored = await demoStore().get('catalog', { type: 'json' }) as DemoRow[] | null;
  return Array.isArray(stored) ? stored : DEFAULT_DEMO_TEMPLATES;
}

// O administrador controla rótulos, categorias e visibilidade.
// O renderer original permanece intacto nesta fase.
export default async function templates(request: Request, context: Context) {
  const demo = isV09PasswordOnlyPreview(request, context);
  const user = demo ? null : await getUser();
  if (!demo && !user) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
  const isAdmin = demo || !!user?.roles?.includes('admin');
  if (!isAdmin && !user?.roles?.includes('creator')) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  if (demo && request.method === 'GET') {
    try {
      const all = await readDemoTemplates();
      const showAll = new URL(request.url).searchParams.get('scope') === 'admin';
      const visible = all.filter((row) => showAll || row.is_published)
        .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
      return Response.json({ templates: visible, demo: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      // Manter a lista disponível mesmo em caso de falha temporária do Blobs.
      return Response.json({ templates: DEFAULT_DEMO_TEMPLATES, demo: true, storageWarning: true },
        { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  const db = demo ? null : getDatabase();
  if (request.method === 'GET') {
    const templates = isAdmin
      ? await db!.sql`SELECT id, slug, title, category, description, is_published, sort_order, version, template_definition
                     FROM fg_templates ORDER BY category, sort_order, title`
      : await db!.sql`SELECT id, slug, title, category, description, is_published, sort_order, version, template_definition
                     FROM fg_templates WHERE is_published = true ORDER BY category, sort_order, title`;
    return Response.json({ templates }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (demo && request.method === 'GET' && new URL(request.url).searchParams.has('versions')) {
    const id = new URL(request.url).searchParams.get('versions') ?? '';
    if(!/^[a-z0-9-]{2,90}$/.test(id))return Response.json({error:'ID inválido'},{status:400});
    const versions=await demoStore().get(versionKey(id),{type:'json'}) as DemoRow[]|null;
    return Response.json({ versions:versions??[] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!['PATCH','POST','DELETE'].includes(request.method)) return new Response('Método não permitido', { status: 405 });
  if (!isAdmin) return Response.json({ error: 'Somente administradores podem editar templates' }, { status: 403 });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Origem não permitida' }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object') return Response.json({ error: 'Dados inválidos' }, { status: 400 });
  const data = payload as Record<string, unknown>;
  if (demo && request.method === 'POST') {
    const sourceId=String(data.sourceId??'');
    const source=(await readDemoTemplates()).find(item=>item.id===sourceId);
    if(!source)return Response.json({error:'Modelo de origem não encontrado'}, {status:404});
    const duplicate:DemoRow={...source,id:'preset-'+crypto.randomUUID(),slug:'preset-'+Date.now(),
      title:('Cópia de '+source.title).slice(0,100),version:1,is_published:false,sort_order:source.sort_order+1};
    const all=await readDemoTemplates();
    await demoStore().setJSON('catalog',[...all,duplicate]);
    return Response.json({template:duplicate},{status:201});
  }
  if (demo && request.method === 'DELETE') {
    const id=String(data.id??'');
    if(!id.startsWith('preset-'))return Response.json({error:'Somente cópias podem ser excluídas; despublique modelos originais.'},{status:400});
    const all=await readDemoTemplates();
    const selected=all.find(item=>item.id===id);
    if(!selected)return Response.json({error:'Modelo não encontrado'},{status:404});
    await rememberVersion(selected);
    await demoStore().setJSON('catalog',all.filter(t=>t.id!==id));
    return Response.json({ok:true});
  }
  if(demo && request.method==='PATCH' && data.restore===true) {
    const id=String(data.id??'');
    const all=await readDemoTemplates();
    const index=all.findIndex(t=>t.id===id);
    if(index<0)return Response.json({error:'Modelo não encontrado'}, {status:404});
    const versions=await demoStore().get(versionKey(id),{type:'json'}) as DemoRow[]|null;
    if(!versions?.length)return Response.json({error:'Nenhuma versão anterior disponível'},{status:404});
    const restored={...versions[0],version:all[index].version+1};
    const next=[...all]; next[index]=restored;
    await demoStore().setJSON('catalog',next);
    await demoStore().setJSON(versionKey(id),versions.slice(1));
    return Response.json({template:restored});
  }
  if (typeof data.id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(data.id))
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 100)
    return Response.json({ error: 'Título inválido' }, { status: 400 });
  if (typeof data.category !== 'string' || !data.category.trim() || data.category.length > 60)
    return Response.json({ error: 'Categoria inválida' }, { status: 400 });
  if (typeof data.isPublished !== 'boolean')
    return Response.json({ error: 'Visibilidade inválida' }, { status: 400 });
  if (typeof data.sortOrder !== 'number' || !Number.isInteger(data.sortOrder) || data.sortOrder < 0 || data.sortOrder > 9999)
    return Response.json({ error: 'Posição inválida' }, { status: 400 });

  if (demo) {
    try {
      const current = await readDemoTemplates();
      const index = current.findIndex((row) => row.id === data.id);
      if (index < 0) return Response.json({ error: 'Modelo não encontrado' }, { status: 404 });
      const original = current[index];
      const changed: DemoRow = {
        ...original,
        title: data.title.trim(),
        category: data.category.trim(),
        is_published: data.isPublished,
        sort_order: data.sortOrder,
        version: original.version + 1,
      };
      const updated = [...current];
      updated[index] = changed;
      await rememberVersion(original);
      await demoStore().setJSON('catalog', updated);
      return Response.json({ template: changed, demo: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ error: 'Não foi possível salvar a versão de testes. Tente novamente.' }, { status: 503 });
    }
  }

  const rows = await db!.sql`
    UPDATE fg_templates
    SET title = ${data.title.trim()}, category = ${data.category.trim()},
        is_published = ${data.isPublished}, sort_order = ${data.sortOrder},
        version = version + 1, updated_at = now()
    WHERE id = ${data.id}
    RETURNING id, title, category, is_published, sort_order, version
  `;
  if (!rows.length) return Response.json({ error: 'Template não encontrado' }, { status: 404 });
  await db!.sql`
    INSERT INTO fg_audit_log (actor_id, action, resource_type, resource_id)
    VALUES (${user?.id ?? ''}, 'template.metadata.updated', 'template', ${data.id})
  `;
  return Response.json({ template: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
}
