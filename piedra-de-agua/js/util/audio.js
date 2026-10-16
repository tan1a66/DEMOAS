// Sonidos sintetizados (WebAudio): solo se activan tras la primera interacción.
let ctx = null;
let master = null;
let enabled = true;

try { enabled = localStorage.getItem('pda-sound') !== 'off'; } catch (e) { /* ignorar */ }

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.5 : 0;
  master.connect(ctx.destination);
}

export function isSoundOn() { return enabled; }
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('pda-sound', on ? 'on' : 'off'); } catch (e) { /* ignorar */ }
  if (master) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
}

function noiseBuffer(seconds = 0.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function ready() { return ctx && enabled && ctx.state !== 'closed'; }

// Gota de agua: tono que sube rápido, muy suave.
export function playDrop(intensity = 1) {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const f = 520 + Math.random() * 380;
  o.frequency.setValueAtTime(f, t0);
  o.frequency.exponentialRampToValueAtTime(f * 2.3, t0 + 0.09);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09 * intensity, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + 0.25);
}

// Clic mecánico del citófono.
export function playClick() {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.06);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(180, t0);
  o.frequency.exponentialRampToValueAtTime(70, t0 + 0.06);
  og.gain.setValueAtTime(0.25, t0);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
  o.connect(og).connect(master);
  o.start(t0); o.stop(t0 + 0.1);
}

// Timbre suave tras pulsar (dos notas de campanilla).
export function playChime() {
  if (!ready()) return;
  const t0 = ctx.currentTime + 0.08;
  [[1318.5, 0], [1046.5, 0.16]].forEach(([f, d]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + d + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.9);
    o.connect(g).connect(master);
    o.start(t0 + d); o.stop(t0 + d + 1);
  });
}

// Cerrojo y madera: el portón se abre.
export function playLatch() {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  // golpe grave de la madera
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(110, t0 + 0.05);
  o.frequency.exponentialRampToValueAtTime(50, t0 + 0.4);
  og.gain.setValueAtTime(0.0001, t0 + 0.05);
  og.gain.exponentialRampToValueAtTime(0.22, t0 + 0.07);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  o.connect(og).connect(master);
  o.start(t0 + 0.05); o.stop(t0 + 0.55);
}

// Soplo de aire (transiciones de puerta).
export function playWhoosh(duration = 1.2) {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(duration);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, t0);
  lp.frequency.exponentialRampToValueAtTime(1400, t0 + duration * 0.5);
  lp.frequency.exponentialRampToValueAtTime(250, t0 + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.06, t0 + duration * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(lp).connect(g).connect(master);
  src.start(t0);
}
