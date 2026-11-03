'use client';
import {useEffect,useMemo,useState} from 'react';

type Project = {
  id:string;name:string;slides:number;templateIds:string[];createdAt:string;
  updatedAt:string;saves:number;exports:number;lastFormat?:string;
};
type Api={projects:Project[];stats:{projects:number};historyComplete:boolean};
const format=(date:string)=>new Date(date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export default function AdminProjects(){
  const [items,setItems]=useState<Project[]>([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [onlyExported,setOnlyExported]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const [sort,setSort]=useState<'new'|'old'|'most'>('new');
  useEffect(()=>{
    let active=true;
    fetch('/.netlify/functions/admin-overview',{cache:'no-store'})
      .then(async response=>{
        const data=await response.json() as Api&{error?:string};
        if(!response.ok)throw new Error(data.error??'Histórico indisponível');
        return data;
      })
      .then(data=>{if(active)setItems(data.projects??[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao carregar projetos.')})
      .finally(()=>{if(active)setBusy(false)});
    return()=>{active=false};
  },[]);
  const visible=useMemo(()=>items.filter(p=>
    (!onlyExported||p.exports>0)&&
    (p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))||
      p.id.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b)=>sort==='most'?b.exports-a.exports:sort==='old'?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt)),
  [items,search,onlyExported,sort]);
  function csvExport(){
    const rows=[['ID','Nome','Criado em','Última edição','Lâminas','Salvamentos','Exportações','Formato','Modelos'],
      ...visible.map(p=>[p.id,p.name,p.createdAt,p.updatedAt,String(p.slides),String(p.saves),String(p.exports),p.lastFormat??'',p.templateIds.join(' / ')])];
    const csv='\uFEFF'+rows.map(row=>row.map(cell=>'"'+String(cell).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='fgstudio-criacoes-preview.csv';a.click();
    URL.revokeObjectURL(url);
  }
  return <div>
    <div className="fl-admin-heading"><div>
      <p className="fl-eyebrow">Histórico da ferramenta</p>
      <h1 className="fl-title">Criações registradas</h1>
      <p className="fl-muted">Organização por nome, data, uso de modelos e exportações.</p>
    </div><button className="fl-button" type="button" disabled={!visible.length} onClick={csvExport}>Exportar relatório CSV</button></div>
    <div className="fl-demo-note" style={{margin:'0 0 22px'}}><strong>Escopo desta listagem</strong>
      <p>Somente registros desta prévia. O histórico anterior do Supabase ainda precisa ser migrado para aparecer aqui. Esta listagem representa metadados, não arquivos editáveis armazenados no servidor.</p>
    </div>
    <div className="fl-panel">
      <div className="fl-admin-filters">
        <input className="fl-input" placeholder="Pesquisar por nome ou ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="fl-input" value={sort} onChange={e=>setSort(e.target.value as 'new'|'old'|'most')}>
          <option value="new">Mais recentes</option><option value="old">Mais antigos</option><option value="most">Mais exportados</option>
        </select>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
          <input type="checkbox" checked={onlyExported} onChange={e=>setOnlyExported(e.target.checked)}/> Somente exportados
        </label>
      </div>
      <p className="fl-muted" style={{fontSize:12}}>{busy?'Carregando…':visible.length+' de '+items.length+' projetos registrados'}</p>
      {error&&<p role="alert" style={{color:'#C0262D'}}>{error}</p>}
      <div className="fl-table-wrap"><table className="fl-data-table">
        <thead><tr><th>Projeto</th><th>Modelos</th><th>Lâminas</th><th>Criado em</th><th>Última atividade</th><th>Downloads</th></tr></thead>
        <tbody>{visible.map(p=><tr key={p.id} onClick={()=>setSelected(p)} style={{cursor:'pointer'}}>
          <td><strong>{p.name}</strong><small>{p.id}</small></td>
          <td>{p.templateIds.join(', ')||'—'}</td><td>{p.slides}</td>
          <td>{format(p.createdAt)}</td><td>{format(p.updatedAt)}</td><td>{p.exports}</td>
        </tr>)}
        {!visible.length&&!busy&&<tr><td colSpan={6}>Nenhuma criação encontrada.</td></tr>}
        </tbody>
      </table></div>
    </div>
    {selected&&<section className="fl-panel" style={{marginTop:20}}>
      <div className="fl-admin-heading"><h2 style={{fontSize:20}}>Detalhes do projeto</h2>
        <button type="button" className="fl-nav-back" onClick={()=>setSelected(null)}>Fechar</button>
      </div>
      <h3>{selected.name}</h3>
      <p className="fl-muted">Identificador: {selected.id}</p>
      <div className="fl-stat-grid">
        <div className="fl-stat"><span>Lâminas</span><strong>{selected.slides}</strong></div>
        <div className="fl-stat"><span>Salvamentos</span><strong>{selected.saves}</strong></div>
        <div className="fl-stat"><span>Exportações</span><strong>{selected.exports}</strong></div>
      </div>
      <p className="fl-muted" style={{marginTop:16,fontSize:12}}>A visualização do arquivo editável será habilitada quando o histórico completo for migrado para o Netlify Database.</p>
    </section>}
  </div>;
}
