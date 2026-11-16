import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PacmanMatch } from '../src/games/pacman/PacmanMatch.js';
import { MemoryMatch } from '../src/games/memory/MemoryMatch.js';
import { ChessMatch } from '../src/games/chess/ChessMatch.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { collectGameEvents } from '../src/services/gameEvents.js';

const base = (process.env.GAMESTATS_BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const adapter = new EventAdapter();
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  assert.equal(response.ok, true, JSON.stringify(data));
  return data;
}

function fixtures() {
  const pacman = new PacmanMatch({ rows: ['#####', '#P.o#', '#G F#', '#####'], maxLevels: 1 });
  pacman.ghosts.forEach((ghost) => { ghost.cooldownMs = 10000; });
  pacman.start(); pacman.tick(360);
  assert.equal(pacman.result, 'WIN');
  collectGameEvents(pacman, adapter);
  const memory = new MemoryMatch(); memory.start(); memory.tick(1000);
  for (const symbol of new Set(memory.cards.map((card) => card.symbol))) {
    for (const card of memory.cards.filter((card) => card.symbol === symbol)) memory.flip(card.id);
  }
  assert.equal(memory.result, 'WIN');
  collectGameEvents(memory, adapter);
  const chess = new ChessMatch();
  const emit = (playerId, type, data) => chess.appendEvent(adapter.createEvent({ gameId: 'CHESS', matchId: chess.id, playerId, type, data }));
  for (const color of ['w', 'b']) emit(chess.playerIdFor(color), 'MATCH_STARTED', { side: color === 'w' ? 'WHITE' : 'BLACK' });
  for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
    const move = chess.playMove({ from, to });
    emit(move.playerId, 'MOVE_PLAYED', { ply: move.ply, piece: move.piece, from, to, thinkTimeSeconds: move.thinkTimeSeconds });
    if (move.gaveCheck) emit(move.playerId, 'CHECK_GIVEN', { ply: move.ply });
    if (move.checkmate) emit(move.playerId, 'CHECKMATE', { ply: move.ply });
  }
  for (const color of ['w', 'b']) emit(chess.playerIdFor(color), 'MATCH_FINISHED', { result: chess.result === color ? 'WIN' : 'LOSS', durationSeconds: chess.elapsedSeconds() });
  return [pacman, memory, chess].map((match) => ({ id: match.id, gameId: match.gameId, events: match.events }));
}

await request('/health');
let records;
if (process.argv.includes('--verify')) {
  assert.ok(process.env.INTEGRATION_RECEIPT, 'Define INTEGRATION_RECEIPT para comprobar un reinicio');
  records = JSON.parse(await readFile(process.env.INTEGRATION_RECEIPT, 'utf8'));
} else {
  records = fixtures();
  const events = records.flatMap((record) => record.events);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const acknowledgement = await request('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(events) });
    assert.deepEqual(acknowledgement.eventIds, events.map((event) => event.eventId));
  }
  const rejected = await fetch(`${base}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[{"gameId":"UNKNOWN"}]' });
  assert.equal(rejected.status, 400);
  if (process.env.INTEGRATION_RECEIPT) await writeFile(process.env.INTEGRATION_RECEIPT, JSON.stringify(records));
}
const result = await request('/api/stats');
assert.equal(result.schemaVersion, 1);
for (const record of records) {
  const match = result.matches.find((item) => item.matchId === record.id);
  assert.ok(match, `Falta partida ${record.id}`);
  assert.equal(match.eventCount, record.events.length);
  assert.equal(match.result, record.gameId === 'CHESS' ? 'DECIDED' : 'WIN');
  if (record.gameId === 'PACMAN') assert.equal(result.metrics.find((metric) => metric.matchId === record.id && metric.metric === 'totalPoints').value, 60);
  if (record.gameId === 'MEMORY') assert.equal(result.metrics.find((metric) => metric.matchId === record.id && metric.metric === 'pairsFound').value, 8);
}
const filtered = await request('/api/stats?gameId=MEMORY&playerId=PLAYER_ONE');
assert.ok(filtered.matches.every((match) => match.gameId === 'MEMORY'));
console.log(`Integración correcta: ${records.length} partidas reales, eventos idempotentes, métricas Scala y filtros${process.argv.includes('--verify') ? ', persistencia tras reinicio' : ''}.`);
