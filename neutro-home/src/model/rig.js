// Estado dinámico de la trenza colgada: profundidad de las ondas (muelles), balanceo de
// colas y borlas (péndulos amortiguados) y la caída inicial sobre los ganchos.
// Todo es estable por construcción: no hay simulación de cuerda, sólo pocos muelles.

import { HangingModel } from './hanging.js';
import { Spring, clamp, rubber } from './spring.js';
import { BRAID, PEGS, WAVES, WRAP_RADIUS } from '../config.js';

const SUBSTEP = 1 / 240;
const INWARD_LIMIT = 0.07; // las colas no pueden meterse bajo las ondas

function tailSprings() {
  return {
    root: new Spring(0, 3.7, 0.16),
    tip: new Spring(0, 6.2, 0.26),
    tassel: new Spring(0, 7.5, 0.22),
  };
}

export class Rig {
  constructor() {
    const d = PEGS.spacing;
    this.model = new HangingModel({ pegX: [-d, 0, d], pegY: PEGS.y, rho: WRAP_RADIUS, length: BRAID.length });
    const N = BRAID.samples;
    this.center = { px: new Float32Array(N), py: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N) };
    this.depth = [new Spring(WAVES.depthDefault, 9, 0.42), new Spring(WAVES.depthDefault, 9, 0.42)];
    this.tails = { L: tailSprings(), R: tailSprings() };
    this.drop = null; // { y, vy, contact }
    this.dragging = -1;
    this.prevTail = null;
    this.active = true;
    this._acc = 0;
    this.info = null;
    this.state = { len1: 0, len2: 0, tailL: { root: 0, tip: 0 }, tailR: { root: 0, tip: 0 }, offsetY: 0 };
  }

  setRest() {
    this.depth.forEach((s) => s.set(WAVES.depthDefault));
    for (const t of Object.values(this.tails)) Object.values(t).forEach((s) => s.set(0));
    this.drop = null;
    this.active = true;
  }

  // Caída inicial: la trenza entra desde arriba, casi horizontal, y se engancha.
  startDrop(height = 1.5) {
    this.depth.forEach((s) => s.set(0.045));
    for (const t of Object.values(this.tails)) Object.values(t).forEach((s) => s.set(1.28));
    this.drop = { y: height, vy: -0.4 };
    this.active = true;
  }

  get settled() {
    return !this.drop && this.dragging < 0 && !this.active;
  }

  // ---------------------------------------------------------------- límites
  maxDepth(i) {
    const m = this.model;
    const other = m.lengthForDepth(this.depth[1 - i].x);
    const mine = m.lengthForDepth(this.depth[i].x);
    const wrap = m.wrapLength(mine, other);
    const maxLen = BRAID.length - wrap - 2 * WAVES.tailMin - other;
    return Math.min(WAVES.depthMax, m.depthForLength(maxLen));
  }

  // Profundidad deseada por el dedo → profundidad con resistencia elástica en los límites.
  softDepth(i, raw) {
    const hi = this.maxDepth(i);
    const lo = WAVES.depthMin;
    if (raw > hi) return hi + rubber(raw - hi, WAVES.overshoot);
    if (raw < lo) return lo - rubber(lo - raw, WAVES.overshoot * 0.5);
    return raw;
  }

  grab(i) {
    this.dragging = i;
    const s = this.depth[i];
    s.omega = 24;
    s.zeta = 1;
    this.active = true;
  }

  dragTo(i, rawDepth) {
    this.depth[i].target = this.softDepth(i, rawDepth);
    this.active = true;
  }

  release() {
    const i = this.dragging;
    if (i < 0) return;
    this.dragging = -1;
    const s = this.depth[i];
    s.target = clamp(s.target, WAVES.depthMin, this.maxDepth(i));
    s.omega = 8.5;
    s.zeta = 0.38;
    s.v += 0.22; // el peso se asienta: pequeño rebote
    for (const side of ['L', 'R']) {
      this.tails[side].root.v += 0.28;
      this.tails[side].tassel.v += 0.55;
    }
    this.active = true;
  }

  // Pequeña demostración (una sola vez) para invitar a tocar.
  nudge(i) {
    this.depth[i].v += 0.32;
    this.tails.L.tassel.v += 0.25;
    this.tails.R.tassel.v -= 0.25;
    this.active = true;
  }

  // ---------------------------------------------------------------- integración
  step(dt) {
    if (!this.active && !this.drop && this.dragging < 0) return false;
    this._acc += Math.min(dt, 1 / 20);
    while (this._acc >= SUBSTEP) {
      this._acc -= SUBSTEP;
      this._substep(SUBSTEP);
    }
    this._build();

    // ¿Todo en reposo?
    let moving = !!this.drop || this.dragging >= 0;
    for (const s of this.depth) if (!s.resting) moving = true;
    for (const t of Object.values(this.tails)) for (const s of Object.values(t)) if (!s.resting) moving = true;
    this.active = moving;
    return true;
  }

  _substep(h) {
    if (this.drop) {
      const d = this.drop;
      d.vy -= 6.5 * h;
      d.y += d.vy * h;
      if (d.y <= 0) {
        // contacto con los ganchos: las ondas se descuelgan, las colas caen
        const impact = Math.min(1.4, -d.vy);
        this.drop = null;
        this.depth.forEach((s) => {
          s.target = WAVES.depthDefault;
          s.omega = 7.5;
          s.zeta = 0.34;
          s.v = impact * 0.55;
        });
        for (const t of Object.values(this.tails)) {
          t.root.zeta = 0.2;
          t.tip.v = -0.3;
        }
      } else {
        return;
      }
    }

    for (const s of this.depth) s.step(h);

    for (const side of ['L', 'R']) {
      const t = this.tails[side];
      t.root.target = 0;
      t.tip.target = t.root.x;
      t.tassel.target = t.tip.x;
      for (const s of [t.root, t.tip, t.tassel]) {
        s.step(h);
        // tope blando hacia dentro (la cola choca con la onda y rebota)
        if (s.x < -INWARD_LIMIT) {
          const pen = -INWARD_LIMIT - s.x;
          s.v += (420 * pen - 10 * Math.min(0, s.v)) * h;
        }
      }
      // la amortiguación vuelve poco a poco a su valor normal tras la caída
      t.root.zeta += (0.16 - t.root.zeta) * h * 0.6;
    }
  }

  _build() {
    const m = this.model;
    const st = this.state;
    st.len1 = m.lengthForDepth(this.depth[0].x);
    st.len2 = m.lengthForDepth(this.depth[1].x);
    st.tailL.root = this.tails.L.root.x;
    st.tailL.tip = this.tails.L.tip.x;
    st.tailR.root = this.tails.R.root.x;
    st.tailR.tip = this.tails.R.tip.x;
    st.offsetY = this.drop ? this.drop.y : 0;
    this.info = m.build(st, this.center);

    // Cambios rápidos de longitud de las colas → un poco de balanceo.
    const tail = this.info.tail;
    if (this.prevTail !== null && !this.drop) {
      const dl = tail - this.prevTail;
      const k = clamp(-dl * 14, -0.06, 0.06);
      this.tails.L.tassel.v += k;
      this.tails.R.tassel.v += k;
      this.tails.L.root.v += k * 0.35;
      this.tails.R.root.v += k * 0.35;
    }
    this.prevTail = tail;
  }

  tasselLag(side) {
    const t = this.tails[side];
    return (side === 'L' ? -1 : 1) * (t.tassel.x - t.tip.x) * 1.2;
  }
}
