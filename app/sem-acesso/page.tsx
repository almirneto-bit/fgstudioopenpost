export default function ForbiddenPage() {
  return (
    <main className="fl-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="fl-panel" style={{ width: 'min(100%, 480px)' }}>
        <p className="fl-eyebrow">Final Level Co. · Acesso controlado</p>
        <h1 className="fl-title">Sem permissão para este painel</h1>
        <p className="fl-muted">Sua conta não possui a permissão necessária. Entre em contato com a pessoa administradora para receber o acesso correto.</p>
        <a href="/" className="fl-button" style={{ display: 'inline-block', textDecoration: 'none' }}>Voltar</a>
      </section>
    </main>
  );
}
