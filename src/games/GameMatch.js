export function createId() {
  return globalThis.crypto.randomUUID();
}

export class GameMatch {
  constructor({ id = createId(), gameId, players, createdAt = Date.now() }) {
    if (!gameId) {
      throw new Error('gameId es obligatorio');
    }

    this.id = id;
    this.gameId = gameId;
    this.players = { ...players };
    this.createdAt = createdAt;
    this.finishedAt = null;
    this.status = 'in-progress';
    this.events = [];
  }

  elapsedSeconds(at = this.finishedAt ?? Date.now()) {
    return Math.max(0, Math.floor((at - this.createdAt) / 1000));
  }

  finish(at = Date.now()) {
    if (this.status === 'finished') {
      return;
    }

    this.status = 'finished';
    this.finishedAt = at;
  }

  appendEvent(event) {
    if (event.gameId !== this.gameId || event.matchId !== this.id) {
      throw new Error('El evento debe pertenecer a esta partida');
    }
    this.events.push(event);
  }
}
