// El recorrido: tramos CatmullRom entre paradas, ligados al scroll con suavizado y pausas.
import * as THREE from 'three';

export const STOPS = [
  { id: 'paseo', pos: [0, 1.72, 24.0], look: [0, 3.0, 0] },
  { id: 'porton', pos: [0, 2.27, 2.45], look: [0, 3.7, -8] },
  { id: 'patio', pos: [0.15, 2.73, -14.3], look: [-1.25, 10.5, -24.3] },
  { id: 'boutiques', pos: [-2.6, 2.85, -11.8], look: [-12.6, 3.1, -12.2] },
  { id: 'aperitivo', pos: [-10.95, 2.85, -13.9], look: [-10.6, 2.55, -27] },
  { id: 'eventos', pos: [-7.6, 4.3, -16.4], look: [4.4, 1.5, -21.4] },
  { id: 'salida', pos: [0, 2.85, -12.1], look: [0, 2.75, 10] },
];

// puntos intermedios de cada tramo (pasos sobre la banqueta, escalinata, zaguán…)
const VIA = [
  [[0, 1.74, 19.6], [0, 1.78, 14.6], [0, 1.82, 10.2], [0, 1.86, 6.4], [0, 1.95, 3.6]],
  [[0, 2.62, 1.6], [0, 2.85, 0.2], [0, 2.85, -3.2], [0, 2.85, -6.4], [0, 2.84, -10.3]],
  [[-1.1, 2.8, -13.05]],
  [[-5.5, 2.85, -11.7], [-9.4, 2.85, -11.75], [-10.85, 2.85, -12.5]],
  [[-9.6, 3.1, -15.0], [-8.6, 3.8, -15.7]],
  [[-4.2, 3.4, -15.2], [-1.4, 2.8, -13.6]],
];

const V = (a) => new THREE.Vector3(...a);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const DRIFT = 0.025; // pequeño avance mientras se lee una parada: la cámara nunca se congela

export class Recorrido {
  constructor() {
    this.stops = STOPS.map((s) => ({ ...s, p: V(s.pos), l: V(s.look) }));
    this.curves = [];
    for (let i = 0; i < this.stops.length - 1; i++) {
      const pts = [this.stops[i].p, ...VIA[i].map(V), this.stops[i + 1].p];
      this.curves.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5));
    }
    this.n = this.stops.length;
    this.items = [];      // secciones del DOM en orden: parada, tramo, parada…
    this.T = 0;           // línea de tiempo suavizada (parada i = [2i, 2i+1), tramo i = [2i+1, 2i+2))
    this.Ttarget = 0;
    this.reduced = false;
    this._dir = new THREE.Vector3(0, 0, -1);
    this._tmp = new THREE.Vector3();
  }

  bind(elements) {
    this.items = elements;
    this.measure();
  }

  measure() {
    const sy = window.scrollY;
    this.metrics = this.items.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + sy, h: Math.max(1, r.height) };
    });
  }

  timelineFromScroll(scrollY, vh) {
    const c = scrollY + vh * 0.5;
    const m = this.metrics;
    if (!m || !m.length) return 0;
    if (c <= m[0].top) return 0;
    for (let k = 0; k < m.length; k++) {
      if (c < m[k].top + m[k].h) return k + (c - m[k].top) / m[k].h;
    }
    return m.length - 1e-4;
  }

  // Desplazamiento (scroll) que deja la parada i en pantalla con su tarjeta visible.
  scrollForStop(i, vh) {
    const k = i * 2;
    const m = this.metrics[k];
    if (!m) return 0;
    if (i === 0) return 0;
    return Math.max(0, m.top + Math.min(m.h, vh * 1.05) - vh);
  }

  // Parámetro global G: parada i = i exacto, tramo i = (i, i+1).
  G(T) {
    const k = Math.floor(T);
    const f = T - k;
    const i = Math.floor(k / 2);
    if (i >= this.n - 1 && k % 2 === 0) return this.n - 1;
    if (k % 2 === 0) return i + DRIFT * f;
    if (this.reduced) return f < 0.5 ? i : i + 1;
    return i + DRIFT + (1 - DRIFT) * easeInOut(f);
  }

  // Estados animados ligados a la línea de tiempo.
  state(T) {
    if (this.reduced) {
      return { gate: T >= 1.5 ? 1 : 0, doors: T >= 2.0 ? 1 : 0, event: T >= 9.5 ? 1 : 0 };
    }
    return {
      gate: smooth(1.22, 1.5, T),
      doors: smooth(2.12, 2.7, T),
      event: smooth(9.35, 10.4, T),
    };
  }

  stopIndex(T) {
    const k = Math.floor(T);
    const i = Math.floor(k / 2);
    if (k % 2 === 0) return Math.min(this.n - 1, i);
    return T - k < 0.5 ? i : Math.min(this.n - 1, i + 1);
  }

  pose(G, outPos, outDir) {
    const n = this.n;
    let s = Math.min(n - 2, Math.max(0, Math.floor(G)));
    let f = G - s;
    if (G >= n - 1) { s = n - 2; f = 1; }
    const curve = this.curves[s];
    const A = this.stops[s], B = this.stops[s + 1];
    curve.getPointAt(f, outPos);
    const dA = this._tmp.copy(A.l).sub(A.p).normalize();
    const dA2 = dA.clone();
    const dB = B.l.clone().sub(B.p).normalize();
    const p0 = curve.getPointAt(Math.max(0, f - 0.02));
    const p1 = curve.getPointAt(Math.min(1, f + 0.16));
    const dM = p1.sub(p0);
    if (dM.lengthSq() < 1e-6) dM.copy(dB);
    dM.normalize();
    dM.y *= 0.45; dM.normalize();
    const ws = 1 - smooth(0, 0.42, f);
    const we = smooth(0.55, 1.0, f);
    const wm = Math.max(0, 1 - ws - we);
    outDir.set(0, 0, 0).addScaledVector(dA2, ws).addScaledVector(dM, wm).addScaledVector(dB, we).normalize();
    return { s, f };
  }
}
