import { test, expect } from '@playwright/test';

async function readMatch(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
    .map((key) => JSON.parse(localStorage[key])).filter((match) => match.gameId === 'MINESWEEPER')
    .sort((a, b) => b.createdAt - a.createdAt)[0]);
}

function buttonFor(page, cell) {
  return page.getByRole('button', { name: new RegExp(`^Fila ${cell.row + 1}, columna ${cell.column + 1}:`) });
}

async function startMatch(page) {
  await page.goto('/');
  await expect(page.getByText('04 EXPERIENCIAS')).toBeVisible();
  await page.getByRole('button', { name: /Buscaminas/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
  await expect(page.getByRole('heading', { name: 'Buscaminas', exact: true })).toBeVisible();
  await expect(page.locator('.minesweeper-cell')).toHaveCount(81);
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await buttonFor(page, { row: 4, column: 4 }).click();
  return readMatch(page);
}

async function finishBoard(page, record) {
  for (const cell of record.board.cells.filter((item) => !item.mine)) {
    const button = buttonFor(page, cell);
    if (await button.isEnabled()) await button.click();
  }
  await expect(page.getByText('¡Victoria! Completaste el juego.')).toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  });
  if (testInfo.title.startsWith('integración real')) return;
  await page.route('**/api/events', async (route) => {
    const events = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
});

test('Buscaminas marca y retira banderas, pausa, restaura y reinicia con otro ID', async ({ page }) => {
  const record = await startMatch(page);
  const mine = record.board.cells.find((cell) => cell.mine);
  const safe = record.board.cells.find((cell) => !cell.mine && !cell.revealed);
  await buttonFor(page, mine).click({ button: 'right' });
  await expect(buttonFor(page, mine)).toHaveAttribute('aria-label', /bandera$/);
  await buttonFor(page, mine).click();
  expect((await readMatch(page)).status).toBe('in-progress');
  await buttonFor(page, mine).click({ button: 'right' });
  await expect(buttonFor(page, mine)).toHaveAttribute('aria-label', /oculta$/);
  await page.getByRole('button', { name: /Marcar banderas/ }).click();
  await buttonFor(page, safe).click();
  await expect(buttonFor(page, safe)).toHaveAttribute('aria-label', /bandera$/);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(buttonFor(page, safe)).toBeDisabled();
  await page.reload();
  await page.locator('.saved-card').first().click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await expect(buttonFor(page, safe)).toHaveAttribute('aria-label', /bandera$/);
  await page.getByRole('button', { name: 'Nueva partida / Reiniciar' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible();
  const fresh = await readMatch(page);
  expect(fresh.id).not.toBe(record.id);
  expect(fresh.board.initialized).toBe(false);
  const previous = await page.evaluate((id) => JSON.parse(localStorage.getItem(`gameconsole:match:${id}`)), record.id);
  expect(previous.result).toBe('LOSS');
  expect(previous.events.filter((event) => event.type === 'MATCH_FINISHED')).toHaveLength(1);
});

test('Buscaminas gana al abrir las seguras y pierde al pisar una mina', async ({ page }) => {
  const record = await startMatch(page);
  await finishBoard(page, record);
  expect((await readMatch(page)).events.filter((event) => event.type === 'CELL_REVEALED')).toHaveLength(71);
  await page.getByRole('button', { name: 'Nueva partida / Reiniciar' }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await buttonFor(page, { row: 4, column: 4 }).click();
  const next = await readMatch(page);
  await buttonFor(page, next.board.cells.find((cell) => cell.mine)).click();
  await expect(page.getByText('Fin de partida. Inténtalo de nuevo.')).toBeVisible();
  await expect(page.locator('.minesweeper-cell.is-mine')).toHaveCount(10);
  const ended = await readMatch(page);
  expect(ended.result).toBe('LOSS');
  expect(ended.events.filter((event) => event.type === 'MINE_TRIGGERED')).toHaveLength(1);
});

test('integración real: Buscaminas envía eventos y muestra métricas y patrones Scala', async ({ page }) => {
  test.skip(process.env.GAMESTATS_LIVE !== '1', 'Requiere los servicios reales de GameStats');
  const record = await startMatch(page);
  const safe = record.board.cells.find((cell) => !cell.mine && !cell.revealed);
  const mine = record.board.cells.find((cell) => cell.mine);
  await buttonFor(page, safe).click({ button: 'right' });
  await buttonFor(page, safe).click({ button: 'right' });
  await buttonFor(page, mine).click({ button: 'right' });
  await finishBoard(page, record);
  await expect.poll(() => page.evaluate((id) => {
    const match = JSON.parse(localStorage.getItem(`gameconsole:match:${id}`));
    const confirmed = JSON.parse(localStorage.getItem(`gameconsole:delivered:${id}`) ?? '[]');
    return match.events.every((event) => confirmed.includes(event.eventId));
  }, record.id)).toBe(true);
  await page.getByRole('button', { name: /Consola/ }).click();
  await page.getByRole('button', { name: /Estadísticas/ }).click();
  const row = page.getByRole('row').filter({ hasText: record.id.slice(0, 8) });
  await expect(row).toContainText('Buscaminas');
  await expect(row).toContainText('Victoria');
  await expect(row).toContainText('Casillas reveladas: 71');
  await expect(row).toContainText('Banderas correctas (%): 50');
  await expect(page.getByText(/FLAG_CORRECTED/).first()).toBeVisible();
  await page.getByRole('combobox').selectOption('MINESWEEPER');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(row).toBeVisible();
});
