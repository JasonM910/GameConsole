import { loadMatches } from './matchStorage.js';

// La partida es la cola persistente; las confirmaciones se guardan por separado
// para no sobrescribir posiciones de juego con respuestas HTTP tardías.
export class EventDelivery {
  constructor(adapter, { storage = globalThis.localStorage, readMatches = loadMatches } = {}) {
    this.adapter = adapter;
    this.storage = storage;
    this.readMatches = readMatches;
    this.queue = Promise.resolve();
  }
  sync() {
    this.queue = this.queue.catch(() => {}).then(() => this.flush());
    return this.queue;
  }
  async flush() {
    if (!this.adapter.endpoint) return { status: 'pending', message: 'Sin API configurada; los eventos siguen guardados.' };
    let sent = false;
    for (const match of this.readMatches()) {
      const key = `gameconsole:delivered:${match.id}`;
      const acknowledged = new Set(JSON.parse(this.storage.getItem(key) ?? '[]'));
      const pending = (match.events ?? []).filter((event) => !acknowledged.has(event.eventId));
      for (let offset = 0; offset < pending.length; offset += 100) {
        const result = await this.adapter.sendBatch(pending.slice(offset, offset + 100));
        if (result.status !== 'sent') return result;
        result.eventIds.forEach((id) => acknowledged.add(id));
        this.storage.setItem(key, JSON.stringify([...acknowledged]));
        sent = true;
      }
    }
    return sent
      ? { status: 'sent', message: 'Eventos confirmados por GameStats.' }
      : { status: 'idle', message: 'No hay eventos pendientes de envío.' };
  }
}
