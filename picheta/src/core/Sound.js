// Sonido opcional (apagado por defecto). Todo sintetizado con Web Audio:
// un tambor grave tipo tunkul (cuerpo + madera + golpe) con reverberación.
// No hay archivos de audio que cargar.
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

  toggle() {
    this.set(!this.enabled);
  }

  set(on) {
    if (on && !this.ensure()) return;
    this.enabled = on;
    if (this.ctx) {
      if (on) this.ctx.resume();
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.12);
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
