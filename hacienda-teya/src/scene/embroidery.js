// ─────────────────────────────────────────────────────────────────────────────
//  Il ricamo: la spina-ago cuce "Hacienda Teya" sul lino
//
//  1. Punti: le lettere (linea centrale da thread-paths.json) diventano una
//     fila di punti dritti quasi contigui (l'aspetto del punto indietro, quello
//     delle scritte ricamate). Nelle curve i punti si accorciano, come fa una
//     ricamatrice; dove la "penna" ripasserebbe su un tratto già cucito il filo
//     passa dietro il lino invece di fare un secondo punto.
//  2. Traiettoria della punta dell'ago: vola dal cogollo al primo foro, poi per
//     ogni foro passa DRITTO attraverso il tessuto (tutto l'ago attraversa il
//     foro, come nella realtà) e tra un foro e l'altro fa un'ansa davanti o
//     dietro al lino. I primi punti sono ampi e lenti; poi le anse si stringono
//     e il ritmo accelera (time-lapse) fino alla fine del nome.
//  3. Il filo: un tratto pende dalla pianta al primo foro; un tratto libero va
//     dall'ultimo foro alla base dell'ago; ogni punto compare (e si stende sul
//     lino) quando la base dell'ago lo ha attraversato.
//  Tutto dipende solo dal tempo dell'apertura → si può riavvolgere e registrare.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import paths from '../data/thread-paths.json';
import { THREAD, INTRO } from '../config.js';
import { fabricWave } from './fabric.js';
import { createFiberMaterial, createStitchDepthMaterial, DynamicTube, Rope, writeTube, tubeIndex } from './fiber.js';
import { createNeedle, NEEDLE_LENGTH } from './needle.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// Misure dei punti (in em: scalano con la scritta). Punti quasi contigui, come
// il punto indietro usato per le scritte ricamate: la linea resta leggibile.
export const STITCH = {
  length: 0.1, // punto visibile
  gap: 0.014, // spazio minimo tra due punti (il filo passa dietro)
  min: 0.035, // punto più corto ammesso (curve strette)
  tolerance: 0.006, // scostamento massimo del punto dritto dalla curva della lettera
  retrace: 0.022, // un punto che cade a meno di così da uno già cucito è un "ripasso"
  cross: 0.05, // sotto questa distanza il punto passa SOPRA quello già cucito
};

// ── Polilinea 2D con lunghezze cumulate ──────────────────────────────────────
class Path2 {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.cum.at(-1);
  }
  index(s) {
    let lo = 0;
    let hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return Math.min(lo, this.pts.length - 2);
  }
  at(s) {
    s = THREE.MathUtils.clamp(s, 0, this.len);
    const i = this.index(s);
    const f = (s - this.cum[i]) / (this.cum[i + 1] - this.cum[i] || 1);
    return this.pts[i].clone().lerp(this.pts[i + 1], f);
  }
  tangent(s) {
    const e = Math.min(0.02, this.len * 0.25);
    return this.at(s + e).sub(this.at(s - e)).normalize();
  }
  deviation(s0, s1) {
    const a = this.at(s0);
    const b = this.at(s1);
    const ab = b.clone().sub(a);
    const L = ab.length() || 1e-9;
    let m = 0;
    for (let i = this.index(s0) + 1; i <= this.index(s1); i++) {
      const p = this.pts[i];
      m = Math.max(m, Math.abs(ab.x * (p.y - a.y) - ab.y * (p.x - a.x)) / L);
    }
    return m;
  }
}

// punti lungo un tratto di lettera
function stitchPath(path, em) {
  const Ls = STITCH.length * em;
  const Lg = STITCH.gap * em;
  const Lmin = STITCH.min * em;
  const tol = STITCH.tolerance * em;
  const out = [];
  let s = 0;
  while (path.len - s > Lmin * 0.7) {
    let e = Math.min(s + Ls, path.len);
    while (e - s > Lmin && path.deviation(s, e) > tol) e -= (e - s) * 0.15;
    // non lasciare un avanzo troppo corto alla fine del tratto
    if (path.len - e < Lmin + Lg * 0.6 && path.len - s <= Ls * 1.35) e = path.len;
    out.push({ s0: s, s1: e });
    s = e + Lg;
  }
  return out;
}

