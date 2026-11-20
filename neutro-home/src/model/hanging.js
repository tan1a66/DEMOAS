// Modelo "que parece físico" de la trenza colgada en tres ganchos.
//
//   codaIzq + onda1 + onda2 + codaDer (+ los arcos sobre los ganchos) = longitud total
//
// · Cada onda es una catenaria entre los dos ganchos; sus extremos son los puntos donde la
//   trenza deja de apoyarse sobre el gancho (tangencia con un círculo de radio WRAP_RADIUS).
// · Las colas cuelgan del gancho exterior; pueden balancearse (ángulos raíz/punta).
// · El eje se muestrea con paso constante de longitud: el parámetro s es "material",
//   así el trenzado se desliza sobre los ganchos cuando cambian las longitudes.

import { solveCatenary, catenaryAt, catenaryEndAngles, catenaryLowest } from './catenary.js';

const HALF_PI = Math.PI / 2;
const TAIL_STEPS = 48;

export class HangingModel {
  constructor({ pegX, pegY, rho, length }) {
    this.pegX = pegX;
    this.pegY = pegY;
    this.rho = rho;
    this.length = length;
    this._tmp = { x: 0, y: 0, tx: 0, ty: 0 };
    this._tailL = new Float32Array((TAIL_STEPS + 1) * 4);
    this._tailR = new Float32Array((TAIL_STEPS + 1) * 4);
    this._buildTable();
  }

  // Onda entre el gancho i y el i+1 con longitud L.
  solveWave(i, L) {
    const c1 = this.pegX[i];
    const c2 = this.pegX[i + 1];
    const cy = this.pegY;
    const rho = this.rho;
    let aL = HALF_PI - 0.7;
    let aR = HALF_PI + 0.7;
    let cat;
    for (let it = 0; it < 6; it++) {
      cat = solveCatenary(c1 + rho * Math.cos(aL), cy + rho * Math.sin(aL), c2 + rho * Math.cos(aR), cy + rho * Math.sin(aR), L);
      if (it === 5) break;
      const [b1, b2] = catenaryEndAngles(cat);
      aL = HALF_PI + b1;
      aR = HALF_PI + b2;
    }
    return { cat, aL, aR, low: catenaryLowest(cat) };
  }

