import { readJsonResponse } from './httpResponse.js';

export async function requestPrologMove(fen, { signal, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const response = await fetchImpl('/api/prolog/move', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fen, depth: 2 }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  const data = await readJsonResponse(response, 'Prolog');
  if (data?.fen !== fen || !/^[a-h][1-8]$/.test(data?.move?.from) || !/^[a-h][1-8]$/.test(data?.move?.to)
    || (data.move.promotion && !['q', 'r', 'b', 'n'].includes(data.move.promotion))) throw new Error('Prolog devolvió una decisión inválida o para otra posición');
  return data;
}
