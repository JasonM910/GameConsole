import { test, expect } from '@playwright/test';

async function records(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
    .map((key) => JSON.parse(localStorage[key])));
}
async function start(page, name) {
  await page.locator('.game-grid').getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  return (await records(page)).sort((a, b) => b.createdAt - a.createdAt)[0];
}
async function mockServices(context) {
  await context.route('**/api/events', (route) => {
    const events = route.request().postDataJSON();
    return route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
  await context.route('**/api/stats*', (route) => route.fulfill({ json: { schemaVersion: 1, matches: [], players: [], games: [], metrics: [], patterns: [] } }));
}

test('dos instancias de Memoria y Pac-Man siguen ejecutándose al consultar el panel', async ({ page, context }) => {
  if (process.env.GAMESTATS_LIVE !== '1') await mockServices(context);
  await page.goto('/');
  const first = await start(page, 'Memoria');
  await page.getByRole('button', { name: /Consola/ }).click();
  const second = await start(page, 'Memoria');
  await page.getByRole('button', { name: /Consola/ }).click();
  const pacman = await start(page, 'Pac-Man');
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Partidas en ejecución' })).toContainText('3 partidas en curso');
  const before = await records(page);
  await expect.poll(async () => {
    const after = await records(page);
    return after.every((match) => match.activeMs > before.find((previous) => previous.id === match.id).activeMs + 500);
  }).toBe(true);
  const after = await records(page);
  if (process.env.GAMESTATS_LIVE === '1') {
    await page.getByRole('button', { name: 'Sincronizar y actualizar' }).click();
    for (const id of [first.id, second.id, pacman.id]) {
      await expect(page.getByRole('row').filter({ hasText: id.slice(0, 8) })).toContainText('En curso');
    }
    await expect.poll(async () => {
      const stats = await (await page.request.get('/api/stats')).json();
      return stats.metrics.find((metric) => metric.matchId === pacman.id && metric.metric === 'totalPoints')?.value ?? 0;
    }).toBeGreaterThan(0);
  }
  for (const match of after) {
    expect(match.status).toBe('in-progress');
    expect(match.events.every((event) => event.matchId === match.id)).toBe(true);
    expect(match.events.filter((event) => event.type === 'MATCH_STARTED')).toHaveLength(1);
  }
  expect(new Set(after.flatMap((match) => match.events.map((event) => event.eventId))).size).toBe(after.flatMap((match) => match.events).length);
  await page.locator('.session-monitor__item').filter({ hasText: first.id.slice(0, 8) }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const paused = (await records(page)).find((match) => match.id === first.id);
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
  await expect.poll(async () => (await records(page)).find((match) => match.id === second.id).activeMs).toBeGreaterThan(paused.activeMs + 1000);
  expect((await records(page)).find((match) => match.id === first.id).activeMs).toBe(paused.activeMs);
  expect((await records(page)).find((match) => match.id === pacman.id).status).toBe('in-progress');
});

test('dos pestañas ejecutan partidas independientes y una partida compartida tiene un solo escritor', async ({ page, context }) => {
  if (process.env.GAMESTATS_LIVE !== '1') await mockServices(context);
  await page.goto('/');
  const first = await start(page, 'Memoria');
  const other = await context.newPage();
  await other.goto('/');
  const second = await start(other, 'Memoria');
  const before = await records(other);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await other.bringToFront();
  await expect.poll(async () => {
    const after = await records(other);
    return [first.id, second.id].every((id) => after.find((match) => match.id === id).activeMs > before.find((match) => match.id === id).activeMs + 600);
  }).toBe(true);
  await other.getByRole('button', { name: /Consola/ }).click();
  await other.locator('.saved-card').filter({ hasText: first.id.slice(0, 8).toUpperCase() }).click();
  await expect(other.locator('.ownership-note')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
  await expect(other.locator('.memory-card:enabled')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  await page.close();
  await expect(other.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
  await other.getByRole('button', { name: 'Continuar', exact: true }).click();
  const after = await records(other);
  expect(after.find((match) => match.id === first.id).events.filter((event) => event.type === 'MATCH_STARTED')).toHaveLength(1);
  expect(after.find((match) => match.id === second.id).status).toBe('in-progress');
  if (process.env.GAMESTATS_LIVE === '1') {
    const stats = await (await other.request.get('/api/stats?gameId=MEMORY')).json();
    for (const id of [first.id, second.id]) {
      expect(stats.matches.find((match) => match.matchId === id).eventCount).toBe(1);
      expect(stats.matches.find((match) => match.matchId === id).result).toBe('UNFINISHED');
    }
  }
});

test('una partida rechazada no impide sincronizar otra cola pendiente desde la página', async ({ page }) => {
  let rejectedId, offline = true, offlineRequests = 0;
  const accepted = [];
  await page.route('**/api/events', async (route) => {
    const events = route.request().postDataJSON();
    if (offline) { offlineRequests += 1; return route.fulfill({ status: 503, json: { error: { message: 'Conexión inicial interrumpida para esta prueba' } } }); }
    rejectedId ??= events[0].matchId;
    if (events[0].matchId === rejectedId) return route.fulfill({ status: 400, json: { error: { message: 'Partida rechazada para esta prueba' } } });
    accepted.push(...events);
    return route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
  await page.goto('/');
  const first = await start(page, 'Memoria');
  await expect.poll(() => offlineRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Consola/ }).click();
  offline = false;
  const second = await start(page, 'Memoria');
  await expect.poll(() => accepted.some((event) => event.matchId === first.id)).toBe(true);
  expect(rejectedId).toBe(second.id);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`gameconsole:delivered:${id}`) ?? '[]').length, second.id)).toBe(0);
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem(`gameconsole:delivered:${id}`) ?? '[]').length, first.id)).toBeGreaterThan(0);
});
