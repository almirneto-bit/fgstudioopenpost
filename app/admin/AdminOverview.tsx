'use client';
import { useEffect, useMemo, useState } from 'react';
type Project={id:string;name:string;slides:number;createdAt:string;updatedAt:string;saves:number;exports:number;lastFormat?:string;templateIds:string[]};
type Activity={id:string;kind:'created'|'saved'|'exported';projectId:string;projectName:string;templateId:string;format:string;slideCount:number;at:string};
type Overview={
  scope:string;historyComplete:boolean;legacyMigration:string;
  stats:{projects:number;slides:number;exports:number;monthCreated:number;publishedTemplates:number;templates:number;importedPsd:number;drafts:number};
  formats:Record<string,number>;
  days:{date:string;created:number;saved:number;exported:number}[];
  templatesUsage:{id:string;title:string;category:string;uses:number}[];
  projects:Project[];recent:Activity[];
};
const pretty=(date:string)=>new Date(date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
const sample=(name:string,count:number)=>`${name}: ${count}`;
export default function AdminOverview(){
  const [data,setData]=useState<Overview|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [stamp,setStamp]=useState(0);
  useEffect(()=>{
    let active=true;
    fetch('/.netlify/functions/admin-overview',{cache:'no-store'})
      .then(async r=>{const result=await r.json() as Overview&{error?:string};if(!r.ok)throw new Error(result.error||'Dashboard indisponível');return result;})
      .then(value=>{if(active)setData(value)})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao carregar indicadores')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[stamp]);
  const projects=useMemo(()=>data?.projects.filter(p=>{
    const matches=p.name.toLowerCase().includes(query.toLowerCase())||p.id.toLowerCase().includes(query.toLowerCase());
    const updated=Date.now()-new Date(p.updatedAt).getTime();
    return matches&&(filter==='all'||filter==='exported'&&p.exports>0||filter==='last7'&&updated<7*86400000);
  })??[],[data,query,filter]);
  const statCards=data?[['Criações registradas',data.stats.projects],['Lâminas dos projetos',data.stats.slides],
    ['Exportações',data.stats.exports],['Modelos publicados',data.stats.publishedTemplates],
    ['PSDs importados',data.stats.importedPsd],['Rascunhos de template',data.stats.drafts]]:[];
  const max=Math.max(1,...(data?.days.map(d=>d.created+d.saved+d.exported)??[]));

  return <div className="fl-admin-overview">
    <div className="fl-admin-heading">
      <div><p className="fl-eyebrow">Painel de controle / visão geral</p>
        <h2 className="fl-title" style={{fontSize:29}}>Acompanhe o FG Studio</h2>
        <p className="fl-muted">Criações, modelos e movimentações deste ambiente em um só lugar.</p></div>
      <button type="button" className="fl-nav-back" onClick={()=>{setLoading(true);setStamp(x=>x+1)}}>↻ Atualizar dados</button>
    </div>
    <div className="fl-demo-note" role="note" style={{margin:'0 0 24px'}}>
      <strong>Histórico parcial · ambiente de testes</strong>
      <p>Os indicadores abaixo são registros produzidos nesta prévia. Os projetos históricos do Supabase ainda não foram importados.
         Este dashboard não representa o total de criações da empresa até que a migração seja concluída.</p>
    </div>
    {loading&&<div className="fl-panel">Carregando métricas…</div>}
    {error&&<div className="fl-panel" role="alert" style={{color:'#C0262D'}}>{error}</div>}
    {data&&<div style={{display:'grid',gap:20}}>
      <section className="fl-stat-grid" aria-label="Indicadores principais">
        {statCards.map(([label,value])=><div className="fl-stat" key={label}>
          <span className="fl-muted">{label}</span><strong>{value}</strong>
        </div>)}
      </section>
      <div className="fl-admin-two-col">
        <section className="fl-panel">
          <div className="fl-admin-heading"><h3>Atividade dos últimos 7 dias</h3><span className="fl-muted">Criações / salvamentos / exportações</span></div>
          <div className="fl-mini-chart">
            {data.days.map(day=>{
              const n=day.created+day.saved+day.exported;
              return <div className="fl-chart-day" key={day.date} title={`${day.date} · ${n} eventos`}>
                <div className="fl-chart-bar" style={{height:'145px'}}>
                  <div className="fl-chart-stack" style={{height:Math.max(n?3:0,145*n/max)+'px'}}>
                    <span style={{flex:day.created,background:'#8200FF'}}/>
                    <span style={{flex:day.saved,background:'#CB6BFC'}}/>
                    <span style={{flex:day.exported,background:'#D4EF39'}}/>
                  </div>
                </div>
                <small>{day.date.slice(-5).split('-').reverse().join('/')}</small>
                <strong>{n}</strong>
              </div>;
            })}
          </div>
          <div className="fl-legend"><span><i style={{background:'#8200FF'}}/> Criações</span><span><i style={{background:'#CB6BFC'}}/> Salvamentos</span><span><i style={{background:'#D4EF39'}}/> Exportações</span></div>
        </section>
        <section className="fl-panel">
          <h3>Exportações por formato</h3>
          <p className="fl-muted">Downloads registrados com sucesso no editor</p>
          {Object.entries(data.formats).map(([name,value])=><div className="fl-format-row" key={name}>
            <span>{name.toUpperCase()}</span>
            <div><span style={{width:`${Math.max(0,value/Math.max(1,data.stats.exports)*100)}%`}}/></div>
            <strong>{value}</strong>
          </div>)}
          <div className="fl-admin-submetric"><span>Templates cadastrados</span><strong>{data.stats.templates}</strong></div>
        </section>
      </div>
      <div className="fl-admin-two-col">
        <section className="fl-panel">
          <h3>Modelos utilizados</h3>
          {data.templatesUsage.map(t=><div className="fl-template-rank" key={t.id}>
            <div><strong>{t.title}</strong><small>{t.category}</small></div><span>{t.uses} criações</span>
          </div>)}
        </section>
        <section className="fl-panel">
          <h3>Atividade recente</h3>
          {data.recent.length===0&&<p className="fl-muted">Sem ações registradas nesta prévia.</p>}
          {data.recent.slice(0,10).map(evt=><div className="fl-template-rank" key={evt.id}>
            <div><strong>{evt.projectName}</strong><small>{evt.kind==='created'?'Nova criação':evt.kind==='saved'?'Salvo no histórico':'Exportado '+evt.format.toUpperCase()}</small></div>
            <small>{pretty(evt.at)}</small>
          </div>)}
        </section>
      </div>
      <section className="fl-panel">
        <div className="fl-admin-heading">
          <div><h3>Projetos registrados</h3><p className="fl-muted">Lista de criações conhecidas pela telemetria desta prévia. Não inclui rascunhos de outros navegadores que nunca foram registrados.</p></div>
          <strong>{projects.length} projetos</strong>
        </div>
        <div className="fl-admin-filters">
          <input className="fl-input" placeholder="Pesquisar nome ou ID..." value={query} onChange={e=>setQuery(e.target.value)} aria-label="Pesquisar projetos"/>
          <select className="fl-input" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtrar projetos">
            <option value="all">Todos</option><option value="exported">Exportados</option><option value="last7">Últimos 7 dias</option>
          </select>
        </div>
        <div className="fl-table-wrap">
          <table className="fl-data-table">
            <thead><tr><th>Nome da criação</th><th>Lâminas</th><th>Última atividade</th><th>Exportações</th><th>Último formato</th></tr></thead>
            <tbody>
              {projects.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.id}</small></td><td>{p.slides}</td><td>{pretty(p.updatedAt)}</td><td>{p.exports}</td><td>{p.lastFormat?.toUpperCase()??'—'}</td></tr>)}
              {!projects.length&&<tr><td colSpan={5}>Nenhuma criação corresponde aos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>}
  </div>;
}
