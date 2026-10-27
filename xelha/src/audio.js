// Ambiente sonoro generado (sin archivos): acorde suave, brisa entre árboles y algún pájaro.
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

    // Acorde (Re mayor 9) con filtro que respira despacio.
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    pad.connect(lp).connect(this.master);
    for (const f of [146.83, 220, 293.66, 369.99, 329.63]) {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(pad);
        o.start();
      }
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // Brisa: ruido filtrado con volumen ondulante.
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.6;
    const wind = ctx.createGain();
    wind.gain.value = 0.12;
    noise.connect(bp).connect(wind).connect(this.master);
    noise.start();
    const wl = ctx.createOscillator();
    const wg = ctx.createGain();
    wl.frequency.value = 0.08;
    wg.gain.value = 0.07;
    wl.connect(wg).connect(wind.gain);
    wl.start();

    this.birds();
    this.set(true);
  }

  // Trinos breves con intervalos aleatorios.
  birds() {
    const ctx = this.ctx;
    const chirp = () => {
      if (this.on) {
        const t = ctx.currentTime;
        const n = 2 + Math.floor(Math.random() * 4);
        const base = 2200 + Math.random() * 1800;
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const t0 = t + i * (0.09 + Math.random() * 0.05);
          o.frequency.setValueAtTime(base, t0);
          o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t0 + 0.06);
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.025, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
          o.connect(g).connect(this.master);
          o.start(t0);
          o.stop(t0 + 0.1);
        }
      }
      setTimeout(chirp, 2500 + Math.random() * 6000);
    };
    setTimeout(chirp, 3000);
  }

  set(on) {
    if (!this.ctx) return;
    this.on = on;
    if (on) this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(on ? 0.7 : 0, t + 1.2);
  }

  toggle() {
    if (!this.ctx) this.start();
    else this.set(!this.on);
    return this.on;
  }
}
