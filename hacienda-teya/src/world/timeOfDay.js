// ─────────────────────────────────────────────────────────────────────────────
//  Ora del giorno: dal palcoscenico buio dell'apertura all'oro del pomeriggio
//  yucateco, poi tramonto (Eventos), ora blu (Casas) e notte (Trova).
//  Ogni "umore" è un insieme di parametri; lo scroll li interpola.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);
const D = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const MOODS = {
  // l'apertura: notte calda, sole basso dietro la pianta
  stage: {
    sunDir: D(-0.62, 0.3, -0.72),
    sunColor: C('#ffb468'),
    sunI: 3.2,
    fillColor: C('#ffe4c8'),
    fillI: 0.6,
    rimI: 0.7,
    env: 0.32,
    zenith: C('#080504'),
    mid: C('#190b06'),
    horizon: C('#2a130b'),
    sunGlow: C('#6e3418'),
    skyGround: C('#160c08'),
    fog: C('#160c08'),
    fogDensity: 0.06,
    night: 0,
    lights: 0,
    hdri: 0,
  },
  // pomeriggio dorato: luce radente da sinistra sulle facciate
  golden: {
    sunDir: D(-0.8, 0.34, 0.5),
    sunColor: C('#ffd29a'),
    sunI: 3.9,
    fillColor: C('#bcd2f0'),
    fillI: 0.28,
    rimI: 0.2,
    env: 0.62,
    zenith: C('#2c5d9f'),
    mid: C('#f3e3c6'),
    horizon: C('#ffcb8e'),
    sunGlow: C('#ffd08f'),
    skyGround: C('#e4c299'),
    fog: C('#e4c299'),
    fogDensity: 0.0052,
    night: 0,
    lights: 0,
    hdri: 1,
  },
  // tramonto: il sole tocca l'orizzonte, cielo rosa-arancio
  sunset: {
    sunDir: D(-0.9, 0.09, 0.42),
    sunColor: C('#ff8f52'),
    sunI: 2.6,
    fillColor: C('#93a7d6'),
    fillI: 0.32,
    rimI: 0.2,
    env: 0.5,
    zenith: C('#2c4a86'),
    mid: C('#ffc28e'),
    horizon: C('#ff9459'),
    sunGlow: C('#ff7a3c'),
    skyGround: C('#c27f5c'),
    fog: C('#c27f5c'),
    fogDensity: 0.0075,
    night: 0.5,
    lights: 1,
    hdri: 1,
  },
  // ora blu: cielo indaco-azzurro, ultima striscia arancio
  blue: {
    sunDir: D(-0.92, 0.03, 0.38),
    sunColor: C('#ff6c3c'),
    sunI: 0.9,
    fillColor: C('#6f89c8'),
    fillI: 0.38,
    rimI: 0.15,
    env: 0.22,
    zenith: C('#16264a'),
    mid: C('#5a5a78'),
    horizon: C('#d06d47'),
    sunGlow: C('#ff5c2c'),
    skyGround: C('#2a2620'),
    fog: C('#2b3448'),
    fogDensity: 0.011,
    night: 0.85,
    lights: 1,
    hdri: 1,
  },
  // notte: luna fredda, lanterne calde
  night: {
    sunDir: D(0.45, 0.62, 0.55),
    sunColor: C('#a7bbe6'),
    sunI: 0.42,
    fillColor: C('#4f6290'),
    fillI: 0.18,
    rimI: 0.1,
    env: 0.08,
    zenith: C('#050912'),
    mid: C('#0f1628'),
    horizon: C('#18203a'),
    sunGlow: C('#0b1020'),
    skyGround: C('#0a0c12'),
    fog: C('#0c111e'),
    fogDensity: 0.012,
    night: 1,
    lights: 1,
    hdri: 1,
  },
};

// stato corrente (si riusa: niente allocazioni per fotogramma)
export function createMoodState() {
  const m = {};
  for (const [k, v] of Object.entries(MOODS.stage)) m[k] = v && v.clone ? v.clone() : v;
  return m;
}

export function mixMood(out, a, b, t) {
  for (const k of Object.keys(out)) {
    const va = a[k];
    const vb = b[k];
    if (va.isColor) out[k].copy(va).lerp(vb, t);
    else if (va.isVector3) out[k].copy(va).lerp(vb, t).normalize();
    else if (k === 'fogDensity') out[k] = Math.exp(THREE.MathUtils.lerp(Math.log(va), Math.log(vb), t));
    else out[k] = THREE.MathUtils.lerp(va, vb, t);
  }
  return out;
}
