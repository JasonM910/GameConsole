import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/events', async (route) => {
    const events = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Ajedrez/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
});

async function move(page, from, to) {
  await page.getByRole('gridcell', { name: new RegExp(`^${from}\\b`) }).click();
  await page.getByRole('gridcell', { name: new RegExp(`^${to}\\b`) }).click();
}

test('el jaque destaca al rey y desaparece al responder, sin anunciar mate', async ({ page }) => {
  for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['f1', 'b5']]) await move(page, from, to);
  await expect(page.locator('.chess-status--check')).toContainText('Jaque a Negras');
  await expect(page.locator('.match-state')).toHaveText('JAQUE');
  await expect(page.getByRole('gridcell', { name: /^e8 .*en jaque$/ })).toHaveClass(/is-threatened/);
  await expect(page.locator('.chess-status .move-count')).toContainText('Bb5+');
  await move(page, 'c7', 'c6');
  await expect(page.locator('.chess-status')).toContainText('Turno de Blancas');
  await expect(page.locator('.square.is-threatened')).toHaveCount(0);
  await page.getByRole('button', { name: 'Finalizar por abandono' }).click();
  await expect(page.locator('.chess-status')).toContainText('Abandono');
  await expect(page.locator('.chess-status--mate')).toHaveCount(0);
});

test('el jaque mate queda visible, bloquea el tablero y se conserva al restaurar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await move(page, from, to);
  const notice = page.locator('.chess-status--mate');
  await expect(notice).toContainText('Jaque mate · ganan Negras');
  await expect(page.locator('.match-state')).toHaveText('JAQUE MATE');
  await expect(page.getByRole('gridcell', { name: /^e1 .*jaque mate$/ })).toHaveClass(/is-threatened/);
  await expect(page.locator('.chess-board button:disabled')).toHaveCount(64);
  expect((await notice.boundingBox()).y + (await notice.boundingBox()).height).toBeLessThan(844);
  await page.reload();
  await page.locator('.saved-card').first().click();
  await expect(notice).toContainText('Jaque mate · ganan Negras');
  const events = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
    .map((key) => JSON.parse(localStorage[key]))[0].events);
  expect(events.filter((event) => event.type === 'CHECKMATE')).toHaveLength(1);
  expect(events.filter((event) => event.type === 'MATCH_FINISHED').map((event) => event.data.result).sort()).toEqual(['LOSS', 'WIN']);
});
