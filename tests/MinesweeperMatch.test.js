import test from 'node:test';
import assert from 'node:assert/strict';
import { MinesweeperBoard } from '../src/games/minesweeper/MinesweeperBoard.js';
import { MinesweeperMatch } from '../src/games/minesweeper/MinesweeperMatch.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { collectGameEvents } from '../src/services/gameEvents.js';

const fixedOptions = { rows: 3, columns: 3, mineCount: 2, minePositions: [{ row: 0, column: 0 }, { row: 2, column: 2 }] };

test('el primer clic es seguro, las minas son únicas y las partidas son independientes', () => {
  for (const [row, column] of [[0, 0], [4, 4], [8, 8]]) {
    const game = new MinesweeperMatch({ random: () => 0 });
    assert.equal(game.reveal(row, column), false);
    game.start(); game.start();
    assert.equal(game.toggleFlag(0, 0), false);
    game.reveal(row, column);
    assert.equal(game.board.cells.filter((cell) => cell.mine).length, 10);
    assert.equal(game.board.cellAt(row, column).mine, false);
    assert.equal(game.board.cellAt(row, column).adjacentMines, 0);
    assert.equal(game.pendingEvents.filter((event) => event.type === 'MATCH_STARTED').length, 1);
  }
  // Un tablero denso también conserva segura la primera casilla.
  const dense = new MinesweeperBoard({ rows: 2, columns: 2, mineCount: 3 });
  assert.equal(dense.reveal(0, 0).triggered, null);
  assert.equal(dense.complete, true);
  const first = new MinesweeperMatch(); const second = new MinesweeperMatch();
  first.start(); first.reveal(4, 4);
  assert.notEqual(first.id, second.id);
  assert.equal(second.board.initialized, false);
});

test('los números cuentan las ocho casillas vecinas y las coordenadas inválidas no actúan', () => {
  const game = new MinesweeperMatch(fixedOptions); game.start();
  assert.equal(game.board.cellAt(1, 1).adjacentMines, 2);
  assert.equal(game.board.cellAt(0, 1).adjacentMines, 1);
  assert.equal(game.board.cellAt(0, 2).adjacentMines, 0);
  assert.equal(game.reveal(-1, 0), false);
  assert.equal(game.reveal(0, 3), false);
  assert.equal(game.toggleFlag(0.5, 1), false);
});

test('la apertura en cadena descubre las seguras y emite una sola victoria', () => {
  const game = new MinesweeperMatch({ rows: 4, columns: 4, mineCount: 1, minePositions: [{ row: 3, column: 3 }] });
  game.start(); game.tick(2300); game.reveal(0, 0);
  assert.equal(game.board.revealedCount, 15);
  assert.equal(game.board.cellAt(3, 3).revealed, false);
  assert.equal(game.result, 'WIN');
  assert.equal(game.reveal(3, 3), false);
  game.end('LOSS');
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'CELL_REVEALED').length, 15);
  assert.equal(events.filter((event) => event.type === 'BOARD_COMPLETED').length, 1);
  assert.equal(events.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  assert.deepEqual(events.at(-1).data, { result: 'WIN', durationSeconds: 2 });
});

test('las banderas protegen casillas, distinguen aciertos y errores, y se pueden retirar', () => {
  const game = new MinesweeperMatch(fixedOptions); game.start();
  game.reveal(1, 1);
  assert.equal(game.toggleFlag(1, 1), false);
  game.toggleFlag(0, 0);
  assert.equal(game.reveal(0, 0), false);
  game.toggleFlag(0, 0);
  game.toggleFlag(0, 1);
  game.toggleFlag(2, 2);
  assert.equal(game.board.flagCount, 2);
  assert.equal(game.toggleFlag(1, 0), false);
  const events = collectGameEvents(game, new EventAdapter());
  assert.deepEqual(events.filter((event) => event.type === 'FLAG_PLACED').map((event) => event.data.correct), [true, false, true]);
  assert.deepEqual(events.find((event) => event.type === 'FLAG_REMOVED').data, { row: 0, column: 0 });
});

test('pisar una mina finaliza con derrota una sola vez y no emite tablero completado', () => {
  const game = new MinesweeperMatch(fixedOptions); game.start(); game.reveal(1, 1);
  game.reveal(0, 0); game.reveal(2, 2); game.end('LOSS');
  assert.equal(game.result, 'LOSS');
  assert.equal(game.toggleFlag(2, 2), false);
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'MINE_TRIGGERED').length, 1);
  assert.equal(events.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  assert.equal(events.some((event) => event.type === 'BOARD_COMPLETED'), false);
  assert.deepEqual(events.at(-1).data, { result: 'LOSS', durationSeconds: 0 });
});

test('pausa y restauración conservan reloj, tablero, banderas y eventos', () => {
  const game = new MinesweeperMatch(fixedOptions); game.start(); game.reveal(1, 1); game.toggleFlag(0, 0);
  game.tick(1200); game.pause(); game.tick(5000);
  collectGameEvents(game, new EventAdapter());
  const restored = MinesweeperMatch.fromJSON(JSON.parse(JSON.stringify(game.toJSON())));
  assert.deepEqual(restored.toJSON(), game.toJSON());
  restored.resume(); restored.tick(800);
  assert.equal(restored.elapsedSeconds(), 2);
  assert.equal(game.elapsedSeconds(), 1);
  assert.equal(restored.board.cellAt(0, 0).flagged, true);
  const unstarted = new MinesweeperMatch();
  assert.equal(MinesweeperMatch.fromJSON(unstarted.toJSON()).board.initialized, false);
});

test('rechaza tableros inválidos y posiciones de minas repetidas o fuera del tablero', () => {
  for (const options of [{ rows: 0 }, { columns: 1 }, { mineCount: -1 }, { mineCount: 81 }, { rows: 2.5 }]) {
    assert.throws(() => new MinesweeperMatch(options), /inválida/);
  }
  assert.throws(() => new MinesweeperMatch({ ...fixedOptions, minePositions: [{ row: 0, column: 0 }, { row: 0, column: 0 }] }), /inválidas/);
  assert.throws(() => new MinesweeperMatch({ ...fixedOptions, minePositions: [{ row: 0, column: 0 }, { row: 8, column: 8 }] }), /inválidas/);
});
