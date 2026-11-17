import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchRuntime } from '../src/services/MatchRuntime.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { MemoryMatch } from '../src/games/memory/MemoryMatch.js';
import { PacmanMatch } from '../src/games/pacman/PacmanMatch.js';
import { ChessMatch } from '../src/games/chess/ChessMatch.js';

const flush = () => new Promise(setImmediate);
function fixture(t, decide) {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let now = 0;
  const runtime = new MatchRuntime(new EventAdapter(), { storage, now: () => now, decide,
    locks: { request: (_key, _options, callback) => callback() } });
  runtime.start();
  t.after(() => runtime.stop());
  return { runtime, storage, advance: (delta) => { now += delta; runtime.advance(); },
    open: async (match) => {
      storage.setItem(`gameconsole:match:${match.id}`, JSON.stringify(match.toJSON()));
      const entry = runtime.open(match.toJSON());
      await flush(); return entry;
    } };
}

test('varias sesiones avanzan sin vista; pausar una no detiene las demás y cerrar conserva los eventos', async (t) => {
  const { runtime, open, advance, storage } = fixture(t);
  const memory = await open(new MemoryMatch({ timeLimitSeconds: 3 }));
  const pacman = await open(new PacmanMatch());
  runtime.act(memory.model.id, (match) => match.start());
  runtime.act(pacman.model.id, (match) => match.start());
  advance(1200);
  assert.equal(memory.model.activeMs, 1200);
  assert.ok(pacman.model.activeMs > 1199);
  runtime.act(pacman.model.id, (match) => match.pause());
  const pacmanTime = pacman.model.activeMs;
  advance(2000);
  assert.equal(memory.model.result, 'LOSS');
  assert.equal(memory.model.events.filter((event) => event.type === 'TIME_EXPIRED').length, 1);
  assert.equal(pacman.model.activeMs, pacmanTime);
  const events = memory.model.events;
  assert.ok(events.every((event) => event.matchId === memory.model.id));
  runtime.stop();
  assert.equal(JSON.parse(storage.getItem(`gameconsole:match:${memory.model.id}`)).status, 'finished');
  assert.equal(JSON.parse(storage.getItem(`gameconsole:match:${pacman.model.id}`)).status, 'paused');
});

test('Prolog responde una sola vez por turno y sus jugadas generan eventos del contrato', async (t) => {
  let reply, calls = 0;
  const { runtime, open, advance } = fixture(t, (fen) => { calls += 1; return new Promise((resolve) => { reply = () => resolve({ fen, move: { from: 'e7', to: 'e5' }, search: { nodes: 40, depth: 2 } }); }); });
  const entry = await open(new ChessMatch({ opponent: 'prolog', players: { white: 'PLAYER_WHITE', black: 'PROLOG' } }));
  runtime.moveChess(entry.model.id, { from: 'e2', to: 'e4' });
  advance(1000); advance(1000);
  assert.equal(entry.aiStatus, 'thinking');
  assert.equal(calls, 1);
  runtime.moveChess(entry.model.id, { from: 'd7', to: 'd5' });
  assert.equal(entry.model.moveCount, 1, 'el humano no controla al oponente');
  reply(); await flush();
  assert.equal(entry.model.moveCount, 2);
  assert.equal(entry.model.turn, 'w');
  assert.deepEqual(entry.model.events.map((event) => event.playerId), ['PLAYER_WHITE', 'PROLOG']);
  assert.equal(entry.aiInfo.nodes, 40);
});

test('un fallo de Prolog permite reintentar y una renuncia descarta la respuesta tardía', async (t) => {
  let resolve;
  let calls = 0;
  const { runtime, open } = fixture(t, async (fen) => {
    calls += 1;
    if (calls === 1) return { fen, move: { from: 'e7', to: 'e4' } };
    return new Promise((done) => { resolve = () => done({ fen, move: { from: 'e7', to: 'e5' } }); });
  });
  const entry = await open(new ChessMatch({ opponent: 'prolog' }));
  runtime.moveChess(entry.model.id, { from: 'e2', to: 'e4' });
  await flush();
  assert.equal(entry.aiStatus, 'error');
  assert.equal(entry.model.moveCount, 1);
  runtime.retryComputer(entry.model.id);
  assert.equal(calls, 2);
  runtime.resign(entry.model.id);
  assert.equal(entry.aiStatus, 'idle');
  assert.equal(entry.model.result, 'b', 'renuncia el humano aunque sea turno de Prolog');
  resolve(); await flush();
  assert.equal(entry.model.moveCount, 1);
  assert.equal(entry.model.events.filter((event) => event.type === 'MATCH_FINISHED').length, 2);
});

test('una sesión sin propiedad observa registros externos y no puede modificar ni guardar', async (t) => {
  const { runtime, open, storage, advance } = fixture(t);
  const entry = await open(new MemoryMatch());
  entry.owned = false;
  const record = entry.model.toJSON();
  record.status = 'in-progress'; record.activeMs = 2500;
  runtime.refresh(record);
  runtime.act(record.id, (match) => match.end('LOSS'));
  advance(1000);
  assert.equal(entry.model.activeMs, 2500);
  assert.equal(entry.model.status, 'in-progress');
  assert.equal(JSON.parse(storage.getItem(`gameconsole:match:${record.id}`)).status, 'ready');
});
