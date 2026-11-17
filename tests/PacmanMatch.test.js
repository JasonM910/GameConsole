import test from 'node:test';
import assert from 'node:assert/strict';
import { PacmanMatch } from '../src/games/pacman/PacmanMatch.js';
import { Maze, positionKey } from '../src/games/pacman/Maze.js';
import { Pacman, Ghost } from '../src/games/pacman/Characters.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { collectGameEvents } from '../src/services/gameEvents.js';

const CORRIDOR = ['#######', '#P...G#', '#######'];
function playing(options = {}) {
  const game = new PacmanMatch(options);
  game.start(); game.start(); game.tick(800);
  game.ghosts.forEach((ghost) => { ghost.cooldownMs = 100000; });
  return game;
}

test('todos los consumibles son alcanzables y la casa tiene salida exclusiva para fantasmas', () => {
  const maze = new Maze();
  const queue = [maze.playerSpawn]; const visited = new Set(queue.map(positionKey));
  for (let i = 0; i < queue.length; i += 1) for (const next of maze.neighbors(queue[i])) {
    if (!visited.has(positionKey(next))) { visited.add(positionKey(next)); queue.push(next); }
  }
  for (const key of maze.items.keys()) assert.ok(visited.has(key), key);
  assert.equal(visited.has(positionKey(maze.ghostSpawn)), false);
  assert.ok(maze.distancesFrom(maze.ghostExit).has(positionKey(maze.ghostSpawn)));
  assert.deepEqual(maze.next(maze.ghostExit, 'down'), maze.ghostExit);
  assert.deepEqual(maze.next(maze.ghostExit, 'down', true), maze.door);
  assert.equal([...maze.items.values()].filter((item) => item === 'o').length, 4);
});

test('movimiento continuo, giro preparado e inversión en mitad del pasillo respetan paredes', () => {
  const maze = new Maze(['#####', '#P..#', '###.#', '#G..#', '#####']);
  const player = new Pacman(maze.playerSpawn);
  player.move(maze, 0.5);
  assert.deepEqual(player.visualPosition(maze), { x: 1.5, y: 1 });
  player.request('down'); player.move(maze, 1.5);
  assert.deepEqual(player.position, { x: 3, y: 1 });
  player.move(maze, 0.5);
  assert.deepEqual(player.visualPosition(maze), { x: 3, y: 1.5 });
  player.request('up');
  assert.deepEqual(player.visualPosition(maze), { x: 3, y: 1.5 });
  player.move(maze, 1);
  assert.deepEqual(player.position, { x: 3, y: 1 });
  assert.equal(player.destination, null);
});

test('los túneles conectan ambos extremos en las dos direcciones sin atravesar otras paredes', () => {
  const maze = new Maze();
  const y = maze.rows.findIndex((_, row) => maze.isTunnelRow(row));
  assert.deepEqual(maze.next({ x: 0, y }, 'left'), { x: maze.width - 1, y });
  assert.deepEqual(maze.next({ x: maze.width - 1, y }, 'right'), { x: 0, y });
  const player = new Pacman({ x: 0, y }, 'left');
  player.move(maze, 0.5);
  assert.equal(player.visualPosition(maze).x, -0.5);
  player.move(maze, 0.5);
  assert.deepEqual(player.position, { x: maze.width - 1, y });
  assert.deepEqual(maze.next({ x: 1, y: 1 }, 'up'), { x: 1, y: 1 });
});

test('pausar congela el reloj y restaurar conserva una posición entre casillas y sus eventos', () => {
  const game = playing({ rows: CORRIDOR });
  game.tick(80);
  assert.equal(game.player.progress, 0.5);
  collectGameEvents(game, new EventAdapter());
  game.pause(); const elapsed = game.activeMs; game.tick(5000);
  assert.equal(game.activeMs, elapsed);
  const saved = JSON.parse(JSON.stringify(game.toJSON()));
  const restored = PacmanMatch.fromJSON(saved);
  assert.deepEqual(restored.toJSON(), saved);
  restored.resume(); restored.tick(80);
  assert.equal(restored.score, 10);
  assert.deepEqual(restored.player.position, { x: 2, y: 1 });
  assert.equal(game.score, 0);
  const events = collectGameEvents(restored, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'PELLET_EATEN').length, 1);
  assert.equal(restored.events.filter((event) => event.type === 'MATCH_STARTED').length, 1);
});

