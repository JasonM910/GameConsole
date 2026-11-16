import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryMatch } from '../src/games/memory/MemoryMatch.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { collectGameEvents } from '../src/services/gameEvents.js';

test('todas las cartas forman parejas reales y se puede terminar después de la primera', () => {
  const game = new MemoryMatch(); game.start(); game.start();
  const symbols = [...new Set(game.cards.map((card) => card.symbol))];
  for (const symbol of symbols) {
    const pair = game.cards.filter((card) => card.symbol === symbol);
    assert.equal(pair.length, 2);
    assert.equal(game.flip(pair[0].id), true);
    assert.equal(game.flip(pair[0].id), false);
    assert.equal(game.flip(pair[1].id), true);
    assert.equal(game.selected.length, 0);
  }
  assert.equal(game.pairsFound, 8);
  assert.equal(game.attempts, 8);
  assert.equal(game.result, 'WIN');
  assert.equal(game.flip(game.cards[0].id), false);
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'MATCH_STARTED').length, 1);
  assert.equal(events.filter((event) => event.type === 'PAIR_MATCHED').length, 8);
  assert.equal(events.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
});

test('un fallo bloquea una tercera carta, pausa el reloj y después libera el tablero', () => {
  const game = new MemoryMatch(); game.start();
  const first = game.cards[0];
  const second = game.cards.find((card) => card.symbol !== first.symbol);
  game.flip(first.id); game.flip(second.id);
  assert.equal(game.attempts, 1);
  assert.equal(game.flip(game.cards.find((card) => !game.selected.includes(card.id)).id), false);
  game.pause(); game.tick(1000);
  assert.equal(game.activeMs, 0);
  assert.equal(game.selected.length, 2);
  game.resume(); game.tick(800);
  assert.equal(game.selected.length, 0);
  assert.equal(game.flip(first.id), true);
  assert.deepEqual(MemoryMatch.fromJSON(game.toJSON()).toJSON(), game.toJSON());
  assert.doesNotThrow(() => collectGameEvents(game, new EventAdapter()));
});

test('al expirar el tiempo finaliza una sola vez y reiniciar produce otro ID', () => {
  const game = new MemoryMatch({ timeLimitSeconds: 1 }); game.start();
  game.tick(1000); game.tick(1000); game.end('LOSS');
  assert.equal(game.result, 'LOSS');
  assert.equal(game.remainingSeconds, 0);
  assert.equal(game.pendingEvents.filter((event) => event.type === 'TIME_EXPIRED').length, 1);
  assert.equal(game.pendingEvents.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  const fresh = new MemoryMatch();
  assert.notEqual(fresh.id, game.id);
  assert.equal(fresh.attempts, 0);
  assert.throws(() => new MemoryMatch({ rows: 3, columns: 3 }), /inválida/);
});
