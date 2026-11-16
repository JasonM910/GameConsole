import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { gameStatsTarget } from './scripts/devConfig.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { proxy: { '/api': {
      target: gameStatsTarget(env),
      changeOrigin: true,
      configure(proxy) {
        proxy.on('error', (_error, _request, response) => {
          if (!response || !('writeHead' in response) || response.headersSent || response.writableEnded) return;
          response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ error: {
            code: 'gamestats_unavailable',
            message: 'No se pudo conectar con GameStats. Inicia los servicios con npm run services o reinicia npm run dev.',
          } }));
        });
      },
    } } },
  };
});