test('los cuatro fantasmas tienen objetivos diferentes y los modos se pausan durante el poder', () => {
  const game = playing();
  assert.deepEqual(game.ghosts.map((ghost) => ghost.name), ['BLINKY', 'PINKY', 'INKY', 'CLYDE']);
  game.player.position = { x: 10, y: 12 }; game.player.direction = 'left';
  const targets = game.ghosts.map((ghost) => ghost.target(game.player, game.ghosts[0], game.maze, false));
  assert.equal(new Set(targets.map(positionKey)).size, 4);
  assert.equal(game.mode, 'scatter');
  game.tick(7000); assert.equal(game.mode, 'chase');
  game.powerMs = 6000; const before = game.modeElapsedMs;
  game.tick(3000); assert.equal(game.modeElapsedMs, before);
  assert.equal(game.mode, 'frightened');
  game.tick(3000); assert.equal(game.mode, 'chase');
});

test('las colisiones detectan cruces entre casillas y cada vida genera una sola pérdida', () => {
  const game = playing({ rows: ['######', '#P.G.#', '######'] });
  const ghost = game.ghosts[0];
  ghost.cooldownMs = 0; ghost.state = 'active'; ghost.direction = 'left';
  game.tick(200);
  assert.equal(game.lives, 2);
  assert.equal(game.phase, 'dying');
  game.tick(100);
  assert.equal(game.lives, 2);
  assert.equal(game.pendingEvents.filter((event) => event.type === 'LIFE_LOST').length, 1);
});

test('la cadena de poder puntúa 200, 400, 800 y 1600 sin duplicar fantasmas comidos', () => {
  const game = playing();
  game.maze.items.set(positionKey(game.player.position), 'o'); game.consume();
  for (const ghost of game.ghosts) {
    ghost.position = { ...game.player.position }; ghost.destination = null; ghost.progress = 0; ghost.cooldownMs = 0; ghost.state = 'active';
  }
  game.collide(); game.collide();
  assert.equal(game.score, 3050);
  assert.equal(game.lives, 3);
  assert.ok(game.ghosts.every((ghost) => ghost.state === 'returning'));
  const events = collectGameEvents(game, new EventAdapter());
  assert.deepEqual(events.filter((event) => event.type === 'GHOST_EATEN').map((event) => event.data.points), [200, 400, 800, 1600]);
});

test('los ojos regresan físicamente a la casa y esperan antes de salir otra vez', () => {
  const game = playing();
  const ghost = new Ghost('BLINKY', game.maze.ghostExit, 0, { state: 'returning', home: game.maze.ghostSpawn });
  for (let i = 0; i < 20; i += 1) game.advanceGhost(ghost, 16);
  assert.deepEqual(ghost.position, game.maze.ghostSpawn);
  assert.equal(ghost.state, 'house');
  assert.ok(ghost.cooldownMs > 0);
  const active = new Ghost('BLINKY', game.maze.ghostExit, 0, { direction: 'down' });
  active.move(game.maze, game.maze.ghostSpawn);
  assert.notDeepEqual(active.position, game.maze.door);
});