// Punti già cuciti, in una griglia: serve a riconoscere i ripassi (la "penna"
// tornerebbe sullo stesso tratto: la ricamatrice invece passa dietro) e gli
// incroci (il nuovo punto passa sopra quello vecchio)
class StitchGrid {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
  }
  key(x, y) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }
  add(a, b, id) {
    const n = Math.ceil(a.distanceTo(b) / (this.cell * 0.5)) + 1;
    const seen = new Set();
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      const k = this.key(p.x, p.y);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push({ a, b, id });
    }
  }
  // distanza minima dai punti cuciti, ignorando quelli con id ≥ skipFrom
  dist(p, skipFrom) {
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    let m = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = this.map.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const sg of list) {
          if (sg.id >= skipFrom) continue;
          const ab = sg.b.clone().sub(sg.a);
          const t = THREE.MathUtils.clamp(p.clone().sub(sg.a).dot(ab) / (ab.lengthSq() || 1e-9), 0, 1);
          m = Math.min(m, sg.a.clone().addScaledVector(ab, t).distanceTo(p));
        }
      }
    return m;
  }
}

// ── Campionamento di curve in 3D ─────────────────────────────────────────────
function bezierPts(p0, p1, p2, p3, n) {
  const c = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(c.getPoint(i / n));
  return out;
}

export class Embroidery {
  /**
   * @param quality       QUALITY da config
   * @param bandUniforms  uniform del lino (vento, poke, scala): oggetto persistente condiviso con i punti
   */
  constructor(quality, bandUniforms) {
    this.quality = quality;
    this.bandUniforms = bandUniforms;
    this.uniforms = {
      uIntroTime: { value: 0 },
      uTwist: { value: 1 },
      uBump: { value: 0.35 },
      uArchAmp: { value: 0.02 },
    };
    this.stitchMat = createFiberMaterial({ stitches: true, uniforms: this.allUniforms() });
    this.stitchDepth = createStitchDepthMaterial(this.allUniforms());
    const rake = { uRakeDirView: bandUniforms.uRakeDirView, uRakeColor: bandUniforms.uRakeColor };
    this.ropeMat = createFiberMaterial({ stitches: false, uniforms: { ...this.uniforms, ...rake } });

    this.needle = createNeedle(rake);
    this.leadRope = new Rope(48);
    this.leadTube = new DynamicTube(48, quality.threadRadial, this.ropeMat);
    this.freeRope = new Rope(18);
    this.freeTube = new DynamicTube(18, quality.threadRadial, this.ropeMat);
    this.world = new THREE.Group(); // ago e fili liberi (coordinate mondo)
    this.world.add(this.needle, this.leadTube.mesh, this.freeTube.mesh);
    this.local = new THREE.Group(); // punti ricamati (coordinate del lino)
  }

  allUniforms() {
    return { ...this.uniforms, ...this.bandUniforms };
  }

