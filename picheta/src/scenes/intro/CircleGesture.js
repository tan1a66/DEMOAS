import { fitCircle } from './logoSampler.js';

// Reconoce "dibuja un círculo": se ajusta un círculo a los puntos del trazo
// (más estable que el centroide en arcos parciales) y se acumula el ángulo
// recorrido alrededor de su centro. Completo a ~330° con radio regular.
export class CircleGesture {
  constructor({ minAngleDeg = 330, maxDeviation = 0.3 } = {}) {
    this.target = (minAngleDeg * Math.PI) / 180;
    this.maxDeviation = maxDeviation;
    this.xs = [];
    this.ys = [];
    this.ts = [];
    this.progress = 0;
    this.center = { x: 0, y: 0 };
    this.radius = 0;
    this.window = 6;
    this.minR = 24;
    this.maxR = 1000;
  }

  // Tamaño de pantalla en px CSS: límites de radio razonables.
  setViewport(w, h) {
    this.minR = Math.max(22, Math.min(w, h) * 0.045);
    this.maxR = Math.max(w, h) * 0.75;
  }

  // window: segundos de trazo que se tienen en cuenta (más corto al pasar el ratón sin pulsar).
  reset(window = 6) {
    this.xs.length = this.ys.length = this.ts.length = 0;
    this.progress = 0;
    this.window = window;
  }

  get points() {
    return this.xs.map((x, i) => ({ x, y: this.ys[i] }));
  }

  add(x, y, t) {
    const n = this.xs.length;
    if (n && Math.hypot(x - this.xs[n - 1], y - this.ys[n - 1]) < 3) return this.progress;
    this.xs.push(x);
    this.ys.push(y);
    this.ts.push(t);
    let drop = 0;
    while (drop < this.ts.length && t - this.ts[drop] > this.window) drop++;
    drop = Math.max(drop, this.xs.length - 500);
    if (drop > 0) this.trim(drop);
    this.evaluate();
    return this.progress;
  }

  trim(k) {
    this.xs.splice(0, k);
    this.ys.splice(0, k);
    this.ts.splice(0, k);
  }

  evaluate() {
    const n = this.xs.length;
    this.progress = 0;
    if (n < 8) return;
    const fit = fitCircle(this.xs, this.ys);
    if (!fit || fit.r < this.minR || fit.r > this.maxR) return this.restart();

    let sum = 0;
    let abs = 0;
    let dev = 0;
    let prev = Math.atan2(this.ys[0] - fit.cy, this.xs[0] - fit.cx);
    for (let i = 0; i < n; i++) {
      const dx = this.xs[i] - fit.cx;
      const dy = this.ys[i] - fit.cy;
      const rr = Math.hypot(dx, dy);
      dev += (rr - fit.r) ** 2;
      if (i === 0) continue;
      const a = Math.atan2(dy, dx);
      let d = a - prev;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      sum += d;
      abs += Math.abs(d);
      prev = a;
    }
    dev = Math.sqrt(dev / n) / fit.r;
    const steady = abs > 0 ? Math.abs(sum) / abs : 0;
    if (dev > this.maxDeviation || steady < 0.8) return this.restart();

    this.center = { x: fit.cx, y: fit.cy };
    this.radius = fit.r;
    this.direction = Math.sign(sum);
    this.progress = Math.min(1, Math.abs(sum) / this.target);
  }

  // El trazo dejó de parecer un círculo: se conserva sólo el final para
  // poder empezar uno nuevo sin levantar el dedo.
  restart() {
    this.progress = 0;
    if (this.xs.length > 24) this.trim(this.xs.length - 12);
  }
}
