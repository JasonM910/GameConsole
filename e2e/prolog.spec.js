import { test, expect } from '@playwright/test';
import { ChessMatch } from '../src/games/chess/ChessMatch.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { playChessMove } from '../src/services/chessEvents.js';

async function chessRecord(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
    .map((key) => JSON.parse(localStorage[key])).find((record) => record.gameId === 'CHESS'));
}
async function mockEvents(page) {
  await page.route('**/api/events', (route) => {
    const events = route.request().postDataJSON();
    return route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
}
async function start(page) {
  await page.goto('/');
  await page.locator('.game-grid').getByRole('button', { name: /Ajedrez/ }).click();
  await expect(page.getByRole('radio', { name: 'Computadora · Prolog' })).toBeChecked();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await page.getByRole('gridcell', { name: /^e2 / }).click();
  await page.getByRole('gridcell', { name: /^e4/ }).click();
}

test('Prolog puede reintentarse y termina su turno mientras se consulta el panel', async ({ page }) => {
  await mockEvents(page);
  await page.route('**/api/stats*', (route) => route.fulfill({ json: { schemaVersion: 1, matches: [], players: [], games: [], metrics: [], patterns: [] } }));
  let calls = 0, release;
  const wait = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/prolog/move', async (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 503, json: { error: { message: 'Prolog detenido para esta prueba' } } });
    await wait;
    return route.fulfill({ json: { fen: route.request().postDataJSON().fen, move: { from: 'e7', to: 'e5' }, search: { depth: 2, nodes: 84, score: 0 } } });
  });
  await start(page);
  await expect(page.getByRole('alert')).toContainText('Prolog detenido');
  await expect(page.locator('.chess-board button:disabled')).toHaveCount(64);
  await page.getByRole('button', { name: 'Reintentar jugada Prolog' }).click();
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
  release();
  await expect.poll(async () => (await chessRecord(page)).events.filter((event) => event.type === 'MOVE_PLAYED').length).toBe(2);
  await page.getByRole('button', { name: /Volver a la partida/ }).click();
  await expect(page.locator('.chess-status')).toContainText('Turno de Blancas');
  expect(calls).toBe(2);
  await page.reload();
  await page.locator('.saved-card').first().click();
  await expect(page.locator('.chess-status')).toContainText('Turno de Blancas');
  expect((await chessRecord(page)).opponent).toBe('prolog');
  expect(calls).toBe(2);
});

test('integración real: Prolog da mate y GameStats recibe los movimientos y los dos resultados', async ({ page }) => {
  test.skip(process.env.GAMESTATS_LIVE !== '1', 'Requiere SWI-Prolog, Go y Scala reales');
  const adapter = new EventAdapter();
  const match = new ChessMatch({ opponent: 'prolog', players: { white: 'PLAYER_WHITE', black: 'PROLOG' } });
  for (const color of ['w', 'b']) match.appendEvent(adapter.createEvent({ gameId: 'CHESS', matchId: match.id, playerId: match.playerIdFor(color), type: 'MATCH_STARTED', data: { side: color === 'w' ? 'WHITE' : 'BLACK' } }));
  for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4']]) playChessMove(match, { from, to }, adapter);
  await page.addInitScript((record) => localStorage.setItem(`gameconsole:match:${record.id}`, JSON.stringify(record)), match.toJSON());
  await page.goto('/');
  await page.locator('.saved-card').first().click();
  await expect(page.locator('.chess-status--mate')).toContainText('Jaque mate · ganan Negras');
  const record = await chessRecord(page);
  expect(record.events.filter((event) => event.type === 'CHECKMATE')).toHaveLength(1);
  expect(record.events.filter((event) => event.type === 'MATCH_FINISHED').map((event) => event.data.result).sort()).toEqual(['LOSS', 'WIN']);
  expect(record.events.filter((event) => event.type === 'MOVE_PLAYED').at(-1).playerId).toBe('PROLOG');
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
  await page.getByRole('button', { name: 'Sincronizar y actualizar' }).click();
  const row = page.getByRole('row').filter({ hasText: match.id.slice(0, 8) });
  await expect(row).toContainText('PROLOG: Victoria');
  await expect(row).toContainText('PLAYER_WHITE: Derrota');
  const stats = await (await page.request.get(`/api/stats?gameId=CHESS&playerId=PROLOG`)).json();
  expect(stats.metrics.find((metric) => metric.matchId === match.id && metric.playerId === 'PROLOG' && metric.metric === 'movesPlayed').value).toBe(2);
});
