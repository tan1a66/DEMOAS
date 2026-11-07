// Primitive e operatori SDF (signed distance functions) per modellare forme organiche.
// Negativo = dentro, positivo = fuori. Unità: 1 ≈ 10 cm.
// Riferimenti: Inigo Quilez, "distance functions" (iquilezles.org).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Unione morbida (k = raggio di raccordo). */
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
/** Intersezione morbida. */
export const smax = (a, b, k) => -smin(-a, -b, k);
/** Sottrazione morbida: a meno b. */
export const ssub = (a, b, k) => smax(a, -b, k);

export const sfera = (x, y, z, r) => Math.sqrt(x * x + y * y + z * z) - r;

export function ellissoide(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = x / (rx * rx), by = y / (ry * ry), bz = z / (rz * rz);
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

/** Tronco di cono arrotondato (capsula con raggio variabile, approssimata). */
export function cono(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r1 + (r2 - r1) * h);
}

/** Toro nel piano XZ locale (asse = Y). */
export function toro(x, y, z, R, r) {
  const q = Math.sqrt(x * x + z * z) - R;
  return Math.sqrt(q * q + y * y) - r;
}

export function scatolaTonda(x, y, z, bx, by, bz, r) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/**
 * Tubo lungo una polilinea [[x,y,z,r], …] con raggi variabili e giunzioni morbide.
 * `scalaX` appiattisce la sezione (es. 1.6 = sezione ovale più larga in X).
 */
export function tubo(x, y, z, punti, k = 0.03, scalaX = 1) {
  const xs = x / scalaX;
  let d = 1e9;
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i], b = punti[i + 1];
    d = smin(d, cono(xs, y, z, a[0] / scalaX, a[1], a[2], b[0] / scalaX, b[1], b[2], a[3], b[3]), k);
  }
  return d * Math.min(scalaX, 1);
}

/**
 * Sistema di riferimento locale: posizione + rotazione (Euler XYZ, radianti).
 * `locale(x,y,z)` restituisce le coordinate locali in un array riusato (niente allocazioni).
 */
export function riferimento(px, py, pz, rx = 0, ry = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx (come Euler 'XYZ' di three.js)
  const m = [
    cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz,
    cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz,
    -sy, sx * cy, cx * cy,
  ];
  const out = [0, 0, 0];
  return {
    pos: [px, py, pz],
    m,
    /** mondo → locale (R^T · (p − pos)) */
    locale(x, y, z) {
      const dx = x - px, dy = y - py, dz = z - pz;
      out[0] = m[0] * dx + m[3] * dy + m[6] * dz;
      out[1] = m[1] * dx + m[4] * dy + m[7] * dz;
      out[2] = m[2] * dx + m[5] * dy + m[8] * dz;
      return out;
    },
    /** locale → mondo */
    mondo(x, y, z) {
      return [
        px + m[0] * x + m[1] * y + m[2] * z,
        py + m[3] * x + m[4] * y + m[5] * z,
        pz + m[6] * x + m[7] * y + m[8] * z,
      ];
    },
  };
}

/** Riferimento da assi espliciti (vettori normalizzati): utile per orientare anelli e lamine. */
export function riferimentoAssi(px, py, pz, ux, uy, uz) {
  const out = [0, 0, 0];
  return {
    locale(x, y, z) {
      const dx = x - px, dy = y - py, dz = z - pz;
      out[0] = dx * ux[0] + dy * ux[1] + dz * ux[2];
      out[1] = dx * uy[0] + dy * uy[1] + dz * uy[2];
      out[2] = dx * uz[0] + dy * uz[1] + dz * uz[2];
      return out;
    },
  };
}

export const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
