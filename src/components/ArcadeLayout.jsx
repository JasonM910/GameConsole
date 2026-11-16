export default function ArcadeLayout({ title, match, delivery, error, onBack, onRestart, onToggle, children, summary }) {
  const finished = match.status === 'finished';
  const state = { ready: 'LISTA', 'in-progress': 'EN CURSO', paused: 'PAUSADA', finished: 'FINALIZADA' }[match.status];
  return (
    <main className="match-layout">
      <header className="match-topbar">
        <button className="text-button" onClick={onBack} type="button">← Consola</button>
        <div className="match-brand"><span className="brand-mark">G</span><span>GAME<span className="brand-highlight">CONSOLE</span></span></div>
        <span className="match-id">ID · {match.id.slice(0, 8).toUpperCase()}</span>
      </header>
      <div className="match-content">
        <section className="board-panel">
          <div className="match-heading"><div><p className="eyebrow">Un jugador · {match.players.player}</p><h1>{title}</h1></div><span className="match-state">{state}</span></div>
          {children}
          <p aria-live="polite" className="turn-banner">{finished ? (match.result === 'WIN' ? '¡Victoria! Completaste el juego.' : 'Fin de partida. Inténtalo de nuevo.') : state === 'PAUSADA' ? 'Partida pausada. Continúa cuando quieras.' : '¡A jugar!'}</p>
        </section>
        <aside className="match-sidebar">
          <section className="side-card">
            <div className="side-card__heading"><h2>Tu partida</h2></div>
            {summary}
            <div className="side-stat"><span>Tiempo de juego</span><strong>{match.elapsedSeconds()} s</strong></div>
            <div className="arcade-actions">
              {!finished && <button className="button button--primary" onClick={onToggle} type="button">{match.status === 'ready' ? 'Iniciar' : match.status === 'paused' ? 'Continuar' : 'Pausar'}</button>}
              <button className="button button--quiet" onClick={onRestart} type="button">Nueva partida / Reiniciar</button>
            </div>
            <div className="integration-note" role="status"><div><strong>{delivery.status === 'sent' ? 'Eventos sincronizados' : 'Sincronización'}</strong><p>{delivery.message}</p></div></div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
