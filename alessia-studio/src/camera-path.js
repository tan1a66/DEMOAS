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

export const BUBBLE_R = 0.95;

// Bolle dei progetti, tutte insieme davanti alla telecamera alla sosta sott'acqua: un alveare sfalsato
// (schermo orizzontale: due file; verticale: file da 3 e 2), con la distanza scelta perché stia nello
// spazio libero tra il titolo (in alto) e i pulsanti (in basso), con le etichette sotto le bolle.
// Restituisce posizioni sullo schermo (sx, sy in metà larghezza/altezza) e distanza d.
// h = altezza dello schermo in px: su schermi bassi titolo, pulsanti ed etichette pesano di più.
function clusterLayout(n, fovDeg, aspect, h = 900) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const tanH = tanV * aspect;
  const portrait = aspect < 1;
  if (!n) return { slots: [], tanH, tanV };
  const rows = [];
  if (portrait) {
    for (let left = n, k = 0; left > 0; k++) {
      const c = Math.min(left, k % 2 ? 2 : 3);
      rows.push(c);
      left -= c;
    }
  } else if (n) {
    rows.push(Math.ceil(n / 2));
    if (n > 1) rows.push(Math.floor(n / 2));
  }
  // area libera (in metà schermo) e passo tra le bolle in raggi
  const px = (v) => (2 * v) / h; // pixel -> metà altezza
  const low = h < 520;
  const area = portrait
    ? { x0: -0.9, x1: 0.9, y0: Math.max(-0.74, -1 + px(92)), y1: Math.min(0.5, 1 - px(190)) }
    : { x0: low ? -0.6 : -0.66, x1: low ? 0.6 : 0.8, y0: Math.max(-0.7, -1 + px(low ? 100 : 92)), y1: Math.min(0.42, 1 - px(low ? 96 : 250)) };
  const stepX = 2.5, stepY = 2.25, label = Math.max(0.075, px(26));
  const spanCols = portrait ? Math.max(...rows) - 1 : Math.max(...rows) - 1 + (rows.length > 1 ? 0.5 : 0);
  const nr = rows.length;
  // raggio massimo (in metà larghezza / altezza) che fa stare tutto nell'area
  const rW = (area.x1 - area.x0) / (spanCols * stepX + 2);
  const rH = (area.y1 - area.y0 - (nr - 1) * label - label) / ((nr - 1) * stepY + 2);
  const d = Math.max(7.5, BUBBLE_R / Math.min(rW * tanH, rH * tanV));
  const rw = BUBBLE_R / (d * tanH), rh = BUBBLE_R / (d * tanV);
  const cx = (area.x0 + area.x1) / 2, cy = (area.y0 + area.y1) / 2 + label / 2;
  const out = [];
  const jit = (i, k) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1; // [-1, 1] deterministico
  rows.forEach((cols, r) => {
    const sy = cy + ((nr - 1) / 2 - r) * (stepY * rh + label);
    const shift = portrait ? 0 : (r % 2 ? 0.25 : -0.25) * (nr > 1 ? 1 : 0);
    for (let c = 0; c < cols; c++) {
      const i = out.length;
      const sx = cx + (c - (cols - 1) / 2 + shift) * stepX * rw;
      out.push({ sx: sx + jit(i, 1) * rw * 0.12, sy: sy + jit(i, 2) * rh * 0.12, d: d * (1 + jit(i, 3) * 0.05) });
    }
  });
  return { slots: out, tanH, tanV };
}

// posizioni nel mondo delle bolle, viste dalla posa della sosta (pos -> target)
function bubbleWorld(n, fovDeg, aspect, h, pos, target) {
  const { slots, tanH, tanV } = clusterLayout(n, fovDeg, aspect, h);
  const f = new THREE.Vector3().subVectors(target, pos).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  return slots.map(({ sx, sy, d }) => pos.clone().addScaledVector(f, d).addScaledVector(r, sx * d * tanH).addScaledVector(u, sy * d * tanV));
}