  /**
   * @param place       da layout.placeText
   * @param heartWorld  punta del cogollo (mondo): da qui parte il filo
   */
  build(place, heartWorld) {
    this.disposeStitches();
    const em = place.scale;
    const r = THREAD.radius * em;
    // la spina resta in proporzione con la scritta (su mobile la scritta è più piccola)
    const needleScale = THREE.MathUtils.clamp(em / 0.54, 0.55, 1.2);
    const Ln = NEEDLE_LENGTH * needleScale;
    this.needle.scale.setScalar(needleScale);
    this.Ln = Ln;
    this.place = place;
    this.em = em;
    this.r = r;
    this.origin = place.band.origin.clone();
    this.heart = heartWorld.clone();
    this.uniforms.uTwist.value = 1 / (r * 7);
    this.uniforms.uArchAmp.value = r * 3.2;

    // ── 1. tratti → punti ─────────────────────────────────────────────────────
    const L = paths.layouts[place.layout];
    const strokes = L.strokes.map((st) => {
      if (st.dot) return { dot: place.toLocal(st.dot[0], st.dot[1]) };
      const pts = [];
      for (let i = 0; i < st.p.length; i += 3) pts.push(place.toLocal(st.p[i], st.p[i + 1]));
      return { path: new Path2(pts) };
    });

    // il primo foro è un'uscita (U): l'ago arriva da DIETRO il lino, dove resta
    // la coda del filo che scende alla pianta (come nel ricamo vero)
    const events = []; // fori in ordine: { type: 'D'|'U'|'K', pos, dir, stitch }
    const stitches = []; // { a, b, lift }
    const grid = new StitchGrid(STITCH.cross * em);
    for (const st of strokes) {
      if (st.dot) {
        // nodo francese per il puntino della "i"
        const dir = new THREE.Vector2(1, 0);
        events.push({ type: 'U', pos: st.dot.clone(), dir });
        events.push({ type: 'K', pos: st.dot.clone(), dir });
        events.push({ type: 'D', pos: st.dot.clone().add(new THREE.Vector2(0.004, 0)), dir, knot: true });
        continue;
      }
      const path = st.path;
      for (const sp of stitchPath(path, em)) {
        const a = path.at(sp.s0);
        const b = path.at(sp.s1);
        // confronto con i punti già cuciti (esclusi gli ultimi due, che sono contigui)
        const skip = stitches.length - 2;
        const d = [0.15, 0.35, 0.5, 0.65, 0.85].map((f) => grid.dist(a.clone().lerp(b, f), skip));
        if (d.filter((x) => x < STITCH.retrace * em).length >= 4) continue; // ripasso: il filo passa dietro
        const crossing = Math.min(...d) < STITCH.cross * em;
        const dir = b.clone().sub(a).normalize();
        events.push({ type: 'U', pos: a, dir });
        const k = stitches.length;
        stitches.push({ a, b, lift: crossing ? r * 1.7 : 0 });
        grid.add(a, b, k);
        events.push({ type: 'D', pos: b, dir, stitch: k });
      }
    }
    this.events = events;
    this.stitches = stitches;

    // ── 2. traiettoria della punta dell'ago ──────────────────────────────────
    const tip = []; // { p (locale, z = distanza dal lino), w (peso vento), lam }
    const heartL = this.heart.clone().sub(this.origin);
    const up = V3(0, 1, 0);
    const tipStart = heartL.clone().addScaledVector(up, Ln);
    tip.push({ p: tipStart, w: 0, lam: 0 });

    const lamOf = (k) => smooth(4.5, 11, k); // 0 = punti lenti e ampi, 1 = time-lapse
    // direzione con cui l'ago attraversa il foro: inclinata in avanti lungo la
    // lettera e (nei punti lenti) un po' verso l'alto in uscita / dall'alto in
    // entrata, così la spina si vede di lato e non di punta
    const passDir = (ev, lam) => {
      const th = THREE.MathUtils.degToRad(lerp(58, 74, lam));
      const sg = ev.type === 'D' ? -1 : 1;
      const lat = new THREE.Vector2(ev.dir.x, ev.dir.y + sg * 0.8 * (1 - lam)).normalize();
      return V3(lat.x * Math.sin(th), lat.y * Math.sin(th), sg * Math.cos(th));
    };
    const pushSeg = (pts, w, lam) => pts.forEach((p) => tip.push({ p, w, lam }));
    const straight = (a, b, step) => {
      const n = Math.max(2, Math.ceil(a.distanceTo(b) / step));
      const out = [];
      for (let i = 1; i <= n; i++) out.push(a.clone().lerp(b, i / n));
      return out;
    };

    // volo: la spina sale dritta (tira fuori la fibra), poi passa dietro il lino
    // e risale fino al primo foro, che buca dal retro
    const ev0 = events[0];
    const d0 = passDir(ev0, 0);
    const H0 = V3(ev0.pos.x, ev0.pos.y, 0);
    const A0 = H0.clone().addScaledVector(d0, -0.07);
    const lift = tipStart.clone().addScaledVector(up, 0.16);
    pushSeg(straight(tipStart, lift, 0.01), 0, 0);
    const flight = bezierPts(lift, lift.clone().add(V3(0, 0.75, 0.05)), A0.clone().addScaledVector(d0, -0.6), A0, 90);
    flight.forEach((p, i) => tip.push({ p, w: smooth(0.6, 1, (i + 1) / flight.length), lam: 0 }));
    this.flightEnd = tip.length - 1;

    // fori: passaggio dritto + ansa verso il foro successivo
    const holeIndex = []; // indice in tip[] del punto esattamente nel foro
    let prevX = null;
    let prevD = null;
    events.forEach((ev, k) => {
      const lam = lamOf(k);
      const H = V3(ev.pos.x, ev.pos.y, 0);
      if (ev.type === 'K') {
        // piccolo nodo: due giri stretti davanti al tessuto
        const rk = 0.024 * em;
        const loop = [];
        for (let i = 1; i <= 28; i++) {
          const a = (i / 28) * Math.PI * 2 * 2 + Math.PI;
          loop.push(H.clone().add(V3(Math.cos(a) * rk, Math.sin(a) * rk, 0.02 + 0.01 * Math.sin((i / 28) * Math.PI))));
        }
        pushSeg(bezierPts(prevX, prevX.clone().addScaledVector(prevD, 0.03), loop[0].clone().add(V3(0, 0, 0.03)), loop[0], 6), 1, lam);
        pushSeg(loop, 1, lam);
        prevX = loop.at(-1);
        prevD = V3(0, 0, 1);
        holeIndex.push(tip.length - 1);
        return;
      }
      const d = passDir(ev, lam);
      const a = lerp(0.06, 0.012, lam);
      const p = lerp(Ln + 0.05, 0.035, lam);
      const A = H.clone().addScaledVector(d, -a);
      const X = H.clone().addScaledVector(d, p);
      if (prevX) {
        const dist = prevX.distanceTo(A);
        const c = Math.max(0.32 * dist, lerp(0.14, 0.012, lam));
        const n = THREE.MathUtils.clamp(Math.ceil(dist / 0.012), 4, 60);
        pushSeg(bezierPts(prevX, prevX.clone().addScaledVector(prevD, c), A.clone().addScaledVector(d, -c), A, n), 1, lam);
      }
      pushSeg(straight(tip.at(-1).p, H, 0.01), 1, lam);
      holeIndex.push(tip.length - 1);
      pushSeg(straight(H, X, lerp(0.01, 0.02, lam)), 1, lam);
      prevX = X;
      prevD = d;
    });
    // uscita finale: l'ago resta dietro il lino e sparisce
    pushSeg(straight(prevX, prevX.clone().addScaledVector(prevD, 0.5), 0.03), 1, 1);

    // lunghezze d'arco
    const sArr = new Float32Array(tip.length);
    for (let i = 1; i < tip.length; i++) sArr[i] = sArr[i - 1] + tip[i].p.distanceTo(tip[i - 1].p);
    this.tip = tip;
    this.sArr = sArr;
    this.sHole = holeIndex.map((i) => sArr[i]);
    this.sEnd = sArr[sArr.length - 1];

    // ── 3. tempi ─────────────────────────────────────────────────────────────
    // volo: rallenta all'inizio (la spina si stacca) e all'arrivo
    // cucitura: velocità che cresce col "time-lapse" (lam), riscalata alla finestra
    const tArr = new Float32Array(tip.length);
    const fEnd = this.flightEnd;
    const sF = sArr[fEnd];
    for (let i = 0; i <= fEnd; i++) {
      const u = sArr[i] / sF;
      // inversa di una smoothstep (s = 3τ² − 2τ³) risolta numericamente
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 30; it++) {
        const m = (lo + hi) / 2;
        if (m * m * (3 - 2 * m) < u) lo = m;
        else hi = m;
      }
      tArr[i] = lerp(INTRO.needleLift, INTRO.needleArrive, (lo + hi) / 2);
    }
    let raw = 0;
    const rawArr = new Float32Array(tip.length);
    for (let i = fEnd + 1; i < tip.length; i++) {
      // dietro il lino l'ago non si vede: lì va più veloce, così il tempo resta ai tratti visibili
      const behind = tip[i].p.z < -0.01 ? 2.4 : 1;
      const v = lerp(1, 7.5, tip[i].lam) * behind;
      raw += (sArr[i] - sArr[i - 1]) / v;
      rawArr[i] = raw;
    }
    for (let i = fEnd + 1; i < tip.length; i++) tArr[i] = lerp(INTRO.needleArrive, INTRO.stitchEnd, rawArr[i] / raw);
    this.tArr = tArr;

