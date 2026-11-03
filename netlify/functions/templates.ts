import { getUser } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import type { Context } from '@netlify/functions';

// O administrador controla rótulos, categorias e visibilidade.
// O renderer original permanece intacto nesta fase.
export default async function templates(request: Request, _context: Context) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
  const isAdmin = user.roles?.includes('admin');
  if (!isAdmin && !user.roles?.includes('creator')) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const db = getDatabase();
  if (request.method === 'GET') {
    const templates = isAdmin
      ? await db.sql`SELECT id, slug, title, category, description, is_published, sort_order, version, template_definition
                     FROM fg_templates ORDER BY category, sort_order, title`
      : await db.sql`SELECT id, slug, title, category, description, is_published, sort_order, version, template_definition
                     FROM fg_templates WHERE is_published = true ORDER BY category, sort_order, title`;
    return Response.json({ templates }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method !== 'PATCH') return new Response('Método não permitido', { status: 405 });
  if (!isAdmin) return Response.json({ error: 'Somente administradores podem editar templates' }, { status: 403 });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Origem não permitida' }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object') return Response.json({ error: 'Dados inválidos' }, { status: 400 });
  const data = payload as Record<string, unknown>;
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

  const rows = await db.sql`
    UPDATE fg_templates
    SET title = ${data.title.trim()}, category = ${data.category.trim()},
        is_published = ${data.isPublished}, sort_order = ${data.sortOrder},
        version = version + 1, updated_at = now()
    WHERE id = ${data.id}
    RETURNING id, title, category, is_published, sort_order, version
  `;
  if (!rows.length) return Response.json({ error: 'Template não encontrado' }, { status: 404 });
  await db.sql`
    INSERT INTO fg_audit_log (actor_id, action, resource_type, resource_id)
    VALUES (${user.id}, 'template.metadata.updated', 'template', ${data.id})
  `;
  return Response.json({ template: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
}
