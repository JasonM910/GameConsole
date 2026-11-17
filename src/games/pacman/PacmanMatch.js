import { SinglePlayerMatch } from '../SinglePlayerMatch.js';
import { Maze, DIRECTIONS, positionKey, samePosition } from './Maze.js';
import { Pacman, Ghost } from './Characters.js';

const MODES = [7000, 20000, 7000, 20000, 5000, 20000, 5000, Infinity];
const GHOST_NAMES = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'];

export class PacmanMatch extends SinglePlayerMatch {
  constructor(options = {}) {
    super({ ...options, gameId: 'PACMAN' });
    this.maze = new Maze(options.rows, options.items);
    const player = options.player;
    this.player = new Pacman(player?.position ?? this.maze.playerSpawn, player?.direction, player?.requestedDirection, player?.destination, player?.progress);
    this.ghosts = options.ghosts
      ? options.ghosts.map((ghost) => new Ghost(ghost.name, ghost.position, ghost.cooldownMs, ghost))
      : GHOST_NAMES.map((name, index) => new Ghost(name, this.homeFor(index), index * 1800, { state: this.maze.door ? 'house' : 'active' }));
    this.score = options.score ?? 0;
    this.lives = options.lives ?? 3;
    this.level = options.level ?? 1;
    this.maxLevels = options.maxLevels ?? 2;
    this.powerMs = options.powerMs ?? 0;
    this.invulnerableMs = options.invulnerableMs ?? 0;
    this.step = options.step ?? 0;
    this.levelStartMs = options.levelStartMs ?? 0;
    this.phase = options.phase ?? (this.status === 'ready' ? 'ready' : 'playing');
    this.phaseMs = options.phaseMs ?? 0;
    this.modeIndex = options.modeIndex ?? 0;
    this.modeElapsedMs = options.modeElapsedMs ?? 0;
    this.ghostCombo = options.ghostCombo ?? 0;
    this.dynamicFruit = options.dynamicFruit ?? !options.rows;
    this.fruitMs = options.fruitMs ?? 0;
    this.fruitMilestones = [...(options.fruitMilestones ?? [])];
    this.popup = options.popup ? { ...options.popup, position: { ...options.popup.position } } : null;
    if (this.dynamicFruit && !this.fruitMs) this.maze.items.delete(positionKey(this.maze.fruitSpawn));
  }

  static fromJSON(record) {
    if (record?.gameId !== 'PACMAN') throw new Error('El registro no es Pac-Man');
    return new PacmanMatch(record);
  }

  get mode() { return this.powerMs > 0 ? 'frightened' : this.modeIndex % 2 === 0 ? 'scatter' : 'chase'; }
  get playerTileMs() { return 160 * Math.max(0.78, 1 - (this.level - 1) * 0.04); }

