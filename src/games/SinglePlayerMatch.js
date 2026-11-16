import { GameMatch } from './GameMatch.js';

// El reloj avanza únicamente mientras se juega; cerrar o pausar no consume tiempo.
export class SinglePlayerMatch extends GameMatch {
  constructor({ id, gameId, players = { player: 'PLAYER_ONE' }, createdAt, events = [],
    finishedAt = null, status = 'ready', activeMs = 0, result = null } = {}) {
    super({ id, gameId, players, createdAt });
    Object.assign(this, { events: [...events], finishedAt, status, activeMs, result });
    this.pendingEvents = [];
  }

  emit(type, data = {}) { this.pendingEvents.push({ type, data }); }

  elapsedSeconds() { return Math.floor(this.activeMs / 1000); }

  pause() {
    if (this.status === 'in-progress') this.status = 'paused';
  }

  resume() {
    if (this.status === 'paused') this.status = 'in-progress';
  }

  end(result) {
    if (this.status === 'finished' || this.status === 'ready') return;
    this.result = result;
    this.finish();
    this.emit('MATCH_FINISHED', { result, durationSeconds: this.elapsedSeconds() });
  }

  toJSON() {
    return {
      id: this.id, gameId: this.gameId, players: { ...this.players },
      createdAt: this.createdAt, finishedAt: this.finishedAt,
      status: this.status, activeMs: this.activeMs, result: this.result,
      events: [...this.events],
    };
  }
}
