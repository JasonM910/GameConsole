import test from 'node:test';
import assert from 'node:assert/strict';
import { EventDelivery } from '../src/services/EventDelivery.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { fetchStats } from '../src/services/statsClient.js';
import { gameStatsTarget } from '../scripts/devConfig.mjs';

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
  const failure = await delivery.sync();
  assert.equal(failure.status, 'failed');
  assert.match(failure.failures[0].message, /sin conexión/);
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

test('el proxy usa el puerto publicado de Compose y respeta un Go local explícito', () => {
  assert.equal(gameStatsTarget(), 'http://127.0.0.1:8088');
  assert.equal(gameStatsTarget({ GAMECONSOLE_PORT: '8090' }), 'http://127.0.0.1:8090');
  assert.equal(gameStatsTarget({ GAMESTATS_PROXY_TARGET: 'http://127.0.0.1:8080' }), 'http://127.0.0.1:8080');
});

test('el panel y el envío manejan errores vacíos o HTML del proxy sin errores de JSON', async () => {
  for (const [status, body] of [[500, ''], [502, '<html>Bad gateway</html>'], [503, '']]) {
    const fetchImpl = async () => new Response(body, { status });
    await assert.rejects(fetchStats({ fetchImpl }), new RegExp(`GameStats no está disponible \\(HTTP ${status}\\)`));
    const adapter = new EventAdapter({ endpoint: '/api/events', fetchImpl });
    const storage = memoryStorage();
    const delivery = new EventDelivery(adapter, { storage, readMatches: () => [{ id: 'P1', events: [{ eventId: 'E1' }] }] });
    const result = await delivery.sync();
    assert.equal(result.status, 'failed');
    assert.match(result.failures[0].message, /GameStats no está disponible/);
    assert.equal(storage.getItem('gameconsole:delivered:P1'), null);
  }
  await assert.rejects(fetchStats({ fetchImpl: async () => new Response('', { status: 200 }) }), /respuesta vacía/);
  await assert.rejects(fetchStats({ fetchImpl: async () => Response.json(null) }), /formato de estadísticas desconocido/);
});

test('una cola vacía no afirma que el servicio está conectado', async () => {
  const adapter = new EventAdapter({ endpoint: '/api/events', fetchImpl: () => assert.fail('No hay eventos que enviar') });
  const delivery = new EventDelivery(adapter, { storage: memoryStorage(), readMatches: () => [] });
  const result = await delivery.sync();
  assert.equal(result.status, 'idle');
  assert.equal(result.message, 'No hay eventos pendientes de envío.');
});

test('un rechazo persistente no bloquea otras partidas y cada una conserva el orden de sus lotes', async () => {
  const storage = memoryStorage();
  const requests = [];
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const matches = [{ id: 'bad', events: [{ eventId: 'bad-1' }] },
    { id: 'good', events: Array.from({ length: 205 }, (_, index) => ({ eventId: `good-${index}` })) }];
  const delivery = new EventDelivery({ endpoint: '/api/events', sendBatch: async (events) => {
    requests.push(events.map((event) => event.eventId));
    if (events[0].eventId === 'bad-1') { await blocked; throw new Error('HTTP 400'); }
    return { status: 'sent', eventIds: events.map((event) => event.eventId) };
  } }, { storage, readMatches: () => matches });
  const pending = delivery.sync();
  await new Promise(setImmediate);
  assert.equal(JSON.parse(storage.getItem('gameconsole:delivered:good')).length, 205, 'no espera la respuesta de la partida rechazada');
  assert.deepEqual(requests.filter((batch) => batch[0].startsWith('good')).map((batch) => [batch[0], batch.length]), [['good-0', 100], ['good-100', 100], ['good-200', 5]]);
  release();
  assert.equal((await pending).status, 'failed');
  assert.equal(storage.getItem('gameconsole:delivered:bad'), null);
  matches[1].events.push({ eventId: 'good-new' });
  assert.equal((await delivery.sync()).status, 'failed');
  assert.deepEqual(requests.at(-1), ['good-new']);
  assert.equal(JSON.parse(storage.getItem('gameconsole:delivered:good')).length, 206);
});
