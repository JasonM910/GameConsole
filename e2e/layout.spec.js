import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`los cuatro juegos muestran tablero y controles sin desplazarse en ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/events', async (route) => {
      const events = route.request().postDataJSON();
      await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
    });
    for (const game of ['Ajedrez', 'Pac-Man', 'Memoria', 'Buscaminas']) {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.game-grid').getByRole('button', { name: new RegExp(game) }).click();
      await page.getByRole('button', { name: /Nueva partida/ }).click();
      await expect(page.getByRole('heading', { name: game, exact: true })).toBeVisible();
      expect(await page.evaluate(() => scrollY), 'entrar al juego debe volver al inicio').toBe(0);
      const board = await page.locator('.chess-board,.pacman-board,.memory-board,.minesweeper-board').boundingBox();
      expect(board.y).toBeGreaterThan(0);
      expect(board.y + board.height, `tablero completo de ${game}`).toBeLessThanOrEqual(viewport.height);
      const controls = await page.locator('.arcade-actions,.chess-controls').boundingBox();
      expect(controls.y + controls.height, `controles de ${game}`).toBeLessThanOrEqual(viewport.height);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('button,select,.game-metrics,.chess-status')]
        .filter((element) => element.getClientRects().length)
        .some((element) => { const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }));
      expect(clipped, `controles dentro del ancho de ${game}`).toBe(false);
      if (viewport.height >= 700) {
        expect(await page.evaluate(() => document.documentElement.scrollHeight), `pantalla de ${game} sin scroll adicional`).toBeLessThanOrEqual(viewport.height + 1);
      }
    }
  });
}

test('los controles táctiles de Pac-Man caben y responden en horizontal', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.route('**/api/events', async (route) => {
      const events = route.request().postDataJSON();
      await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Pac-Man/ }).tap();
    await page.getByRole('button', { name: /Nueva partida/ }).tap();
    const pad = page.locator('.direction-pad');
    await expect(pad).toBeVisible();
    const bounds = await pad.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Iniciar', exact: true }).tap();
    await page.getByRole('button', { name: 'Mover up', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
      .map((key) => JSON.parse(localStorage[key])).find((record) => record.gameId === 'PACMAN').player.requestedDirection)).toBe('up');
  } finally { await context.close(); }
});
