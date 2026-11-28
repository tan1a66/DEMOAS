import { CONFIG } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Sonido del mar en bucle, volumen bajo. Usa /audio/sea.mp3 si existe; si no,
//  sintetiza el mar (ruido filtrado) sincronizado con la ola visual: el rumor
//  crece cuando rompe y la espuma sisea mientras el agua sube y se retira.
//  Solo arranca tras un gesto del usuario (requisito de iOS).
// ─────────────────────────────────────────────────────────────────────────────

const AC = window.AudioContext || window.webkitAudioContext;
const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
const SR = 44100;

const rand = (n) => {
  const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
};

// Funde el final con el principio para que el bucle no tenga costura.
const makeLoop = (src, loopSeconds, fadeSeconds, skipSeconds = 0) => {
  const sr = src.sampleRate;
  const skip = Math.round(skipSeconds * sr);
  const L = Math.min(Math.round(loopSeconds * sr), src.length - skip - 1);
  const X = Math.min(Math.round(fadeSeconds * sr), src.length - skip - L);
  const out = new OAC(src.numberOfChannels, 1, sr).createBuffer(src.numberOfChannels, L, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch += 1) {
    const a = src.getChannelData(ch);
    const o = out.getChannelData(ch);
    for (let i = 0; i < L; i += 1) o[i] = a[skip + i];
    for (let i = 0; i < X; i += 1) {
      const t = i / X;
      o[i] = a[skip + i] * Math.sin(t * Math.PI * 0.5) + a[skip + L + i] * Math.cos(t * Math.PI * 0.5);
    }
  }
  return out;
};

const synthesizeSea = async (period) => {
  const cycles = 3;
  const loop = period * cycles;
  const tail = 1.2;
  const len = Math.ceil((loop + tail) * SR);
  const ctx = new OAC(2, len, SR);

  // ruido estéreo decorrelado (rosa aproximado para el rumor)
  const noise = ctx.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = noise.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i += 1) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;

  const roarLP = ctx.createBiquadFilter();
  roarLP.type = 'lowpass';
  roarLP.Q.value = 0.4;
  const roar = ctx.createGain();
  const fizzHP = ctx.createBiquadFilter();
  fizzHP.type = 'highpass';
  fizzHP.frequency.value = 2400;
  const fizzLP = ctx.createBiquadFilter();
  fizzLP.type = 'lowpass';
  fizzLP.frequency.value = 9500;
  const fizz = ctx.createGain();
  const bedLP = ctx.createBiquadFilter();
  bedLP.type = 'lowpass';
  bedLP.frequency.value = 340;
  const bed = ctx.createGain();
  bed.gain.value = 0.55;

  src.connect(roarLP).connect(roar).connect(ctx.destination);
  src.connect(fizzHP).connect(fizzLP).connect(fizz).connect(ctx.destination);
  src.connect(bedLP).connect(bed).connect(ctx.destination);

  const W = CONFIG.wave;
  const P = period;
  for (let k = 0; k <= cycles; k += 1) {
    const t0 = k * P;
    const v = 0.82 + 0.36 * rand(k % cycles);
    // la ola rompe fuera de cuadro justo antes de entrar
    roar.gain.setValueAtTime(0.16, t0);
    roar.gain.linearRampToValueAtTime(0.95 * v, t0 + 0.06 * P);
    roar.gain.linearRampToValueAtTime(0.42 * v, t0 + W.rushEnd * P);
    roar.gain.linearRampToValueAtTime(0.22, t0 + W.recedeEnd * P);
    roar.gain.linearRampToValueAtTime(0.16, t0 + 0.98 * P);
    roarLP.frequency.setValueAtTime(320, t0);
    roarLP.frequency.linearRampToValueAtTime(1500 * v, t0 + 0.07 * P);
    roarLP.frequency.linearRampToValueAtTime(620, t0 + W.holdEnd * P);
    roarLP.frequency.linearRampToValueAtTime(320, t0 + 0.98 * P);
    // espuma sobre la arena: sube con el agua, sisea al retirarse
    fizz.gain.setValueAtTime(0.0, t0);
    fizz.gain.linearRampToValueAtTime(0.5 * v, t0 + W.rushEnd * 0.85 * P);
    fizz.gain.linearRampToValueAtTime(0.16, t0 + W.holdEnd * P);
    fizz.gain.linearRampToValueAtTime(0.3 * v, t0 + (W.holdEnd + 0.18) * P);
    fizz.gain.linearRampToValueAtTime(0.0, t0 + (W.recedeEnd + 0.06) * P);
    fizz.gain.linearRampToValueAtTime(0.0, t0 + 0.98 * P);
  }
  src.start(0);
  const rendered = await ctx.startRendering();
  return makeLoop(rendered, loop, 0.9);
};

