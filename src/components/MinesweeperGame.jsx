import { useState } from 'react';
import { MinesweeperMatch } from '../games/minesweeper/MinesweeperMatch.js';
import ArcadeLayout from './ArcadeLayout.jsx';
import { useSinglePlayerGame } from './useSinglePlayerGame.js';

export default function MinesweeperGame(props) {
  const { match, act, error } = useSinglePlayerGame(MinesweeperMatch, props);
  const [flagMode, setFlagMode] = useState(false);
  const { board } = match;
  const playing = match.status === 'in-progress';
  const finished = match.status === 'finished';

  function restart() {
    if (match.status !== 'ready' && !finished) act((game) => game.end('LOSS'));
    props.onRestart('MINESWEEPER');
  }

  return (
    <ArcadeLayout {...props} title="Buscaminas" match={match} error={error} onRestart={restart}
      help={<p className="arcade-help">Abre todas las casillas sin minas para ganar. El primer clic es seguro. Después puedes colocar o retirar banderas con clic derecho o con «Marcar banderas», también en pantalla táctil. Los números indican las minas en las ocho casillas vecinas.</p>}
      onToggle={() => act((game) => game.status === 'ready' ? game.start() : game.status === 'paused' ? game.resume() : game.pause())}
      summary={<><div className="side-stat"><span>Tablero</span><strong>{board.rows} × {board.columns}</strong></div><div className="side-stat"><span>Minas / Banderas</span><strong>{board.mineCount} / {board.flagCount}</strong></div><div className="side-stat"><span>Casillas seguras abiertas</span><strong>{board.revealedCount} / {board.rows * board.columns - board.mineCount}</strong></div></>}
      toolbar={<div className="minesweeper-toolbar" role="group" aria-label="Acción sobre las casillas">
        <button className={`button ${!flagMode ? 'button--primary' : 'button--quiet'}`} aria-pressed={!flagMode} onClick={() => setFlagMode(false)} type="button">Abrir casillas</button>
        <button className={`button ${flagMode ? 'button--primary' : 'button--quiet'}`} aria-pressed={flagMode} disabled={!board.initialized || finished} onClick={() => setFlagMode(true)} type="button">⚑ Marcar banderas</button>
      </div>}>
      <div className="minesweeper-board" role="group" aria-label="Tablero de Buscaminas" style={{ gridTemplateColumns: `repeat(${board.columns}, minmax(0, 1fr))` }}>
        {board.cells.map((cell) => {
          const showMine = cell.mine && (cell.revealed || finished);
          const wrongFlag = finished && cell.flagged && !cell.mine;
          const description = showMine ? 'mina' : wrongFlag ? 'bandera incorrecta' : cell.flagged ? 'bandera' : cell.revealed ? `${cell.adjacentMines} minas cercanas` : 'oculta';
          return <button key={`${cell.row}:${cell.column}`} type="button"
            className={`minesweeper-cell${cell.revealed ? ' is-revealed' : ''}${cell.flagged ? ' is-flagged' : ''}${showMine ? ' is-mine' : ''}${showMine && cell.revealed ? ' is-triggered' : ''}${wrongFlag ? ' is-wrong-flag' : ''}`}
            data-adjacent={cell.revealed && !cell.mine ? cell.adjacentMines : undefined}
            aria-label={`Fila ${cell.row + 1}, columna ${cell.column + 1}: ${description}`}
            disabled={!playing || cell.revealed}
            onClick={() => act((game) => flagMode ? game.toggleFlag(cell.row, cell.column) : game.reveal(cell.row, cell.column))}
            onContextMenu={(event) => { event.preventDefault(); act((game) => game.toggleFlag(cell.row, cell.column)); }}>
            <span aria-hidden="true">{showMine ? '✹' : wrongFlag ? '×' : cell.flagged ? '⚑' : cell.revealed && cell.adjacentMines > 0 ? cell.adjacentMines : ''}</span>
          </button>;
        })}
      </div>
    </ArcadeLayout>
  );
}
