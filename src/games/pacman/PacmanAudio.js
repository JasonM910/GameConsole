// Efectos sintetizados: no se descargan ni se incluyen grabaciones del arcade.
export class PacmanAudio {
  constructor() { this.context = null; this.enabled = true; this.notes = new Set(); this.chomp = 0; }

  unlock() {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext || !this.enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  tone(frequency, endFrequency, duration, delay = 0, shape = 'square', volume = 0.035) {
    if (!this.enabled || !this.context || this.context.state === 'closed') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    this.notes.add(oscillator);
    oscillator.onended = () => { this.notes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration);
  }

  play(events) {
    for (const event of events) {
      if (event.type === 'PELLET_EATEN') {
        this.chomp += 1; this.tone(this.chomp % 2 ? 480 : 340, 120, 0.07, 0, 'triangle', 0.055);
      } else if (event.type === 'POWER_PELLET_EATEN') this.tone(190, 700, 0.25);
      else if (event.type === 'GHOST_EATEN') this.tone(320, 1400, 0.22);
      else if (event.type === 'FRUIT_EATEN') { this.tone(600, 900, 0.12); this.tone(900, 1200, 0.16, 0.12); }
      else if (event.type === 'LIFE_LOST') this.tone(600, 40, 0.8, 0, 'sawtooth', 0.03);
      else if (event.type === 'MATCH_STARTED' || event.type === 'LEVEL_COMPLETED') {
        [262, 330, 392, 523].forEach((note, index) => this.tone(note, note, 0.13, index * 0.12, 'triangle', 0.06));
      }
    }
  }

  stop() { for (const oscillator of this.notes) { try { oscillator.stop(); } catch { /* Una nota pudo terminar antes. */ } } }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.stop(); else this.unlock(); }
  dispose() { this.stop(); if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {}); this.context = null; }
}
