'use client';

import { useEffect, useState } from 'react';
import { readPsd, getCompositeCanvas, getLayerCanvas } from 'ag-psd';

type LayerEntry = {
  id: string; name: string; kind: 'text' | 'image';
  x: number; y: number; width: number; height: number;
  defaultText: string; fontSize: number; fontFamily?: string; color?: string;
  editable: boolean;
};
type LayerLike = {
  name?: string; children?: LayerLike[]; hidden?: boolean;
  text?: { text?: string; style?: { fontSize?: number; font?: { name?: string }; fillColor?: { r: number; g: number; b: number } } };
  left?: number; top?: number; right?: number; bottom?: number; opacity?: number;
  canvas?: HTMLCanvasElement;
};
type PsdDocument = { width: number; height: number; children?: LayerLike[] };
type PsdListItem = { id: string; title: string; category: string; sourceName: string;
  layerCount: number; slots: LayerEntry[]; published: boolean; createdAt: string; warnings: string[] };
type Imported = {
  name: string; width: number; height: number; layers: LayerEntry[]; source: PsdDocument;
  originalPreview: string; warnings: string[];
};

const readFileAsImage = (canvas: HTMLCanvasElement, maxWidth = 1080, quality = .70) => {
  const scale = Math.min(1, maxWidth / canvas.width, 1400 / canvas.height);
  const output = document.createElement('canvas');
  output.width = Math.round(canvas.width * scale);
  output.height = Math.round(canvas.height * scale);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não permite visualizar o PSD.');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,output.width,output.height);
  ctx.drawImage(canvas,0,0,output.width,output.height);
  return output.toDataURL('image/jpeg',quality);
};
function collectLayers(layers: LayerLike[], prefix = ''): LayerEntry[] {
  const items: LayerEntry[] = [];
  layers.forEach((layer,i)=>{
    const path = prefix ? prefix + '.' + i : String(i);
    if (layer.children?.length) { items.push(...collectLayers(layer.children,path)); return; }
    const name = layer.name || 'Camada ' + path;
    const isText = typeof layer.text?.text === 'string';
    const kind: LayerEntry['kind'] = isText ? 'text' : 'image';
    const x = Number(layer.left ?? 0), y = Number(layer.top ?? 0);
    const width = Math.max(1,Number(layer.right ?? x+100)-x);
    const height = Math.max(1,Number(layer.bottom ?? y+60)-y);
    const fontSize = Number(layer.text?.style?.fontSize ?? 48);
    items.push({
      id:path,name,kind,x,y,width,height,defaultText:layer.text?.text ?? '',
      fontSize:Number.isFinite(fontSize)?fontSize:48,
      fontFamily:layer.text?.style?.font?.name,
      editable:isText || /(substitu|imagem|foto|image|photo|placeholder|smart|mídia|media)/i.test(name),
    });
  });
  return items;
}
function createBackground(doc: PsdDocument, editable: Set<string>): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width=doc.width; canvas.height=doc.height;
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Canvas indisponível.');
  // Combina as camadas não-editáveis em ordem inferior -> superior.
  function draw(layers:LayerLike[],prefix=''){
    for(let i=layers.length-1;i>=0;i--){
      const layer=layers[i];
      if(layer.hidden)continue;
      const id=prefix?prefix+'.'+i:String(i);
      if(layer.children?.length){draw(layer.children,id);continue;}
      if(editable.has(id))continue;
      const bitmap=layer.canvas ?? getLayerCanvas(layer as Parameters<typeof getLayerCanvas>[0]) as HTMLCanvasElement | undefined;
      if(!bitmap)continue;
      ctx.save();
      ctx.globalAlpha=Math.max(0,Math.min(1,layer.opacity ?? 1));
      ctx.drawImage(bitmap,layer.left??0,layer.top??0);
      ctx.restore();
    }
  }
  draw(doc.children??[]);
  return canvas;
}

