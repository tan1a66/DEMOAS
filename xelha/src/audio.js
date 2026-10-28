// Ambiente sonoro generado (sin archivos), en clave de spa: acordes largos que cambian
// despacio, notas sueltas tipo marimba suave, todo con reverberación, y algún pájaro lejano.
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Re mayor 9 → Si menor 11 → Sol mayor 9 → La sus2 (registro medio-grave, sin tensiones).
const CHORDS = [
  [50, 57, 64, 66, 73],
  [47, 54, 62, 64, 69],
  [43, 50, 57, 59, 66],
  [45, 52, 59, 64, 69],
];
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78];
const CHORD_S = 14; // duración de cada acorde (se solapan al cambiar)

export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  start() {
    if (this.ctx) return this.set(true);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Reverberación larga: respuesta al impulso de ruido con caída exponencial.
    const len = Math.floor(ctx.sampleRate * 5);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    this.bus = ctx.createGain();
    this.bus.connect(dry).connect(this.master);
    this.bus.connect(verb).connect(wet).connect(this.master);

    // Filtro cálido para el colchón de acordes, que respira muy despacio.
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 620;
    this.padFilter.Q.value = 0.2;
    this.padFilter.connect(this.bus);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.03;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start();

    this.chordIndex = 0;
    this.nextChordAt = ctx.currentTime + 0.1;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 1000);
    this.set(true);
  }

  // Programa acordes con antelación y notas sueltas al azar.
  schedule() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    while (this.nextChordAt < now + 3) {
      this.chord(CHORDS[this.chordIndex % CHORDS.length], this.nextChordAt);
      this.chordIndex++;
      this.nextChordAt += CHORD_S - 4;
    }
    if (this.on && Math.random() < 0.28) this.pluck(now + Math.random() * 0.8);
    if (this.on && Math.random() < 0.025) this.bird(now + Math.random());
  }

  chord(notes, t0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 5);
    g.gain.setValueAtTime(1, t0 + CHORD_S - 6);
    g.gain.linearRampToValueAtTime(0, t0 + CHORD_S);
    g.connect(this.padFilter);
    for (const m of notes) {
      for (const [type, det, vol] of [['sine', -5, 0.028], ['sine', 5, 0.028], ['triangle', 0, 0.01]]) {
        const o = ctx.createOscillator();
        const v = ctx.createGain();
        o.type = type;
        o.frequency.value = midi(m);
        o.detune.value = det;
        v.gain.value = vol;
        o.connect(v).connect(g);
        o.start(t0);
        o.stop(t0 + CHORD_S + 0.1);
      }
    }
  }

  // Nota suelta de la escala pentatónica, ataque suave y cola larga.
  pluck(t0) {
    const ctx = this.ctx;
    const m = PENTA[Math.floor(Math.random() * PENTA.length)];
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    g.connect(pan).connect(this.bus);
    for (const [mult, vol] of [[1, 1], [2, 0.18]]) {
      const o = ctx.createOscillator();
      const v = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = midi(m) * mult;
      v.gain.value = vol;
      o.connect(v).connect(g);
      o.start(t0);
      o.stop(t0 + 3.3);
    }
  }

  // Pájaro lejano: dos o tres trinos suaves, poco frecuentes.
  bird(t) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 2);
    const base = 1800 + Math.random() * 700;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = t + i * (0.14 + Math.random() * 0.06);
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.25, t0 + 0.08);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.008, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(g).connect(this.bus);
      o.start(t0);
      o.stop(t0 + 0.14);
    }
  }

  set(on) {
    if (!this.ctx) return;
    this.on = on;
    if (on) this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(on ? 0.6 : 0, t + 2);
  }

  toggle() {
    if (!this.ctx) this.start();
    else this.set(!this.on);
    return this.on;
  }
}
