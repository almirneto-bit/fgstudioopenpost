'use client';
import {useEffect,useState} from 'react';
type PsdItem = {id:string;title:string;category:string;published:boolean;thumbnail?:string;slots:{editable:boolean}[]};
export default function PsdTemplatesPicker(){
  const [items,setItems]=useState<PsdItem[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    fetch('/.netlify/functions/psd-templates',{cache:'no-store'})
      .then(async r=>{if(!r.ok)throw new Error('Biblioteca PSD indisponível.');return r.json() as Promise<{templates:PsdItem[]}>})
      .then(d=>{if(active)setItems(d.templates??[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro de conexão.')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  if(loading)return <small className="sm-post-hint">Verificando PSDs publicados…</small>;
  if(!items.length)return <p className="sm-post-hint">Nenhum modelo PSD publicado ainda.</p>;
  return <div className="fl-psd-picker">
    {items.map(item=><a key={item.id} className="fl-psd-picker-card" href={'/criar/psd/'+encodeURIComponent(item.id)}>
      {item.thumbnail?<img src={item.thumbnail} alt={'Prévia do modelo '+item.title}/>:<div className="fl-psd-placeholder">PSD</div>}
      <strong>{item.title}</strong>
      <small>{item.category} · {item.slots.filter(x=>x.editable).length} campos</small>
    </a>)}
    {error&&<small role="alert">{error}</small>}
  </div>;
}
