import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPrologMove } from '../src/services/prologClient.js';

test('envía FEN con plazo y rechaza decisiones ajenas, mal formadas o servicios caídos', async () => {
  const fen = 'position';
  const reply = await requestPrologMove(fen, { fetchImpl: async (url, request) => {
    assert.equal(url, '/api/prolog/move');
    assert.deepEqual(JSON.parse(request.body), { fen, depth: 2 });
    assert.ok(request.signal instanceof AbortSignal);
    return Response.json({ fen, move: { from: 'e7', to: 'e5' } });
  } });
  assert.equal(reply.move.from, 'e7');
  for (const data of [{ fen: 'other', move: { from: 'e7', to: 'e5' } }, { fen, move: null }, { fen, move: { from: 'e7', to: 'e8', promotion: 'k' } }]) {
    await assert.rejects(requestPrologMove(fen, { fetchImpl: async () => Response.json(data) }), /decisión inválida/);
  }
  await assert.rejects(requestPrologMove(fen, { fetchImpl: async () => new Response('', { status: 503 }) }), /Prolog no está disponible/);
});
