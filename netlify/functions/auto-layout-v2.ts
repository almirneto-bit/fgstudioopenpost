import { getUser } from '@netlify/identity';
import type { Config, Context } from '@netlify/functions';
import backend from '../../api/auto-layout-v2';

// Exposição protegida do motor já existente; não cobra créditos Kie para visitantes anônimos.
export default async function autoLayout(request: Request, _context: Context) {
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const user = await getUser();
  if (!user) return Response.json({ error: 'Faça login para usar Auto Layout' }, { status: 401 });
  if (!user.roles.includes('admin') && !user.roles.includes('creator')) {
    return Response.json({ error: 'Sem permissão para usar Auto Layout' }, { status: 403 });
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Origem não permitida' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 800_000) return Response.json({ error: 'Prévia muito grande' }, { status: 413 });
  const response = await backend.fetch(request);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config: Config = { path: '/api/auto-layout-v2' };
