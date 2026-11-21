// Sonido (opcional, se enciende con el botón): todo generado en el navegador, sin archivos.
//  · brisa en el patio (ruido filtrado que respira) y hojas,
//  · pájaros lejanos de día; grillos al anochecer,
//  · las tijeras del corte, una nota suave en cada cambio de color, el clic de las lámparas.

const NOTES = [0, 2, 4, 7, 9, 12, 14, 16]; // pentatónica (semitonos sobre la nota base)

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.dusk = 0;
    this.noteI = 0;
    this.timers = [];
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // reverberación corta y suave (respuesta generada)
    const len = Math.floor(ctx.sampleRate * 2.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.master);
    // ruido para la brisa
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let b = 0;
    for (let i = 0; i < nd.length; i++) {
      b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); // ruido "marrón": más grave y suave
      nd[i] = b * 6;
    }
    this.noise = nb;
    const wind = ctx.createBufferSource();
    wind.buffer = nb;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.18;
    // la brisa respira (dos osciladores lentos sobre el volumen y el filtro)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.09;
    lfo.connect(lfoG).connect(this.windGain.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.045;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = 220;
    lfo2.connect(lfo2G).connect(bp.frequency);
    wind.connect(bp).connect(this.windGain).connect(this.master);
    wind.start();
    lfo.start();
    lfo2.start();
    // hojas: ruido agudo, muy bajo
    const leaves = ctx.createBufferSource();
    const wb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const wd = wb.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    leaves.buffer = wb;
    leaves.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3800;
    this.leafGain = ctx.createGain();
    this.leafGain.gain.value = 0.012;
    leaves.connect(hp).connect(this.leafGain).connect(this.master);
    leaves.start();
    this._schedule();
    return true;
  }

  toggle() {
    if (!this.ctx && !this._init()) return false;
    this.on = !this.on;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.on ? 0.9 : 0, t + 1.2);
    return this.on;
  }

  // 0 = tarde, 1 = noche (menos pájaros, grillos)
  setDusk(k) {
    this.dusk = k;
  }

  _schedule() {
    const loop = () => {
      if (this.on) {
        if (Math.random() > this.dusk * 0.9) this._bird();
        if (this.dusk > 0.4) this._cricket();
      }
      this.timers.push(setTimeout(loop, 4500 + Math.random() * 7000));
    };
    this.timers.push(setTimeout(loop, 2500));
  }

  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _bird() {
    const ctx = this.ctx;
    let t = ctx.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2300 + Math.random() * 900;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 0.05;
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      out.connect(pan).connect(this.verb);
      pan.connect(this.master);
    } else out.connect(this.master);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const f0 = base * (0.9 + Math.random() * 0.25);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), t + 0.07);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.92, t + 0.12);
      this._env(g, t, 0.012, 0.6, 0.12);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      t += 0.13 + Math.random() * 0.1;
    }
  }

  _cricket() {
    const ctx = this.ctx;
    let t = ctx.currentTime + 0.05;
    const out = ctx.createGain();
    out.gain.value = 0.02 * this.dusk;
    out.connect(this.verb);
    out.connect(this.master);
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      const am = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 4400;
      am.frequency.value = 38;
      const amG = ctx.createGain();
      amG.gain.value = 0.5;
      am.connect(amG).connect(g.gain);
      this._env(g, t, 0.02, 0.5, 0.22);
      o.connect(g).connect(out);
      o.start(t);
      am.start(t);
      o.stop(t + 0.3);
      am.stop(t + 0.3);
      t += 0.4;
    }
  }

  // tijeras: dos chasquidos metálicos
  snip() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    for (const [dt, f] of [[0, 4200], [0.09, 3600]]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 3;
      const g = ctx.createGain();
      this._env(g, t + dt, 0.003, 1.2, 0.05);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t + dt, Math.random() * 2);
      src.stop(t + dt + 0.08);
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = 2600 + dt * 2000;
      this._env(og, t + dt, 0.002, 0.08, 0.09);
      o.connect(og).connect(this.verb);
      o.start(t + dt);
      o.stop(t + dt + 0.12);
    }
  }

  // una nota suave (marimba de madera) en cada color nuevo; sube y baja por la escala
  note() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const step = NOTES[this.noteI++ % NOTES.length];
    const f = 293.66 * Math.pow(2, step / 12);
    const g = ctx.createGain();
    this._env(g, t, 0.006, 0.05, 1.1);
    for (const [mul, type, v] of [[1, 'sine', 1], [4, 'sine', 0.18], [2, 'triangle', 0.25]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1.3);
    }
    g.connect(this.master);
    g.connect(this.verb);
  }

  click() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.03);
    this._env(g, t, 0.002, 0.12, 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }
}
