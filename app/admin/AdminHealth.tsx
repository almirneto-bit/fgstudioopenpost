'use client';
import {useState} from 'react';
type Health = {
  mode:string;database:{state:'ok'|'unavailable';projects?:number;templates?:number;note?:string};
  blobs:{state:'ok'|'unavailable';templateObjects?:number};
  historyMigration:string;authentication:string;largeMediaUpload:string;
};
export default function AdminHealth(){
  const [data,setData]=useState<Health|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function check(){
    setBusy(true);setError('');
    try{
      const r=await fetch('/.netlify/functions/admin-health',{cache:'no-store'});
      const value=await r.json() as Health&{error?:string};
      if(!r.ok)throw new Error(value.error??'Serviço indisponível');
      setData(value);
    }catch(e){setError(e instanceof Error?e.message:'Falha de diagnóstico')}
    finally{setBusy(false)}
  }
  return <section style={{marginTop:28}}>
    <button type="button" className="fl-button" onClick={()=>void check()} disabled={busy}>{busy?'Verificando…':'Executar diagnóstico da infraestrutura'}</button>
    {error&&<p role="alert" style={{color:'#C0262D'}}>{error}</p>}
    {data&&<div style={{marginTop:20,display:'grid',gap:10}}>
      <div className="fl-setting-row"><div><strong>Netlify Database</strong><small>{data.database.state==='ok'?(`${data.database.projects??0} projetos / ${data.database.templates??0} templates`):data.database.note??'Indisponível'}</small></div><span>{data.database.state==='ok'?'Conectado':'Pendente'}</span></div>
      <div className="fl-setting-row"><div><strong>Netlify Blobs</strong><small>{data.blobs.templateObjects??0} objetos de configuração na biblioteca temporária</small></div><span>{data.blobs.state==='ok'?'Acessível':'Indisponível'}</span></div>
      <div className="fl-setting-row"><div><strong>Histórico Supabase</strong><small>Não migrado</small></div><span>Pendente</span></div>
      <div className="fl-setting-row"><div><strong>Upload de vídeos grandes</strong><small>Precisa de implementação em partes</small></div><span>Pendente</span></div>
      <p className="fl-muted" style={{fontSize:12}}>Este diagnóstico verifica conectividade, não integridade nem equivalência dos registros migrados.</p>
    </div>}
  </section>;
}
