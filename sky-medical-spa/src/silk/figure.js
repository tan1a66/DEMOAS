// La figura: un busto femminile stilizzato (come un manichino da atelier o una scultura
// classica), invisibile. È un campo di distanza fatto di forme morbide unite: spalle, petto,
// vita, fianchi, l'attacco delle cosce. Nessun dettaglio anatomico, solo i volumi.
// La seta ci si appoggia sopra (collisione) e, spinta da un vento leggero, ne rivela la forma.
// `amount` (0..1) la fa crescere dal suo centro: la seta "diventa" figura e poi torna seta.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z); // (Math.hypot è lento)

const sdEllipsoid = (px, py, pz, rx, ry, rz) => {
  const k0 = len3(px / rx, py / ry, pz / rz);
  const k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
};

// capsula con raggio che varia lungo l'asse
const sdCone = (px, py, pz, ax, ay, az, bx, by, bz, ra, rb) => {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const t = clamp01((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return len3(dx, dy, dz) - (ra + (rb - ra) * t);
};

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/** Origine locale: la vita. y verso l'alto, z verso chi guarda. Misure in metri. */
const bodySdf = (x, y, z) => {
  const k = 0.06;
  let d = sdEllipsoid(x, y - 0.22, z, 0.15, 0.17, 0.1); // gabbia toracica
  d = smin(d, sdCone(x, y, z, -0.16, 0.37, -0.01, 0.16, 0.37, -0.01, 0.058, 0.058), k); // spalle
  d = smin(d, sdCone(x, y, z, 0, 0.4, -0.01, 0, 0.53, -0.015, 0.05, 0.043), 0.04); // collo
  d = smin(d, sdEllipsoid(x - 0.072, y - 0.205, z - 0.06, 0.07, 0.066, 0.062), 0.05); // petto, a destra
  d = smin(d, sdEllipsoid(x + 0.072, y - 0.205, z - 0.06, 0.07, 0.066, 0.062), 0.05); // petto, a sinistra
  d = smin(d, sdEllipsoid(x, y, z, 0.112, 0.13, 0.086), 0.08); // vita
  d = smin(d, sdEllipsoid(x, y + 0.2, z - 0.005, 0.172, 0.14, 0.112), 0.08); // fianchi
  d = smin(d, sdCone(x, y, z, 0.085, -0.24, 0, 0.075, -0.62, 0, 0.088, 0.062), 0.05); // coscia destra
  d = smin(d, sdCone(x, y, z, -0.085, -0.24, 0, -0.075, -0.62, 0, 0.088, 0.062), 0.05); // coscia sinistra
  return d;
};

/** Per l'abito: le gambe unite in una sola forma (la gonna scende senza entrare tra le gambe). */
export const gownSdf = (x, y, z) => {
  // volumi esagerati quanto basta perché la silhouette si legga attraverso la seta
  let d = sdEllipsoid(x, y - 0.22, z, 0.155, 0.16, 0.1); // gabbia toracica
  d = smin(d, sdCone(x, y, z, -0.18, 0.36, -0.01, 0.18, 0.36, -0.01, 0.06, 0.06), 0.06); // spalle
  d = smin(d, sdEllipsoid(x - 0.08, y - 0.2, z - 0.07, 0.085, 0.08, 0.075), 0.05); // seno
  d = smin(d, sdEllipsoid(x + 0.08, y - 0.2, z - 0.07, 0.085, 0.08, 0.075), 0.05);
  d = smin(d, sdEllipsoid(x, y, z, 0.098, 0.12, 0.08), 0.07); // vita sottile
  d = smin(d, sdEllipsoid(x, y + 0.2, z, 0.2, 0.15, 0.125), 0.08); // fianchi pieni
  d = smin(d, sdEllipsoid(x, y + 0.48, z, 0.16, 0.34, 0.11), 0.12); // gambe unite (la gonna)
  return d;
};

export const createFigure = () => {
  const f = { x: 0, y: 0.55, z: -0.02, amount: 0 };
  f.sdf = (px, py, pz) => {
    const s = Math.max(0.02, f.amount);
    const lx = (px - f.x) / s, ly = (py - f.y) / s, lz = (pz - f.z) / s;
    // fuori dalla sfera che la contiene: basta una stima per eccesso
    const r = len3(lx, ly + 0.05, lz);
    if (r > 0.95) return (r - 0.85) * s;
    return bodySdf(lx, ly, lz) * s;
  };
  return f;
};
