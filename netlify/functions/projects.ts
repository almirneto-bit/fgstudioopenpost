import { getUser } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import type { Context } from '@netlify/functions';

// V09 API: todos os acessos ao PostgreSQL são verificados no servidor.
// Nenhuma conexão PostgreSQL ou chave administrativa deve ir ao navegador.
export default async function projects(request: Request, _context: Context) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
  const isAdmin = user.roles.includes('admin');
  if (!isAdmin && !user.roles.includes('creator')) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const db = getDatabase();
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const result = isAdmin
      ? await db.sql`SELECT id, owner_id, name, slides, active_slide_id, created_at, updated_at
                     FROM fg_projects ORDER BY updated_at DESC LIMIT 100`
      : await db.sql`SELECT id, owner_id, name, slides, active_slide_id, created_at, updated_at
                     FROM fg_projects WHERE owner_id = ${user.id}
                     ORDER BY updated_at DESC LIMIT 100`;
    return Response.json({ projects: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  // Requisições que alteram dados exigem origem da aplicação.
  if (!['POST', 'DELETE'].includes(request.method)) return new Response('Método não permitido', { status: 405 });
  if (request.headers.get('origin') !== url.origin) return Response.json({ error: 'Origem não permitida' }, { status: 403 });

  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id') ?? '';
    if (!/^project-[a-zA-Z0-9-]{12,80}$/.test(id)) return Response.json({ error: 'ID inválido' }, { status: 400 });
    const rows = isAdmin
      ? await db.sql`DELETE FROM fg_projects WHERE id = ${id} RETURNING id`
      : await db.sql`DELETE FROM fg_projects WHERE id = ${id} AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return Response.json({ error: 'Projeto não encontrado ou sem permissão' }, { status: 404 });
    return Response.json({ deleted: id });
  }

  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object') return Response.json({ error: 'Projeto inválido' }, { status: 400 });
  const data = payload as Record<string, unknown>;
  if (typeof data.id !== 'string' || !/^project-[a-zA-Z0-9-]{12,80}$/.test(data.id))
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 160)
    return Response.json({ error: 'Nome inválido' }, { status: 400 });
  if (!Array.isArray(data.slides) || data.slides.length < 1 || data.slides.length > 100)
    return Response.json({ error: 'Quantidade de lâminas inválida' }, { status: 400 });
  const slides = JSON.stringify(data.slides);
  if (slides.length > 3_000_000 || slides.includes('data:video/') || slides.includes('data:image/'))
    return Response.json({ error: 'Envie as mídias ao armazenamento antes de salvar o projeto' }, { status: 413 });
  const activeId = typeof data.activeSlideId === 'string' ? data.activeSlideId : null;

  const result = await db.sql`
    INSERT INTO fg_projects (id, owner_id, name, slides, active_slide_id)
    VALUES (${data.id}, ${user.id}, ${data.name.trim()}, ${slides}::jsonb, ${activeId})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, slides = EXCLUDED.slides,
      active_slide_id = EXCLUDED.active_slide_id,
      updated_at = now()
    WHERE fg_projects.owner_id = ${user.id} OR ${isAdmin}
    RETURNING id
  `;
  if (!result.length) return Response.json({ error: 'Não é possível alterar projeto de outra conta' }, { status: 403 });
  return Response.json({ id: data.id }, { headers: { 'Cache-Control': 'no-store' } });
}
