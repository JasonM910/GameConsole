export class MinesweeperCell {
  constructor({ row, column, mine = false, revealed = false, flagged = false, adjacentMines = 0 }) {
    Object.assign(this, { row, column, mine, revealed, flagged, adjacentMines });
  }

  toJSON() { return { ...this }; }
}

export class MinesweeperBoard {
  constructor({ rows = 9, columns = 9, mineCount = 10, cells, initialized = false, minePositions } = {}) {
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || columns < 2
      || rows > 30 || columns > 30 || !Number.isInteger(mineCount) || mineCount < 1 || mineCount >= rows * columns) {
      throw new Error('Configuración de Buscaminas inválida');
    }
    Object.assign(this, { rows, columns, mineCount, initialized });
    this.cells = cells
      ? cells.map((cell) => new MinesweeperCell(cell))
      : Array.from({ length: rows * columns }, (_, index) => new MinesweeperCell({ row: Math.floor(index / columns), column: index % columns }));
    if (minePositions) this.placeMines(minePositions);
  }

  cellAt(row, column) {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= this.rows || column < 0 || column >= this.columns) return null;
    return this.cells[row * this.columns + column];
  }

  neighbors(cell) {
    const result = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const neighbor = this.cellAt(cell.row + dr, cell.column + dc);
        if (neighbor) result.push(neighbor);
      }
    }
    return result;
  }

  placeMines(positions) {
    const selected = positions.map(({ row, column }) => this.cellAt(row, column));
    if (selected.length !== this.mineCount || selected.some((cell) => !cell) || new Set(selected).size !== this.mineCount) {
      throw new Error('Posiciones de minas inválidas');
    }
    this.cells.forEach((cell) => { cell.mine = false; });
    selected.forEach((cell) => { cell.mine = true; });
    this.cells.forEach((cell) => { cell.adjacentMines = this.neighbors(cell).filter((neighbor) => neighbor.mine).length; });
    this.initialized = true;
  }

  initialize(firstCell, random = Math.random) {
    // El primer clic abre una zona sin minas cuando el tamaño del tablero lo permite.
    const opening = new Set([firstCell, ...this.neighbors(firstCell)]);
    let candidates = this.cells.filter((cell) => !opening.has(cell));
    if (candidates.length < this.mineCount) candidates = this.cells.filter((cell) => cell !== firstCell);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    }
    this.placeMines(candidates.slice(0, this.mineCount));
  }

  reveal(row, column, random) {
    const cell = this.cellAt(row, column);
    if (!cell || cell.revealed || cell.flagged) return { revealed: [], triggered: null };
    if (!this.initialized) this.initialize(cell, random);
    if (cell.mine) {
      cell.revealed = true;
      return { revealed: [], triggered: cell };
    }
    const queue = [cell];
    const revealed = [];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.revealed || current.flagged || current.mine) continue;
      current.revealed = true;
      revealed.push(current);
      if (current.adjacentMines === 0) queue.push(...this.neighbors(current));
    }
    return { revealed, triggered: null };
  }

  toggleFlag(row, column) {
    const cell = this.cellAt(row, column);
    if (!this.initialized || !cell || cell.revealed || (!cell.flagged && this.flagCount >= this.mineCount)) return null;
    cell.flagged = !cell.flagged;
    return cell;
  }

  get flagCount() { return this.cells.filter((cell) => cell.flagged).length; }
  get revealedCount() { return this.cells.filter((cell) => cell.revealed && !cell.mine).length; }
  get complete() { return this.revealedCount === this.rows * this.columns - this.mineCount; }

  toJSON() {
    return { rows: this.rows, columns: this.columns, mineCount: this.mineCount, initialized: this.initialized,
      cells: this.cells.map((cell) => cell.toJSON()) };
  }
}
