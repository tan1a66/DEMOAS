import * as THREE from 'three';

// Percorso della telecamera guidato dallo scroll.
// Ogni chiave: p = avanzamento dello scroll (0..1), pos/target, esposizione, peso del parallasse.
// Due CatmullRomCurve3 (posizione e target) percorse con lo stesso parametro; la mappa
// scroll -> parametro è una cubica monotona, così le soste (chiavi vicine nello spazio ma
// lontane nello scroll) rallentano la telecamera senza scatti.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const KEYS = [
  // 0 · orizzonte: monolite rosa sul mare, telecamera in piano (l'orizzonte è a metà schermo)
  { p: 0.0, pos: V(-19.0, 12.4, 52), target: V(-2.0, 12.4, 6), exposure: 1.0, parallax: 1 },
  { p: 0.12, pos: V(-10.5, 9.0, 37), target: V(-0.6, 7.4, 8), exposure: 1.0, parallax: 1 },
  { p: 0.24, pos: V(-2.6, 6.5, 23), target: V(0.0, 5.95, 9), exposure: 1.0, parallax: 0.8 },
  // 1 · allineamento e attraversamento della finestra circolare
  { p: 0.32, pos: V(-0.05, 5.86, 14.5), target: V(0.0, 5.8, 0), exposure: 1.0, parallax: 0.35 },
  { p: 0.38, pos: V(0.0, 5.8, 9.9), target: V(0.0, 5.55, -2), exposure: 1.3, parallax: 0.15 },
  { p: 0.43, pos: V(0.0, 5.62, 7.3), target: V(0.1, 3.6, -2.4), exposure: 2.4, parallax: 0.3 },
  // 2 · conversation pit: discesa, sguardo verso l'alto (pausa), ripartenza
  { p: 0.51, pos: V(0.3, 4.55, 4.6), target: V(0.45, 2.1, -1.8), exposure: 3.2, parallax: 0.6 },
  { p: 0.575, pos: V(0.6, 3.72, 2.75), target: V(0.4, 2.7, -2.2), exposure: 3.3, parallax: 0.6 },
  { p: 0.63, pos: V(0.66, 3.6, 2.45), target: V(0.12, 9.6, 0.6), exposure: 3.3, parallax: 0.5 },
  { p: 0.705, pos: V(0.62, 3.62, 2.3), target: V(0.06, 9.6, 0.5), exposure: 3.3, parallax: 0.5 },
  { p: 0.765, pos: V(0.25, 4.1, 0.55), target: V(0.0, 4.7, -8), exposure: 3.2, parallax: 0.5 },
  // 3 · verso il mare: grande apertura rettangolare, terrazza, il sole basso
  { p: 0.84, pos: V(0.0, 4.35, -3.6), target: V(0.0, 4.5, -14), exposure: 1.9, parallax: 0.3 },
  { p: 0.89, pos: V(0.0, 4.4, -7.4), target: V(-0.6, 4.55, -17), exposure: 1.25, parallax: 0.15 },
  { p: 0.94, pos: V(-0.7, 4.55, -10.6), target: V(-7.5, 4.95, -19), exposure: 1.05, parallax: 0.6 },
  { p: 1.0, pos: V(-3.0, 4.7, -13.0), target: V(-30, 6.4, -9.2), exposure: 1.0, parallax: 1 },
];

// Interpolazione cubica monotona (Fritsch–Carlson)
function monotone(xs, ys) {
  const n = xs.length;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export function createCameraPath(camera, { reducedMotion = false } = {}) {
  const n = KEYS.length;
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.target), false, 'centripetal');
  const ps = KEYS.map((k) => k.p);
  const us = KEYS.map((_, i) => i / (n - 1));
  const pToU = monotone(ps, us);
  const uToExposure = monotone(us, KEYS.map((k) => k.exposure));
  const uToParallax = monotone(us, KEYS.map((k) => k.parallax));

  const state = { target: 0, u: 0 };
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const f = new THREE.Vector3(), r = new THREE.Vector3(), up = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  function setProgress(p) {
    state.target = pToU(THREE.MathUtils.clamp(p, 0, 1));
  }

  // parallax: vettore [-1,1]^2 già smorzato; amp = metri di spostamento laterale
  function update(dt, parallax = { x: 0, y: 0 }, amp = 0.22) {
    if (reducedMotion) state.u = state.target;
    else state.u += (state.target - state.u) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(state.target - state.u) < 1e-6) state.u = state.target;
    const u = state.u;
    posCurve.getPoint(u, pos);
    tgtCurve.getPoint(u, tgt);
    const w = reducedMotion ? 0 : uToParallax(u) * amp;
    if (w > 0) {
      f.subVectors(tgt, pos).normalize();
      r.crossVectors(f, WORLD_UP).normalize();
      up.crossVectors(r, f);
      pos.addScaledVector(r, parallax.x * w).addScaledVector(up, parallax.y * w * 0.6);
      tgt.addScaledVector(r, parallax.x * w * 0.35).addScaledVector(up, parallax.y * w * 0.2);
    }
    camera.position.copy(pos);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    return { exposure: uToExposure(u), u };
  }

  return { setProgress, update, state, posCurve, tgtCurve };
}
