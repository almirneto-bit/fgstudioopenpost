export type TemplatePillar = 'competitivo' | 'educacional' | 'sociocultural' | 'institucional';
export const TEMPLATE_PILLARS: TemplatePillar[] = ['competitivo','educacional','sociocultural','institucional'];
export type PsdLayerOption = { id: number; name: string; visible: boolean; opacity: number };
export type PsdTemplateRecord = {
  id: string; name: string; pillar: TemplatePillar; updatedAt: number;
  preview: string; layerOptions: PsdLayerOption[]; source: Blob;
};
const DB_NAME = 'fg-post-studio-psd-library-v1';
const STORE = 'templates';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result);
  });
}
async function transaction<T>(mode:IDBTransactionMode, callback:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const request=callback(tx.objectStore(STORE));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export async function listPsdTemplates():Promise<PsdTemplateRecord[]> {
  const records=await transaction<PsdTemplateRecord[]>('readonly',store=>store.getAll());
  return records.sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function savePsdTemplate(record:PsdTemplateRecord) {
  return transaction<IDBValidKey>('readwrite',store=>store.put(record));
}
export function deletePsdTemplate(id:string) {
  return transaction<undefined>('readwrite',store=>store.delete(id));
}
export async function loadPsdTemplate(id:string):Promise<PsdTemplateRecord|undefined> {
  return transaction<PsdTemplateRecord|undefined>('readonly',store=>store.get(id));
}
