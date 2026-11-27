// Campo de distancia con signo de una forma SVG (rasterizada en canvas) — base del relieve tallado.
import * as THREE from 'three';

export function parsePath(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

/**
 * Rasteriza el trazo y calcula la distancia con signo (positiva dentro), en unidades del viewBox.
 * Devuelve la textura (HalfFloat, R) y el rectángulo cubierto en unidades del viewBox.
 */
export function strokeSDF(d, pxPerUnit = 0.8, padUnits = 26) {
  const pts = parsePath(d);
  const b = bbox(pts);
  const x0 = b.x0 - padUnits, y0 = b.y0 - padUnits;
  const wU = b.w + padUnits * 2, hU = b.h + padUnits * 2;
  const W = Math.ceil(wU * pxPerUnit), H = Math.ceil(hU * pxPerUnit);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(W / wU, 0, 0, H / hU, -x0 * W / wU, -y0 * H / hU);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(d));
  const a = ctx.getImageData(0, 0, W, H).data;
  const inside = new Float64Array(W * H), outside = new Float64Array(W * H);
  const cov = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = a[i * 4 + 3] / 255; cov[i] = v;
    const on = v >= 0.5;
    inside[i] = on ? INF : 0;   // distancia (al exterior) para los píxeles de dentro
    outside[i] = on ? 0 : INF;  // distancia (al interior) para los de fuera
  }
  edt(inside, W, H); edt(outside, W, H);
  const unitsPerPx = wU / W;
  const data = new Uint16Array(W * H);
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    // corrección sub-píxel con la cobertura del antialias en el borde
    let s = cov[i] >= 0.5 ? Math.sqrt(inside[i]) - 0.5 : -(Math.sqrt(outside[i]) - 0.5);
    if (cov[i] > 0.02 && cov[i] < 0.98) s = cov[i] - 0.5;
    s *= unitsPerPx;
    raw[i] = s;
    data[i] = THREE.DataUtils.toHalfFloat(s);
  }
  // la textura se lee con v hacia arriba: invertimos filas
  const flipped = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) flipped.set(data.subarray((H - 1 - y) * W, (H - y) * W), y * W);
  const tex = new THREE.DataTexture(flipped, W, H, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, W, H, x0, y0, wU, hU, raw, bbox: b };
}
