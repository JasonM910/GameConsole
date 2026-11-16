import { SinglePlayerMatch } from '../SinglePlayerMatch.js';
import { MinesweeperBoard } from './MinesweeperBoard.js';

export class MinesweeperMatch extends SinglePlayerMatch {
  constructor(options = {}) {
    super({ ...options, gameId: 'MINESWEEPER' });
    this.board = new MinesweeperBoard(options.board ?? options);
    this.difficulty = options.difficulty ?? 'EASY';
    this.random = options.random ?? Math.random;
  }

  static fromJSON(record) {
    if (record?.gameId !== 'MINESWEEPER') throw new Error('El registro no es Buscaminas');
    return new MinesweeperMatch(record);
  }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'in-progress';
    const { rows, columns, mineCount } = this.board;
    this.emit('MATCH_STARTED', { rows, columns, mineCount, difficulty: this.difficulty });
  }

  reveal(row, column) {
    if (this.status !== 'in-progress') return false;
    const { revealed, triggered } = this.board.reveal(row, column, this.random);
    for (const cell of revealed) {
      this.emit('CELL_REVEALED', { row: cell.row, column: cell.column, adjacentMines: cell.adjacentMines });
    }
    if (triggered) {
      this.emit('MINE_TRIGGERED', { row: triggered.row, column: triggered.column });
      this.end('LOSS');
    } else if (revealed.length && this.board.complete) {
      this.emit('BOARD_COMPLETED', { difficulty: this.difficulty, durationSeconds: this.elapsedSeconds() });
      this.end('WIN');
    }
    return Boolean(revealed.length || triggered);
  }

  toggleFlag(row, column) {
    if (this.status !== 'in-progress') return false;
    const cell = this.board.toggleFlag(row, column);
    if (!cell) return false;
    this.emit(cell.flagged ? 'FLAG_PLACED' : 'FLAG_REMOVED', {
      row, column, ...(cell.flagged ? { correct: cell.mine } : {}),
    });
    return true;
  }

  tick(deltaMs = 100) {
    if (this.status === 'in-progress' && Number.isFinite(deltaMs) && deltaMs > 0) this.activeMs += deltaMs;
  }

  toJSON() { return { ...super.toJSON(), difficulty: this.difficulty, board: this.board.toJSON() }; }
}
