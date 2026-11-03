import { getUser } from '@netlify/identity';
import { getDeployStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { isV09PasswordOnlyPreview } from '../../lib/v09NetlifyPreview';

export type PsdSlot = {
  id: string;
  name: string;
  kind: 'text' | 'image';
  x: number; y: number; width: number; height: number;
  defaultText?: string;
  fontSize?: number;
  editable: boolean;
};
export type PsdRecord = {
  id: string; title: string; category: string;
  width: number; height: number;
  preview: string; background: string;
  slots: PsdSlot[];
  sourceName: string;
  layerCount: number;
  warnings: string[];
  published: boolean;
  createdAt: string; updatedAt: string;
};
type ListItem = Omit<PsdRecord, 'preview' | 'background'>;
const STORE = 'fgstudio-v09-demo-psd';
const recordKey = (id: string) => 'psd:' + id;
const idPattern = /^psd-[a-z0-9-]{8,90}$/i;
const responseHeaders = { 'Cache-Control': 'private, no-store' };

function toItem(x: PsdRecord): ListItem {
  const { preview: _preview, background: _background, ...rest } = x;
  return rest;
}
async function authorized(req: Request, context: Context, write: boolean): Promise<boolean> {
  if (isV09PasswordOnlyPreview(req, context)) return true;
  const user = await getUser();
  return !!user && (user.roles?.includes('admin') || (!write && user.roles?.includes('creator'))) || false;
}
async function listAll(): Promise<PsdRecord[]> {
  const store = getDeployStore(STORE);
  const results: PsdRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.list({ prefix: 'psd:', ...(cursor ? { cursor } : {}) });
    for (const entry of page.blobs) {
      const row = await store.get(entry.key, { type: 'json' }) as PsdRecord | null;
      if (row) results.push(row);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return results.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}

export default async function psdTemplates(request: Request, context: Context) {
  const demo = isV09PasswordOnlyPreview(request, context);
  const write = request.method !== 'GET';
  if (!(await authorized(request, context, write))) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });
  if (!demo) return Response.json({ error: 'Importação PSD em homologação; aguarde conexão com o banco de produção' }, { status: 501 });
  const store = getDeployStore(STORE);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      if (!idPattern.test(id)) return Response.json({ error: 'ID inválido' }, { status: 400 });
      const row = await store.get(recordKey(id), { type: 'json' }) as PsdRecord | null;
      if (!row) return Response.json({ error: 'Template inexistente' }, { status: 404 });
      if (!row.published && !url.searchParams.has('admin')) return Response.json({ error: 'Template não publicado' }, { status: 404 });
      return Response.json({ template: row }, { headers: responseHeaders });
    }
    const rows = await listAll();
    return Response.json({ templates: rows.filter(r => url.searchParams.has('admin') || r.published).map(toItem), demo: true }, { headers: responseHeaders });
  }
  if (!['POST','PATCH','DELETE'].includes(request.method)) return new Response('Método não permitido', { status: 405 });
  if (request.headers.get('origin') !== url.origin) return Response.json({ error: 'Origem não permitida' }, { status: 403 });
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id') ?? '';
    if (!idPattern.test(id)) return Response.json({ error: 'ID inválido' }, { status: 400 });
    await store.delete(recordKey(id));
    return Response.json({ ok: true });
  }
  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > 4_000_000) return Response.json({ error: 'Prévia muito grande. Reduza a resolução antes de importar.' }, { status: 413 });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(input.id ?? '');
  if (!idPattern.test(id)) return Response.json({ error: 'ID de PSD inválido' }, { status: 400 });
  if (request.method === 'PATCH') {
    const old = await store.get(recordKey(id), { type: 'json' }) as PsdRecord | null;
    if (!old) return Response.json({ error: 'Template não encontrado' }, { status: 404 });
    const updated: PsdRecord = { ...old, published: input.published === true, updatedAt: new Date().toISOString() };
    if (typeof input.title === 'string' && input.title.trim()) updated.title = input.title.trim().slice(0,100);
    if (typeof input.category === 'string' && input.category.trim()) updated.category = input.category.trim().slice(0,60);
    await store.setJSON(recordKey(id), updated);
    return Response.json({ template: toItem(updated) }, { headers: responseHeaders });
  }
  const title = String(input.title ?? '').trim();
  const category = String(input.category ?? '').trim();
  const preview = String(input.preview ?? '');
  const background = String(input.background ?? '');
  const width = Number(input.width);
  const height = Number(input.height);
  if (!title || title.length > 100 || !category || category.length > 60
     || width <= 0 || width > 8000 || height <= 0 || height > 8000
     || !/^data:image\/(jpeg|png);base64,/.test(preview)
     || !/^data:image\/(jpeg|png);base64,/.test(background)
     || preview.length > 1_800_000 || background.length > 1_800_000
     || !Array.isArray(input.slots) || input.slots.length > 150
     || typeof input.sourceName !== 'string' || input.sourceName.length > 260) {
    return Response.json({ error: 'Dados do template inválidos ou imagens muito grandes' }, { status: 400 });
  }
  const slots: PsdSlot[] = [];
  for (const raw of input.slots as unknown[]) {
    if (!raw || typeof raw !== 'object') return Response.json({ error: 'Camada inválida' }, { status: 400 });
    const entry = raw as Record<string, unknown>;
    const slot: PsdSlot = {
      id: String(entry.id ?? '').slice(0,100),
      name: String(entry.name ?? '').slice(0,140),
      kind: entry.kind === 'image' ? 'image' : 'text',
      x: Number(entry.x), y: Number(entry.y), width: Number(entry.width), height: Number(entry.height),
      defaultText: typeof entry.defaultText === 'string' ? entry.defaultText.slice(0,2000) : '',
      fontSize: typeof entry.fontSize === 'number' ? entry.fontSize : 48,
      editable: entry.editable === true,
    };
    if ([slot.x,slot.y,slot.width,slot.height].some(v => !Number.isFinite(v)) || slot.width < 0 || slot.height < 0)
      return Response.json({ error: 'Coordenadas de camada inválidas' }, { status: 400 });
    slots.push(slot);
  }
  const existing = await store.get(recordKey(id), { type: 'json' });
  if (existing) return Response.json({ error: 'Identificador já utilizado' }, { status: 409 });
  const createdAt = new Date().toISOString();
  const value: PsdRecord = {
    id, title, category, width, height, preview, background, slots,
    sourceName: String(input.sourceName),
    layerCount: Math.max(0,Number(input.layerCount ?? slots.length)),
    warnings: Array.isArray(input.warnings) ? input.warnings.filter((v):v is string=>typeof v==='string').slice(0,20) : [],
    published: input.published === true,
    createdAt, updatedAt: createdAt,
  };
  await store.setJSON(recordKey(id), value);
  return Response.json({ template: toItem(value), demo: true }, { status: 201, headers: responseHeaders });
}
