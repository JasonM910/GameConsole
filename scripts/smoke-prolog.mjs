import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

const base = (process.env.GAMESTATS_BASE_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, '');
const health = await (await fetch(`${base}/api/prolog/health`)).json();
assert.equal(health.engine, 'SWI-Prolog');
const afterOpening = new Chess(); afterOpening.move('e4');
const positions = [new Chess().fen(), afterOpening.fen(),
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  'k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
  '7k/P7/8/8/8/8/8/7K w - - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2'];
await Promise.all(positions.map(async (fen, index) => {
  const response = await fetch(`${base}/api/prolog/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, depth: 2 }), signal: AbortSignal.timeout(15000) });
  assert.equal(response.ok, true, `Fallo HTTP en posición ${index}`);
  const reply = await response.json();
  assert.equal(reply.fen, fen);
  assert.equal(reply.search.algorithm, 'negamax-alpha-beta');
  assert.ok(reply.search.nodes > 1);
  const chess = new Chess(fen);
  assert.ok(chess.move(reply.move), `Prolog devolvió una jugada ilegal en posición ${index}`);
  if (index === positions.length - 1) assert.equal(chess.isCheckmate(), true);
}));
for (const body of [{ fen: 'invalid' }, { fen: positions[0], depth: 99 }]) {
  const response = await fetch(`${base}/api/prolog/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.message);
}
console.log(`Prolog correcto: ${positions.length} decisiones concurrentes validadas por chess.js, mate y rechazo de solicitudes inválidas.`);
