// Campionamento del rilievo su tre livelli annidati:
//   hi   (4 m, corridoio della strada)  ⊂  base (8 m, area della scena)  ⊂  far (100 m, orizzonte)
// Ai bordi di ogni livello la quota sfuma nel livello più grossolano, così non ci sono gradini.

export const BLEND = { hi: 60, base: 400 }; // larghezza della sfumatura (m), condivisa con gli shader

function bilinear(L, x, z) {
  const fx = Math.min(Math.max((x - L.xMin) / L.cell, 0), L.width - 1.001);
  const fz = Math.min(Math.max((z - L.zMin) / L.cell, 0), L.height - 1.001);
  const ix = fx | 0, iz = fz | 0;
  const tx = fx - ix, tz = fz - iz;
  const i = iz * L.width + ix, d = L.data;
  const a = d[i] + (d[i + 1] - d[i]) * tx;
  const b = d[i + L.width] + (d[i + L.width + 1] - d[i + L.width]) * tx;
  return a + (b - a) * tz;
}

/** 0 sul bordo del livello → 1 a `w` metri all'interno */
export function edgeWeight(L, x, z, w) {
  const d = Math.min(x - L.xMin, L.xMax - x, z - L.zMin, L.zMax - z);
  if (d <= 0) return 0;
  const t = Math.min(d / w, 1);
  return t * t * (3 - 2 * t);
}

export class Heightfield {
  constructor(levels) {
    this.hi = levels.hi;
    this.base = levels.base;
    this.far = levels.far;
  }

  height(x, z) {
    let h = bilinear(this.far, x, z);
    const wb = edgeWeight(this.base, x, z, BLEND.base);
    if (wb > 0) h += (bilinear(this.base, x, z) - h) * wb;
    const wh = edgeWeight(this.hi, x, z, BLEND.hi);
    if (wh > 0) h += (bilinear(this.hi, x, z) - h) * wh;
    return h;
  }

  /** pendenza 0 (piano) … 1 (verticale), come 1 − n.y */
  slope(x, z, d = 4) {
    const gx = (this.height(x + d, z) - this.height(x - d, z)) / (2 * d);
    const gz = (this.height(x, z + d) - this.height(x, z - d)) / (2 * d);
    return 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
  }
}
