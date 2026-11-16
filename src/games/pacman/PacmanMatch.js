import { SinglePlayerMatch } from '../SinglePlayerMatch.js';
import { Maze, DIRECTIONS, positionKey, samePosition } from './Maze.js';
import { Pacman, Ghost } from './Characters.js';

export class PacmanMatch extends SinglePlayerMatch {
  constructor(options = {}) {
    super({ ...options, gameId: 'PACMAN' });
    this.maze = new Maze(options.rows, options.items);
    this.player = new Pacman(options.player?.position ?? this.maze.playerSpawn,
      options.player?.direction, options.player?.requestedDirection);
    this.ghosts = options.ghosts
      ? options.ghosts.map((ghost) => new Ghost(ghost.name, ghost.position, ghost.cooldownMs))
      : ['BLINKY', 'PINKY', 'INKY'].map((name, index) => new Ghost(name, this.maze.ghostSpawn, index * 1600));
    this.score = options.score ?? 0;
    this.lives = options.lives ?? 3;
    this.level = options.level ?? 1;
    this.maxLevels = options.maxLevels ?? 2;
    this.powerMs = options.powerMs ?? 0;
    this.invulnerableMs = options.invulnerableMs ?? 1800;
    this.step = options.step ?? 0;
    this.levelStartMs = options.levelStartMs ?? 0;
    this.stepMs = options.stepMs ?? 0;
  }

  static fromJSON(record) {
    if (record?.gameId !== 'PACMAN') throw new Error('El registro no es Pac-Man');
    return new PacmanMatch(record);
  }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'in-progress';
    this.emit('MATCH_STARTED');
  }
  setDirection(direction) {
    if (DIRECTIONS[direction] && this.status === 'in-progress') this.player.requestedDirection = direction;
  }

  tick(deltaMs = 180) {
    if (this.status !== 'in-progress' || deltaMs <= 0) return;
    this.stepMs += deltaMs;
    // Avance fijo: las velocidades y colisiones no dependen del refresco de React.
    while (this.stepMs >= 180 && this.status === 'in-progress') {
      this.stepMs -= 180;
      this.activeMs += 180;
      this.powerMs = Math.max(0, this.powerMs - 180);
      this.invulnerableMs = Math.max(0, this.invulnerableMs - 180);
      this.ghosts.forEach((ghost) => { ghost.cooldownMs = Math.max(0, ghost.cooldownMs - 180); });
      this.step += 1;
      this.player.move(this.maze);
      this.consume();
      if (this.collide()) continue;
      if (this.step % (this.level === 1 ? 2 : 1) === 0) {
        for (const ghost of this.ghosts) {
          ghost.move(this.maze, this.player.position, this.powerMs > 0, this.step);
          if (this.collide()) break;
        }
      }
      if (this.status === 'in-progress' && this.maze.pelletsLeft === 0) this.completeLevel();
    }
  }

  consume() {
    const key = positionKey(this.player.position);
    const item = this.maze.items.get(key);
    if (!item) return;
    this.maze.items.delete(key);
    const points = item === 'o' ? 50 : item === 'F' ? 100 : 10;
    this.score += points;
    if (item === 'o') {
      this.powerMs = 6000;
      this.emit('POWER_PELLET_EATEN', { points, powerDurationSeconds: 6 });
    } else if (item === 'F') this.emit('FRUIT_EATEN', { fruit: 'CHERRY', points });
    else this.emit('PELLET_EATEN', { points });
  }

  collide() {
    for (const ghost of this.ghosts) {
      if (ghost.cooldownMs > 0 || !samePosition(ghost.position, this.player.position)) continue;
      if (this.powerMs > 0) {
        this.score += 200;
        this.emit('GHOST_EATEN', { ghost: ghost.name, points: 200 });
        ghost.position = { ...this.maze.ghostSpawn };
        ghost.cooldownMs = 3000;
      } else if (this.invulnerableMs === 0) {
        this.lives -= 1;
        this.emit('LIFE_LOST', { remainingLives: this.lives, ghost: ghost.name });
        this.powerMs = 0;
        if (this.lives === 0) this.end('LOSS');
        else this.resetCharacters();
        return true;
      }
    }
    return false;
  }

  resetCharacters() {
    this.player = new Pacman(this.maze.playerSpawn);
    this.ghosts.forEach((ghost, index) => {
      ghost.position = { ...this.maze.ghostSpawn };
      ghost.cooldownMs = index * 1600;
    });
    this.invulnerableMs = 1800;
  }

  completeLevel() {
    this.emit('LEVEL_COMPLETED', { level: this.level,
      durationSeconds: Math.floor((this.activeMs - this.levelStartMs) / 1000) });
    if (this.level >= this.maxLevels) this.end('WIN');
    else {
      this.level += 1;
      this.levelStartMs = this.activeMs;
      this.maze = new Maze(this.maze.rows);
      this.powerMs = 0;
      this.resetCharacters();
    }
  }

  toJSON() {
    return { ...super.toJSON(), rows: this.maze.rows, items: [...this.maze.items],
      player: { ...this.player }, ghosts: this.ghosts.map((ghost) => ({ ...ghost })),
      score: this.score, lives: this.lives, level: this.level, maxLevels: this.maxLevels,
      powerMs: this.powerMs, invulnerableMs: this.invulnerableMs, step: this.step,
      stepMs: this.stepMs, levelStartMs: this.levelStartMs };
  }
}
