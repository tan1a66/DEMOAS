import * as THREE from 'three';
import { FRONT_WALL as FW, WINDOW } from './layout.js';

// Percorso della telecamera guidato dallo scroll.
// Il percorso è una sequenza di chiavi (posizione, target, esposizione, peso del parallasse) con una
// durata di scroll ciascuna; le soste sono chiavi quasi ferme con molta durata. Due CatmullRomCurve3
// (posizione e target) percorse con lo stesso parametro; la mappa scroll -> parametro è una cubica
// monotona, così le soste rallentano la telecamera senza scatti.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Distanza iniziale dal muro: il muro rosa deve riempire tutto lo schermo (niente mare né cielo
// attorno alla struttura), con un margine per il parallasse. Dipende dal campo visivo.
export function startDistance(fovDeg, aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const tanH = tanV * aspect;
  const margin = 0.55;
  const vert = Math.min(WINDOW.cy - FW.y0, FW.y1 - WINDOW.cy) - margin;
  const horiz = Math.min(-FW.x0, FW.x1) - margin;
  return THREE.MathUtils.clamp(Math.min(vert / tanV, horiz / tanH), 4.5, 14);
}

// Posizioni delle bolle dei progetti, in mare aperto oltre la punta della terrazza
export function bubblePositions(n) {
  return Array.from({ length: n }, (_, i) => V(-38 - 10.5 * i, -3.3 + 0.55 * Math.sin(i * 1.7), -13.5 + (i % 2 ? 1.6 : -1.6)));
}

// d = distanza iniziale dal muro; n = numero di progetti (bolle); aspect = larghezza/altezza dello schermo
export function buildStory(d, n, aspect = 1.6) {
  const zw = FW.zOut;
  const cy = WINDOW.cy;
  const keys = [];
  const marks = {};
  // dur = scroll (in "unità", ~vh) per arrivare a questa chiave dalla precedente
  const key = (dur, pos, target, exposure, parallax, mark) => {
    keys.push({ dur, pos, target, exposure, parallax });
    if (mark) marks[mark] = keys.length - 1;
  };

  // 0 · il muro a cassero riempie lo schermo; l'unico orizzonte, visto attraverso la finestra e
  //     l'apertura di fondo, è a metà schermo (telecamera in piano)
  key(0, V(0, cy, zw + d), V(0, cy, 0), 1.12, 0.6, 'start');
  key(45, V(0, cy, zw + Math.max(3.6, d * 0.6)), V(0, cy, 0), 1.12, 0.45);
  // 1 · attraversamento della finestra circolare
  key(35, V(0, cy, zw + 2.2), V(0, cy - 0.1, -2), 1.15, 0.25);
  key(25, V(0, cy, zw + 0.9), V(0, cy - 0.25, -2), 1.3, 0.15);
  key(30, V(0.0, 5.62, 7.3), V(0.1, 3.6, -2.4), 2.4, 0.3);
  // 2 · discesa nel conversation pit e sosta accanto al divano verde: ALESSIA STUDIO
  key(45, V(-0.5, 4.35, 3.9), V(0.0, 2.5, -2.0), 3.1, 0.5);
  key(45, V(-1.05, 3.18, 0.45), V(0.35, 2.58, -2.6), 3.3, 0.45, 'brandIn');
  key(75, V(-1.12, 3.14, 0.32), V(0.38, 2.6, -2.6), 3.3, 0.45, 'brandOut');
  // 3 · lo sguardo sale al lucernario e si ferma: VISIONE, cosa facciamo, servizi
  key(45, V(-1.15, 3.12, 0.15), V(-0.25, 9.6, 0.5), 3.3, 0.4, 'visionIn');
  key(115, V(-1.17, 3.12, 0.08), V(-0.3, 9.6, 0.45), 3.3, 0.4, 'visionOut');
  // 4 · ripartenza attraverso il fascio di sole, grande apertura, terrazza, il sole basso
  key(45, V(-0.3, 4.0, -1.6), V(0.0, 4.6, -9), 3.2, 0.5);
  key(40, V(0.0, 4.35, -4.2), V(0.0, 4.5, -14), 1.9, 0.3);
  key(30, V(0.0, 4.4, -7.4), V(-0.6, 4.55, -17), 1.25, 0.15);
  key(30, V(-0.7, 4.55, -10.6), V(-7.5, 4.95, -19), 1.05, 0.6);
  key(35, V(-4.0, 4.7, -13.0), V(-30, 6.4, -9.5), 1.0, 1, 'sun');
  key(30, V(-6.0, 4.6, -13.1), V(-31, 6.0, -10.0), 1.0, 1);
  // 5 · in fondo alla terrazza e giù, nel mare (attraversamento continuo della superficie)
  key(45, V(-25.4, 3.95, -13.3), V(-31, 0.6, -13.4), 1.0, 0.4);
  key(30, V(-27.0, 0.95, -13.4), V(-30.5, -2.6, -13.6), 1.0, 0.15);
  key(25, V(-28.2, -0.9, -13.5), V(-32, -3.0, -13.6), 1.05, 0.15, 'dive');
  key(35, V(-30.5, -3.1, -13.5), V(-40, -3.5, -13.4), 1.1, 0.4, 'underwater');
  // 6 · le bolle: ogni progetto ha un avvicinamento e una sosta
  const B = bubblePositions(n);
  // schermo orizzontale: bolla a destra, scheda a sinistra; telefono in verticale: bolla in alto, scheda sotto
  const portrait = aspect < 1;
  const side = portrait ? 0 : 1.05;
  const low = portrait ? -1.05 : 0;
  const back = portrait ? 1.0 : 0;
  B.forEach((b, i) => {
    const tgt = () => V(b.x, b.y + low, b.z + side);
    key(40, V(b.x + 7.5 + back, b.y + 0.4, b.z + 0.2), tgt(), 1.1, 0.6);
    key(32, V(b.x + 4.1 + back, b.y + 0.15, b.z + 0.35), tgt(), 1.1, 0.5, `projectIn${i}`);
    key(55, V(b.x + 3.85 + back, b.y + 0.12, b.z + 0.32), tgt(), 1.1, 0.5, `projectOut${i}`);
  });
  // 7 · contattaci: oltre l'ultima bolla, lo sguardo sale verso la luce della superficie
  const last = B.length ? B[B.length - 1] : V(-38, -3.3, -13.5);
  key(55, V(last.x - 6.0, -4.3, -13.5), V(last.x - 16, 2.6, -13.5), 1.1, 0.6, 'contactIn');
  key(60, V(last.x - 7.0, -4.6, -13.5), V(last.x - 14, 4.6, -13.5), 1.1, 0.6, 'end');

  // durate cumulate -> avanzamento dello scroll (0..1)
  const total = keys.reduce((s, k) => s + k.dur, 0);
  let acc = 0;
  for (const k of keys) {
    acc += k.dur;
    k.p = acc / total;
  }
  const at = (name) => keys[marks[name]].p;
  // finestra visibile di un testo: entra durante l'arrivo alla sosta, esce all'inizio della ripartenza
  const range = (a, b, pre = 0.35, post = 0.25) => {
    const ia = marks[a], ib = marks[b];
    const before = keys[ia].p - keys[ia - 1].p;
    const after = ib + 1 < keys.length ? keys[ib + 1].p - keys[ib].p : 0;
    return [keys[ia].p - before * pre, keys[ib].p + after * post];
  };
  const sections = {
    brand: range('brandIn', 'brandOut'),
    vision: range('visionIn', 'visionOut'),
    projectsTitle: [at('dive'), at('underwater') + (B.length ? (keys[marks.projectIn0 - 1].p - at('underwater')) * 0.6 : 0)],
    projects: B.map((_, i) => range(`projectIn${i}`, `projectOut${i}`)),
    contact: [at('contactIn') - (at('contactIn') - keys[marks.contactIn - 1].p) * 0.4, 1.01],
  };
  return { keys, sections, bubbles: B, total, dive: at('dive') };
}

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

