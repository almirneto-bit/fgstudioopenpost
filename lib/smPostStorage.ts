import type { SmPostFields, SmPostLayoutId } from './smPostTemplate';
import { createDefaultFields } from './smPostTemplate';

export type SmPostSlide = { id: string; fields: SmPostFields };

export type SmPostProject = {
  id: string;
  name: string;
  slides: SmPostSlide[];
  activeSlideId: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'fg-post-studio';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
export const ACTIVE_PROJECT_KEY = 'fg-post-studio-active-project';

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createSlide(layoutId: SmPostLayoutId = 'classic'): SmPostSlide {
  return { id: makeId('slide'), fields: createDefaultFields(layoutId) };
}

export function createProject(): SmPostProject {
  const now = Date.now();
  const slide = createSlide();
  return {
    id: makeId('project'),
    name: `Criação ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now)}`,
    slides: [slide],
    activeSlideId: slide.id,
    createdAt: now,
    updatedAt: now,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o histórico local.'));
  });
}

export async function listProjects(): Promise<SmPostProject[]> {
  const db = await openDb();
  try {
    const projects = await new Promise<SmPostProject[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as SmPostProject[]);
      request.onerror = () => reject(request.error);
    });
    return projects.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  } finally {
    db.close();
  }
}

export async function getProject(id: string): Promise<SmPostProject | null> {
  const db = await openDb();
  try {
    return await new Promise<SmPostProject | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as SmPostProject | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveProject(project: SmPostProject): Promise<SmPostProject[]> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    const projects = await new Promise<SmPostProject[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as SmPostProject[]);
      request.onerror = () => reject(request.error);
    });
    const ordered = projects.sort((a, b) => b.updatedAt - a.updatedAt);
    const stale = ordered.slice(5);

    if (stale.length) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        stale.forEach((item) => store.delete(item.id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }

    return ordered.slice(0, 5);
  } finally {
    db.close();
  }
}
