import { getUser } from '@netlify/identity';
import TemplateManager from './TemplateManager';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (!user.roles.includes('admin')) redirect('/sem-acesso');

  return (
    <div className="fl-shell">
      <header className="fl-topbar">
        <div>
          <p className="fl-eyebrow">Final Level Co. · Administração</p>
          <div className="fl-title">FG Post Studio</div>
        </div>
        <a className="fl-button" href="/criar" style={{ textDecoration: 'none' }}>Abrir editor</a>
      </header>
      <main className="fl-main">
        <h1 className="fl-title">Gerenciamento de templates</h1>
        <p className="fl-muted">Catálogo de layouts oficiais. Nesta fase, nomes, categorias, ordem e publicação podem ser editados; novas estruturas de PSD e edição de camadas ficam para a próxima etapa.</p>
        <TemplateManager />
      </main>
    </div>
  );
}
