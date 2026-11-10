import { useEffect, useMemo, useState } from 'react';
import { ChessMatch } from '../games/chess/ChessMatch.js';

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

function finishEvents(match, result, adapter) {
  const durationSeconds = match.elapsedSeconds();
  return ['w', 'b'].map((color) => adapter.createEvent({
    gameId: 'CHESS',
    matchId: match.id,
    playerId: match.playerIdFor(color),
    type: 'MATCH_FINISHED',
    data: {
      result: result === 'DRAW' ? 'DRAW' : result === color ? 'WIN' : 'LOSS',
      durationSeconds,
    },
  }));
}

export default function ChessGame({ record, adapter, delivery, onSave, onEvents, onBack, onOpenMatch, matches }) {
  const [match, setMatch] = useState(() => ChessMatch.fromJSON(record));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [promotion, setPromotion] = useState('q');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setMatch(ChessMatch.fromJSON(record));
    setSelectedSquare(null);
  }, [record]);

  const legalMoves = useMemo(
    () => match.legalMovesFrom(selectedSquare),
    [match, selectedSquare, version],
  );
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => move.to)), [legalMoves]);
  const lastMove = match.lastMove;
  const board = match.board;
  const currentColor = match.turn;
  const deliverySummary = delivery.status === 'sent'
    ? 'Servicio respondió'
    : delivery.status === 'failed'
      ? 'Envío pendiente'
      : 'Integración con GameStats pendiente';

  function persist(events = []) {
    for (const event of events) {
      match.appendEvent(event);
    }
    onSave(match.toJSON());
    if (events.length) {
      onEvents(events);
    }
  }

  function selectSquare(square, piece) {
    setError('');
    if (selectedSquare && legalTargets.has(square)) {
      try {
        const move = match.playMove({ from: selectedSquare, to: square, promotion });
        const events = [
          adapter.createEvent({
            gameId: 'CHESS',
            matchId: match.id,
            playerId: move.playerId,
            type: 'MOVE_PLAYED',
            data: {
              ply: move.ply,
              piece: move.piece,
              from: move.from,
              to: move.to,
              thinkTimeSeconds: move.thinkTimeSeconds,
            },
          }),
        ];
        if (move.capturedPiece) {
          events.push(adapter.createEvent({
            gameId: 'CHESS',
            matchId: match.id,
            playerId: move.playerId,
            type: 'PIECE_CAPTURED',
            data: { ply: move.ply, capturedPiece: move.capturedPiece },
          }));
        }
        if (move.gaveCheck) {
          events.push(adapter.createEvent({
            gameId: 'CHESS',
            matchId: match.id,
            playerId: move.playerId,
            type: 'CHECK_GIVEN',
            data: { ply: move.ply },
          }));
        }
        if (move.checkmate) {
          events.push(adapter.createEvent({
            gameId: 'CHESS',
            matchId: match.id,
            playerId: move.playerId,
            type: 'CHECKMATE',
            data: { ply: move.ply },
          }));
        }
        if (move.gameOver) {
          events.push(...finishEvents(match, move.result, adapter));
        }
        setSelectedSquare(null);
        persist(events);
        setVersion((value) => value + 1);
      } catch (moveError) {
        setError(moveError.message);
      }
      return;
    }

    if (piece?.color === currentColor) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  function resign() {
    try {
      const outcome = match.resign();
      const events = finishEvents(match, outcome.winnerColor, adapter);
      persist(events);
      setVersion((value) => value + 1);
      setError('');
    } catch (resignError) {
      setError(resignError.message);
    }
  }

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

  return (
    <main className="match-layout">
      <header className="match-topbar">
        <button className="text-button" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> Consola
        </button>
        <div className="match-brand">
          <span className="brand-mark motion-safe:animate-pixel-glow">G</span>
          <span>GAME<span className="brand-highlight">CONSOLE</span></span>
        </div>
        <span className="match-id">ID · {match.id.slice(0, 8).toUpperCase()}</span>
      </header>

      <div className="match-content">
        <section className="board-panel">
          <div className="match-heading">
            <div>
              <p className="eyebrow">Partida local · dos jugadores</p>
              <h1>Ajedrez</h1>
            </div>
            <span className={`match-state${match.status === 'finished' ? ' is-finished' : ''}`}>
              <span /> {match.status === 'finished' ? 'FINALIZADA' : 'EN CURSO'}
            </span>
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
                  const last = lastMove === square;
                  const legalTarget = legalTargets.has(square);
                  return (
                    <button
                      aria-label={`${square}${piece ? ` ${PIECE_NAMES[piece.type]} ${piece.color === 'w' ? 'blanco' : 'negro'}` : ''}${legalTarget ? ', movimiento legal' : ''}`}
                      aria-selected={selected}
                      className={`square${dark ? ' square--dark' : ''}${selected ? ' is-selected' : ''}${last ? ' is-last' : ''}${legalTarget ? ' is-legal' : ''}`}
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

          <div aria-live="polite" className="turn-banner">
            <span className="turn-banner__icon">{match.status === 'finished' ? '✓' : '♟'}</span>
            <div><strong>{statusText()}</strong><span>Las reglas y movimientos se validan con chess.js.</span></div>
            <span className="move-count">{match.moveCount} <small>JUGADAS</small></span>
          </div>
        </section>

        <aside className="match-sidebar">
          <section className="side-card">
            <div className="side-card__heading">
              <div><p className="eyebrow">Sesión activa</p><h2>Tu partida</h2></div>
              <span className="live-tag"><i /> LOCAL</span>
            </div>
            <div className="side-stat"><span>Identificador</span><code>{match.id}</code></div>
            <div className="side-stat"><span>Modo</span><strong>Dos jugadores</strong></div>
            <div className="side-stat"><span>Motor de reglas</span><strong>chess.js</strong></div>
            <div className="side-divider" />
            <div className="integration-note">
              <span aria-hidden="true">⌁</span>
              <div><strong>{deliverySummary}</strong><p>{delivery.message}</p></div>
            </div>
            {match.status === 'in-progress' && (
              <>
                <label className="control-label" htmlFor="promotion">Promoción de peón</label>
                <select id="promotion" onChange={(event) => setPromotion(event.target.value)} value={promotion}>
                  {PROMOTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
                <button className="button button--quiet button--full" onClick={resign} type="button">
                  Finalizar por abandono
                </button>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>

          <section className="side-card side-card--sessions">
            <div className="side-card__heading">
              <div><p className="eyebrow">Multisesión</p><h2>Partidas guardadas</h2></div>
              <span className="session-count">{matches.length}</span>
            </div>
            <div className="session-list">
              {matches.map((saved) => (
                <button
                  className={`session-item${saved.id === match.id ? ' is-active' : ''}`}
                  key={saved.id}
                  onClick={() => onOpenMatch(saved.id)}
                  type="button"
                >
                  <span className="session-icon">♞</span>
                  <span className="session-item__text"><strong>Ajedrez</strong><small>{saved.id.slice(0, 8).toUpperCase()}</small></span>
                  <span className={`session-status${saved.status === 'finished' ? ' is-done' : ''}`} />
                </button>
              ))}
            </div>
            <button className="text-button text-button--new" onClick={onBack} type="button">＋ Crear otra partida</button>
          </section>

          <div className="ai-note">
            <span aria-hidden="true">✳</span>
            <p><strong>Oponente Prolog</strong><br />Se integrará en una siguiente etapa. Esta versión es local y no usa IA.</p>
          </div>
        </aside>
      </div>
      <footer className="page-footer"><span>GAMECONSOLE · ETAPA 01</span><span>Diseñado para jugar mejor.</span></footer>
    </main>
  );
}