    // ── 4. geometria dei punti (tutti in un'unica mesh) ──────────────────────
    const R = this.quality.stitchRadial;
    const pos = [];
    const nor = [];
    const uvs = [];
    const reveal = [];
    const arch = [];
    const index = [];
    let vOff = 0;
    const revealAt = (eventIdx) => this.timeAtS(this.sHole[eventIdx] + Ln);
    const addTube = (pts, radiusAt, tReveal, archW) => {
      const n = pts.length;
      const P = new Float32Array(n * (R + 1) * 3);
      const N = new Float32Array(n * (R + 1) * 3);
      const U = new Float32Array(n * (R + 1) * 2);
      writeTube(pts, n, radiusAt, R, P, N, U, 0, 0, V3(0, 0, 1));
      pos.push(...P);
      nor.push(...N);
      uvs.push(...U);
      for (let i = 0; i < n; i++) for (let j = 0; j <= R; j++) {
        reveal.push(tReveal);
        arch.push(archW(i / (n - 1)));
      }
      tubeIndex(n, R, vOff, index);
      vOff += n * (R + 1);
    };
    events.forEach((ev, k) => {
      if (ev.stitch === undefined) return;
      const st = stitches[ev.stitch];
      const zTop = r + st.lift;
      const ctrl = [
        [0, -0.7 * r],
        [0.06, 0.75 * r],
        [0.2, zTop],
        [0.5, zTop + 0.12 * r],
        [0.8, zTop],
        [0.94, 0.75 * r],
        [1, -0.7 * r],
      ].map(([t, z]) => V3(lerp(st.a.x, st.b.x, t), lerp(st.a.y, st.b.y, t), z));
      const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
      const pts = curve.getPoints(10);
      addTube(pts, () => r, revealAt(k), (t) => Math.sin(Math.PI * t) * smooth(0.04, 0.12, t) * (1 - smooth(0.88, 0.96, t)));
    });
    // nodo francese: una piccola spirale in rilievo
    events.forEach((ev, k) => {
      if (!ev.knot) return;
      const c = ev.pos;
      const rk = 0.02 * em;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const a = u * Math.PI * 2 * 3;
        const rr = rk * (1 - 0.45 * u);
        pts.push(V3(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, r * (0.6 + 1.4 * Math.sin(Math.PI * u))));
      }
      addTube(pts, () => r * 0.85, revealAt(k), () => 0);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aReveal', new THREE.Float32BufferAttribute(reveal, 1));
    g.setAttribute('aArch', new THREE.Float32BufferAttribute(arch, 1));
    g.setIndex(index);
    this.stitchMesh = new THREE.Mesh(g, this.stitchMat);
    this.stitchMesh.customDepthMaterial = this.stitchDepth;
    this.stitchMesh.castShadow = true;
    this.stitchMesh.receiveShadow = true;
    this.stitchMesh.frustumCulled = false;
    this.local.add(this.stitchMesh);

    this.leadRope.ready = false;
    this.freeRope.ready = false;
    this.freeAnchor = -1;
  }

