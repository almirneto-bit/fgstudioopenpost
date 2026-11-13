'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deletePsdTemplate, listPsdTemplates, savePsdTemplate, TEMPLATE_PILLARS, type PsdLayerOption, type PsdTemplateRecord, type TemplatePillar } from '@/lib/psdTemplateLibrary';

type PsdNode = { name?:string; hidden?:boolean; opacity?:number; left?:number; top?:number; canvas?:HTMLCanvasElement; children?:PsdNode[] };
type PsdDoc = { width:number; height:number; children?:PsdNode[] };
function flatten(nodes:PsdNode[],result:PsdNode[]=[]):PsdNode[] {
  for(const node of nodes) { if(node.children) flatten(node.children,result); if(node.canvas) result.push(node); }
  return result;
}
async function readDocument(blob:Blob):Promise<PsdDoc> {
  const {readPsd}=await import('ag-psd');
  return readPsd(await blob.arrayBuffer(),{ skipCompositeImageData:true }) as unknown as PsdDoc;
}
function paint(doc:PsdDoc, layers:PsdLayerOption[]):string {
  const flat=flatten(doc.children??[]);
  const canvas=document.createElement('canvas');
  const ratio=Math.min(1,720/Math.max(doc.width,doc.height));
  canvas.width=Math.max(1,Math.round(doc.width*ratio));canvas.height=Math.max(1,Math.round(doc.height*ratio));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas indisponível.');
  ctx.scale(ratio,ratio);
  // PSD layers are stored from front to back; draw from back to front.
  for(let i=flat.length-1;i>=0;i--){
    const node=flat[i], option=layers[i];
    if(!node.canvas||!option?.visible)continue;
    ctx.globalAlpha=option.opacity/100;
    ctx.drawImage(node.canvas,node.left??0,node.top??0);
  }
  ctx.globalAlpha=1;
  return canvas.toDataURL('image/png');
}
export default function PsdTemplateManager(){
  const [items,setItems]=useState<PsdTemplateRecord[]>([]);
  const [active,setActive]=useState<PsdTemplateRecord|null>(null);
  const [doc,setDoc]=useState<PsdDoc|null>(null);
  const [preview,setPreview]=useState('');
  const [filter,setFilter]=useState<TemplatePillar|'todos'>('todos');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const refresh=useCallback(async()=>setItems(await listPsdTemplates()),[]);
  useEffect(()=>{void refresh().catch(()=>setError('Não foi possível abrir a biblioteca local.'));},[refresh]);
  const open=async(item:PsdTemplateRecord)=>{
    setBusy(true);setError('');
    try {const parsed=await readDocument(item.source);setDoc(parsed);setActive(item);setPreview(paint(parsed,item.layerOptions));}
    catch {setError('O PSD usa recursos não compatíveis com a leitura no navegador.');}
    finally {setBusy(false);}
  };
  const importFile=async(file?:File)=>{
    if(!file)return;
    if(!/\.psd$/i.test(file.name)){setError('Selecione um arquivo .psd.');return;}
    setBusy(true);setError('');
    try {
      const parsed=await readDocument(file);
      const nodes=flatten(parsed.children??[]);
      if(!nodes.length)throw new Error('Não foram encontradas camadas rasterizáveis.');
      const layerOptions=nodes.map((node,i)=>({id:i,name:node.name||'Camada '+(i+1),visible:!node.hidden,opacity:Math.round((node.opacity??255)/255*100)}));
      const item:PsdTemplateRecord={id:crypto.randomUUID(),name:file.name.replace(/\.psd$/i,''),pillar:'competitivo',updatedAt:Date.now(),source:file,layerOptions,preview:paint(parsed,layerOptions)};
      await savePsdTemplate(item);await refresh();setDoc(parsed);setActive(item);setPreview(item.preview);
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível importar o PSD.');}
    finally{setBusy(false);if(inputRef.current)inputRef.current.value='';}
  };
  const update=(patch:Partial<PsdTemplateRecord>)=>{
    if(!active)return;
    const next={...active,...patch,updatedAt:Date.now()};
    setActive(next);
    if(doc&&patch.layerOptions)setPreview(paint(doc,next.layerOptions));
  };
  const persist=async()=>{
    if(!active)return;
    setBusy(true);setError('');
    try{const next={...active,preview,updatedAt:Date.now()};await savePsdTemplate(next);setActive(next);await refresh();}
    catch{setError('Não foi possível salvar. Verifique o espaço disponível no navegador.');}
    finally{setBusy(false);}
  };
  const remove=async(item:PsdTemplateRecord)=>{
    if(!window.confirm('Excluir este template deste navegador?'))return;
    await deletePsdTemplate(item.id);if(active?.id===item.id){setActive(null);setDoc(null);setPreview('');}await refresh();
  };
  return <div className="psd-admin">
    <header className="psd-admin-header"><div><a href="/">← Voltar ao Post Editor</a><span>FG / STUDIO</span><h1>Biblioteca de templates</h1><p>PSD em camadas · edição não destrutiva · organização por pilar</p></div><label className="psd-upload">+ Importar PSD<input ref={inputRef} type="file" accept=".psd,image/vnd.adobe.photoshop" onChange={e=>void importFile(e.target.files?.[0])} hidden /></label></header>
    {error&&<p className="psd-error" role="alert">{error}</p>}
    {busy&&<p role="status">Processando arquivo…</p>}
    <div className="psd-admin-columns">
      <section className="psd-library"><div className="psd-pillars">{(['todos',...TEMPLATE_PILLARS] as const).map(p=><button key={p} className={filter===p?'active':''} onClick={()=>setFilter(p)}>{p}</button>)}</div>
        <div className="psd-cards">{items.filter(item=>filter==='todos'||item.pillar===filter).map(item=><button key={item.id} className={'psd-card '+(active?.id===item.id?'selected':'')} onClick={()=>void open(item)}><img src={item.preview} alt="" /><strong>{item.name}</strong><small>{item.pillar} · {item.layerOptions.length} camadas</small></button>)}</div>
        {!items.length&&<p className="psd-empty">Importe seu primeiro PSD para criar um template. Os arquivos ficam armazenados localmente neste navegador.</p>}
      </section>
      <section className="psd-inspector">{active?<><div className="psd-inspector-head"><h2>Editar template</h2><button onClick={()=>void remove(active)}>Excluir</button></div><label>Nome<input value={active.name} onChange={e=>update({name:e.target.value})}/></label><label>Pilar<select value={active.pillar} onChange={e=>update({pillar:e.target.value as TemplatePillar})}>{TEMPLATE_PILLARS.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
        <div className="psd-preview"><img src={preview} alt={'Prévia do template '+active.name}/></div>
        <h3>Camadas <small>Visibilidade e opacidade</small></h3>
        <div className="psd-layers">{active.layerOptions.map((layer,i)=><div className="psd-layer" key={layer.id}><label><input type="checkbox" checked={layer.visible} onChange={e=>update({layerOptions:active.layerOptions.map((l,j)=>j===i?{...l,visible:e.target.checked}:l)})}/>{layer.name}</label><div><input type="range" min="0" max="100" value={layer.opacity} aria-label={'Opacidade de '+layer.name} onChange={e=>update({layerOptions:active.layerOptions.map((l,j)=>j===i?{...l,opacity:Number(e.target.value)}:l)})}/><output>{layer.opacity}%</output></div></div>)}</div>
        <button className="psd-save" disabled={busy} onClick={()=>void persist()}>Salvar alterações</button><p className="psd-note">O PSD original permanece preservado. A prévia é uma composição rasterizada; blend modes, textos e smart objects complexos podem não reproduzir exatamente o Photoshop.</p>
      </>:<div className="psd-empty">Selecione um template para ajustar suas camadas e classificá-lo.</div>}</section>
    </div>
  </div>;
}
