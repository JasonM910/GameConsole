import test from 'node:test';
import assert from 'node:assert/strict';
import { EventDelivery } from '../src/services/EventDelivery.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { fetchStats } from '../src/services/statsClient.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('un fallo conserva el lote y un reintento reutiliza IDs; solicitudes se serializan', async () => {
  let fail = true;
  const requests = [];
  const adapter = new EventAdapter({ endpoint: '/api/events', fetchImpl: async (url, options) => {
    const batch = JSON.parse(options.body); requests.push(batch);
    if (fail) throw new Error('sin conexión');
    return { ok: true, json: async () => ({ status: 'accepted', eventIds: batch.map((event) => event.eventId) }) };
  } });
  const events = [{ eventId: 'START' }, { eventId: 'POINT' }];
  const storage = memoryStorage();
  const readMatches = () => [{ id: 'match', events }];
  const delivery = new EventDelivery(adapter, { storage, readMatches });
  await assert.rejects(delivery.sync(), /sin conexión/);
  assert.equal(storage.getItem('gameconsole:delivered:match'), null);
  fail = false;
  await Promise.all([delivery.sync(), delivery.sync()]);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  events.push({ eventId: 'FINISH' });
  await new EventDelivery(adapter, { storage, readMatches }).sync();
  assert.deepEqual(requests[2], [{ eventId: 'FINISH' }]);
});

test('una confirmación parcial no marca eventos como entregados', async () => {
  const adapter = new EventAdapter({ endpoint: '/api/events', fetchImpl: async () => ({
    ok: true, json: async () => ({ status: 'accepted', eventIds: [] }),
  }) });
  await assert.rejects(adapter.sendBatch([{ eventId: 'E1' }]), /no confirmó/);
});

test('fetch nativo conserva el contexto global al llamarse desde el adaptador', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    assert.equal(this, globalThis, 'fetch requiere el contexto Window del navegador');
    return { ok: true, json: async () => ({ status: 'accepted', eventIds: ['E1'] }) };
  };
  try {
    const adapter = new EventAdapter({ endpoint: '/api/events' });
    const result = await adapter.sendBatch([{ eventId: 'E1' }]);
    assert.equal(result.status, 'sent');
  } finally { globalThis.fetch = original; }
});

test('el panel consume el esquema de Scala y codifica filtros sin calcular métricas', async () => {
  const document = { schemaVersion: 1, players: [], matches: [], games: [], metrics: [], patterns: [] };
  const result = await fetchStats({ gameId: 'PACMAN', playerId: 'J & 1', fetchImpl: async (url) => {
    assert.equal(url, '/api/stats?gameId=PACMAN&playerId=J+%26+1');
    return { ok: true, json: async () => document };
  } });
  assert.equal(result, document);
  await assert.rejects(fetchStats({ fetchImpl: async () => ({ ok: false, json: async () => ({ error: { message: 'Scala sin conexión' } }) }) }), /Scala sin conexión/);
  await assert.rejects(fetchStats({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /desconocido/);
});
