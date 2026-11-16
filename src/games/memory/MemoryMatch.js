import { SinglePlayerMatch } from '../SinglePlayerMatch.js';
import { MemoryCard, makeCards, SYMBOLS } from './MemoryCard.js';

export class MemoryMatch extends SinglePlayerMatch {
  constructor(options = {}) {
    super({ ...options, gameId: 'MEMORY' });
    this.rows = options.rows ?? 4;
    this.columns = options.columns ?? 4;
    this.timeLimitSeconds = options.timeLimitSeconds ?? 180;
    this.pairCount = this.rows * this.columns / 2;
    if (!Number.isInteger(this.rows) || this.rows <= 0 || !Number.isInteger(this.columns) || this.columns <= 0
      || !Number.isInteger(this.pairCount) || this.pairCount < 1 || this.pairCount > SYMBOLS.length
      || !Number.isInteger(this.timeLimitSeconds) || this.timeLimitSeconds <= 0) {
      throw new Error('Configuración de Memoria inválida');
    }
    this.cards = options.cards ? options.cards.map((card) => new MemoryCard(card)) : makeCards(this.pairCount, options.random);
    this.selected = [...(options.selected ?? [])];
    this.attempts = options.attempts ?? 0;
    this.mismatchMs = options.mismatchMs ?? 0;
  }

  static fromJSON(record) {
    if (record?.gameId !== 'MEMORY') throw new Error('El registro no es Memoria');
    return new MemoryMatch(record);
  }
  get pairsFound() { return this.cards.filter((card) => card.matched).length / 2; }
  get remainingSeconds() { return Math.max(0, this.timeLimitSeconds - this.elapsedSeconds()); }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'in-progress';
    this.emit('MATCH_STARTED', { rows: this.rows, columns: this.columns, pairCount: this.pairCount, timeLimitSeconds: this.timeLimitSeconds });
  }

  flip(cardId) {
    const card = this.cards.find((item) => item.id === cardId);
    if (this.status !== 'in-progress' || !card || card.matched || this.selected.includes(cardId) || this.selected.length === 2) return false;
    const turn = this.attempts + 1;
    this.selected.push(cardId);
    this.emit('CARD_FLIPPED', { cardId, symbol: card.symbol, turn });
    if (this.selected.length === 2) {
      const first = this.cards.find((item) => item.id === this.selected[0]);
      this.attempts += 1;
      const matched = first.symbol === card.symbol;
      this.emit(matched ? 'PAIR_MATCHED' : 'PAIR_MISMATCHED', { firstCardId: first.id, secondCardId: card.id, turn });
      if (matched) {
        first.matched = true;
        card.matched = true;
        this.selected = [];
        if (this.pairsFound === this.pairCount) this.end('WIN');
      } else this.mismatchMs = 800;
    }
    return true;
  }

  tick(deltaMs = 100) {
    if (this.status !== 'in-progress' || deltaMs <= 0) return;
    this.activeMs = Math.min(this.timeLimitSeconds * 1000, this.activeMs + deltaMs);
    if (this.mismatchMs > 0) {
      this.mismatchMs = Math.max(0, this.mismatchMs - deltaMs);
      if (this.mismatchMs === 0) this.selected = [];
    }
    if (this.remainingSeconds === 0) {
      this.emit('TIME_EXPIRED', { pairsFound: this.pairsFound });
      this.end('LOSS');
    }
  }

  toJSON() {
    return { ...super.toJSON(), rows: this.rows, columns: this.columns, timeLimitSeconds: this.timeLimitSeconds,
      cards: this.cards.map((card) => ({ ...card })), selected: [...this.selected],
      attempts: this.attempts, mismatchMs: this.mismatchMs };
  }
}