test('al perder las tres vidas la animación finaliza una sola partida', () => {
  const game = playing();
  for (let lives = 2; lives >= 0; lives -= 1) {
    const ghost = game.ghosts[0]; ghost.position = { ...game.player.position }; ghost.destination = null; ghost.progress = 0;
    ghost.cooldownMs = 0; ghost.state = 'active'; game.invulnerableMs = 0;
    game.collide(); assert.equal(game.lives, lives);
    game.tick(900);
    if (lives) { game.tick(700); game.ghosts.forEach((item) => { item.cooldownMs = 100000; }); }
  }
  assert.equal(game.result, 'LOSS'); game.tick(5000); game.end('LOSS');
  assert.equal(game.pendingEvents.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  assert.doesNotThrow(() => collectGameEvents(game, new EventAdapter()));
});

test('las cerezas aparecen por avance, suman puntos y expiran si no se comen', () => {
  const game = playing();
  const threshold = Math.floor(game.maze.totalPellets * 0.35);
  const pellets = [...game.maze.items].filter(([, item]) => item !== 'F').slice(0, threshold);
  for (const [key] of pellets) {
    const [x, y] = key.split(',').map(Number); game.player.position = { x, y }; game.player.destination = null; game.player.progress = 0; game.consume();
  }
  assert.equal(game.fruitMs, 9000);
  const previous = game.score; game.player.position = { ...game.maze.fruitSpawn }; game.consume();
  assert.equal(game.score, previous + 100);
  game.fruitMs = 100; game.maze.items.set(positionKey(game.maze.fruitSpawn), 'F');
  game.player.position = { ...game.maze.playerSpawn }; game.tick(101);
  assert.equal(game.maze.items.has(positionKey(game.maze.fruitSpawn)), false);
  assert.equal(game.pendingEvents.filter((event) => event.type === 'FRUIT_EATEN').length, 1);
});

test('completar un nivel conserva los puntos y la victoria emite el contrato de GameStats', () => {
  const game = new PacmanMatch({ rows: ['#####', '#P.o#', '#G F#', '#####'], maxLevels: 2 });
  game.start(); game.tick(800); game.ghosts.forEach((ghost) => { ghost.cooldownMs = 100000; });
  game.tick(320); assert.equal(game.phase, 'level-clear'); assert.equal(game.score, 60);
  game.tick(1000); assert.equal(game.level, 2); assert.ok(game.maze.pelletsLeft > 0);
  game.tick(700); game.ghosts.forEach((ghost) => { ghost.cooldownMs = 100000; });
  game.tick(400); game.tick(1000);
  assert.equal(game.result, 'WIN'); assert.equal(game.score, 120);
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'LEVEL_COMPLETED').length, 2);
  assert.equal(events.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  const restarted = new PacmanMatch(); assert.notEqual(restarted.id, game.id);
  assert.equal(restarted.score, 0); assert.equal(restarted.lives, 3);
});

test('las partidas antiguas conservan su laberinto, sus identificadores y sus eventos', () => {
  const game = playing({ rows: CORRIDOR }); game.tick(160); collectGameEvents(game, new EventAdapter());
  const old = game.toJSON(); delete old.phase; delete old.phaseMs; delete old.engineVersion;
  delete old.player.destination; delete old.player.progress;
  old.ghosts = old.ghosts.slice(0, 3).map(({ name, position, cooldownMs }) => ({ name, position, cooldownMs }));
  const restored = PacmanMatch.fromJSON(old);
  assert.equal(restored.id, game.id); assert.deepEqual(restored.maze.rows, CORRIDOR);
  assert.deepEqual(restored.events, game.events); assert.equal(restored.phase, 'playing');
  assert.equal(restored.player.progress, 0);
});

test('el laberinto completo se puede terminar en ambos niveles mediante movimientos legales', () => {
  const game = playing();
  let moves = 0;
  while (game.status !== 'finished' && moves < 2000) {
    game.ghosts.forEach((ghost) => { ghost.cooldownMs = 1000000; });
    if (game.phase !== 'playing') { game.tick(1000); continue; }
    const queue = [{ position: game.player.position, first: null }];
    const seen = new Set([positionKey(game.player.position)]);
    let direction;
    for (let i = 0; i < queue.length && !direction; i += 1) {
      const current = queue[i];
      const item = game.maze.items.get(positionKey(current.position));
      if (current.first && item && item !== 'F') { direction = current.first; break; }
      for (const next of game.maze.neighbors(current.position)) {
        if (!seen.has(positionKey(next))) { seen.add(positionKey(next)); queue.push({ position: next, first: current.first ?? next.direction }); }
      }
    }
    assert.ok(direction, 'debe existir un camino hacia el siguiente punto');
    game.setDirection(direction); game.tick(game.playerTileMs); moves += 1;
  }
  assert.equal(game.result, 'WIN');
  assert.equal(game.lives, 3);
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((event) => event.type === 'LEVEL_COMPLETED').length, 2);
  assert.equal(events.filter((event) => event.type === 'MATCH_FINISHED').length, 1);
  assert.equal(events.filter((event) => event.type === 'POWER_PELLET_EATEN').length, 8);
  assert.equal(events.reduce((total, event) => total + (event.data.points ?? 0), 0), game.score);
});
