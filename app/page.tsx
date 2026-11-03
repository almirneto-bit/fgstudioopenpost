import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!V09_DEMO_MODE) {
    const user = await getUser();
    if (!user) redirect('/login');
    if (user.roles?.includes('admin')) redirect('/admin');
    if (user.roles?.includes('creator')) redirect('/criar');
    redirect('/sem-acesso');
  }

  return (
    <main className="fl-shell fl-landing">
      <header className="fl-topbar">
        <div className="fl-brandlock">
          <div className="fl-brandmark" aria-hidden="true">FL.</div>
          <div>
            <div className="fl-eyebrow">Final Level Co. / Favela Gaming</div>
            <strong>FG Post Studio</strong>
          </div>
        </div>
        <span className="fl-mode-tag">Ambiente de testes · V09</span>
      </header>

      <div className="fl-landing-main">
        <p className="fl-eyebrow">Bem-vindo ao FG Post Studio</p>
        <h1 className="fl-landing-title">Como você quer <span>começar?</span></h1>
        <p className="fl-landing-lead">
          Escolha um ambiente para seguir. Neste preview, não é necessário outro login além da
          senha de acesso já configurada no Netlify.
        </p>

        <nav className="fl-choice-grid" aria-label="Escolher ambiente do FG Post Studio">
          <a href="/criar" className="fl-choice-card">
            <div className="fl-choice-number">01 <span>USO DA PLATAFORMA</span></div>
            <div className="fl-choice-icon" aria-hidden="true">✦</div>
            <h2>Criar posts</h2>
            <p>Selecione layouts, adicione textos e mídias, monte o carrossel e exporte suas artes.</p>
            <span className="fl-choice-cta">Abrir editor <span aria-hidden="true">↗</span></span>
          </a>
          <a href="/admin" className="fl-choice-card">
            <div className="fl-choice-number">02 <span>CONTROLE DOS MODELOS</span></div>
            <div className="fl-choice-icon" aria-hidden="true">▦</div>
            <h2>Administração</h2>
            <p>Organize templates, ajuste nomes e categorias, escolha a ordem e controle a publicação.</p>
            <span className="fl-choice-cta">Gerenciar templates <span aria-hidden="true">↗</span></span>
          </a>
        </nav>

        <div className="fl-demo-note" role="note">
          <strong>Modo de demonstração</strong>
          <p>Os dois ambientes ficam acessíveis a quem souber a senha geral do Netlify. Alterações
            administrativas são experimentais e isoladas deste deploy. Rascunhos do editor ficam
            neste navegador; o histórico definitivo do Supabase não será alterado.</p>
        </div>
      </div>
      <footer className="fl-landing-footer">© 2026 Final Level Co. · Ferramenta interna de uso exclusivo de pessoas autorizadas.</footer>
    </main>
  );
}
