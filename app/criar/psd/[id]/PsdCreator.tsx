'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
type Slot = {
  id:string; name:string; kind:'text'|'image'; x:number; y:number; width:number; height:number;
  defaultText?:string; fontSize?:number; fontFamily?:string; color?:string; editable:boolean;
};
type Template = {
  id:string; title:string; width:number;height:number;
  background:string; preview:string; slots:Slot[];
  sourceName:string; warnings:string[];
};
type Values = Record<string,string>;

function wrapText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number):string[] {
  const lines:string[]=[];
  for(const paragraph of text.split(/\n/)){
    let current='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      const next=current?current+' '+word:word;
      if(ctx.measureText(next).width>maxWidth&&current){lines.push(current);current=word;}
      else current=next;
    }
    lines.push(current);
  }
  return lines;
}
function track(templateId:string,format:string){
  void fetch('/.netlify/functions/demo-activity',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'export',templateId,format,projectName:'PSD · '+templateId,slideCount:1}),
  }).catch(()=>{});
}

export default function PsdCreator({id}:{id:string}){
  const [template,setTemplate]=useState<Template|null>(null);
  const [values,setValues]=useState<Values>({});
  const [images,setImages]=useState<Record<string,string>>({});
  const [original,setOriginal]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{
    let active=true;
    fetch('/.netlify/functions/psd-templates?id='+encodeURIComponent(id),{cache:'no-store'})
      .then(async r=>{if(!r.ok)throw new Error('O PSD não está publicado ou não foi encontrado.');return r.json() as Promise<{template:Template}>;})
      .then(r=>{
        if(!active)return;
        setTemplate(r.template);
        setValues(Object.fromEntries(r.template.slots.filter(s=>s.kind==='text').map(s=>[s.id,s.defaultText??''])));
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao abrir PSD.')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[id]);

  const draw=useCallback(async()=>{
    const canvas=canvasRef.current;
    if(!canvas||!template)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    canvas.width=template.width;canvas.height=template.height;
    const base=new Image();
    base.src=original?template.preview:template.background;
    await base.decode();
    ctx.drawImage(base,0,0,canvas.width,canvas.height);
    if(original)return;
    for(const slot of template.slots.filter(s=>s.editable)){
      if(slot.kind==='image'){
        const source=images[slot.id];
        if(!source)continue;
        const photo=new Image();photo.src=source;
        try{await photo.decode();}catch{continue;}
        ctx.save();ctx.beginPath();ctx.rect(slot.x,slot.y,slot.width,slot.height);ctx.clip();
        const scale=Math.max(slot.width/photo.width,slot.height/photo.height);
        const w=photo.width*scale,h=photo.height*scale;
        ctx.drawImage(photo,slot.x+(slot.width-w)/2,slot.y+(slot.height-h)/2,w,h);
        ctx.restore();
      }else{
        const text=values[slot.id]??'';
        if(!text.trim())continue;
        ctx.save();
        const fontSize=Math.max(12,Math.min(280,slot.fontSize??48));
        ctx.font=`${fontSize}px ${slot.fontFamily ? JSON.stringify(slot.fontFamily) : '"Kanit"'}`;
        ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=slot.color??'#FFFFFF';
        const lines=wrapText(ctx,text,Math.max(40,slot.width));
        const lineHeight=fontSize*1.02;
        const count=Math.min(lines.length,Math.max(1,Math.floor(Math.max(slot.height,40)/lineHeight)));
        for(let i=0;i<count;i++)ctx.fillText(lines[i],slot.x,slot.y+i*lineHeight,Math.max(slot.width,40));
        ctx.restore();
      }
    }
  },[template,values,images,original]);
  useEffect(()=>{void draw().catch(()=>setError('Não foi possível renderizar a composição.'));},[draw]);

  async function loadImage(file:File,id:string){
    if(file.size>20*1024*1024){setError('Imagem muito grande. Máximo de 20 MB.');return;}
    const data=await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Falha ao carregar imagem'));reader.readAsDataURL(file);
    });
    setImages(v=>({...v,[id]:data}));
  }
  async function download(){
    const canvas=canvasRef.current;if(!canvas||!template)return;
    if(original){setOriginal(false);await new Promise(resolve=>setTimeout(resolve,200));}
    await draw();
    canvas.toBlob(blob=>{
      if(!blob){setError('Não foi possível exportar PNG.');return;}
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;
      a.download=template.title.toLowerCase().replace(/[^a-z0-9]+/gi,'-')+'.png';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      track(template.id,'png');
    },'image/png');
  }
  return <div className="fl-shell">
    <header className="fl-topbar">
      <div><div className="fl-eyebrow">Final Level Co. / PSD Studio</div><strong>{template?.title??'Abrindo modelo...'}</strong></div>
      <a href="/criar" className="fl-nav-back">← Voltar ao editor</a>
    </header>
    <main className="fl-main">
      {loading?<p>Carregando camadas do PSD…</p>:error&&!template?<p role="alert">{error}</p>:null}
      {template&&<div className="fl-psd-creator-grid">
        <section className="fl-panel">
          <h1 style={{fontSize:23,margin:'0 0 16px'}}>Personalizar conteúdo</h1>
          <p className="fl-muted">Somente as camadas liberadas pelo administrador podem ser alteradas.</p>
          {template.slots.filter(s=>s.editable).map(slot=><label key={slot.id} style={{display:'grid',gap:7,marginTop:14}}>
            <strong style={{fontSize:13}}>{slot.name}</strong>
            {slot.kind==='text'?
              <textarea className="fl-input" rows={3} value={values[slot.id]??''} onChange={e=>setValues(old=>({...old,[slot.id]:e.target.value}))}/>:
              <input type="file" accept="image/*" className="fl-input" onChange={e=>{const f=e.target.files?.[0];if(f)void loadImage(f,slot.id);}}/>
            }
          </label>)}
          {template.slots.filter(s=>s.editable).length===0&&<p className="fl-muted">Nenhuma camada editável foi selecionada neste template.</p>}
          <label style={{display:'flex',alignItems:'center',gap:9,marginTop:20,fontSize:13}}>
            <input type="checkbox" checked={original} onChange={e=>setOriginal(e.target.checked)}/> Comparar com o composite original
          </label>
          <button className="fl-button" type="button" onClick={()=>void download()} style={{marginTop:18,width:'100%'}}>Exportar PNG</button>
          <p className="fl-muted" style={{fontSize:12,marginTop:15}}>Importador PSD beta: fontes e efeitos especiais podem apresentar diferenças. Compare sempre com o PSD original.</p>
          {error&&<p role="alert" style={{color:'#C0262D'}}>{error}</p>}
        </section>
        <section className="fl-panel">
          <div className="fl-eyebrow">Prévia em canvas · {template.width} × {template.height}</div>
          <canvas ref={canvasRef} className="fl-psd-livecanvas" aria-label="Prévia do template PSD editado"/>
        </section>
      </div>}
    </main>
  </div>;
}
