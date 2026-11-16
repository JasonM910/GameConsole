import test from 'node:test';
import assert from 'node:assert/strict';
import { PacmanMatch } from '../src/games/pacman/PacmanMatch.js';
import { Maze, positionKey } from '../src/games/pacman/Maze.js';
import { EventAdapter } from '../src/services/EventAdapter.js';
import { collectGameEvents } from '../src/services/gameEvents.js';

test('todos los consumibles y fantasmas son alcanzables desde el jugador', () => {
  const maze = new Maze();
  const queue = [maze.playerSpawn];
  const visited = new Set(queue.map(positionKey));
  for (let index = 0; index < queue.length; index += 1) for (const next of maze.neighbors(queue[index])) {
    if (!visited.has(positionKey(next))) { visited.add(positionKey(next)); queue.push(next); }
  }
  for (const key of maze.items.keys()) assert.ok(visited.has(key), key);
  assert.ok(visited.has(positionKey(maze.ghostSpawn)));
});

test('movimiento, paredes, puntos, pausa y restauración mantienen estado', () => {
  const game = new PacmanMatch();
  game.start(); game.start();
  game.setDirection('up'); game.player.direction = 'up'; game.tick();
  assert.deepEqual(game.player.position, { x: 1, y: 1 });
  game.setDirection('right'); game.tick();
  assert.equal(game.score, 10);
  game.pause(); game.tick(1000);
  assert.equal(game.score, 10);
  assert.equal(game.activeMs, 360);
  const events = collectGameEvents(game, new EventAdapter());
  assert.equal(events.filter((e) => e.type === 'MATCH_STARTED').length, 1);
  assert.equal(events.filter((e) => e.type === 'PELLET_EATEN').length, 1);
  assert.deepEqual(PacmanMatch.fromJSON(game.toJSON()).toJSON(), game.toJSON());
  assert.equal(collectGameEvents(game, new EventAdapter()).length, 0);
});

test('los fantasmas persiguen, las colisiones descuentan una vida y terminan una vez', () => {
  const game = new PacmanMatch(); game.start();
  const ghost = game.ghosts[0];
  const before = { ...ghost.position };
  ghost.move(game.maze, game.player.position, false, 20);
  assert.notDeepEqual(ghost.position, before);
  for (let life = 2; life >= 0; life -= 1) {
    game.invulnerableMs = 0;
    game.ghosts.forEach((item) => { item.position = { ...game.player.position }; item.cooldownMs = 0; });
    game.collide();
    assert.equal(game.lives, life);
  }
  game.end('LOSS'); game.tick();
  assert.equal(game.status, 'finished');
  assert.equal(game.pendingEvents.filter((e) => e.type === 'MATCH_FINISHED').length, 1);
});

test('poderes, frutas, victoria y cambio de nivel generan el contrato existente', () => {
  const game = new PacmanMatch(); game.start();
  const key = positionKey(game.player.position);
  game.maze.items.set(key, 'o'); game.consume();
  game.ghosts[0].position = { ...game.player.position }; game.collide();
  assert.equal(game.score, 250);
  assert.equal(game.lives, 3);
  game.maze.items.set(key, 'F'); game.consume();
  assert.equal(game.score, 350);
  game.maze.items.clear(); game.completeLevel();
  assert.equal(game.level, 2);
  assert.ok(game.maze.pelletsLeft > 0);
  game.maze.items.clear(); game.completeLevel();
  assert.equal(game.result, 'WIN');
  assert.doesNotThrow(() => collectGameEvents(game, new EventAdapter()));
  const restarted = new PacmanMatch();
  assert.notEqual(restarted.id, game.id);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.lives, 3);
});