  homeFor(index) {
    const home = index && this.maze.door ? { x: this.maze.ghostSpawn.x + index - 2, y: this.maze.ghostSpawn.y + 1 } : this.maze.ghostSpawn;
    return this.maze.isOpen(home, true) ? home : this.maze.ghostSpawn;
  }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'in-progress';
    this.phase = 'ready';
    this.phaseMs = 800;
    this.emit('MATCH_STARTED');
  }

  setDirection(direction) {
    if (DIRECTIONS[direction] && this.status === 'in-progress' && (this.phase === 'ready' || this.phase === 'playing')) this.player.request(direction);
  }

  tick(deltaMs = 160) {
    if (this.status !== 'in-progress' || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = deltaMs;
    // Subpasos cortos: también detectan cruces de personajes entre dos casillas.
    while (remaining > 0.00001 && this.status === 'in-progress') {
      const delta = Math.min(16, remaining);
      remaining -= delta;
      this.activeMs += delta;
      this.step = Math.floor(this.activeMs / 16);
      if (this.popup) {
        this.popup.remainingMs -= delta;
        if (this.popup.remainingMs <= 0) this.popup = null;
      }
      if (this.phase !== 'playing') {
        this.phaseMs = Math.max(0, this.phaseMs - delta);
        if (this.phaseMs === 0) this.advancePhase();
        continue;
      }
      const wasPowered = this.powerMs > 0;
      this.powerMs = Math.max(0, this.powerMs - delta);
      this.invulnerableMs = Math.max(0, this.invulnerableMs - delta);
      if (!wasPowered) this.advanceMode(delta);
      if (this.dynamicFruit && this.fruitMs > 0) {
        this.fruitMs = Math.max(0, this.fruitMs - delta);
        if (!this.fruitMs) this.maze.items.delete(positionKey(this.maze.fruitSpawn));
      }
      const visited = this.player.move(this.maze, delta / this.playerTileMs);
      if (visited.length) this.consume();
      if (this.maze.pelletsLeft === 0) { this.completeLevel(); continue; }
      if (this.collide()) continue;
      for (const ghost of this.ghosts) this.advanceGhost(ghost, delta);
      this.collide();
    }
  }

  advancePhase() {
    if (this.phase === 'dying') {
      if (this.lives === 0) { this.end('LOSS'); return; }
      this.resetCharacters();
      this.phase = 'ready'; this.phaseMs = 700;
    } else if (this.phase === 'level-clear') {
      if (this.level >= this.maxLevels) { this.end('WIN'); return; }
      this.level += 1;
      this.levelStartMs = this.activeMs;
      this.maze = new Maze(this.maze.rows);
      this.fruitMilestones = [];
      this.fruitMs = 0;
      if (this.dynamicFruit) this.maze.items.delete(positionKey(this.maze.fruitSpawn));
      this.resetCharacters();
      this.phase = 'ready'; this.phaseMs = 700;
    } else this.phase = 'playing';
  }

  advanceMode(delta) {
    this.modeElapsedMs += delta;
    if (this.modeElapsedMs >= MODES[this.modeIndex]) {
      this.modeElapsedMs -= MODES[this.modeIndex];
      this.modeIndex = Math.min(MODES.length - 1, this.modeIndex + 1);
      for (const ghost of this.ghosts) if (ghost.state === 'active') ghost.reverse();
    }
  }

  advanceGhost(ghost, delta) {
    if (ghost.cooldownMs > 0) { ghost.cooldownMs = Math.max(0, ghost.cooldownMs - delta); return; }
    if (ghost.state === 'house') ghost.state = this.maze.door ? 'leaving' : 'active';
    if (ghost.state === 'returning' && samePosition(ghost.position, ghost.home) && !ghost.destination) {
      ghost.state = 'house'; ghost.cooldownMs = 1100; return;
    }
    if (ghost.state === 'leaving' && samePosition(ghost.position, this.maze.ghostExit) && !ghost.destination) ghost.state = 'active';
    const returning = ghost.state === 'returning';
    const routing = returning || ghost.state === 'leaving';
    const target = returning ? ghost.home : ghost.state === 'leaving' ? this.maze.ghostExit
      : ghost.target(this.player, this.ghosts[0], this.maze, this.mode === 'scatter');
    const frightened = this.powerMs > 0 && ghost.state === 'active';
    const tunnel = this.maze.isTunnelRow(ghost.position.y) && (ghost.position.x < 3 || ghost.position.x > this.maze.width - 4);
    const tileMs = returning ? 70 : frightened ? 290 : tunnel ? 260 : 190 * Math.max(0.72, 1 - (this.level - 1) * 0.1);
    ghost.move(this.maze, target, frightened, this.step, delta / tileMs, routing);
  }

  consume() {
    const key = positionKey(this.player.position);
    const item = this.maze.items.get(key);
    if (!item) return;
    this.maze.items.delete(key);
    const points = item === 'o' ? 50 : item === 'F' ? 100 : 10;
    this.score += points;
    if (item === 'o') {
      const duration = Math.max(2, 6 - (this.level - 1));
      this.powerMs = duration * 1000; this.ghostCombo = 0;
      for (const ghost of this.ghosts) if (ghost.state === 'active') ghost.reverse();
      this.emit('POWER_PELLET_EATEN', { points, powerDurationSeconds: duration });
    } else if (item === 'F') {
      this.fruitMs = 0;
      this.popup = { text: '+100', position: { ...this.player.position }, remainingMs: 900 };
      this.emit('FRUIT_EATEN', { fruit: 'CHERRY', points });
    } else this.emit('PELLET_EATEN', { points });
    if (this.dynamicFruit && item !== 'F') {
      const eaten = this.maze.totalPellets - this.maze.pelletsLeft;
      for (const milestone of [Math.floor(this.maze.totalPellets * 0.35), Math.floor(this.maze.totalPellets * 0.7)]) {
        if (eaten >= milestone && !this.fruitMilestones.includes(milestone)) {
          this.fruitMilestones.push(milestone);
          this.maze.items.set(positionKey(this.maze.fruitSpawn), 'F');
          this.fruitMs = 9000;
        }
      }
    }
  }

  collide() {
    if (this.phase !== 'playing' || this.status !== 'in-progress') return false;
    const player = this.player.visualPosition(this.maze);
    for (const ghost of this.ghosts) {
      if (ghost.cooldownMs > 0 || ghost.state !== 'active') continue;
      const position = ghost.visualPosition(this.maze);
      const dx = Math.abs(position.x - player.x);
      if (Math.hypot(Math.min(dx, Math.abs(this.maze.width - dx)), position.y - player.y) >= 0.65) continue;
      if (this.powerMs > 0) {
        const points = 200 * 2 ** Math.min(this.ghostCombo, 3);
        this.ghostCombo += 1; this.score += points;
        this.popup = { text: '+' + points, position: { ...ghost.position }, remainingMs: 900 };
        this.emit('GHOST_EATEN', { ghost: ghost.name, points });
        ghost.state = 'returning';
        ghost.reverse();
      } else if (this.invulnerableMs === 0) {
        this.lives -= 1;
        this.emit('LIFE_LOST', { remainingLives: this.lives, ghost: ghost.name });
        this.phase = 'dying'; this.phaseMs = 900;
        this.powerMs = 0;
        if (this.dynamicFruit) this.maze.items.delete(positionKey(this.maze.fruitSpawn));
        this.fruitMs = 0;
        return true;
      }
    }
    return false;
  }

  resetCharacters() {
    this.player = new Pacman(this.maze.playerSpawn);
    this.ghosts = this.ghosts.map((ghost, index) => new Ghost(ghost.name, this.homeFor(index), index * 1800, { state: this.maze.door ? 'house' : 'active' }));
    this.powerMs = 0; this.ghostCombo = 0; this.modeIndex = 0; this.modeElapsedMs = 0;
    this.invulnerableMs = 800;
    this.popup = null;
  }

  completeLevel() {
    if (this.phase !== 'playing' || this.status !== 'in-progress') return;
    this.emit('LEVEL_COMPLETED', { level: this.level, durationSeconds: Math.floor((this.activeMs - this.levelStartMs) / 1000) });
    this.phase = 'level-clear'; this.phaseMs = 1000;
  }

  toJSON() {
    return { ...super.toJSON(), engineVersion: 2, rows: [...this.maze.rows], items: [...this.maze.items],
      player: { ...this.player, position: { ...this.player.position }, destination: this.player.destination ? { ...this.player.destination } : null }, ghosts: this.ghosts.map((ghost) => ({ ...ghost, position: { ...ghost.position }, home: { ...ghost.home }, destination: ghost.destination ? { ...ghost.destination } : null })),
      score: this.score, lives: this.lives, level: this.level, maxLevels: this.maxLevels,
      powerMs: this.powerMs, invulnerableMs: this.invulnerableMs, step: this.step, levelStartMs: this.levelStartMs,
      phase: this.phase, phaseMs: this.phaseMs, modeIndex: this.modeIndex, modeElapsedMs: this.modeElapsedMs,
      ghostCombo: this.ghostCombo, dynamicFruit: this.dynamicFruit, fruitMs: this.fruitMs,
      fruitMilestones: [...this.fruitMilestones], popup: this.popup ? { ...this.popup, position: { ...this.popup.position } } : null };
  }
}