const decodeFile = async (url) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) return null;
  const data = await res.arrayBuffer();
  const ctx = new OAC(2, 1, SR);
  const buf = await ctx.decodeAudioData(data);
  if (!buf || buf.duration < 2) return null;
  // quita el silencio inicial del codificador mp3 y funde las juntas
  return makeLoop(buf, buf.duration - 0.6, 0.45, 0.05);
};

export class SeaAudio {
  constructor({ getVisualTime }) {
    this.getVisualTime = getVisualTime;
    this.ctx = null;
    this.gain = null;
    this.source = null;
    this.buffer = null;
    this.synced = false;
    this.playing = false;
    this.listeners = new Set();
    this.ready = this.prepare();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend();
      } else if (this.playing) {
        // al volver, se reinicia la fuente para recuperar la sincronía con la ola
        this.dropSource();
        this.play();
      }
    });
  }

  async prepare() {
    if (!AC || !OAC) return null;
    try {
      const file = await decodeFile(CONFIG.audio.src);
      if (file) {
        this.buffer = file;
        this.synced = false;
        return file;
      }
    } catch {
      /* sin archivo o formato no válido: se usa el mar sintetizado */
    }
    try {
      this.buffer = await synthesizeSea(CONFIG.wave.period);
      this.synced = true;
    } catch (err) {
      console.warn('[casa-caracol] audio no disponible', err);
    }
    return this.buffer;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.playing));
  }

  // Debe llamarse dentro de un gesto (toque/clic/tecla).
  unlock() {
    if (!AC) return false;
    if (!this.ctx) {
      try {
        this.ctx = new AC({ latencyHint: 'playback' });
      } catch {
        this.ctx = new AC();
      }
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      // búfer mudo: desbloquea definitivamente el audio en iOS antiguos
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, 22050);
      s.connect(this.ctx.destination);
      s.start(0);
    }
    this.ctx.resume();
    return true;
  }

  async play({ explicit = false } = {}) {
    if (!this.unlock()) return;
    // con el botón (gesto explícito) el mar suena aunque el iPhone esté en silencio
    if (explicit && navigator.audioSession) {
      try {
        navigator.audioSession.type = 'playback';
      } catch {
        /* no soportado */
      }
    }
    this.playing = true;
    this.emit();
    await this.ready;
    if (!this.buffer || !this.playing) return;
    const { ctx } = this;
    if (!this.source) {
      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = true;
      src.connect(this.gain);
      const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
      const offset = this.synced ? (this.getVisualTime() + latency) % this.buffer.duration : 0;
      src.start(0, offset);
      this.source = src;
    }
    const g = this.gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(CONFIG.audio.volume, now + CONFIG.audio.fadeIn);
  }

  pause() {
    this.playing = false;
    this.emit();
    if (!this.ctx) return;
    const g = this.gain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.6);
    setTimeout(() => {
      if (this.playing || !this.ctx) return;
      this.dropSource();
      this.ctx.suspend();
    }, 700);
  }

  dropSource() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      /* ya detenida */
    }
    this.source.disconnect();
    this.source = null;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play({ explicit: true });
  }
}
