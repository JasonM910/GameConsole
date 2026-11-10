import test from 'node:test';
import assert from 'node:assert/strict';
import { EventAdapter } from '../src/services/EventAdapter.js';

test('genera eventos Chess con los campos comunes y los datos admitidos', () => {
  const adapter = new EventAdapter();
  const event = adapter.createEvent({
    gameId: 'CHESS',
    matchId: 'match-1',
    playerId: 'PLAYER_WHITE',
    type: 'MOVE_PLAYED',
    data: { ply: 1, piece: 'PAWN', from: 'e2', to: 'e4', thinkTimeSeconds: 0 },
  });

  assert.deepEqual(Object.keys(event), [
    'eventId', 'timestamp', 'gameId', 'gameVersion', 'matchId', 'playerId', 'type', 'data',
  ]);
  assert.equal(event.gameId, 'CHESS');
  assert.equal(new Date(event.timestamp).toISOString(), event.timestamp);
});

test('rechaza campos adicionales, movimientos inválidos y Carreras no soportado', () => {
  const adapter = new EventAdapter();
  assert.throws(() => adapter.createEvent({
    gameId: 'CHESS',
    matchId: 'match-1',
    playerId: 'PLAYER_WHITE',
    type: 'MOVE_PLAYED',
    data: { ply: 1, piece: 'PAWN', from: 'e2', to: 'e4', thinkTimeSeconds: 0, action: 'move' },
  }), /exactamente/);
  assert.throws(() => adapter.createEvent({
    gameId: 'CHESS',
    matchId: 'match-1',
    playerId: 'PLAYER_WHITE',
    type: 'MOVE_PLAYED',
    data: { ply: 1, piece: 'PAWN', from: 'e2', to: 'e2', thinkTimeSeconds: 0 },
  }), /diferentes/);
  assert.throws(() => adapter.createEvent({
    gameId: 'RACING',
    matchId: 'match-1',
    playerId: 'PLAYER_ONE',
    type: 'MATCH_STARTED',
    data: {},
  }), /no admite el juego/);
});

test('sin dirección configurada no inicia una solicitud ni simula entrega', async () => {
  const adapter = new EventAdapter({ fetchImpl: () => assert.fail('No debe enviar sin URL') });
  const result = await adapter.send({ eventId: 'event-1' });
  assert.equal(result.status, 'pending');
});

test('usa la dirección configurada y envía el formato de lote JSON', async () => {
  let request;
  const adapter = new EventAdapter({
    endpoint: 'https://stats.example.test/bridge',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 202 };
    },
  });
  const event = { eventId: 'event-1' };
  const result = await adapter.send(event);

  assert.equal(request.url, 'https://stats.example.test/bridge');
  assert.deepEqual(JSON.parse(request.options.body), [event]);
  assert.equal(result.status, 'sent');
});
