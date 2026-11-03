'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { handleAuthCallback, login } from '@netlify/identity';

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    handleAuthCallback()
      .then((result) => {
        if (!active || !result) return;
        if (result.type === 'recovery') {
          setError('Solicitação de recuperação reconhecida. Conclua a redefinição de senha pelo link enviado ao seu e-mail.');
          return;
        }
        window.location.assign('/');
      })
      .catch(() => {
        if (active) setError('Não foi possível concluir o link de autenticação. Solicite um novo convite.');
      });
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      // A navegação completa envia a sessão do Identity ao servidor Next.js.
      window.location.assign('/');
    } catch {
      setError('Não foi possível entrar. Confira suas credenciais e se o convite foi confirmado.');
      setBusy(false);
    }
  }

  return (
    <main className="fl-shell" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="fl-panel" style={{ width: 'min(100%, 420px)' }}>
        <p className="fl-eyebrow">Final Level Co. · uso interno</p>
        <h1 className="fl-title" style={{ margin: '8px 0 12px' }}>FG Post Studio</h1>
        <p className="fl-muted" style={{ margin: '0 0 28px' }}>Entre com sua conta autorizada para criar ou administrar templates.</p>
        <form onSubmit={signIn} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 6 }}>E-mail
            <input className="fl-input" autoComplete="email" type="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>Senha
            <input className="fl-input" autoComplete="current-password" type="password" value={password} required onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p role="alert" style={{ color: '#C0262D', margin: 0, fontSize: 13 }}>{error}</p>}
          <button className="fl-button" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="fl-copyright">© 2026 Final Level Co. Acesso exclusivo a pessoas autorizadas.</p>
      </section>
    </main>
  );
}