export function createCameraPath(camera, { reducedMotion = false, projects = 0 } = {}) {
  const story = buildStory(startDistance(46, 1.6), projects);
  const { keys } = story;
  const n = keys.length;
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.target), false, 'centripetal');
  const ps = keys.map((k) => k.p);
  const us = keys.map((_, i) => i / (n - 1));
  const pToU = monotone(ps, us);
  const uToP = monotone(us, ps);
  const uToExposure = monotone(us, keys.map((k) => k.exposure));
  const uToParallax = monotone(us, keys.map((k) => k.parallax));

  const state = { target: 0, u: 0 };
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const f = new THREE.Vector3(), r = new THREE.Vector3(), up = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  function setProgress(p) {
    state.target = pToU(THREE.MathUtils.clamp(p, 0, 1));
  }

  // al resize: ricalcola le chiavi che dipendono dall'inquadratura (stesso numero di chiavi, stesse
  // durate: cambiano solo posizioni e target, e le curve usano gli stessi vettori)
  function setFraming(fovDeg, aspect) {
    const fresh = buildStory(startDistance(fovDeg, aspect), projects, aspect).keys;
    fresh.forEach((k, i) => {
      keys[i].pos.copy(k.pos);
      keys[i].target.copy(k.target);
    });
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
    // p = avanzamento "visivo" (segue la telecamera smorzata): guida la comparsa dei testi
    return { exposure: uToExposure(u), u, p: uToP(u) };
  }

  return { setProgress, setFraming, update, state, posCurve, tgtCurve, story };
}
