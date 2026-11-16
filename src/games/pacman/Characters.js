import { positionKey, samePosition } from './Maze.js';

export class Pacman {
  constructor(position, direction = 'right', requestedDirection = direction) {
    this.position = { ...position };
    this.direction = direction;
    this.requestedDirection = requestedDirection;
  }
  move(maze) {
    const requested = maze.next(this.position, this.requestedDirection);
    if (!samePosition(requested, this.position)) this.direction = this.requestedDirection;
    this.position = maze.next(this.position, this.direction);
  }
}

export class Ghost {
  constructor(name, position, cooldownMs = 0) {
    Object.assign(this, { name, position: { ...position }, cooldownMs });
  }
  move(maze, target, frightened, step) {
    if (this.cooldownMs > 0) return;
    const options = maze.neighbors(this.position);
    if (!options.length) return;
    // Distancias reales por los corredores; cada fantasma alterna persecución y dispersión.
    const distances = new Map([[positionKey(target), 0]]);
    const queue = [{ ...target }];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of maze.neighbors(current)) {
        const key = positionKey(next);
        if (!distances.has(key)) {
          distances.set(key, distances.get(positionKey(current)) + 1);
          queue.push(next);
        }
      }
    }
    const scatter = this.name === 'INKY' && step % 40 < 10;
    options.sort((a, b) => {
      const difference = (distances.get(positionKey(a)) ?? 999) - (distances.get(positionKey(b)) ?? 999);
      return frightened || scatter ? -difference : difference;
    });
    this.position = { x: options[0].x, y: options[0].y };
  }
}
