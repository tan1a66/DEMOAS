// El recorrido: tramos CatmullRom entre paradas, ligados al scroll con suavizado.
// En cada parada la cámara no se congela: avanza despacio de "pos" a "pos2" y gira la
// mirada de "look" a "look2" mientras se lee; el tramo siguiente arranca desde ahí.
import * as THREE from 'three';
import { L } from './scene/layout.js';

// Paseo de Montejo: en escritorio desde la calle (fachada completa entre almendros);
// en el teléfono desde el andador del jardín (sin banqueta ni asfalto en el cuadro).
const HERO = {
  desk: { pos: [0, 1.72, 27.5], pos2: [0, 1.74, 26.2], look: [0, 3.0, 0], look2: [0, 2.9, 0] },
  cine: { pos: [-2.3, 1.88, 10.15], pos2: [-1.95, 1.88, 9.5], look: [0.9, 4.25, 0], look2: [0.75, 4.1, 0] },
};
const HERO_VIA = {
  desk: [[0, 1.74, 22.6], [0, 1.78, 17.8], [0, 1.82, 13.4], [0, 1.86, 9.4], [0, 1.9, 6.0], [0, 1.94, 4.0]],
  cine: [[-1.0, 1.9, 7.3], [-0.15, 1.92, 5.0], [0, 1.95, 3.7]],
};

export const STOPS = [
  { id: 'paseo' },
  { id: 'porton', pos: [0, 2.08, 2.85], pos2: [0, 2.2, 2.3], look: [0, 3.75, -8], look2: [0, 3.5, -8] },
  { id: 'patio', pos: [0.15, 2.73, -14.3], pos2: [0.1, 2.73, -13.95], look: [-1.25, 10.5, -24.3], look2: [-0.5, 9.2, -24.3] },
  { id: 'boutiques', pos: [-2.6, 2.85, -11.8], pos2: [-3.6, 2.85, -11.8], look: [-12.6, 3.1, -12.2], look2: [-13.6, 3.1, -12.35] },
  { id: 'aperitivo', pos: [-10.95, 2.85, -13.9], pos2: [-10.95, 2.85, -14.75], look: [-10.6, 2.55, -27], look2: [-10.45, 2.55, -27.5] },
  { id: 'eventos', pos: [-7.6, 4.3, -16.4], pos2: [-7.2, 4.42, -16.85], look: [4.4, 1.5, -21.4], look2: [4.7, 1.4, -21.9] },
  { id: 'salida', pos: [0, 2.85, -12.1], pos2: [0, 2.85, -11.1], look: [0, 2.75, 10], look2: [0, 2.75, 10] },
];

const VIA = [
  null,
  [[0, 2.62, 1.6], [0, 2.85, 0.2], [0, 2.85, -3.2], [0, 2.85, -6.4], [0, 2.84, -10.3]],
  [[-1.1, 2.8, -13.05]],
  [[-5.5, 2.85, -11.7], [-9.4, 2.85, -11.75], [-10.85, 2.85, -12.5]],
  [[-9.6, 3.1, -15.0], [-8.6, 3.8, -15.7]],
  [[-4.2, 3.4, -15.2], [-1.4, 2.8, -13.6]],
];

