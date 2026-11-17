import { useMemo, useState } from 'react';
import { useRuntimeMatch } from './useRuntimeMatch.js';

const PIECE_SYMBOLS = {
  wp: '♟',
  wn: '♞',
  wb: '♝',
  wr: '♜',
  wq: '♛',
  wk: '♚',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

const PIECE_NAMES = {
  p: 'peón',
  n: 'caballo',
  b: 'alfil',
  r: 'torre',
  q: 'dama',
  k: 'rey',
};

const PROMOTIONS = [
  ['q', 'Dama'],
  ['r', 'Torre'],
  ['b', 'Alfil'],
  ['n', 'Caballo'],
];

function playerLabel(color) {
  return color === 'w' ? 'Blancas' : 'Negras';
}

export default function ChessGame({ record, runtime, delivery, onBack, onStats, onOpenMatch, matches }) {
  const { match, error, readOnly, aiStatus, aiInfo } = useRuntimeMatch({ runtime, record });
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [promotion, setPromotion] = useState('q');
  const computerTurn = match.isComputerTurn;

  const legalMoves = useMemo(
    () => match.legalMovesFrom(selectedSquare),
    [match, selectedSquare, match.moveCount],
  );
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => move.to)), [legalMoves]);
  const lastMove = match.lastMove;
  const board = match.board;
  const currentColor = match.turn;
  const checkmate = match.isCheckmate;
  const inCheck = match.isCheck && match.status !== 'finished';
  const finished = match.status === 'finished';
  const statusKind = checkmate ? 'mate' : inCheck ? 'check' : finished ? 'finished' : 'turn';
  const statusLabel = checkmate ? 'JAQUE MATE' : inCheck ? 'JAQUE' : finished ? (match.isDraw ? 'TABLAS' : 'FINALIZADA') : 'EN CURSO';
  const deliverySummary = delivery.status === 'sent'
    ? 'Servicio respondió'
    : delivery.status === 'failed'
      ? 'Envío pendiente'
      : 'Eventos pendientes de sincronización';

  function selectSquare(square, piece) {
    if (finished || readOnly || computerTurn) return;
    if (selectedSquare && legalTargets.has(square)) {
      runtime.moveChess(match.id, { from: selectedSquare, to: square, promotion });
      setSelectedSquare(null);
    } else setSelectedSquare(piece?.color === currentColor ? square : null);
  }

  function resign() { runtime.resign(match.id); setSelectedSquare(null); }

  function statusText() {
    if (match.status === 'finished') {
      if (match.result === 'DRAW') {
        return 'Partida finalizada · tablas';
      }
      const winnerColor = match.result ?? (currentColor === 'w' ? 'b' : 'w');
      return `${match.isCheckmate ? 'Jaque mate · ' : 'Abandono · '}ganan ${playerLabel(winnerColor)}`;
    }
    return match.isCheck
      ? `Jaque a ${playerLabel(currentColor)}`
      : `Turno de ${playerLabel(currentColor)}`;
  }

  function statusDescription() {
    if (readOnly) return 'Esta partida se controla desde otra pestaña. Aquí puedes observarla.';
    if (aiStatus === 'error') return 'Prolog no pudo responder. Reintenta sin perder la partida.';
    if (computerTurn) return 'Prolog está calculando su jugada…';
    if (checkmate) return `${playerLabel(currentColor)} no pueden salir del jaque. La partida terminó.`;
    if (finished) return match.result === 'DRAW' ? 'La partida terminó en empate.' : 'La partida terminó por abandono.';
    if (inCheck) return `Debes proteger al rey de ${playerLabel(currentColor)}.`;
    return lastMove ? `Última jugada: ${lastMove.san}` : 'Selecciona una pieza para ver sus movimientos.';
  }

  return (
    <main className="match-layout chess-game">
      <header className="match-topbar">
        <nav className="match-navigation" aria-label="Navegación de partida"><button className="text-button" onClick={onBack} type="button"><span aria-hidden="true">←</span> Consola</button><button className="text-button" onClick={onStats} type="button">Estadísticas</button></nav>
        <div className="match-brand">
          <span className="brand-mark motion-safe:animate-pixel-glow">G</span>
          <span>GAME<span className="brand-highlight">CONSOLE</span></span>
        </div>
        <span className="match-id">ID · {match.id.slice(0, 8).toUpperCase()}</span>
      </header>

      {readOnly && <p className="ownership-note" role="status">Partida abierta en otra pestaña. Los controles se habilitarán al cerrar esa pestaña.</p>}
      <div className="match-content">
        <section className="board-panel">
          <div className="match-heading">
            <div>
              <p className="eyebrow">{match.opponent === 'prolog' ? 'Tú contra Prolog · juegas con blancas' : 'Partida local · dos jugadores'}</p>
              <h1>Ajedrez</h1>
            </div>
            <span className={`match-state match-state--${statusKind}`}>
              <span /> {statusLabel}
            </span>
          </div>

          <div role="status" aria-live="polite" aria-atomic="true" className={`turn-banner chess-status chess-status--${statusKind}`}>
            <span aria-hidden="true" className="turn-banner__icon">{checkmate ? '♚' : inCheck ? '!' : finished ? '✓' : '♟'}</span>
            <div><strong>{statusText()}</strong><span>{statusDescription()}</span></div>
            <span className="move-count">{lastMove?.san ?? '—'}<small>{match.moveCount} JUGADAS</small></span>
          </div>

          <div className="board-frame">
            <div className="player-strip">
              <span className="avatar avatar--dark">♚</span>
              <div><strong>Negras</strong><small>{match.players.black}</small></div>
              {currentColor === 'b' && match.status === 'in-progress' && <span className="turn-indicator motion-safe:animate-blink-soft">JUGANDO</span>}
            </div>
            <div className="board-wrap">
              <div className="board-coordinates board-coordinates--left" aria-hidden="true">
                {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}
              </div>
              <div className="chess-board" role="grid" aria-label="Tablero de ajedrez">
                {board.flatMap((row, rowIndex) => row.map((piece, columnIndex) => {
                  const square = `${'abcdefgh'[columnIndex]}${8 - rowIndex}`;
                  const dark = (rowIndex + columnIndex) % 2 === 1;
                  const selected = selectedSquare === square;
                  const last = lastMove?.from === square || lastMove?.to === square;
                  const legalTarget = legalTargets.has(square);
                  const threatenedKing = (inCheck || checkmate) && piece?.type === 'k' && piece.color === currentColor;
                  return (
                    <button
                      aria-label={`${square}${piece ? ` ${PIECE_NAMES[piece.type]} ${piece.color === 'w' ? 'blanco' : 'negro'}` : ''}${legalTarget ? ', movimiento legal' : ''}${threatenedKing ? checkmate ? ', jaque mate' : ', en jaque' : ''}`}
                      aria-selected={selected}
                      className={`square${dark ? ' square--dark' : ''}${selected ? ' is-selected' : ''}${last ? ' is-last' : ''}${legalTarget ? ' is-legal' : ''}${threatenedKing ? ' is-threatened' : ''}`}
                      disabled={finished || readOnly || computerTurn}
                      key={square}
                      onClick={() => selectSquare(square, piece)}
                      role="gridcell"
                      type="button"
                    >
                      {piece && <span className={`piece piece--${piece.color} motion-safe:animate-piece-drop`}>{PIECE_SYMBOLS[`${piece.color}${piece.type}`]}</span>}
                      {legalTarget && <span aria-hidden="true" className={piece ? 'legal-capture' : 'legal-dot'} />}
                      {columnIndex === 0 && <span aria-hidden="true" className="square-coordinate">{8 - rowIndex}</span>}
                      {rowIndex === 7 && <span aria-hidden="true" className="square-coordinate square-coordinate--file">{'abcdefgh'[columnIndex]}</span>}
                    </button>
                  );
                }))}
              </div>
              <div className="board-coordinates board-coordinates--right" aria-hidden="true">
                {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}
              </div>
            </div>
            <div className="player-strip player-strip--bottom">
              <span className="avatar avatar--light">♔</span>
              <div><strong>Blancas</strong><small>{match.players.white}</small></div>
              {currentColor === 'w' && match.status === 'in-progress' && <span className="turn-indicator motion-safe:animate-blink-soft">JUGANDO</span>}
            </div>
          </div>

        </section>

        <aside className="match-sidebar">
          <section className="side-card chess-controls">
            <div className="side-card__heading">
              <div><p className="eyebrow">{match.opponent === 'prolog' ? 'Computadora · Prolog' : 'Dos jugadores'}</p><h2>Tu partida</h2></div>
              <span className="live-tag"><i /> {match.opponent === 'prolog' ? 'PROLOG' : 'LOCAL'}</span>
            </div>
            {match.status === 'in-progress' && (
              <>
                <label className="control-label" htmlFor="promotion">Promoción de peón</label>
                <select disabled={readOnly || computerTurn} id="promotion" onChange={(event) => setPromotion(event.target.value)} value={promotion}>
                  {PROMOTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
                <button className="button button--quiet button--full" onClick={resign} disabled={readOnly} type="button">
                  Finalizar por abandono
                </button>
              </>
            )}
            {finished && <p className="arcade-help">{statusText()}. Puedes elegir otra partida o volver a la consola.</p>}
            {aiStatus === 'thinking' && <p className="ai-thinking" role="status">Prolog está pensando…</p>}
            {aiStatus === 'error' && !readOnly && <button className="button button--quiet button--full" onClick={() => runtime.retryComputer(match.id)} type="button">Reintentar jugada Prolog</button>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>

          <details className="side-card side-card--sessions">
            <summary>
              Partidas guardadas
              <span className="session-count">{matches.length}</span>
            </summary>
            <div className="details-content">
            <div className="session-list">
              {matches.map((saved) => (
                <button
                  className={`session-item${saved.id === match.id ? ' is-active' : ''}`}
                  key={saved.id}
                  onClick={() => onOpenMatch(saved.id)}
                  type="button"
                >
                  <span className="session-icon">{{ CHESS: '♞', PACMAN: '◉', MEMORY: '▣', MINESWEEPER: '⚑' }[saved.gameId]}</span>
                  <span className="session-item__text"><strong>{{ CHESS: 'Ajedrez', PACMAN: 'Pac-Man', MEMORY: 'Memoria', MINESWEEPER: 'Buscaminas' }[saved.gameId]}</strong><small>{saved.id.slice(0, 8).toUpperCase()}</small></span>
                  <span className={`session-status${saved.status === 'finished' ? ' is-done' : ''}`} />
                </button>
              ))}
            </div>
            <button className="text-button text-button--new" onClick={onBack} type="button">＋ Crear otra partida</button>
            </div>
          </details>

          <details className="side-card">
            <summary>Detalles y conexión</summary>
            <div className="details-content">
              <div className="side-stat"><span>Identificador de partida</span><code>{match.id}</code></div>
              <div className="integration-note"><div><strong>{deliverySummary}</strong><p>{delivery.message}</p></div></div>
              <p className="arcade-help">{match.opponent === 'prolog' ? 'SWI-Prolog genera movimientos legales y elige con negamax y poda alfa-beta a profundidad 2. chess.js vuelve a validar cada respuesta.' : 'Partida local para dos jugadores. Las reglas se validan con chess.js.'}</p>
              {aiInfo && <p className="arcade-help">Última búsqueda: {aiInfo.nodes} posiciones · profundidad {aiInfo.depth} · evaluación {aiInfo.score} centipeones.</p>}
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}
