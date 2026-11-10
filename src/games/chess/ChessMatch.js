import { Chess } from 'chess.js';
import { GameMatch } from '../GameMatch.js';

const PIECES = {
  p: 'PAWN',
  n: 'KNIGHT',
  b: 'BISHOP',
  r: 'ROOK',
  q: 'QUEEN',
  k: 'KING',
};

export class ChessMatch extends GameMatch {
  constructor({
    id,
    players = { white: 'PLAYER_WHITE', black: 'PLAYER_BLACK' },
    createdAt,
    finishedAt = null,
    events = [],
    pgn = '',
    lastMoveAt = createdAt ?? Date.now(),
    result = null,
  } = {}) {
    super({ id, gameId: 'CHESS', players, createdAt });
    this.engine = new Chess();
    if (pgn) {
      this.engine.loadPgn(pgn);
    }
    this.events = [...events];
    this.lastMoveAt = lastMoveAt;
    this.result = result ?? (
      this.engine.isCheckmate()
        ? (this.engine.turn() === 'w' ? 'b' : 'w')
        : this.engine.isDraw()
          ? 'DRAW'
          : null
    );

    if (this.engine.isGameOver()) {
      this.status = 'finished';
      this.finishedAt = finishedAt ?? this.lastMoveAt;
    } else if (finishedAt) {
      this.status = 'finished';
      this.finishedAt = finishedAt;
    }
  }

  static fromJSON(record) {
    if (record?.gameId !== 'CHESS') {
      throw new Error('El registro no corresponde a una partida de Ajedrez');
    }
    return new ChessMatch(record);
  }

  get turn() {
    return this.engine.turn();
  }

  playerIdFor(color) {
    return this.players[color === 'w' ? 'white' : 'black'];
  }

  get board() {
    return this.engine.board();
  }

  get pgn() {
    return this.engine.pgn();
  }

  get moveCount() {
    return this.engine.history().length;
  }

  get lastMove() {
    const history = this.engine.history({ verbose: true });
    const move = history[history.length - 1];
    return move ? { from: move.from, to: move.to } : null;
  }

  get isCheck() {
    return this.engine.isCheck();
  }

  get isCheckmate() {
    return this.engine.isCheckmate();
  }

  get isDraw() {
    return this.engine.isDraw();
  }

  legalMovesFrom(square) {
    if (!square) {
      return [];
    }
    return this.engine.moves({ square, verbose: true });
  }

  playMove({ from, to, promotion = 'q' }) {
    if (this.status !== 'in-progress') {
      throw new Error('La partida ya terminó');
    }

    const playedAt = Date.now();
    const move = this.engine.move({ from, to, promotion });
    const thinkTimeSeconds = Math.max(0, Math.floor((playedAt - this.lastMoveAt) / 1000));
    this.lastMoveAt = playedAt;

    if (this.engine.isGameOver()) {
      this.finish(playedAt);
      this.result = this.engine.isCheckmate() ? move.color : 'DRAW';
    }

    return {
      playerId: this.playerIdFor(move.color),
      color: move.color,
      piece: PIECES[move.piece],
      capturedPiece: move.captured ? PIECES[move.captured] : null,
      from: move.from,
      to: move.to,
      ply: this.moveCount,
      thinkTimeSeconds,
      gaveCheck: this.engine.isCheck(),
      checkmate: this.engine.isCheckmate(),
      gameOver: this.engine.isGameOver(),
      result: this.engine.isCheckmate() ? move.color : this.engine.isGameOver() ? 'DRAW' : null,
    };
  }

  resign() {
    if (this.status !== 'in-progress') {
      throw new Error('La partida ya terminó');
    }

    const resignedColor = this.engine.turn();
    const winnerColor = resignedColor === 'w' ? 'b' : 'w';
    this.finish();
    this.result = winnerColor;
    return {
      resignedPlayerId: this.playerIdFor(resignedColor),
      winnerColor,
      ply: Math.max(1, this.moveCount),
    };
  }

  toJSON() {
    return {
      id: this.id,
      gameId: this.gameId,
      players: { ...this.players },
      createdAt: this.createdAt,
      finishedAt: this.finishedAt,
      status: this.status,
      events: [...this.events],
      pgn: this.pgn,
      lastMoveAt: this.lastMoveAt,
      result: this.result,
    };
  }
}