  // Las dos ondas tienen la misma geometría (ganchos equidistantes y a la misma altura):
  // tabla profundidad ↔ longitud calculada una sola vez.
  _buildTable() {
    const span = this.pegX[1] - this.pegX[0];
    const n = 400;
    this.tableL = new Float64Array(n);
    this.tableD = new Float64Array(n);
    this.tableWrap = new Float64Array(n);
    const Lmin = (span - 2 * this.rho) * 1.002;
    const Lmax = span * 3.2;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const L = Lmin + (Lmax - Lmin) * t * t;
      const w = this.solveWave(0, L);
      this.tableL[k] = L;
      this.tableD[k] = this.pegY - w.low;
    }
  }

  lengthForDepth(depth) {
    const { tableL: L, tableD: D } = this;
    const n = L.length;
    if (depth <= D[0]) return L[0];
    if (depth >= D[n - 1]) return L[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (D[mid] < depth) lo = mid;
      else hi = mid;
    }
    const t = (depth - D[lo]) / (D[hi] - D[lo]);
    return L[lo] + (L[hi] - L[lo]) * t;
  }

  depthForLength(len) {
    const { tableL: L, tableD: D } = this;
    const n = L.length;
    if (len <= L[0]) return D[0];
    if (len >= L[n - 1]) return D[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (L[mid] < len) lo = mid;
      else hi = mid;
    }
    const t = (len - L[lo]) / (L[hi] - L[lo]);
    return D[lo] + (D[hi] - D[lo]) * t;
  }

  // Longitud de los arcos de apoyo con las colas en reposo (vertical).
  wrapLength(len1, len2) {
    const w1 = this.solveWave(0, len1);
    const w2 = this.solveWave(1, len2);
    return this.rho * (Math.PI - w1.aL + (w1.aR - w2.aL) + w2.aR);
  }

  tailLength(len1, len2) {
    return (this.length - len1 - len2 - this.wrapLength(len1, len2)) / 2;
  }

  _tail(table, side, rootX, rootY, Lt, thRoot, thTip) {
    // Integración del eje de la cola desde el gancho hacia abajo.
    let x = rootX;
    let y = rootY;
    const ds = Lt / TAIL_STEPS;
    for (let m = 0; m <= TAIL_STEPS; m++) {
      const u = m / TAIL_STEPS;
      const psi = thRoot + (thTip - thRoot) * u * u;
      const dx = side * Math.sin(psi);
      const dy = -Math.cos(psi);
      table[m * 4] = x;
      table[m * 4 + 1] = y;
      table[m * 4 + 2] = dx;
      table[m * 4 + 3] = dy;
      if (m < TAIL_STEPS) {
        const um = (m + 0.5) / TAIL_STEPS;
        const pm = thRoot + (thTip - thRoot) * um * um;
        x += side * Math.sin(pm) * ds;
        y += -Math.cos(pm) * ds;
      }
    }
  }

  _tailAt(table, Lt, d, o) {
    const f = Math.min(Math.max(d / Lt, 0), 1) * TAIL_STEPS;
    const m = Math.min(Math.floor(f), TAIL_STEPS - 1);
    const t = f - m;
    const a = m * 4;
    const b = a + 4;
    o.x = table[a] + (table[b] - table[a]) * t;
    o.y = table[a + 1] + (table[b + 1] - table[a + 1]) * t;
    o.tx = table[a + 2] + (table[b + 2] - table[a + 2]) * t;
    o.ty = table[a + 3] + (table[b + 3] - table[a + 3]) * t;
    return o;
  }

  /**
   * Construye el eje muestreado.
   * state: { len1, len2, tailL: {root, tip}, tailR: {root, tip}, offsetY }
   * out:   { px, py, tx, ty (Float32Array N) } — se rellena y se devuelve con información extra.
   */
  build(state, out) {
    const { pegX, pegY: cy, rho } = this;
    const w1 = this.solveWave(0, state.len1);
    const w2 = this.solveWave(1, state.len2);
    const thL = state.tailL.root;
    const thR = state.tailR.root;

    const a1in = Math.PI - thL;
    const a1out = w1.aL;
    const a2in = w1.aR;
    const a2out = w2.aL;
    const a3in = w2.aR;
    const a3out = thR;
    const arc1 = Math.max(0, a1in - a1out) * rho;
    const arc2 = Math.max(0, a2in - a2out) * rho;
    const arc3 = Math.max(0, a3in - a3out) * rho;
    // lo que sobra se reparte entre las colas; "bias" = colaIzq − colaDer (tirar de un extremo)
    const rest = this.length - w1.cat.L - w2.cat.L - arc1 - arc2 - arc3;
    const bias = state.bias || 0;
    const LtL = Math.max(0.02, (rest + bias) / 2);
    const LtR = Math.max(0.02, rest - LtL);

    this._tail(this._tailL, -1, pegX[0] + rho * Math.cos(a1in), cy + rho * Math.sin(a1in), LtL, thL, state.tailL.tip);
    this._tail(this._tailR, 1, pegX[2] + rho * Math.cos(a3out), cy + rho * Math.sin(a3out), LtR, thR, state.tailR.tip);

    const segs = [
      { len: LtL, kind: 'tailL' },
      { len: arc1, kind: 'arc', cx: pegX[0], a0: a1in },
      { len: w1.cat.L, kind: 'cat', cat: w1.cat },
      { len: arc2, kind: 'arc', cx: pegX[1], a0: a2in },
      { len: w2.cat.L, kind: 'cat', cat: w2.cat },
      { len: arc3, kind: 'arc', cx: pegX[2], a0: a3in },
      { len: LtR, kind: 'tailR' },
    ];
    const total = segs.reduce((acc, sg) => acc + sg.len, 0);
    const N = out.px.length;
    const step = total / (N - 1);
    const o = this._tmp;
    const dy = state.offsetY || 0;
    let si = 0;
    let segStart = 0;
    for (let i = 0; i < N; i++) {
      const s = Math.min(i * step, total - 1e-9);
      while (si < segs.length - 1 && s > segStart + segs[si].len) {
        segStart += segs[si].len;
        si++;
      }
      const sg = segs[si];
      const ls = s - segStart;
      if (sg.kind === 'tailL') {
        this._tailAt(this._tailL, LtL, LtL - ls, o);
        o.tx = -o.tx;
        o.ty = -o.ty;
      } else if (sg.kind === 'tailR') {
        this._tailAt(this._tailR, LtR, ls, o);
      } else if (sg.kind === 'arc') {
        const al = sg.a0 - ls / rho;
        o.x = sg.cx + rho * Math.cos(al);
        o.y = cy + rho * Math.sin(al);
        o.tx = Math.sin(al);
        o.ty = -Math.cos(al);
      } else {
        catenaryAt(sg.cat, ls, o);
      }
      out.px[i] = o.x;
      out.py[i] = o.y + dy;
      out.tx[i] = o.tx;
      out.ty[i] = o.ty;
    }

    out.total = total;
    out.tailL = LtL;
    out.tailR = LtR;
    out.tail = (LtL + LtR) / 2;
    out.pivotL = { x: pegX[0] - rho, y: cy + (state.offsetY || 0) };
    out.pivotR = { x: pegX[2] + rho, y: cy + (state.offsetY || 0) };
    out.waves = [w1, w2].map((w) => ({
      x: Math.min(Math.max(w.cat.x0, w.cat.x1), w.cat.x2),
      y: w.low + dy,
      depth: cy - w.low,
    }));
    // Extremos (para las borlas): posición y dirección "hacia fuera" del extremo.
    const tl = this._tailL;
    const tr = this._tailR;
    const e = TAIL_STEPS * 4;
    out.endL = { x: tl[e], y: tl[e + 1] + dy, dx: tl[e + 2], dy: tl[e + 3] };
    out.endR = { x: tr[e], y: tr[e + 1] + dy, dx: tr[e + 2], dy: tr[e + 3] };
    return out;
  }
}
