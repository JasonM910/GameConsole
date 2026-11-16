export default function ArcadeLayout({ title, match, delivery, error, onBack, onRestart, onToggle, children, summary, help, controls, toolbar }) {
  const finished = match.status === 'finished';
  const state = { ready: 'LISTA', 'in-progress': 'EN CURSO', paused: 'PAUSADA', finished: 'FINALIZADA' }[match.status];
  return (
    <main className={`match-layout arcade-game arcade-game--${match.gameId.toLowerCase()}`}>
      <header className="match-topbar">
        <button className="text-button" onClick={onBack} type="button">← Consola</button>
        <div className="match-brand"><span className="brand-mark">G</span><span>GAME<span className="brand-highlight">CONSOLE</span></span></div>
        <span className="match-id">ID · {match.id.slice(0, 8).toUpperCase()}</span>
      </header>
      <div className="match-content">
        <section className="board-panel">
          <div className="match-heading"><div><p className="eyebrow">Un jugador · {match.players.player}</p><h1>{title}</h1></div><span className="match-state">{state}</span></div>
          <div className="game-toolbar">
            <div className="arcade-actions">
              {!finished && <button className="button button--primary" onClick={onToggle} type="button">{match.status === 'ready' ? 'Iniciar' : match.status === 'paused' ? 'Continuar' : 'Pausar'}</button>}
              <button className="button button--quiet" onClick={onRestart} type="button">Nueva partida / Reiniciar</button>
            </div>
            <span className="game-clock" aria-label="Tiempo de juego">◷ {match.elapsedSeconds()} s</span>
          </div>
          <div className="game-metrics">{summary}</div>
          {toolbar}
          <div className="game-stage">{children}</div>
          <p aria-live="polite" className={`turn-banner game-status-banner${finished ? ' is-finished' : ''}`}>{finished ? (match.result === 'WIN' ? '¡Victoria! Completaste el juego.' : 'Fin de partida. Inténtalo de nuevo.') : match.status === 'paused' ? 'Partida pausada. Continúa cuando quieras.' : match.status === 'ready' ? 'Pulsa Iniciar para jugar.' : '¡A jugar!'}</p>
          {controls}
        </section>
        <aside className="match-sidebar">
          <details className="side-card game-help">
            <summary>Cómo jugar</summary>
            <div className="details-content">{help}</div>
          </details>
          <details className="side-card game-connection">
            <summary>GameStats <span className={`connection-state${delivery.status === 'failed' || delivery.status === 'pending' ? ' is-pending' : ''}`}>{delivery.status === 'failed' ? 'Envío pendiente' : delivery.status === 'sent' || delivery.status === 'idle' ? 'Sin pendientes' : 'Pendiente'}</span></summary>
            <div className="details-content">
              <div className="integration-note" role="status"><div><strong>{delivery.status === 'sent' ? 'Eventos sincronizados' : 'Sincronización'}</strong><p>{delivery.message}</p></div></div>
              <p className="arcade-help">Los eventos se guardan con la partida y se sincronizan automáticamente.</p>
            </div>
          </details>
          {error && <p className="form-error" role="alert">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
