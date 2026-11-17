const NAMES = { CHESS: 'Ajedrez', PACMAN: 'Pac-Man', MEMORY: 'Memoria', MINESWEEPER: 'Buscaminas' };

export default function SessionMonitor({ matches, onOpen }) {
  const active = matches.filter((match) => match.status === 'in-progress');
  if (!active.length) return null;
  return <section className="session-monitor" aria-label="Partidas en ejecución">
    <strong>{active.length} partida{active.length === 1 ? '' : 's'} en curso</strong>
    <span className="session-monitor__note">Siguen activas mientras consultas el panel o juegas otra partida.</span>
    <div>{active.map((match) => <button className="session-monitor__item" type="button" key={match.id} onClick={() => onOpen(match.id)}>
      <span>{NAMES[match.gameId]} · {match.id.slice(0, 8)}</span>
      <small>{match.gameId === 'CHESS' ? `${match.pgn ? 'En juego' : 'Primer turno'}${match.opponent === 'prolog' ? ' · Prolog' : ''}` : `${Math.floor(match.activeMs / 1000)} s${match.gameId === 'PACMAN' ? ` · ${match.score} puntos` : match.gameId === 'MEMORY' ? ` · ${match.cards.filter((card) => card.matched).length / 2} parejas` : ''}`}</small>
    </button>)}</div>
  </section>;
}
