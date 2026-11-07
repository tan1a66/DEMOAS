// Da SDF a mesh triangolare con "surface nets" (un vertice per cella attraversata dalla superficie),
// poi proiezione dei vertici sulla superficie e normali dal gradiente della SDF (ombreggiatura morbida).

export function surfaceNets(f, min, max, h) {
  const [x0, y0, z0] = min;
  const nx = Math.ceil((max[0] - x0) / h) + 1;
  const ny = Math.ceil((max[1] - y0) / h) + 1;
  const nz = Math.ceil((max[2] - z0) / h) + 1;
  const val = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) val[idx(i, j, k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cella = new Int32Array(cx * cy * cz).fill(-1);
  const cidx = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  // 12 spigoli del cubo come coppie di vertici (0..7, bit: x=1, y=2, z=4)
  const spigoli = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let maschera = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = val[idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          if (v[c] < 0) maschera |= 1 << c;
        }
        if (maschera === 0 || maschera === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of spigoli) {
          if (v[a] < 0 === v[b] < 0) continue;
          const t = v[a] / (v[a] - v[b]);
          const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
          const bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
          sx += ax + (bx - ax) * t;
          sy += ay + (by - ay) * t;
          sz += az + (bz - az) * t;
          n++;
        }
        cella[cidx(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
      }

  // Facce: per ogni spigolo della griglia con cambio di segno, un quadrilatero tra le 4 celle che lo condividono.
  const ind = [];
  const quad = (a, b, c, d, inverti) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (inverti) ind.push(a, c, b, a, d, c);
    else ind.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        const a = val[idx(i, j, k)] < 0, b = val[idx(i + 1, j, k)] < 0;
        if (a === b) continue;
        quad(cella[cidx(i, j - 1, k - 1)], cella[cidx(i, j, k - 1)], cella[cidx(i, j, k)], cella[cidx(i, j - 1, k)], b);
      }
  for (let k = 1; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 1; i < cx; i++) {
        const a = val[idx(i, j, k)] < 0, b = val[idx(i, j + 1, k)] < 0;
        if (a === b) continue;
        quad(cella[cidx(i - 1, j, k - 1)], cella[cidx(i - 1, j, k)], cella[cidx(i, j, k)], cella[cidx(i, j, k - 1)], b);
      }
  for (let k = 0; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 1; i < cx; i++) {
        const a = val[idx(i, j, k)] < 0, b = val[idx(i, j, k + 1)] < 0;
        if (a === b) continue;
        quad(cella[cidx(i - 1, j - 1, k)], cella[cidx(i, j - 1, k)], cella[cidx(i, j, k)], cella[cidx(i - 1, j, k)], b);
      }

  const posizioni = new Float32Array(pos);
  proietta(f, posizioni, h);
  return { posizioni, indici: new Uint32Array(ind), normali: normaliDaGradiente(f, posizioni, h * 0.5) };
}

/** Avvicina i vertici alla superficie (due passi di Newton lungo il gradiente). */
function proietta(f, p, h) {
  const e = h * 0.25;
  for (let i = 0; i < p.length; i += 3) {
    for (let it = 0; it < 2; it++) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      const d = f(x, y, z);
      const gx = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e);
      const gy = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e);
      const gz = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz || 1;
      const passo = Math.max(-h * 0.5, Math.min(h * 0.5, d / g2));
      p[i] = x - gx * passo;
      p[i + 1] = y - gy * passo;
      p[i + 2] = z - gz * passo;
    }
  }
}

export function normaliDaGradiente(f, p, e) {
  const n = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    const gx = f(x + e, y, z) - f(x - e, y, z);
    const gy = f(x, y + e, z) - f(x, y - e, z);
    const gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    n[i] = gx / l;
    n[i + 1] = gy / l;
    n[i + 2] = gz / l;
  }
  return n;
}
