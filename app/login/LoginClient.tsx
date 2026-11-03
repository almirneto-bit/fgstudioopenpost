'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  acceptInvite,
  handleAuthCallback,
  login,
  requestPasswordRecovery,
  updateUser,
} from '@netlify/identity';

type AuthScreen = 'loading' | 'login' | 'invite' | 'forgot' | 'recovery';

export default function LoginClient() {
  const [screen, setScreen] = useState<AuthScreen>('loading');
  const [inviteToken, setInviteToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    handleAuthCallback()
      .then((result) => {
        if (!active) return;
        if (!result) { setScreen('login'); return; }
        if (result.type === 'invite') {
          // Invite callbacks have a token but no authenticated user yet.
          setInviteToken(result.token ?? '');
          setScreen('invite');
          return;
        }
        if (result.type === 'recovery') {
          // Recovery requires a new password, not a redirect.
          setScreen('recovery');
          return;
        }
        window.location.assign('/');
      })
      .catch(() => {
        if (!active) return;
        setError('Não foi possível processar seu link. Solicite um novo convite ou recuperação de senha.');
        setScreen('login');
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || screen === 'loading') return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (screen === 'login') {
        await login(email.trim(), password);
        window.location.assign('/');
        return;
      }
      if (screen === 'forgot') {
        await requestPasswordRecovery(email.trim());
        setMessage('Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.');
        setScreen('login');
        return;
      }
      if (password.length < 10) throw new Error('Escolha uma senha com pelo menos 10 caracteres.');
      if (password !== confirmPassword) throw new Error('As senhas digitadas não coincidem.');
      if (screen === 'invite') {
        if (!inviteToken) throw new Error('Convite inválido ou expirado. Solicite um novo convite.');
        await acceptInvite(inviteToken, password);
        window.location.assign('/');
        return;
      }
      if (screen === 'recovery') {
        await updateUser({ password });
        setPassword('');
        setConfirmPassword('');
        setMessage('Senha alterada. Você já pode entrar com suas credenciais.');
        setScreen('login');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir sua solicitação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="fl-shell" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="fl-panel" style={{ width: 'min(100%, 430px)' }}>
        <p className="fl-eyebrow">Final Level Co. · uso interno</p>
        <h1 className="fl-title" style={{ margin: '8px 0 12px' }}>FG Post Studio</h1>
        <p className="fl-muted" style={{ margin: '0 0 28px' }}>
          {screen === 'invite' ? 'Crie sua senha para ativar o convite.'
            : screen === 'recovery' ? 'Defina sua nova senha.'
            : screen === 'forgot' ? 'Informe seu e-mail para recuperar o acesso.'
            : 'Entre com sua conta autorizada para criar ou administrar templates.'}
        </p>
        {screen === 'loading' ? <p className="fl-muted">Verificando seu acesso…</p> : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            {(screen === 'login' || screen === 'forgot') && (
              <label style={{ display: 'grid', gap: 6 }}>E-mail
                <input className="fl-input" autoComplete="email" type="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
              </label>
            )}
            {(screen === 'login' || screen === 'invite' || screen === 'recovery') && (
              <label style={{ display: 'grid', gap: 6 }}>{screen === 'login' ? 'Senha' : 'Nova senha'}
                <input className="fl-input" type="password" minLength={screen === 'login' ? undefined : 10}
                  autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
                  value={password} required onChange={(event) => setPassword(event.target.value)} />
              </label>
            )}
            {(screen === 'invite' || screen === 'recovery') && (
              <label style={{ display: 'grid', gap: 6 }}>Confirmar nova senha
                <input className="fl-input" type="password" autoComplete="new-password"
                  value={confirmPassword} required onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
            )}
            {message && <p role="status" style={{ color: '#0B7A4B', margin: 0, fontSize: 13 }}>{message}</p>}
            {error && <p role="alert" style={{ color: '#C0262D', margin: 0, fontSize: 13 }}>{error}</p>}
            <button className="fl-button" type="submit" disabled={busy}>
              {busy ? 'Processando…'
                : screen === 'invite' ? 'Ativar minha conta'
                : screen === 'recovery' ? 'Salvar nova senha'
                : screen === 'forgot' ? 'Enviar instruções' : 'Entrar'}
            </button>
            {screen === 'login' && <button type="button" className="sm-post-secondary-btn" onClick={() => { setError(''); setScreen('forgot'); }}>Esqueci minha senha</button>}
            {screen === 'forgot' && <button type="button" className="sm-post-secondary-btn" onClick={() => { setError(''); setScreen('login'); }}>Voltar ao login</button>}
          </form>
        )}
        <p className="fl-copyright">© 2026 Final Level Co. Acesso exclusivo a pessoas autorizadas.</p>
      </section>
    </main>
  );
}
