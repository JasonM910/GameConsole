import { readJsonResponse } from './httpResponse.js';

export async function fetchStats({ endpoint = import.meta.env?.VITE_GAMESTATS_STATS_URL ?? '/api/stats',
  gameId = '', playerId = '', signal, fetchImpl = globalThis.fetch } = {}) {
  const query = new URLSearchParams();
  if (gameId) query.set('gameId', gameId);
  if (playerId) query.set('playerId', playerId);
  const response = await fetchImpl(`${endpoint}${query.size ? `?${query}` : ''}`, { signal, headers: { Accept: 'application/json' } });
  const data = await readJsonResponse(response);
  if (data?.schemaVersion !== 1 || ['players', 'matches', 'games', 'metrics', 'patterns'].some((key) => !Array.isArray(data[key]))) {
    throw new Error('GameStats devolvió un formato de estadísticas desconocido');
  }
  return data;
}