// d = distanza iniziale dal muro; n = numero di progetti (bolle); fov verticale, aspect e altezza (px)
// dello schermo
export function buildStory(d, n, fovDeg = 46, aspect = 1.6, h = 900) {
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
  // 3 · lo sguardo sale al lucernario e si ferma: VISIONE
  //     Il disco luminoso non deve stare dietro ai testi: su schermo orizzontale va a destra (testi a
  //     sinistra), in verticale in alto (testi in basso)
  const sky = (pos, tgt) => {
    const f = new THREE.Vector3().subVectors(tgt, pos).normalize();
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const u = new THREE.Vector3().crossVectors(r, f);
    const land = THREE.MathUtils.smoothstep(aspect, 0.9, 1.25);
    const side = 1.75 + Math.max(0, aspect - 1.6) * 1.2; // schermi molto larghi: un po' di più
    return tgt.addScaledVector(r, -side * land).addScaledVector(u, -0.95 * (1 - land));
  };
  const s1 = V(-1.15, 3.12, 0.15), s2 = V(-1.18, 3.11, 0.02);
  key(45, s1, sky(s1, V(-0.25, 9.6, 0.5)), 3.3, 0.4, 'visionIn');
  key(75, s2, sky(s2, V(-0.36, 9.6, 0.4)), 3.3, 0.4, 'visionOut');
  // 4 · ripartenza attraverso il fascio di sole e la grande apertura, fuori sulla terrazza: sosta
  //     davanti al mare, COSA FACCIAMO. Lo sguardo va a sud-ovest, sul mare aperto oltre il bordo
  //     della terrazza: il sole basso (a ovest) resta fuori dall'inquadratura, a sinistra, e non sta
  //     dietro ai testi; l'edificio è alle spalle
  key(45, V(-0.3, 4.0, -1.6), V(0.0, 4.6, -9), 3.2, 0.5);
  key(40, V(0.0, 4.35, -4.2), V(0.0, 4.5, -14), 1.9, 0.3);
  key(30, V(0.0, 4.4, -7.4), V(-0.6, 4.55, -17), 1.25, 0.15);
  key(35, V(-1.2, 4.6, -11.2), V(-14.2, 4.85, -24.6), 1.05, 0.45, 'servicesIn');
  key(75, V(-1.65, 4.6, -11.65), V(-14.9, 4.85, -24.9), 1.05, 0.45, 'servicesOut');
  // 5 · lungo la terrazza, verso il sole basso
  key(40, V(-4.0, 4.7, -13.0), V(-30, 6.4, -9.5), 1.0, 1, 'sun');
  key(30, V(-6.0, 4.6, -13.1), V(-31, 6.0, -10.0), 1.0, 1);
  // 6 · in fondo alla terrazza e giù, nel mare (attraversamento continuo della superficie)
  key(45, V(-25.4, 3.95, -13.3), V(-31, 0.6, -13.4), 1.0, 0.4);
  key(30, V(-27.0, 0.95, -13.4), V(-30.5, -2.6, -13.6), 1.0, 0.15);
  key(25, V(-28.2, -0.9, -13.5), V(-32, -3.0, -13.6), 1.05, 0.15, 'dive');
  key(35, V(-30.5, -3.1, -13.5), V(-40, -3.5, -13.4), 1.1, 0.4, 'underwater');
  // 7 · le bolle dei progetti, tutte insieme: una sola sosta (si tocca una bolla per aprire il progetto)
  const stopPos = V(-33.0, -3.2, -13.5), stopTgt = V(-45, -3.45, -13.5);
  key(40, stopPos, stopTgt, 1.1, 0.55, 'projectsIn');
  key(60, V(-33.25, -3.2, -13.48), stopTgt.clone(), 1.1, 0.55, 'projectsOut');
  const B = bubbleWorld(n, fovDeg, aspect, h, stopPos, stopTgt);
  // 8 · contattaci: lo sguardo sale verso la luce della superficie, le bolle restano sotto
  key(55, V(-35.0, -2.7, -13.5), V(-40, 6.0, -13.5), 1.1, 0.6, 'contactIn');
  key(50, V(-35.6, -2.6, -13.5), V(-39.5, 7.6, -13.5), 1.1, 0.6, 'end');

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
    vision: range('visionIn', 'visionOut', 0.35, 0.3),
    services: range('servicesIn', 'servicesOut', 0.6),
    projects: range('projectsIn', 'projectsOut'),
    contact: [at('contactIn') - (at('contactIn') - keys[marks.contactIn - 1].p) * 0.4, 1.01],
  };
  // soste dello scroll guidato: ogni gesto porta alla successiva (a metà della sosta, telecamera quasi ferma)
  const mid = (a, b) => (at(a) + at(b)) / 2;
  const stops = [
    { id: 'start', p: 0 },
    { id: 'brand', p: mid('brandIn', 'brandOut') },
    { id: 'vision', p: mid('visionIn', 'visionOut') },
    { id: 'services', p: mid('servicesIn', 'servicesOut') },
    { id: 'projects', p: mid('projectsIn', 'projectsOut') },
    { id: 'contact', p: 1 },
  ];
  return { keys, sections, stops, bubbles: B, total, dive: at('dive') };
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
  const story = buildStory(startDistance(46, 1.6), projects, 46, 1.6);
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

  // al resize: ricalcola le chiavi e le bolle che dipendono dall'inquadratura (stesso numero di chiavi,
  // stesse durate: cambiano solo i vettori, che curve e bolle condividono)
  function setFraming(fovDeg, aspect, h) {
    const fresh = buildStory(startDistance(fovDeg, aspect), projects, fovDeg, aspect, h);
    fresh.keys.forEach((k, i) => {
      keys[i].pos.copy(k.pos);
      keys[i].target.copy(k.target);
    });
    fresh.bubbles.forEach((b, i) => story.bubbles[i].copy(b));
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
