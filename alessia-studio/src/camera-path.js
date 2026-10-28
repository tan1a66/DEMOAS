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

// Sott'acqua, sul fondale: una statua di bronzo da girare col dito (src/sculpture.js). Poi lo sguardo
// sale verso la superficie: il contatto. STATUE_H è l'altezza della statua; ART_SIZE l'ingombro da
// inquadrare (larghezza, altezza), con un margine perché girandola si allarga.
export const SEABED_Y = -10;
export const STATUE_H = 3.0;
export const ART_SIZE = [4.4, 3.2];
const ART_BASE = V(-41.5, SEABED_Y, -13.5);
export const ART = { base: ART_BASE, center: ART_BASE.clone().add(V(0, ART_SIZE[1] / 2, 0)) };

// la scultura un po' dall'alto, come scendendo verso la sabbia; in verticale (telefono) l'opera sta
// più in alto, sopra l'invito
function artView(C, fovDeg, aspect, push = 0) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), tanH = tanV * aspect;
  const port = aspect < 1;
  const [W, H] = ART_SIZE;
  const d = Math.max(W / 2 / ((port ? 1.0 : 0.5) * tanH), H / 2 / ((port ? 0.62 : 0.68) * tanV)) - push;
  const f = V(-1, -0.16, 0.04).normalize();
  const target = C.clone().add(V(0, port ? -0.9 : -0.75, 0));
  return { pos: target.clone().addScaledVector(f, -d), target };
}

// d = distanza iniziale dal muro; fov verticale, aspect e altezza (px) dello schermo
export function buildStory(d, fovDeg = 46, aspect = 1.6, h = 900) {
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
  // 5 · lungo la terrazza fino al bordo, verso il sole basso: una pausa davanti al mare, senza testi,
  //     dentro lo stesso gesto del tuffo (non serve un altro scroll)
  key(40, V(-4.0, 4.7, -13.0), V(-30, 6.4, -9.5), 1.0, 1, 'sun');
  key(40, V(-14.0, 4.62, -13.2), V(-40, 6.0, -10.6), 1.0, 0.8);
  key(40, V(-21.9, 4.58, -13.3), V(-48, 5.6, -11.2), 1.0, 0.6, 'edgeIn');
  key(45, V(-22.4, 4.56, -13.3), V(-48.4, 5.5, -11.3), 1.0, 0.6, 'edgeOut');
  // 6 · il tuffo, lento, scivolando nell'acqua con lo sguardo appena verso il basso
  //     (niente picchiata); molte unità attorno alla superficie, così l'attraversamento è calmo
  key(40, V(-25.0, 3.7, -13.35), V(-34.5, 1.3, -13.45), 1.0, 0.3);
  key(40, V(-27.2, 1.7, -13.4), V(-36.5, -0.6, -13.5), 1.0, 0.2);
  key(40, V(-28.9, 0.32, -13.45), V(-38.0, -1.7, -13.5), 1.02, 0.15);
  key(45, V(-30.3, -0.65, -13.5), V(-39.3, -2.5, -13.5), 1.05, 0.15, 'dive');
  key(40, V(-32.2, -2.3, -13.5), V(-41.0, -3.3, -13.4), 1.1, 0.3, 'underwater');
  // 7 · sott'acqua si scende sul fondale fino alla scultura, che si gira col dito
  const g = artView(ART.center, fovDeg, aspect), gOut = artView(ART.center, fovDeg, aspect, 0.3);
  key(45, V(-33.4, -4.5, -13.6), V(-41.5, -7.4, -13.5), 1.15, 0.3);
  key(55, g.pos, g.target, 1.2, 0.35, 'artIn');
  key(55, gOut.pos, gOut.target, 1.2, 0.35, 'artOut');
  // 8 · contattaci: lo sguardo sale verso la luce della superficie
  const last = gOut.pos;
  key(55, last.clone().add(V(-2.0, 0.5, -0.4)), last.clone().add(V(-7, 9.2, -0.6)), 1.1, 0.6, 'contactIn');
  key(50, last.clone().add(V(-2.6, 0.6, -0.5)), last.clone().add(V(-6.5, 10.8, -0.7)), 1.1, 0.6, 'end');

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
    art: range('artIn', 'artOut', 0.25, 0.2),
    contact: [at('contactIn') - (at('contactIn') - keys[marks.contactIn - 1].p) * 0.4, 1.01],
  };
  // soste dello scroll guidato: ogni gesto porta alla successiva (a metà della sosta, telecamera quasi ferma)
  const mid = (a, b) => (at(a) + at(b)) / 2;
  const stops = [
    { id: 'start', p: 0 },
    { id: 'brand', p: mid('brandIn', 'brandOut') },
    { id: 'vision', p: mid('visionIn', 'visionOut') },
    { id: 'services', p: mid('servicesIn', 'servicesOut') },
    // dalla terrazza alla scultura in un solo gesto: si cammina fino al bordo, una pausa davanti al
    // sole, poi il tuffo e la discesa sul fondale (più lenti e con un'accelerazione più dolce)
    { id: 'art', p: mid('artIn', 'artOut'), via: { p: mid('edgeIn', 'edgeOut'), hold: 1.1 }, pace: 0.016, maxDur: 6.5, ease: 'sine.inOut' },
    { id: 'contact', p: 1 },
  ];
  return { keys, sections, stops, art: ART, total };
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

export function createCameraPath(camera, { reducedMotion = false } = {}) {
  const story = buildStory(startDistance(46, 1.6), 46, 1.6);
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
  // durate: cambiano solo i vettori, che le curve condividono); scultura e banco restano dove sono
  function setFraming(fovDeg, aspect, h) {
    const fresh = buildStory(startDistance(fovDeg, aspect), fovDeg, aspect, h);
    fresh.keys.forEach((k, i) => {
      keys[i].pos.copy(k.pos);
      keys[i].target.copy(k.target);
    });
  }

  // parallax: vettore [-1,1]^2 già smorzato; amp = metri di spostamento laterale
  function update(dt, parallax = { x: 0, y: 0 }, amp = 0.22) {
    if (reducedMotion) state.u = state.target;
    else state.u += (state.target - state.u) * (1 - Math.exp(-dt * 4.5));
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
