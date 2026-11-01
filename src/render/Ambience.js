/*
  Ambiente sonoro generato (nessun file audio), come nella demo Xelha ma mediterraneo:
  - mare: rumore filtrato che sale e scende come le onde;
  - cicale (mattina e tramonto) o grilli (notte);
  - accordi lunghi e morbidi, molto bassi, con riverbero.
  Dentro casa la natura si sente attutita (filtro passa-basso), fuori è aperta.
  Parte al primo gesto dell'utente (regola dei browser) e si spegne con il pulsante.
*/

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Re maggiore 9 → Si minore 7 → Sol maggiore 7+ → La sus2: calmo, senza tensioni.
const CHORDS = [[50, 57, 62, 66, 69], [47, 54, 62, 66, 69], [43, 50, 59, 62, 66], [45, 52, 57, 64, 69]];
const CHORD_S = 14;

export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.time = 'sunset';
    this.indoor = false;
  }

  /** Da chiamare dentro un gesto dell'utente. */
  start() {
    if (this.ctx) return this.set(true);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // riverbero lungo per gli accordi
    const len = Math.floor(ctx.sampleRate * 4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verb.connect(this.master);

    // natura (mare, cicale, grilli) passa da un filtro che si chiude dentro casa
    this.nature = ctx.createBiquadFilter();
    this.nature.type = 'lowpass';
    this.nature.frequency.value = 18000;
    this.natureGain = ctx.createGain();
    this.natureGain.gain.value = 1;
    this.nature.connect(this.natureGain).connect(this.master);

    this.#sea();
    this.#cicadas();
    this.#pad();
    this.timer = setInterval(() => this.#schedule(), 500);
    this.#apply(0.1);
    this.set(true);
  }

  #noise(seconds = 4, brown = false) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  #sea() {
    const ctx = this.ctx;
    const src = this.#noise(6, true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(lp).connect(g).connect(this.nature);
    src.start();
    // risacca: schiuma più chiara sopra il fondo
    const foam = this.#noise(5, false);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.4;
    const fg = ctx.createGain();
    fg.gain.value = 0;
    foam.connect(bp).connect(fg).connect(this.nature);
    foam.start();
    this.seaGain = g;
    this.foamGain = fg;
    this.seaLp = lp;
    this.nextWave = ctx.currentTime + 0.5;
  }

  #wave(t0) {
    const dur = 6 + Math.random() * 3.5;
    const peak = 0.32 + Math.random() * 0.12;
    const g = this.seaGain.gain;
    g.setValueAtTime(0.08, t0);
    g.linearRampToValueAtTime(peak, t0 + dur * 0.45);
    g.linearRampToValueAtTime(0.08, t0 + dur);
    const f = this.foamGain.gain;
    f.setValueAtTime(0, t0 + dur * 0.35);
    f.linearRampToValueAtTime(0.03 + Math.random() * 0.02, t0 + dur * 0.5);
    f.linearRampToValueAtTime(0, t0 + dur * 0.9);
    this.seaLp.frequency.setValueAtTime(380, t0);
    this.seaLp.frequency.linearRampToValueAtTime(700, t0 + dur * 0.45);
    this.seaLp.frequency.linearRampToValueAtTime(380, t0 + dur);
    return dur;
  }

  #cicadas() {
    const ctx = this.ctx;
    const src = this.#noise(3, false);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 6;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 46;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(am.gain);
    this.cicadaGain = ctx.createGain();
    this.cicadaGain.gain.value = 0;
    src.connect(bp).connect(am).connect(this.cicadaGain).connect(this.nature);
    src.start();
    lfo.start();
    // grilli: si programmano a colpi brevi in #schedule
    this.cricketBus = ctx.createGain();
    this.cricketBus.gain.value = 0;
    this.cricketBus.connect(this.nature);
  }

  #cricket(t0) {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.cricketBus);
    const f = 4300 + Math.random() * 600;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = t0 + k * 0.055;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  #pad() {
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.55;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.verb);
    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    this.padGain.connect(dry).connect(this.master);
    this.chordIndex = 0;
    this.nextChordAt = ctx.currentTime + 0.2;
  }

  #chord(notes, t0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 5);
    g.gain.setValueAtTime(1, t0 + CHORD_S - 6);
    g.gain.linearRampToValueAtTime(0, t0 + CHORD_S);
    g.connect(this.padFilter);
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        const v = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = midi(m);
        o.detune.value = det;
        v.gain.value = 0.016;
        o.connect(v).connect(g);
        o.start(t0);
        o.stop(t0 + CHORD_S + 0.1);
      }
    }
  }

  #schedule() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    while (this.nextChordAt < now + 3) {
      this.#chord(CHORDS[this.chordIndex % CHORDS.length], this.nextChordAt);
      this.chordIndex++;
      this.nextChordAt += CHORD_S - 4;
    }
    while (this.nextWave < now + 2) this.nextWave += this.#wave(this.nextWave);
    if (this.time === 'night' && Math.random() < 0.55) this.#cricket(now + Math.random() * 0.45);
  }

  #apply(ramp = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const night = this.time === 'night';
    this.cicadaGain.gain.setTargetAtTime(night ? 0 : (this.time === 'sunset' ? 0.035 : 0.05), t, ramp);
    this.cricketBus.gain.setTargetAtTime(night ? 1 : 0, t, ramp);
    this.nature.frequency.setTargetAtTime(this.indoor ? 900 : 18000, t, ramp * 0.6);
    this.natureGain.gain.setTargetAtTime(this.indoor ? 0.55 : 1, t, ramp);
  }

  setTime(time) { this.time = time; this.#apply(); }

  setIndoor(indoor) { this.indoor = indoor; this.#apply(0.8); }

  set(on) {
    this.on = on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, on ? 1.2 : 0.3);
  }

  toggle() {
    if (!this.ctx) { this.start(); return true; }
    this.set(!this.on);
    return this.on;
  }
}
