'use client';
import { useState } from 'react';
import AdminOverview from './AdminOverview';
import TemplateManager from './TemplateManager';
import PsdImport from './PsdImport';

type Tab='overview'|'templates'|'psd'|'projects'|'settings';

export default function AdminWorkspace(){
  const [tab,setTab]=useState<Tab>('overview');
  const items:{id:Tab;name:string;description:string}[]=[
    {id:'overview',name:'Visão geral',description:'Métricas e desempenho'},
    {id:'templates',name:'Templates',description:'Catálogo de layouts'},
    {id:'psd',name:'Importar PSD',description:'Mapear camadas'},
    {id:'projects',name:'Criações',description:'Histórico de projetos'},
    {id:'settings',name:'Configurações',description:'Infraestrutura'},
  ];
  return <div className="fl-admin-layout">
    <aside className="fl-admin-sidebar">
      <div className="fl-admin-sidebrand"><strong>PAINEL DE CONTROLE</strong><small>FINAL LEVEL CO.</small></div>
      <nav aria-label="Navegação de administração">
        {items.map(item=><button key={item.id} type="button" className={tab===item.id?'fl-admin-nav is-active':'fl-admin-nav'}
          onClick={()=>setTab(item.id)}>
          <strong>{item.name}</strong><small>{item.description}</small>
        </button>)}
      </nav>
      <div className="fl-admin-sidebottom">FG Post Studio · V09 (beta)<p>Uso exclusivo Final Level Co.</p></div>
    </aside>
    <div className="fl-admin-content">
      {tab==='overview'&&<AdminOverview/>}
      {tab==='templates'&&<div>
        <div className="fl-admin-heading"><div><p className="fl-eyebrow">Catálogo oficial</p><h1 className="fl-title">Biblioteca de templates</h1><p className="fl-muted">Gerencie categorias, títulos, ordem e visibilidade para a equipe.</p></div></div>
        <TemplateManager/>
      </div>}
      {tab==='psd'&&<div>
        <div className="fl-admin-heading"><div><p className="fl-eyebrow">Biblioteca de camadas</p><h1 className="fl-title">Importador de PSDs</h1><p className="fl-muted">Transforme arquivos PSD em modelos publicados com campos controlados.</p></div></div>
        <PsdImport/>
      </div>}
      {tab==='projects'&&<AdminOverview/>}
      {tab==='settings'&&<div className="fl-panel">
        <p className="fl-eyebrow">Estado da plataforma</p>
        <h2 style={{fontSize:25,margin:'8px 0'}}>Configurações V09</h2>
        <div className="fl-setting-row"><div><strong>Proteção do site</strong><small>Senha geral Netlify</small></div><span>Ativa</span></div>
        <div className="fl-setting-row"><div><strong>Autenticação individual</strong><small>Netlify Identity</small></div><span>Adiada</span></div>
        <div className="fl-setting-row"><div><strong>Banco principal</strong><small>Netlify Database, migração planejada</small></div><span>Em implantação</span></div>
        <div className="fl-setting-row"><div><strong>Histórico anterior</strong><small>Supabase legado não migrado</small></div><span>Preservado</span></div>
        <div className="fl-setting-row"><div><strong>Dados desta prévia</strong><small>Blobs isolados por deploy e rascunhos IndexedDB</small></div><span>Temporários</span></div>
        <div className="fl-setting-row"><div><strong>Aparência</strong><small>Modo claro · Final Level Co.</small></div><span>Ativo</span></div>
        <p className="fl-demo-note">Os dois painéis compartilham a senha geral durante os testes. Quando os acessos individuais forem ativados, todas as ações administrativas passarão a exigir o papel Admin.</p>
      </div>}
    </div>
  </div>;
}
