export const DEFAULT_MAZE = [
  '###################',
  '#P.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '#....... G .......#',
  '####.#.#####.#.####',
  '#....#...#...#....#',
  '#.##.###.#.###.##.#',
  '#o.......F.......o#',
  '#.##.#.#####.#.##.#',
  '#....#.......#....#',
  '###################',
];

export const DIRECTIONS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 },
  down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
export const positionKey = ({ x, y }) => `${x},${y}`;
export const samePosition = (a, b) => a.x === b.x && a.y === b.y;

export class Maze {
  constructor(rows = DEFAULT_MAZE, remaining = null) {
    if (!rows.length || rows.some((row) => row.length !== rows[0].length)) {
      throw new Error('El laberinto debe ser rectangular');
    }
    this.rows = [...rows];
    this.items = new Map(remaining ?? rows.flatMap((row, y) => [...row].flatMap((cell, x) =>
      '.oF'.includes(cell) ? [[`${x},${y}`, cell]] : [])));
    this.playerSpawn = this.find('P');
    this.ghostSpawn = this.find('G');
  }

  find(symbol) {
    const y = this.rows.findIndex((row) => row.includes(symbol));
    if (y < 0) throw new Error(`Falta ${symbol} en el laberinto`);
    return { x: this.rows[y].indexOf(symbol), y };
  }

  isOpen({ x, y }) { return this.rows[y]?.[x] !== undefined && this.rows[y][x] !== '#'; }
  next(position, direction) {
    const delta = DIRECTIONS[direction];
    if (!delta) return { ...position };
    const next = { x: position.x + delta.x, y: position.y + delta.y };
    return this.isOpen(next) ? next : { ...position };
  }
  neighbors(position) {
    return Object.entries(DIRECTIONS).flatMap(([direction]) => {
      const next = this.next(position, direction);
      return samePosition(position, next) ? [] : [{ ...next, direction }];
    });
  }
  get pelletsLeft() { return [...this.items.values()].filter((item) => item !== 'F').length; }
}
