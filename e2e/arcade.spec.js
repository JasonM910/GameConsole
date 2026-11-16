import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith('integración real')) return;
  await page.route('**/api/events', async (route) => {
    const events = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
});

test('Pac-Man inicia, se mueve, pausa, restaura y reinicia con otro identificador', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Pac-Man/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await expect(page.getByRole('heading', { name: 'Pac-Man', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:')).map((key) => JSON.parse(localStorage[key])).find((record) => record.gameId === 'PACMAN').score)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Consola', exact: false }).click();
  await page.reload();
  await page.locator('.saved-card').first().click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva partida / Reiniciar' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:')).map((key) => JSON.parse(localStorage[key])));
  expect(saved).toHaveLength(2);
  expect(saved.find((record) => record.status === 'finished').result).toBe('LOSS');
});

test('Memoria permite encontrar la primera pareja y todas las siguientes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Memoria/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  const cards = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:')).map((key) => JSON.parse(localStorage[key])).find((record) => record.gameId === 'MEMORY').cards);
  const buttons = page.locator('.memory-card');
  for (const symbol of new Set(cards.map((card) => card.symbol))) {
    const pair = cards.map((card, index) => ({ ...card, index })).filter((card) => card.symbol === symbol);
    await buttons.nth(pair[0].index).click();
    await buttons.nth(pair[1].index).click();
    await expect(buttons.nth(pair[0].index)).toHaveClass(/is-matched/);
  }
  await expect(page.getByText('¡Victoria! Completaste el juego.')).toBeVisible();
  await expect(page.locator('.memory-card.is-matched')).toHaveCount(16);
});

test('estadísticas muestra ausencia de datos y errores del servicio', async ({ page }) => {
  await page.route('**/api/stats*', (route) => route.fulfill({ json: { schemaVersion: 1, players: [], matches: [], games: [], metrics: [], patterns: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Estadísticas/ }).click();
  await expect(page.getByText(/No hay estadísticas para estos filtros/)).toBeVisible();
  await page.route('**/api/stats*', (route) => route.fulfill({ status: 503, json: { error: { message: 'Scala no está disponible' } } }));
  await page.getByRole('button', { name: 'Sincronizar y actualizar' }).click();
  await expect(page.getByRole('alert')).toContainText('Scala no está disponible');
});

test('Ajedrez conserva movimientos legales y partidas independientes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await page.getByRole('gridcell', { name: /^e2 / }).click();
  await page.getByRole('gridcell', { name: /^e4/ }).click();
  await expect(page.getByText('Turno de Negras')).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /^e4 / })).toHaveClass(/is-last/);
});

test('integración real: Memoria envía su victoria y el panel muestra las métricas Scala', async ({ page }) => {
  test.skip(process.env.GAMESTATS_LIVE !== '1', 'Requiere los servicios reales de Compose');
  await page.goto('/');
  await page.getByRole('button', { name: /Memoria/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  const record = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:')).map((key) => JSON.parse(localStorage[key])).find((match) => match.gameId === 'MEMORY'));
  for (const symbol of new Set(record.cards.map((card) => card.symbol))) {
    for (const index of record.cards.map((card, index) => ({ ...card, index })).filter((card) => card.symbol === symbol).map((card) => card.index)) {
      await page.locator('.memory-card').nth(index).click();
    }
  }
  await expect(page.getByText('¡Victoria! Completaste el juego.')).toBeVisible();
  await expect(page.getByText('Eventos sincronizados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Consola/ }).click();
  await page.getByRole('button', { name: /Estadísticas/ }).click();
  const row = page.getByRole('row').filter({ hasText: record.id.slice(0, 8) });
  await expect(row).toContainText('Victoria');
  await expect(row).toContainText('Parejas: 8');
});
