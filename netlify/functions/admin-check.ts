import { getUser } from '@netlify/identity';
import type { Context } from '@netlify/functions';

// As operações administrativas futuras devem replicar esta checagem NO SERVIDOR.
// Esconder botões não constitui controle de acesso.
export default async function adminCheck(_request: Request, _context: Context) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
  if (!user.roles.includes('admin')) return Response.json({ error: 'Acesso negado' }, { status: 403 });
  return Response.json({ ok: true, role: 'admin' }, { headers: { 'Cache-Control': 'no-store' } });
}
