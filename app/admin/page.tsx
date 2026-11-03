import { getUser } from '@netlify/identity';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';
import AdminWorkspace from './AdminWorkspace';
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
      <AdminWorkspace />
    </div>
  );
}
