import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';

test('Vite devuelve JSON y HTTP 503 cuando GameStats rechaza la conexión', async () => {
  // Reservar y liberar un puerto local evita depender de un servicio externo.
  const probe = createHttpServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const target = `http://127.0.0.1:${probe.address().port}`;
  await new Promise((resolve) => probe.close(resolve));
  const original = process.env.GAMESTATS_PROXY_TARGET;
  process.env.GAMESTATS_PROXY_TARGET = target;
  let server;
  try {
    server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: true } });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const [path, method] of [['/api/stats', 'GET'], ['/api/events', 'POST']]) {
      const response = await fetch(`${origin}${path}`, { method, signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type'), /application\/json/);
      const payload = await response.json();
      assert.equal(payload.error.code, 'gamestats_unavailable');
      assert.match(payload.error.message, /npm run services/);
    }
  } finally {
    await server?.close();
    if (original === undefined) delete process.env.GAMESTATS_PROXY_TARGET;
    else process.env.GAMESTATS_PROXY_TARGET = original;
  }
});

test('Vite dirige decisiones a Prolog y estadísticas a Go usando destinos separados', async () => {
  const targets = [];
  const original = { GAMESTATS_PROXY_TARGET: process.env.GAMESTATS_PROXY_TARGET, PROLOG_PROXY_TARGET: process.env.PROLOG_PROXY_TARGET };
  let vite;
  try {
    for (const service of ['go', 'prolog']) {
      const server = createHttpServer((request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ service, path: request.url }));
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      targets.push(server);
    }
    process.env.GAMESTATS_PROXY_TARGET = `http://127.0.0.1:${targets[0].address().port}`;
    process.env.PROLOG_PROXY_TARGET = `http://127.0.0.1:${targets[1].address().port}`;
    vite = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: true } });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const decision = await (await fetch(`${origin}/api/prolog/move`, { method: 'POST' })).json();
    assert.deepEqual(decision, { service: 'prolog', path: '/api/prolog/move' });
    const stats = await (await fetch(`${origin}/api/stats`)).json();
    assert.deepEqual(stats, { service: 'go', path: '/api/stats' });
  } finally {
    await vite?.close();
    await Promise.all(targets.map((server) => new Promise((resolve) => server.close(resolve))));
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
