import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessMatch } from '../src/games/chess/ChessMatch.js';

test('una partida tiene un identificador y mantiene sus movimientos de forma independiente', () => {
  const first = new ChessMatch();
  const second = new ChessMatch();
  assert.notEqual(first.id, second.id);

  const opening = first.playMove({ from: 'e2', to: 'e4' });
  assert.equal(opening.ply, 1);
  assert.equal(opening.playerId, 'PLAYER_WHITE');
  assert.equal(first.turn, 'b');
  assert.equal(second.turn, 'w');
});

test('rechaza movimientos ilegales sin cambiar el tablero', () => {
  const match = new ChessMatch();
  const startingPosition = match.engine.fen();
  assert.throws(() => match.playMove({ from: 'e2', to: 'e5' }));
  assert.equal(match.engine.fen(), startingPosition);
  assert.equal(match.turn, 'w');
});

test('registra una captura y reconoce jaque mate y resultado', () => {
  const captureMatch = new ChessMatch();
  captureMatch.playMove({ from: 'e2', to: 'e4' });
  captureMatch.playMove({ from: 'd7', to: 'd5' });
  const capture = captureMatch.playMove({ from: 'e4', to: 'd5' });
  assert.equal(capture.capturedPiece, 'PAWN');

  const match = new ChessMatch();
  for (const [from, to] of [
    ['e2', 'e4'],
    ['f7', 'f6'],
    ['d2', 'd4'],
    ['g7', 'g5'],
  ]) {
    match.playMove({ from, to });
  }
  const mate = match.playMove({ from: 'd1', to: 'h5' });
  assert.equal(mate.gaveCheck, true);
  assert.equal(mate.checkmate, true);
  assert.equal(mate.result, 'w');
  assert.equal(match.status, 'finished');
});

test('serializa y restaura la posición, la historia y el identificador', () => {
  const original = new ChessMatch();
  original.playMove({ from: 'e2', to: 'e4' });
  original.playMove({ from: 'e7', to: 'e5' });

  const restored = ChessMatch.fromJSON(original.toJSON());
  assert.equal(restored.id, original.id);
  assert.equal(restored.engine.fen(), original.engine.fen());
  assert.equal(restored.moveCount, 2);
  assert.equal(restored.turn, 'w');
});
