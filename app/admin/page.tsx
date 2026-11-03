import { getUser } from '@netlify/identity';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';
import TemplateManager from './TemplateManager';
import LogoutButton from '@/components/LogoutButton';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!V09_DEMO_MODE) {
    const user = await getUser();
    if (!user) redirect('/login');
    if (!user.roles?.includes('admin')) redirect('/sem-acesso');
  }

  return (
    <div className="fl-shell">
      <header className="fl-topbar">
        <div>
          <p className="fl-eyebrow">Final Level Co. · Administração</p>
          <div className="fl-title">FG Post Studio</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {V09_DEMO_MODE && <a href="/" className="fl-nav-back">← Voltar ao menu</a>}
          <a className="fl-button" href="/criar" style={{ textDecoration: 'none' }}>Abrir editor</a>
          {!V09_DEMO_MODE && <LogoutButton />}
        </div>
      </header>
      <main className="fl-main">
        <h1 className="fl-title">Gerenciamento de templates</h1>
        <p className="fl-muted">Catálogo de layouts oficiais. Nesta fase, nomes, categorias, ordem e publicação podem ser editados; novas estruturas de PSD e edição de camadas ficam para a próxima etapa.</p>
        {V09_DEMO_MODE && <div className="fl-demo-note" style={{ marginTop: 22 }}><strong>Modo de demonstração</strong><p>Qualquer pessoa com a senha geral do Netlify pode administrar estes modelos temporários. As alterações não afetam o catálogo definitivo nem o Supabase e podem ser perdidas após outro deploy.</p></div>}
        <TemplateManager />
      </main>
    </div>
  );
}