  // ── Interrogazioni sulla traiettoria ───────────────────────────────────────
  timeAtS(s) {
    const S = this.sArr;
    let lo = 0;
    let hi = S.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (S[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    if (lo >= S.length - 1) return this.tArr[S.length - 1];
    const f = (s - S[lo]) / (S[lo + 1] - S[lo] || 1);
    return lerp(this.tArr[lo], this.tArr[lo + 1], f);
  }

  sAtTime(t) {
    const T = this.tArr;
    if (t <= T[0]) return 0;
    if (t >= T[T.length - 1]) return this.sEnd;
    let lo = 0;
    let hi = T.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (T[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    const f = (t - T[lo]) / (T[lo + 1] - T[lo] || 1);
    return lerp(this.sArr[lo], this.sArr[lo + 1], f);
  }

  sampleAt(s, out) {
    const S = this.sArr;
    s = THREE.MathUtils.clamp(s, 0, this.sEnd);
    let lo = 0;
    let hi = S.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (S[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    const i = Math.min(lo, S.length - 2);
    const f = (s - S[i]) / (S[i + 1] - S[i] || 1);
    out.p.lerpVectors(this.tip[i].p, this.tip[i + 1].p, f);
    out.w = lerp(this.tip[i].w, this.tip[i + 1].w, f);
    out.lam = lerp(this.tip[i].lam, this.tip[i + 1].lam, f);
    return out;
  }

  lastHoleBefore(s) {
    const H = this.sHole;
    if (!H.length || s < H[0]) return -1;
    let lo = 0;
    let hi = H.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (H[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // locale (+ vento) → mondo
  toWorld(p, w, windT, out) {
    const z = w ? fabricWave(p.x / this.em, p.y / this.em, windT) * this.em * w : 0;
    return out.set(p.x + this.origin.x, p.y + this.origin.y, p.z + z + this.origin.z);
  }

  // primo foro (mondo, senza vento): serve alla camera per il primo piano
  firstHoleWorld() {
    const ev = this.events[0];
    return V3(ev.pos.x + this.origin.x, ev.pos.y + this.origin.y, this.origin.z);
  }

  // foro k nel mondo: passa dal gruppo del lino, così segue la fascia anche
  // quando vola via al primo scroll
  holeWorld(k, windT, zOff, out) {
    const ev = this.events[k];
    const z = fabricWave(ev.pos.x / this.em, ev.pos.y / this.em, windT) * this.em;
    this.local.updateWorldMatrix(true, false);
    return this.local.localToWorld(out.set(ev.pos.x, ev.pos.y, z + zOff));
  }

  /**
   * @param t      tempo dell'apertura (s)
   * @param dt     passo per la simulazione dei fili
   * @param windT  tempo del vento (uguale a quello del lino)
   */
  update(t, dt, windT) {
    if (!this.tip) return;
    this.uniforms.uIntroTime.value = t;
    const Ln = this.Ln;
    const r = this.r;

    // posa dell'ago
    const s = t < INTRO.needleLift ? 0 : this.sAtTime(t);
    const a = this.sampleAt(s, { p: V3(), w: 0, lam: 0 });
    const delta = lerp(0.008, 0.09, a.lam);
    const pA = this.sampleAt(s - delta, { p: V3(), w: 0, lam: 0 }).p;
    const pB = this.sampleAt(s + delta, { p: V3(), w: 0, lam: 0 }).p;
    const dir = s < 1e-4 ? V3(0, 1, 0) : pB.sub(pA).normalize();
    const tipW = this.toWorld(a.p, a.w, windT, V3());
    const eyeW = tipW.clone().addScaledVector(dir, -Ln);
    this.needle.position.copy(eyeW);
    this.needle.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
    const eyeS = s - Ln;
    this.needle.visible = eyeS < this.sHole.at(-1) + 0.08;

    // il lino si avvalla dove l'ago sta attraversando un foro
    const poke = this.bandUniforms.uPoke.value;
    poke.z = 0;
    const kTip = this.lastHoleBefore(s);
    if (kTip >= 0 && this.sHole[kTip] > eyeS) {
      const ev = this.events[kTip];
      if (ev.type !== 'K') {
        const lam = this.sampleAt(this.sHole[kTip], { p: V3(), w: 0, lam: 0 }).lam;
        const u = THREE.MathUtils.clamp((s - this.sHole[kTip]) / Ln, 0, 1);
        poke.set(ev.pos.x, ev.pos.y, (ev.type === 'D' ? -1 : 1) * lerp(0.016, 0.003, lam) * Math.sin(Math.PI * u), lerp(0.07, 0.03, lam));
      }
    }

    // fili liberi
    const step = dt > 0 ? dt : 1 / 60;
    const wind = V3(Math.sin(windT * 0.7) * 0.5, 0, Math.cos(windT * 0.45) * 0.35);
    const kEye = this.lastHoleBefore(eyeS);
    const radius = () => r;

    // filo dalla pianta: fino al primo foro segue la base dell'ago, poi resta fissato.
    // A ricamo finito il capo libero viene tirato dietro il lino e sparisce
    // (niente filo che penzola sotto il titolo, né quando il lino vola via)
    const doneT = this.timeAtS(this.sHole.at(-1) + 0.08 + Ln);
    const reel = THREE.MathUtils.smoothstep(t, doneT + 0.05, doneT + 0.85);
    if (t >= INTRO.needleLift && reel < 1) {
      const B = kEye < 0 ? eyeW : this.holeWorld(0, windT, -0.3 * r, V3());
      const A = this.heart.clone().lerp(B, reel * reel);
      const attachT = this.timeAtS(this.sHole[0] + Ln);
      const slack = 1.008 + 0.062 * THREE.MathUtils.smoothstep(t, attachT, attachT + 0.6) * (1 - reel);
      const pts = this.leadRope.step(A, B, A.distanceTo(B) * slack + 0.002, step, wind);
      this.leadTube.update(pts, radius);
    } else {
      this.leadTube.mesh.visible = false;
      this.leadRope.ready = false;
    }

    // tratto libero: dall'ultimo foro "in uscita" (U) alla base dell'ago
    const evE = kEye >= 0 ? this.events[kEye] : null;
    if (evE && evE.type !== 'D' && this.needle.visible) {
      if (this.freeAnchor !== kEye) {
        this.freeRope.ready = false;
        this.freeAnchor = kEye;
      }
      const A = this.holeWorld(kEye, windT, 0.25 * r, V3());
      const pts = this.freeRope.step(A, eyeW, A.distanceTo(eyeW) * 1.06 + 0.004, step, wind);
      this.freeTube.update(pts, radius);
    } else {
      this.freeTube.mesh.visible = false;
      this.freeAnchor = -1;
    }
  }

  disposeStitches() {
    if (this.stitchMesh) {
      this.local.remove(this.stitchMesh);
      this.stitchMesh.geometry.dispose();
      this.stitchMesh = null;
    }
  }
}
