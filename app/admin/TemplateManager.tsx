'use client';

import { useEffect, useState } from 'react';

type TemplateRow = {
  id: string;
  title: string;
  category: string;
  is_published: boolean;
  sort_order: number;
  version: number;
};

export default function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/.netlify/functions/templates?scope=admin', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Catálogo indisponível: verifique Identity e Netlify Database.');
        const result = await response.json() as { templates?: TemplateRow[] };
        if (!cancelled) setTemplates(Array.isArray(result.templates) ? result.templates : []);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Erro ao carregar catálogo.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function reload() {
    const response = await fetch('/.netlify/functions/templates?scope=admin',{cache:'no-store'});
    if (!response.ok) throw new Error('Falha ao atualizar catálogo.');
    const data = await response.json() as {templates:TemplateRow[]};
    setTemplates(data.templates??[]);
  }

  async function action(id:string,verb:'duplicate'|'restore'|'delete') {
    if(verb==='delete'&&!window.confirm('Excluir esta cópia do catálogo de testes?'))return;
    setBusy(id);setMessage('');
    try{
      const method=verb==='duplicate'?'POST':verb==='delete'?'DELETE':'PATCH';
      const payload=verb==='duplicate'?{sourceId:id}:verb==='restore'?{id,restore:true}:{id};
      const response=await fetch('/.netlify/functions/templates',{
        method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
      });
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(result.error??'Operação indisponível.');
      await reload();
      setMessage(verb==='duplicate'?'Cópia criada como rascunho.':verb==='restore'?'Versão anterior restaurada.':'Cópia excluída.');
    }catch(e){setMessage(e instanceof Error?e.message:'Erro ao atualizar template.');}
    finally{setBusy('');}
  }

  function patch(id: string, changes: Partial<TemplateRow>) {
    setTemplates((previous) => previous.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  async function save(template: TemplateRow) {
    setBusy(template.id);
    setMessage('');
    try {
      const response = await fetch('/.netlify/functions/templates', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          title: template.title,
          category: template.category,
          isPublished: template.is_published,
          sortOrder: template.sort_order,
        }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(problem.error || 'Não foi possível salvar.');
      }
      const updated = await response.json() as { template: TemplateRow };
      patch(template.id, { version: updated.template.version });
      setMessage('Template atualizado. As alterações estão registradas no banco.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar template.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="fl-panel" style={{ marginTop: 28 }}>
      <div className="fl-eyebrow">Biblioteca oficial</div>
      <h2 style={{ marginTop: 10, fontSize: 24 }}>Gerenciar modelos existentes</h2>
      <p className="fl-muted">Renomeie, categorize, organize e publique modelos. A estrutura de desenho continua protegida nesta etapa.</p>
      {loading && <p>Carregando templates...</p>}
      {!loading && templates.length === 0 && !message && <p>Nenhum template cadastrado.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {templates.map((item) => (
          <article key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 86px auto auto', alignItems: 'end', gap: 12, borderTop: '1px solid #E2E7F2', paddingTop: 14 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Nome
              <input className="fl-input" value={item.title} maxLength={100} onChange={(event) => patch(item.id, { title: event.target.value })}/>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Categoria
              <input className="fl-input" value={item.category} maxLength={60} onChange={(event) => patch(item.id, { category: event.target.value })}/>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Ordem
              <input className="fl-input" type="number" min={0} max={9999} value={item.sort_order} onChange={(event) => patch(item.id, { sort_order: Number(event.target.value) })}/>
            </label>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, paddingBottom: 12 }}>
              <input type="checkbox" checked={item.is_published} onChange={(event) => patch(item.id, { is_published: event.target.checked })}/> Publicado
            </label>
            <button type="button" className="fl-button" disabled={busy === item.id} onClick={() => save(item)}>{busy === item.id ? 'Salvando...' : 'Salvar'}</button>
            <div style={{gridColumn:'1 / -1',display:'flex',gap:9,justifyContent:'flex-end',flexWrap:'wrap'}}>
              <span className="fl-muted" style={{fontSize:10,marginRight:'auto'}}>Revisão v{item.version} · {item.id.startsWith('preset-')?'Cópia':'Modelo original'}</span>
              <button type="button" className="fl-nav-back" disabled={!!busy} onClick={() => void action(item.id,'duplicate')}>Duplicar</button>
              {item.version>1&&<button type="button" className="fl-nav-back" disabled={!!busy} onClick={() => void action(item.id,'restore')}>Restaurar anterior</button>}
              {item.id.startsWith('preset-')&&<button type="button" className="fl-nav-back" disabled={!!busy} onClick={() => void action(item.id,'delete')}>Excluir cópia</button>}
            </div>
          </article>
        ))}
      </div>
      {message && <p role="status" className="fl-muted">{message}</p>}
    </section>
  );
}
