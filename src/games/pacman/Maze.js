// Laberinto propio de estilo arcade. H es la casa y = su puerta, exclusiva de los fantasmas.
export const DEFAULT_MAZE = [
  '#####################',
  '#o........#........o#',
  '#.##.####.#.####.##.#',
  '#...................#',
  '#.##.#.#######.#.##.#',
  '#....#....#....#....#',
  '####.#### # ####.####',
  '___#.#         #.#___',
  '####.# ###=### #.####',
  '       # HHH #       ',
  '___#.# # HHH # #.#___',
  '####.# ####### #.####',
  '#.........#.........#',
  '#.##.####.#.####.##.#',
  '#..#......F......#..#',
  '##.#.#.#######.#.#.##',
  '#....#....#....#....#',
  '#.######. P .######.#',
  '#........#.#........#',
  '#.########.########.#',
  '#o.................o#',
  '#####################',
];

export const DIRECTIONS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const positionKey = ({ x, y }) => `${x},${y}`;
export const samePosition = (a, b) => a.x === b.x && a.y === b.y;

export class Maze {
  constructor(rows = DEFAULT_MAZE, remaining = null) {
    if (!rows.length || rows.some((row) => row.length !== rows[0].length)) throw new Error('El laberinto debe ser rectangular');
    this.rows = [...rows];
    this.width = rows[0].length;
    this.height = rows.length;
    this.items = new Map(remaining ?? rows.flatMap((row, y) => [...row].flatMap((cell, x) =>
      '.oF'.includes(cell) ? [[`${x},${y}`, cell]] : [])));
    this.playerSpawn = this.find('P');
    this.door = this.find('=', false);
    this.ghostSpawn = this.find('G', false) ?? (this.door ? { x: this.door.x, y: this.door.y + 1 } : this.find('H'));
    this.ghostExit = this.door ? { x: this.door.x, y: this.door.y - 1 } : { ...this.ghostSpawn };
    this.fruitSpawn = this.find('F', false) ?? { ...this.playerSpawn };
    this.totalPellets = rows.reduce((count, row) => count + [...row].filter((cell) => '.o'.includes(cell)).length, 0);
    this.distanceCache = new Map();
  }

  find(symbol, required = true) {
    const y = this.rows.findIndex((row) => row.includes(symbol));
    if (y < 0) {
      if (required) throw new Error(`Falta ${symbol} en el laberinto`);
      return null;
    }
    return { x: this.rows[y].indexOf(symbol), y };
  }

  isOpen({ x, y }, ghost = false) {
    const cell = this.rows[y]?.[x];
    return cell !== undefined && cell !== '#' && cell !== '_' && (ghost || (cell !== '=' && cell !== 'H'));
  }

  isTunnelRow(y) { return this.isOpen({ x: 0, y }) && this.isOpen({ x: this.width - 1, y }); }

  next(position, direction, ghost = false) {
    const delta = DIRECTIONS[direction];
    if (!delta) return { ...position };
    const next = { x: position.x + delta.x, y: position.y + delta.y };
    if (this.isTunnelRow(position.y) && delta.x) next.x = (next.x + this.width) % this.width;
    return this.isOpen(next, ghost) ? next : { ...position };
  }

  neighbors(position, ghost = false) {
    return Object.keys(DIRECTIONS).flatMap((direction) => {
      const next = this.next(position, direction, ghost);
      return samePosition(position, next) ? [] : [{ ...next, direction }];
    });
  }

  distancesFrom(target) {
    const cacheKey = positionKey(target);
    if (this.distanceCache.has(cacheKey)) return this.distanceCache.get(cacheKey);
    const distances = new Map([[positionKey(target), 0]]);
    const queue = [target];
    for (let i = 0; i < queue.length; i += 1) {
      for (const next of this.neighbors(queue[i], true)) {
        const key = positionKey(next);
        if (!distances.has(key)) { distances.set(key, distances.get(positionKey(queue[i])) + 1); queue.push(next); }
      }
    }
    this.distanceCache.set(cacheKey, distances);
    return distances;
  }

  get pelletsLeft() { return [...this.items.values()].filter((item) => item !== 'F').length; }
}
