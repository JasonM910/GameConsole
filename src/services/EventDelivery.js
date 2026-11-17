import { loadMatches } from './matchStorage.js';

// La partida es la cola persistente; las confirmaciones se guardan por separado
// para no sobrescribir posiciones de juego con respuestas HTTP tardías.
export class EventDelivery {
  constructor(adapter, { storage = globalThis.localStorage, readMatches = loadMatches, locks = globalThis.navigator?.locks } = {}) {
    this.adapter = adapter;
    this.storage = storage;
    this.readMatches = readMatches;
    this.locks = locks;
    this.inFlight = null;
  }
  sync() {
    if (!this.inFlight) this.inFlight = this.flush().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  async flush() {
    if (!this.adapter.endpoint) return { status: 'pending', message: 'Sin API configurada; los eventos siguen guardados.' };
    let sent = false;
    const failures = [];
    const matches = this.readMatches();
    // Cada partida conserva su orden; hasta cuatro partidas pueden enviarse en paralelo.
    let cursor = 0;
    const sendMatch = async (match) => {
      try {
        const transmit = async () => {
          const key = `gameconsole:delivered:${match.id}`;
          const acknowledged = new Set(JSON.parse(this.storage.getItem(key) ?? '[]'));
          const pending = (match.events ?? []).filter((event) => !acknowledged.has(event.eventId));
          for (let offset = 0; offset < pending.length; offset += 100) {
            const result = await this.adapter.sendBatch(pending.slice(offset, offset + 100));
            if (result.status !== 'sent') throw new Error(result.message ?? 'Envío pendiente');
            result.eventIds.forEach((id) => acknowledged.add(id));
            this.storage.setItem(key, JSON.stringify([...acknowledged]));
            sent = true;
          }
        };
        if (this.locks) await this.locks.request(`gameconsole:delivery:${match.id}`, transmit);
        else await transmit();
      } catch (error) {
        failures.push({ matchId: match.id, message: error.message });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, matches.length) }, async () => {
      while (cursor < matches.length) await sendMatch(matches[cursor++]);
    }));
    if (failures.length) return {
      status: 'failed', failures,
      message: `${failures.length} partida(s) con eventos pendientes. Las demás se sincronizaron sin quedar bloqueadas. ${failures.map((failure) => `${failure.matchId.slice(0, 8)}: ${failure.message}`).join(' · ')}`,
    };
    return sent
      ? { status: 'sent', message: 'Eventos confirmados por GameStats.' }
      : { status: 'idle', message: 'No hay eventos pendientes de envío.' };
  }
}
