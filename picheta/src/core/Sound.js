// Sonido opcional (apagado por defecto). Todo sintetizado con Web Audio:
// un tambor grave tipo tunkul (cuerpo + madera + golpe) con reverberación y
// los ambientes de cada escena. No hay archivos de audio que cargar.
export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.master);
    this.noise = noiseBuffer(ctx, 0.5);
    return true;
  }

  // Ambiente continuo: 'viento' (mapa y escalera), 'plaza' (terraza: murmullo,
  // campanas lejanas y zanates) o null. Si el sonido está apagado se recuerda
  // y arranca al activarlo.
  ambience(type) {
    this.wanted = type;
    if (!this.enabled || !this.ctx) return;
    if (this.amb?.type === type) return;
    this.stopAmbience();
    if (!type) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    out.connect(this.master);
    const src = ctx.createBufferSource();
    src.buffer = brownNoise(ctx, 4);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type === 'plaza' ? 'bandpass' : 'lowpass';
    f.frequency.value = type === 'plaza' ? 380 : 520;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = type === 'plaza' ? 0.22 : 0.3;
    // Respiración lenta del viento / de la gente.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = type === 'plaza' ? 60 : 180;
    lfo.connect(lfoG).connect(f.frequency);
    src.connect(f).connect(g).connect(out);
    src.start();
    lfo.start();
    const amb = (this.amb = { type, out, nodes: [src, lfo], timers: [] });
    if (type === 'plaza') {
      const later = (fn, min, max) => {
        const id = setTimeout(() => {
          if (this.amb !== amb) return;
          fn();
          later(fn, min, max);
        }, (min + Math.random() * (max - min)) * 1000);
        amb.timers.push(id);
      };
      later(() => this.bell(out), 9, 24);
      later(() => this.zanate(out), 3, 9);
    }
  }

  stopAmbience() {
    const a = this.amb;
    if (!a) return;
    this.amb = null;
    a.timers.forEach(clearTimeout);
    a.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    setTimeout(() => {
      a.nodes.forEach((n) => n.stop());
      a.out.disconnect();
    }, 2500);
  }

  // Campana lejana de la Catedral: parciales inarmónicos con caída larga.
  bell(out) {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const f0 = 196 * (Math.random() < 0.5 ? 1 : 1.5);
    for (const [ratio, amp] of [
      [1, 0.05],
      [2.0, 0.03],
      [2.4, 0.02],
      [3.0, 0.015],
      [4.2, 0.01],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f0 * ratio;
      const g = env(ctx, t, amp, 0.004, 4.5);
      o.connect(g).connect(out);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + 5);
    }
  }

  // Zanate (el pájaro negro de las plazas de Mérida): silbidos ascendentes.
  zanate(out) {
    const ctx = this.ctx;
    let t = ctx.currentTime + 0.02;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1500 + Math.random() * 400, t);
      o.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 800, t + 0.11);
      const g = env(ctx, t, 0.018, 0.01, 0.12);
      const pan = ctx.createStereoPanner?.();
      if (pan) {
        pan.pan.value = Math.random() * 1.6 - 0.8;
        o.connect(g).connect(pan).connect(out);
      } else o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      t += 0.16 + Math.random() * 0.1;
    }
  }

  toggle() {
    this.set(!this.enabled);
  }

  set(on) {
    if (on && !this.ensure()) return;
    this.enabled = on;
    if (this.ctx) {
      if (on) this.ctx.resume();
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.12);
      if (on && this.wanted) this.ambience(this.wanted);
      if (!on) this.stopAmbience();
    }
    for (const fn of this.listeners) fn(on);
  }

  // Golpe de tambor. strength 0..1 (0.2 = latido suave, 1 = unión de los círculos).
  drum(strength = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.value = strength;
    out.connect(this.master);
    out.connect(this.reverb);

    // Cuerpo: seno que cae de tono.
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(96, t);
    body.frequency.exponentialRampToValueAtTime(44, t + 0.5);
    const bg = env(ctx, t, 0.9, 0.006, 1.5);
    body.connect(bg).connect(out);

    // Madera: parcial más agudo y corto (el tunkul es un tronco hueco).
    const wood = ctx.createOscillator();
    wood.type = 'triangle';
    wood.frequency.setValueAtTime(230, t);
    wood.frequency.exponentialRampToValueAtTime(160, t + 0.25);
    const wg = env(ctx, t, 0.22, 0.004, 0.35);
    wood.connect(wg).connect(out);

    // Golpe: ruido filtrado muy breve.
    const hit = ctx.createBufferSource();
    hit.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.9;
    const hg = env(ctx, t, 0.28, 0.002, 0.07);
    hit.connect(bp).connect(hg).connect(out);

    for (const n of [body, wood, hit]) {
      n.start(t);
      n.stop(t + 1.8);
    }
  }
}

function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

// Ruido marrón (grave, como viento o murmullo lejano).
function brownNoise(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Respuesta al impulso sintética (ruido con caída exponencial): una sala de piedra.
function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
