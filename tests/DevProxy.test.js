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
