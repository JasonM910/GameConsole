import { ChessMatch } from '../games/chess/ChessMatch.js';
import { PacmanMatch } from '../games/pacman/PacmanMatch.js';
import { MemoryMatch } from '../games/memory/MemoryMatch.js';
import { MinesweeperMatch } from '../games/minesweeper/MinesweeperMatch.js';
import { collectGameEvents } from './gameEvents.js';
import { playChessMove, finishChessEvents } from './chessEvents.js';
import { requestPrologMove } from './prologClient.js';

const MODELS = { CHESS: ChessMatch, PACMAN: PacmanMatch, MEMORY: MemoryMatch, MINESWEEPER: MinesweeperMatch };

// La consola posee las sesiones; las vistas pueden desmontarse sin detenerlas.
// Un Web Lock por UUID garantiza un único escritor entre pestañas del mismo origen.
export class MatchRuntime {
  constructor(adapter, { storage = globalThis.localStorage, locks = globalThis.navigator?.locks,
    now = () => performance.now(), decide = requestPrologMove } = {}) {
    Object.assign(this, { adapter, storage, locks, now, decide });
    this.entries = new Map();
    this.callbacks = {};
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.advance(), 16);
    for (const entry of this.entries.values()) this.claim(entry);
  }

  open(record) {
    if (this.entries.has(record.id)) return this.entries.get(record.id);
    const model = MODELS[record.gameId].fromJSON(record);
    model.pause?.(); // Restaurar un registro cerrado requiere Continuar, nunca navegar dentro de la sesión.
    const entry = { model, owned: false, version: 0, error: '', aiStatus: 'idle', aiInfo: null,
      listeners: new Set(), eventListeners: new Set(), lastTick: this.now(), lastSave: this.now(), lastRender: 0 };
    this.entries.set(record.id, entry);
    if (this.running) this.claim(entry);
    return entry;
  }

  claim(entry) {
    if (entry.claim || entry.owned) return;
    if (!this.locks) {
      entry.error = 'Este navegador necesita Web Locks para ejecutar partidas sin conflictos entre pestañas. Usa un navegador actualizado en localhost o HTTPS.';
      this.notify(entry); return;
    }
    const controller = new AbortController();
    entry.claim = controller;
    void this.locks.request(`gameconsole:running:${entry.model.id}`, { signal: controller.signal }, async () => {
      if (!this.running || entry.claim !== controller) return;
      try {
        const latest = this.storage.getItem(`gameconsole:match:${entry.model.id}`);
        if (latest) entry.model = MODELS[entry.model.gameId].fromJSON(JSON.parse(latest));
        entry.model.pause?.();
        entry.owned = true;
        entry.lastTick = this.now();
        this.commit(entry.model.id);
        await new Promise((resolve) => { entry.release = resolve; });
      } catch (error) { entry.error = error.message; }
      finally {
        if (entry.claim === controller) { entry.owned = false; entry.claim = null; }
        this.notify(entry);
      }
    }).catch((error) => {
      if (error.name !== 'AbortError') { entry.error = error.message; this.notify(entry); }
    });
  }

  subscribe(id, listener) {
    const entry = this.entries.get(id);
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }
  notify(entry) { entry.version += 1; entry.listeners.forEach((listener) => listener()); }

  refresh(record) {
    const entry = this.entries.get(record.id);
    if (!entry || entry.owned) return;
    entry.model = MODELS[record.gameId].fromJSON(record);
    this.notify(entry);
  }

  save(entry) {
    if (!entry.owned) return;
    const events = entry.model.pendingEvents ? collectGameEvents(entry.model, this.adapter) : [];
    const record = entry.model.toJSON();
    this.storage.setItem(`gameconsole:match:${record.id}`, JSON.stringify(record));
    this.callbacks.onSave?.(record);
    if (events.length) {
      entry.eventListeners.forEach((listener) => listener(events));
      void this.callbacks.onEvents?.();
    }
    entry.lastSave = this.now();
  }

  commit(id) {
    const entry = this.entries.get(id);
    if (!entry?.owned) return;
    try { this.save(entry); entry.error = ''; }
    catch (error) { entry.model.pause?.(); entry.error = error.message; }
    this.notify(entry);
    this.computerTurn(entry);
  }

  act(id, action) {
    const entry = this.entries.get(id);
    if (!entry?.owned) return;
    this.advanceEntry(entry, this.now());
    try { action(entry.model); this.commit(id); }
    catch (error) { entry.error = error.message; this.notify(entry); }
  }

  moveChess(id, decision) {
    const entry = this.entries.get(id);
    if (!entry?.owned || entry.model.isComputerTurn) return;
    this.act(id, (match) => playChessMove(match, decision, this.adapter));
    void this.callbacks.onEvents?.();
  }

  resign(id) {
    const entry = this.entries.get(id);
    if (!entry?.owned) return;
    entry.aiRequest?.abort();
    entry.aiStatus = 'idle';
    this.act(id, (match) => {
      const color = match.opponent === 'prolog' ? (match.computerColor === 'w' ? 'b' : 'w') : match.turn;
      const result = match.resign(color);
      finishChessEvents(match, result.winnerColor, this.adapter).forEach((event) => match.appendEvent(event));
    });
    void this.callbacks.onEvents?.();
  }

  computerTurn(entry) {
    if (!this.running || !entry.owned || !entry.model.isComputerTurn || entry.aiRequest || entry.aiStatus === 'error') return;
    const fen = entry.model.engine.fen();
    const request = new AbortController();
    entry.aiRequest = request; entry.aiStatus = 'thinking'; this.notify(entry);
    void this.decide(fen, { signal: request.signal }).then((reply) => {
      // Ni respuestas tardías ni una renuncia pueden aplicar una jugada sobre otro estado.
      if (!this.running || !entry.owned || request.signal.aborted || !entry.model.isComputerTurn || entry.model.engine.fen() !== fen) return;
      if (reply.fen !== fen) throw new Error('La respuesta de Prolog no corresponde a esta posición');
      playChessMove(entry.model, reply.move, this.adapter);
      entry.aiInfo = reply.search;
      entry.aiStatus = 'idle';
      this.commit(entry.model.id);
      void this.callbacks.onEvents?.();
    }).catch((error) => {
      if (!request.signal.aborted) { entry.error = error.message; entry.aiStatus = 'error'; }
    }).finally(() => { if (entry.aiRequest === request) entry.aiRequest = null; this.notify(entry); });
  }

  retryComputer(id) {
    const entry = this.entries.get(id);
    if (!entry?.owned) return;
    entry.error = ''; entry.aiStatus = 'idle'; this.computerTurn(entry);
  }

  advanceEntry(entry, now) {
    const delta = Math.max(0, now - entry.lastTick);
    entry.lastTick = now;
    if (!entry.owned) return;
    try {
      if (entry.model.tick && entry.model.status === 'in-progress') {
        entry.model.tick(delta);
        if (entry.model.pendingEvents.length || now - entry.lastSave >= 500) this.save(entry);
        if (now - entry.lastRender >= 100 || entry.model.status === 'finished') {
          entry.lastRender = now; this.notify(entry);
        }
      }
      this.computerTurn(entry);
    } catch (error) { entry.model.pause?.(); entry.error = error.message; this.notify(entry); }
  }

  advance() { const now = this.now(); for (const entry of this.entries.values()) this.advanceEntry(entry, now); }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    for (const entry of this.entries.values()) {
      entry.aiRequest?.abort(); entry.aiRequest = null; entry.aiStatus = 'idle';
      if (entry.owned) {
        this.advanceEntry(entry, this.now());
        entry.model.pause?.();
        try { this.save(entry); } catch { /* El último guardado permanece disponible. */ }
      }
      entry.owned = false;
      entry.claim?.abort(); entry.claim = null;
      entry.release?.(); entry.release = null;
    }
  }
}