export default function PsdImport() {
  const [current,setCurrent]=useState<Imported|null>(null);
  const [title,setTitle]=useState('');
  const [category,setCategory]=useState('Institucional');
  const [library,setLibrary]=useState<PsdListItem[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function refresh() {
    try {
      const r=await fetch('/.netlify/functions/psd-templates?admin=1',{cache:'no-store'});
      if(!r.ok)throw new Error('A biblioteca PSD não está disponível.');
      const j=await r.json() as { templates:PsdListItem[] };
      setLibrary(j.templates??[]);
    } catch(e) { setError(e instanceof Error?e.message:'Erro ao carregar PSDs.'); }
  }
  useEffect(()=>{ void refresh(); },[]);

  async function analyze(file:File) {
    if(!/\.psd$/i.test(file.name))throw new Error('Selecione um arquivo com extensão .psd.');
    if(file.size>120*1024*1024)throw new Error('PSD acima de 120 MB: reduza antes de importar.');
    setError('');setMessage('Lendo camadas do PSD…');setLoading(true);
    try {
      const input=await file.arrayBuffer();
      const parsed=readPsd(input,{skipThumbnail:true,skipLinkedFilesData:true});
      const doc=parsed as unknown as PsdDocument;
      if(!doc.width||!doc.height||doc.width>8000||doc.height>8000)throw new Error('Dimensões inválidas ou muito grandes.');
      const layers=collectLayers(doc.children??[]);
      const composite=getCompositeCanvas(parsed) as HTMLCanvasElement|undefined;
      const image=composite??createBackground(doc,new Set());
      const originalPreview=readFileAsImage(image,1080,.70);
      const warnings:string[]=[
        'Efeitos complexos, máscaras, fontes e smart objects precisam de comparação visual com o PSD original.',
        'O arquivo PSD original fica no seu computador; a ferramenta armazena a prévia e a composição rasterizada para edição.',
      ];
      if(!layers.some(l=>l.kind==='text')) warnings.push('Não foram identificadas camadas de texto editáveis.');
      setCurrent({name:file.name,width:doc.width,height:doc.height,layers,source:doc,originalPreview,warnings});
      setTitle(file.name.replace(/\.psd$/i,'').replace(/[_-]/g,' ').slice(0,95));
      setMessage(`PSD analisado: ${layers.length} camadas identificadas. Escolha quais elementos liberar.`);
    }catch(e){
      setError(e instanceof Error?e.message:'Falha ao interpretar o PSD.');
      setCurrent(null);
    }finally{setLoading(false)}
  }

  function toggle(id:string){
    setCurrent(old=>old?{...old,layers:old.layers.map(l=>l.id===id?{...l,editable:!l.editable}:l)}:old);
  }
  async function publishImport() {
    if(!current||!title.trim()||!category.trim())return;
    setLoading(true);setError('');setMessage('Preparando camadas e enviando a prévia…');
    try{
      const editable=new Set(current.layers.filter(l=>l.editable).map(l=>l.id));
      const background=readFileAsImage(createBackground(current.source,editable),1080,.65);
      if(background.length>1_800_000||current.originalPreview.length>1_800_000)
        throw new Error('A prévia excedeu 1,8 MB. Reduza a complexidade do PSD.');
      const thumbnail = readFileAsImage(getCompositeCanvas(current.source as Parameters<typeof getCompositeCanvas>[0]) as HTMLCanvasElement ?? createBackground(current.source,new Set()),240,.52);
      const record={
        thumbnail,id:'psd-'+crypto.randomUUID(),title:title.trim(),category:category.trim(),
        width:current.width,height:current.height,sourceName:current.name,
        layerCount:current.layers.length,preview:current.originalPreview,background,
        slots:current.layers.filter(l=>l.editable),warnings:current.warnings,published:false,
      };
      const response=await fetch('/.netlify/functions/psd-templates',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record),
      });
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Falha ao salvar PSD.');
      setMessage('PSD importado como rascunho. Publique na biblioteca abaixo após conferir a composição.');
      setCurrent(null);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível importar.')}
    finally{setLoading(false)}
  }
  async function patch(item:PsdListItem,published:boolean) {
    setLoading(true);setError('');
    try{
      const r=await fetch('/.netlify/functions/psd-templates',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:item.id,published}),
      });
      if(!r.ok)throw new Error('Não foi possível atualizar a publicação.');
      await refresh();
      setMessage(published?'PSD publicado para os criadores.':'PSD retirado da biblioteca pública.');
    }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.')}
    finally{setLoading(false)}
  }
  async function deleteItem(id:string){
    if(!confirm('Apagar este PSD apenas da biblioteca de testes?'))return;
    setLoading(true);setError('');
    try{
      const r=await fetch('/.netlify/functions/psd-templates?id='+encodeURIComponent(id),{method:'DELETE'});
      if(!r.ok)throw new Error('Falha ao excluir.');
      await refresh();setMessage('PSD excluído da biblioteca de testes.');
    }catch(e){setError(e instanceof Error?e.message:'Falha ao excluir.')}
    finally{setLoading(false)}
  }
  return <div style={{display:'grid',gap:20}}>
    <section className="fl-panel">
      <p className="fl-eyebrow">Importer PSD · Beta</p>
      <h2 style={{fontSize:23,margin:'7px 0 8px'}}>Importar e mapear camadas</h2>
      <p className="fl-muted">Envie o PSD; identifique textos e imagens editáveis antes de liberar o template para a equipe.</p>
      <input type="file" accept=".psd,image/vnd.adobe.photoshop" className="fl-input" disabled={loading}
        onChange={e=>{const file=e.target.files?.[0];if(file)void analyze(file);}} />
      {current&&<div className="fl-psd-inspector">
        <div>
          {/* A imagem abaixo é uma prévia do composite original para comparação. */}
          <img src={current.originalPreview} alt="Prévia composta do PSD original" className="fl-psd-preview" />
          <p className="fl-muted" style={{fontSize:12}}>{current.width} × {current.height} px · {current.layers.length} camadas</p>
          {current.warnings.map((warning,i)=><p key={i} style={{color:'#8A5A00',fontSize:12}}>⚠ {warning}</p>)}
        </div>
        <div style={{display:'grid',alignContent:'start',gap:12}}>
          <label>Nome do template<input className="fl-input" value={title} onChange={e=>setTitle(e.target.value)}/></label>
          <label>Categoria<input className="fl-input" value={category} onChange={e=>setCategory(e.target.value)}/></label>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <strong>Camadas editáveis</strong>
            <small className="fl-muted">{current.layers.filter(l=>l.editable).length} selecionadas</small>
          </div>
          <div className="fl-psd-layer-list">
            {current.layers.map(layer=><label key={layer.id} className="fl-psd-layer">
              <input type="checkbox" checked={layer.editable} onChange={()=>toggle(layer.id)} />
              <span><strong>{layer.name}</strong><small>{layer.kind==='text'?'Texto':'Imagem'} · {Math.round(layer.width)}×{Math.round(layer.height)}</small></span>
            </label>)}
          </div>
          <button type="button" className="fl-button" onClick={()=>void publishImport()} disabled={loading||!title.trim()}>
            Salvar PSD como rascunho
          </button>
        </div>
      </div>}
      {error&&<p role="alert" style={{color:'#C0262D'}}>{error}</p>}
      {message&&<p role="status" className="fl-muted">{message}</p>}
    </section>
    <section className="fl-panel">
      <h2 style={{fontSize:21,margin:'0 0 10px'}}>Biblioteca de PSDs</h2>
      <p className="fl-muted">Arquivos importados neste deploy de teste. Publique para liberar no editor de criação.</p>
      {library.length===0?<p className="fl-muted">Nenhum PSD importado ainda.</p>:<div className="fl-psd-library">
        {library.map(item=><div key={item.id} className="fl-psd-library-item">
          <div style={{flex:1,minWidth:0}}><strong>{item.title}</strong>
            <p className="fl-muted" style={{margin:'5px 0',fontSize:12}}>{item.category} · {item.layerCount} camadas · {item.slots.filter(x=>x.editable).length} campos editáveis</p>
            <small>{item.published?'Publicado':'Rascunho'}</small>
          </div>
          <a className="fl-nav-back" href={'/criar/psd/'+item.id}>Prévia</a>
          <button className="fl-button" type="button" disabled={loading} onClick={()=>void patch(item,!item.published)}>{item.published?'Despublicar':'Publicar'}</button>
          <button className="fl-nav-back" type="button" disabled={loading} onClick={()=>void deleteItem(item.id)}>Excluir</button>
        </div>)}
      </div>}
    </section>
  </div>;
}