const V = (a) => new THREE.Vector3(...a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeInv = (u) => Math.acos(1 - 2 * clamp01(u)) / Math.PI;

export class Recorrido {
  constructor(mode = 'desk') {
    this.mode = mode;
    this.reduced = false;
    this.anchor = mode === 'cine' ? 0 : 0.5; // qué línea de la pantalla marca el avance
    const hero = HERO[mode];
    this.stops = STOPS.map((s, i) => {
      const d = i === 0 ? { ...s, ...hero } : s;
      const p = V(d.pos), p2 = V(d.pos2 || d.pos);
      const dIn = V(d.look).sub(p).normalize();
      const dOut = V(d.look2 || d.look).sub(p2).normalize();
      return { id: s.id, p, p2, dIn, dOut };
    });
    this.curves = [];
    for (let i = 0; i < this.stops.length - 1; i++) {
      const via = i === 0 ? HERO_VIA[mode] : VIA[i];
      const pts = [this.stops[i].p2, ...via.map(V), this.stops[i + 1].p];
      this.curves.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5));
    }
    this.n = this.stops.length;
    // La reja se abre cuando la cámara se acerca (en el teléfono ya se abrió en la intro).
    this.gateRange = mode === 'cine' ? null : [this._Tat(0, L.fence + 4.5), this._Tat(0, L.fence + 1.4)];
    this.items = [];
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  // Línea de tiempo T en la que la cámara del tramo `seg` cruza la profundidad z.
  _Tat(seg, z) {
    const c = this.curves[seg];
    let u = 0;
    for (let k = 0; k <= 400; k++) { if (c.getPointAt(k / 400).z <= z) { u = k / 400; break; } }
    return 2 * seg + 1 + easeInv(u);
  }

  bind(elements) { this.items = elements; this.measure(); }

  measure() {
    const sy = window.scrollY;
    this.metrics = this.items.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + sy, h: Math.max(1, r.height) };
    });
  }

  timelineFromScroll(scrollY, vh) {
    const c = scrollY + vh * this.anchor;
    const m = this.metrics;
    if (!m || !m.length || c <= m[0].top) return 0;
    for (let k = 0; k < m.length; k++) if (c < m[k].top + m[k].h) return k + (c - m[k].top) / m[k].h;
    return m.length - 1e-4;
  }

  // Scroll que deja la parada i en pantalla (con su texto visible).
  scrollForStop(i, vh) {
    const m = this.metrics[i * 2];
    if (!m || i === 0) return 0;
    if (this.mode === 'cine') return i === this.n - 1 ? Math.max(0, m.top - vh * 0.04) : Math.max(0, m.top + m.h * 0.3);
    return Math.max(0, m.top + Math.min(m.h, vh * 1.05) - vh);
  }

  stopIndex(T) {
    const k = Math.floor(T), i = Math.floor(k / 2);
    if (k % 2 === 0) return Math.min(this.n - 1, i);
    return T - k < 0.5 ? i : Math.min(this.n - 1, i + 1);
  }

  state(T) {
    const g = this.gateRange;
    if (this.reduced) {
      return { gate: !g || T >= g[0] ? 1 : 0, doors: T >= 2.0 ? 1 : 0, event: T >= 9.5 ? 1 : 0 };
    }
    return {
      gate: g ? smooth(g[0], g[1], T) : 1,
      doors: smooth(2.0, 2.6, T),
      event: smooth(9.35, 10.4, T),
    };
  }

  // Posición y dirección de la cámara para la línea de tiempo T.
  pose(T, outPos, outDir) {
    const n = this.n;
    const k = Math.max(0, Math.floor(T));
    const f = T - k;
    const i = Math.min(n - 1, Math.floor(k / 2));
    if (k % 2 === 0 || i >= n - 1) {
      // parada: avance lento mientras se lee
      const S = this.stops[i];
      const q = this.reduced ? 0 : (i >= n - 1 && k > 2 * (n - 1) ? 1 : clamp01(f));
      outPos.copy(S.p).lerp(S.p2, q);
      outDir.copy(S.dIn).lerp(S.dOut, q).normalize();
      return;
    }
    // tramo entre la parada i y la i+1
    if (this.reduced) {
      const S = this.stops[f < 0.5 ? i : i + 1];
      outPos.copy(f < 0.5 ? S.p2 : S.p);
      outDir.copy(f < 0.5 ? S.dOut : S.dIn);
      return;
    }
    const A = this.stops[i], B = this.stops[i + 1];
    const curve = this.curves[i];
    const u = easeInOut(f);
    curve.getPointAt(u, outPos);
    const p0 = curve.getPointAt(Math.max(0, u - 0.02), this._a);
    const p1 = curve.getPointAt(Math.min(1, u + 0.16), this._b);
    const dM = p1.sub(p0);
    if (dM.lengthSq() < 1e-6) dM.copy(B.dIn);
    dM.normalize(); dM.y *= 0.45; dM.normalize();
    const ws = 1 - smooth(0, 0.42, u);
    const we = smooth(0.55, 1.0, u);
    const wm = Math.max(0, 1 - ws - we);
    outDir.set(0, 0, 0).addScaledVector(A.dOut, ws).addScaledVector(dM, wm).addScaledVector(B.dIn, we).normalize();
  }
}
