// La strada come polilinea 3D (un punto ogni `step` m, dalla cima al mare)
// con una griglia spaziale per trovare in fretta il punto più vicino.

export const KIND = { road: 0, bridge: 1, tunnel: 2 };

export class RoadPath {
  constructor(json, cellSize = 20) {
    this.step = json.step;
    this.length = json.length;
    this.pts = new Float32Array(json.points); // x, y, z
    this.count = this.pts.length / 3;
    this.kind = new Uint8Array(this.count);
    for (const [k, a, b] of json.spans) this.kind.fill(KIND[k], a, b + 1);
    this.keypoints = json.keypoints;

    // tangenti orizzontali lisciate
    this.tan = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i++) {
      const a = Math.max(i - 2, 0), b = Math.min(i + 2, this.count - 1);
      const dx = this.pts[b * 3] - this.pts[a * 3], dz = this.pts[b * 3 + 2] - this.pts[a * 3 + 2];
      const l = Math.hypot(dx, dz) || 1;
      this.tan[i * 2] = dx / l;
      this.tan[i * 2 + 1] = dz / l;
    }
    // curvatura (1/m), utile per i muretti nei tornanti
    this.curv = new Float32Array(this.count);
    for (let i = 3; i < this.count - 3; i++) {
      const a1 = Math.atan2(this.tan[(i - 3) * 2 + 1], this.tan[(i - 3) * 2]);
      const a2 = Math.atan2(this.tan[(i + 3) * 2 + 1], this.tan[(i + 3) * 2]);
      let d = a2 - a1;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.curv[i] = d / (6 * this.step);
    }

    // griglia spaziale
    this.cell = cellSize;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < this.count; i++) {
      x0 = Math.min(x0, this.pts[i * 3]); x1 = Math.max(x1, this.pts[i * 3]);
      z0 = Math.min(z0, this.pts[i * 3 + 2]); z1 = Math.max(z1, this.pts[i * 3 + 2]);
    }
    this.gx0 = x0 - cellSize; this.gz0 = z0 - cellSize;
    this.gw = Math.ceil((x1 - x0) / cellSize) + 3;
    this.gh = Math.ceil((z1 - z0) / cellSize) + 3;
    const buckets = Array.from({ length: this.gw * this.gh }, () => []);
    for (let i = 0; i < this.count; i++) {
      const cx = Math.floor((this.pts[i * 3] - this.gx0) / cellSize);
      const cz = Math.floor((this.pts[i * 3 + 2] - this.gz0) / cellSize);
      buckets[cz * this.gw + cx].push(i);
    }
    this.buckets = buckets;
  }

  x(i) { return this.pts[i * 3]; }
  y(i) { return this.pts[i * 3 + 1]; }
  z(i) { return this.pts[i * 3 + 2]; }

  /** posizione interpolata a una distanza s (m) dalla cima */
  at(s, out) {
    const f = Math.min(Math.max(s / this.step, 0), this.count - 1.0001);
    const i = f | 0, t = f - i, p = this.pts;
    out.set(
      p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * t,
      p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * t,
      p[i * 3 + 2] + (p[i * 3 + 5] - p[i * 3 + 2]) * t,
    );
    return out;
  }

  /**
   * Punto della strada più vicino a (x, z) entro maxDist.
   * onlyRoad: ignora ponti e gallerie (il terreno non deve seguirli).
   * Restituisce { d, y, i } o null. Distanza esatta dal segmento, non solo dai vertici.
   */
  nearest(x, z, maxDist, onlyRoad = false, out = {}) {
    const c = this.cell;
    const r = Math.ceil(maxDist / c);
    const cx = Math.floor((x - this.gx0) / c), cz = Math.floor((z - this.gz0) / c);
    let best = maxDist * maxDist, bi = -1;
    for (let j = Math.max(cz - r, 0); j <= Math.min(cz + r, this.gh - 1); j++) {
      for (let i = Math.max(cx - r, 0); i <= Math.min(cx + r, this.gw - 1); i++) {
        const b = this.buckets[j * this.gw + i];
        for (let k = 0; k < b.length; k++) {
          const idx = b[k];
          if (onlyRoad && this.kind[idx] !== 0) continue;
          const dx = this.pts[idx * 3] - x, dz = this.pts[idx * 3 + 2] - z;
          const d2 = dx * dx + dz * dz;
          if (d2 < best) { best = d2; bi = idx; }
        }
      }
    }
    if (bi < 0) return null;
    // raffina sui due segmenti adiacenti
    let bd = Math.sqrt(best), by = this.pts[bi * 3 + 1];
    for (const j of [bi - 1, bi]) {
      if (j < 0 || j + 1 >= this.count) continue;
      if (onlyRoad && (this.kind[j] !== 0 || this.kind[j + 1] !== 0)) continue;
      const ax = this.pts[j * 3], az = this.pts[j * 3 + 2];
      const ex = this.pts[j * 3 + 3] - ax, ez = this.pts[j * 3 + 5] - az;
      const l2 = ex * ex + ez * ez || 1;
      const t = Math.min(Math.max(((x - ax) * ex + (z - az) * ez) / l2, 0), 1);
      const d = Math.hypot(ax + ex * t - x, az + ez * t - z);
      if (d < bd) { bd = d; by = this.pts[j * 3 + 1] + (this.pts[j * 3 + 4] - this.pts[j * 3 + 1]) * t; }
    }
    out.d = bd; out.y = by; out.i = bi;
    return out;
  }
}
