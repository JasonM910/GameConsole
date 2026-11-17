import { test, expect } from '@playwright/test';

async function record(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gameconsole:match:'))
    .map((key) => JSON.parse(localStorage[key])).find((match) => match.gameId === 'PACMAN'));
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.__pacmanAudioContexts = [];
    if (NativeAudioContext) window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__pacmanAudioContexts.push(this); }
    };
  });
  if (!testInfo.title.startsWith('integración real')) await page.route('**/api/events', async (route) => {
    const events = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'accepted', eventIds: events.map((event) => event.eventId) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Pac-Man/ }).click();
  await page.getByRole('button', { name: /Nueva partida/ }).click();
});

test('el canvas anima entre casillas y Espacio pausa sin consumir tiempo', async ({ page }) => {
  await expect(page.locator('.pacman-overlay strong')).toHaveText('PAC-MAN');
  await expect(page.locator('.pacman-board canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect.poll(async () => (await record(page)).score).toBeGreaterThan(0);
  const changed = await page.evaluate(async () => {
    const canvas = document.querySelector('.pacman-board canvas');
    const ctx = canvas.getContext('2d');
    const first = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let frame = 0; frame < 4; frame += 1) await new Promise(requestAnimationFrame);
    const next = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return first.some((value, index) => value !== next[index]);
  });
  expect(changed).toBe(true);
  expect((await record(page)).ghosts.map((ghost) => ghost.name)).toEqual(['BLINKY', 'PINKY', 'INKY', 'CLYDE']);
  await page.keyboard.press('Space');
  await expect(page.locator('.pacman-overlay strong')).toHaveText('PAUSA');
  const paused = await record(page);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));
  expect((await record(page)).activeMs).toBe(paused.activeMs);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
});

test('el sonido se activa por gesto, se silencia con M y conserva la preferencia al restaurar', async ({ page }) => {
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect.poll(async () => (await record(page)).score).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__pacmanAudioContexts.some((audio) => audio.state === 'running'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Desactivar sonido' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: 'Activar sonido' })).toHaveAttribute('aria-pressed', 'false');
  const saved = await record(page);
  await page.reload();
  await page.locator('.saved-card').first().click();
  await expect(page.locator('.pacman-overlay strong')).toHaveText('PAUSA');
  await expect(page.getByRole('button', { name: 'Activar sonido' })).toBeVisible();
  const restored = await record(page);
  expect(restored.id).toBe(saved.id);
  expect(restored.score).toBe(saved.score);
  expect(restored.events.filter((event) => event.type === 'MATCH_STARTED')).toHaveLength(1);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: 'Desactivar sonido' })).toHaveAttribute('aria-pressed', 'true');
});

test('deslizar sobre el laberinto cambia la dirección sin desplazar la página', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect.poll(async () => (await record(page)).score).toBeGreaterThan(0);
  const bounds = await page.locator('.pacman-board').boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await record(page)).player.requestedDirection).toBe('left');
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('integración real: Pac-Man actualiza los puntos en Scala y conserva el resultado al reiniciar', async ({ page }) => {
  test.skip(process.env.GAMESTATS_LIVE !== '1', 'Requiere los servicios reales de GameStats');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect.poll(async () => (await record(page)).score).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const saved = await record(page);
  await expect.poll(() => page.evaluate((id) => {
    const match = JSON.parse(localStorage.getItem(`gameconsole:match:${id}`));
    const ids = JSON.parse(localStorage.getItem(`gameconsole:delivered:${id}`) ?? '[]');
    return match.events.every((event) => ids.includes(event.eventId));
  }, saved.id)).toBe(true);
  const response = await page.request.get('/api/stats?gameId=PACMAN&playerId=PLAYER_ONE');
  expect(response.ok()).toBe(true);
  const stats = await response.json();
  expect(stats.matches.find((match) => match.matchId === saved.id).result).toBe('UNFINISHED');
  expect(stats.metrics.find((metric) => metric.matchId === saved.id && metric.metric === 'totalPoints').value).toBe(saved.score);
  await page.getByRole('button', { name: 'Nueva partida / Reiniciar' }).click();
  await page.getByRole('button', { name: /Consola/ }).click();
  await page.getByRole('button', { name: /Estadísticas/ }).click();
  await page.getByRole('button', { name: 'Sincronizar y actualizar' }).click();
  const row = page.getByRole('row').filter({ hasText: saved.id.slice(0, 8) });
  await expect(row).toContainText('Derrota');
  await expect(row).toContainText(`Puntos: ${saved.score}`);
});
