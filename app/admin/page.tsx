import { getUser } from '@netlify/identity';
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
        <p className="fl-muted">Ambiente administrativo protegido por permissão. A biblioteca editável e a migração de dados serão conectadas ao Netlify Database na próxima implementação desta branch.</p>
        <section className="fl-panel" style={{ marginTop: 28 }}>
          <p className="fl-eyebrow">V09 · Em desenvolvimento</p>
          <h2 style={{ marginTop: 10 }}>Estrutura de administração criada</h2>
          <p className="fl-muted">Nenhuma alteração nos templates oficiais está disponível aqui ainda. O editor existente continua preservado para evitar regressões.</p>
        </section>
      </main>
    </div>
  );
}
