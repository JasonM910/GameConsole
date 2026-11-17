import { DIRECTIONS, OPPOSITE, positionKey, samePosition } from './Maze.js';

class MovingCharacter {
  constructor(position, direction = 'left', destination = null, progress = 0) {
    Object.assign(this, { position: { ...position }, direction, destination: destination ? { ...destination } : null, progress });
  }

  advance(maze, distance, chooseDirection, ghost = false) {
    const visited = [];
    while (distance > 0.000001) {
      if (!this.destination) {
        const direction = chooseDirection();
        if (!direction) break;
        const next = maze.next(this.position, direction, ghost);
        if (samePosition(next, this.position)) break;
        this.direction = direction;
        this.destination = next;
        this.progress = 0;
      }
      const movement = Math.min(distance, 1 - this.progress);
      this.progress += movement;
      distance -= movement;
      if (this.progress >= 1 - 0.000001) {
        this.position = { ...this.destination };
        this.destination = null;
        this.progress = 0;
        visited.push({ ...this.position });
      }
    }
    return visited;
  }

  reverse() {
    this.direction = OPPOSITE[this.direction];
    if (this.destination) {
      const previous = this.position;
      this.position = this.destination;
      this.destination = previous;
      this.progress = 1 - this.progress;
    }
  }

  visualPosition(maze) {
    if (!this.destination) return { ...this.position };
    let dx = this.destination.x - this.position.x;
    if (Math.abs(dx) > 1) dx = this.direction === 'left' ? -1 : 1;
    return { x: this.position.x + dx * this.progress, y: this.position.y + (this.destination.y - this.position.y) * this.progress };
  }
}

export class Pacman extends MovingCharacter {
  constructor(position, direction = 'right', requestedDirection = direction, destination = null, progress = 0) {
    super(position, direction, destination, progress);
    this.requestedDirection = requestedDirection;
  }

  request(direction) {
    if (!DIRECTIONS[direction]) return;
    if (this.destination && direction === OPPOSITE[this.direction]) this.reverse();
    this.requestedDirection = direction;
  }

  move(maze, distance = 1) {
    return this.advance(maze, distance, () => {
      if (!samePosition(maze.next(this.position, this.requestedDirection), this.position)) return this.requestedDirection;
      return this.direction;
    });
  }
}

export class Ghost extends MovingCharacter {
  constructor(name, position, cooldownMs = 0, options = {}) {
    super(position, options.direction ?? 'up', options.destination, options.progress ?? 0);
    Object.assign(this, { name, cooldownMs, state: options.state ?? 'active', home: { ...(options.home ?? position) } });
  }

  target(player, blinky, maze, scatter) {
    const corners = { BLINKY: { x: maze.width - 2, y: 1 }, PINKY: { x: 1, y: 1 }, INKY: { x: maze.width - 2, y: maze.height - 2 }, CLYDE: { x: 1, y: maze.height - 2 } };
    if (scatter) return corners[this.name] ?? corners.BLINKY;
    const heading = DIRECTIONS[player.direction];
    if (this.name === 'PINKY') return { x: player.position.x + heading.x * 4, y: player.position.y + heading.y * 4 };
    if (this.name === 'INKY') {
      const ahead = { x: player.position.x + heading.x * 2, y: player.position.y + heading.y * 2 };
      return { x: ahead.x * 2 - blinky.position.x, y: ahead.y * 2 - blinky.position.y };
    }
    if (this.name === 'CLYDE' && Math.hypot(this.position.x - player.position.x, this.position.y - player.position.y) < 8) return corners.CLYDE;
    return { ...player.position };
  }

  move(maze, target, frightened = false, step = 0, distance = 1, routing = false) {
    if (this.cooldownMs > 0) return [];
    const distances = routing ? maze.distancesFrom(target) : null;
    return this.advance(maze, distance, () => {
      if (routing && samePosition(this.position, target)) return null;
      let options = maze.neighbors(this.position, true);
      if (!routing) options = options.filter((next) => !['=', 'H'].includes(maze.rows[next.y]?.[next.x]));
      const forward = options.filter((next) => next.direction !== OPPOSITE[this.direction]);
      if (forward.length && !routing) options = forward;
      if (!options.length) return this.direction;
      if (frightened) return options[(Math.floor(step / 13) + this.name.length + this.position.x * 3 + this.position.y) % options.length].direction;
      options.sort((a, b) => {
        const measure = (point) => distances ? (distances.get(positionKey(point)) ?? 999) : (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
        return measure(a) - measure(b);
      });
      return options[0].direction;
    }, true);
  }
}
