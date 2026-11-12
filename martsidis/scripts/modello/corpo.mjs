// Figura femminile stilizzata che contiene il bacino (stessa scala: 1 unità ≈ 10 cm, sinfisi pubica a y ≈ 0).
// Proporzioni realistiche ma senza dettagli del viso; capelli raccolti in uno chignon basso.
// Le braccia sono staccate dai fianchi (si uniscono solo alla spalla): così camminando oscillano
// avanti e indietro senza trascinare la pelle dei fianchi.
import { smin, smax, ellissoide, cono } from './sdf.mjs';

const gamba = (x, y, z, s) => {
  let d = cono(x, y, z, s * 0.88, 0.2, -0.06, s * 0.46, -5.0, 0.04, 0.78, 0.38); // coscia lunga e affusolata (con un filo d'aria tra le cosce: camminando non si strappano)
  d = smin(d, ellissoide(x - s * 0.47, y + 5.05, z - 0.08, 0.36, 0.38, 0.36), 0.15); // ginocchio
  d = smin(d, cono(x, y, z, s * 0.47, -5.1, 0.0, s * 0.33, -9.55, -0.12, 0.38, 0.17), 0.2); // gamba
  d = smin(d, ellissoide(x - s * 0.42, y + 6.55, z + 0.16, 0.34, 1.15, 0.34), 0.35); // polpaccio
  d = smin(d, cono(x, y, z, s * 0.32, -9.85, -0.2, s * 0.36, -10.0, 0.72, 0.2, 0.12), 0.16); // piede
  return d;
};

const braccio = (x, y, z, s) => {
  let d = cono(x, y, z, s * 1.36, 4.95, -0.2, s * 1.76, 2.15, -0.22, 0.31, 0.22); // omero
  d = smin(d, cono(x, y, z, s * 1.76, 2.15, -0.22, s * 2.18, -0.4, 0.02, 0.22, 0.15), 0.22); // avambraccio (gomito morbido)
  d = smin(d, ellissoide(x - s * 1.77, y - 2.17, z + 0.24, 0.21, 0.28, 0.22), 0.15); // gomito
  d = smin(d, ellissoide(x - s * 2.24, y + 0.88, z - 0.06, 0.12, 0.45, 0.23), 0.1); // mano
  return d;
};

// Proporzioni da figurino: gambe e collo lunghi, spalle strette e spioventi, vita sottile, fianchi morbidi.
export function tronco(x, y, z) {
  const ax = Math.abs(x);
  let d = ellissoide(x, y - 0.75, z + 0.12, 1.72, 1.75, 1.02); // bacino e fianchi
  d = smin(d, ellissoide(x, y - 2.65, z + 0.1, 1.08, 1.2, 0.75), 0.8); // vita
  d = smin(d, ellissoide(x, y - 3.9, z + 0.14, 1.22, 1.05, 0.82), 0.55); // torace
  d = smin(d, cono(x, y, z, -1.26, 4.92, -0.2, 1.26, 4.92, -0.2, 0.34, 0.34), 0.45); // spalle
  d = smin(d, Math.min(cono(x, y, z, -1.2, 4.95, -0.2, 0, 5.35, -0.2, 0.3, 0.3), cono(x, y, z, 1.2, 4.95, -0.2, 0, 5.35, -0.2, 0.3, 0.3)), 0.35); // trapezi spioventi
  d = smin(d, ellissoide(ax - 0.5, y - 3.65, z - 0.52, 0.44, 0.42, 0.38), 0.3); // seno
  d = smin(d, ellissoide(ax - 0.58, y - 0.25, z + 0.78, 0.74, 0.8, 0.58), 0.4); // glutei
  d = smin(d, cono(x, y, z, 0, 4.9, -0.22, 0, 6.75, -0.08, 0.3, 0.26), 0.3); // collo lungo
  let t = ellissoide(x, y - 7.5, z - 0.02, 0.62, 0.78, 0.74); // cranio
  t = smin(t, ellissoide(x, y - 7.0, z - 0.12, 0.45, 0.5, 0.52), 0.22); // mandibola
  d = smin(d, t, 0.2);
  return d;
}

export function corpo(x, y, z) {
  let d = tronco(x, y, z);
  d = smin(d, Math.min(gamba(x, y, z, -1), gamba(x, y, z, 1)), 0.28);
  // braccia: unione morbida solo vicino alla spalla, netta più in basso (staccate dai fianchi)
  for (const s of [-1, 1]) {
    const b = braccio(x, y, z, s);
    d = y > 4.0 ? smin(d, b, 0.16) : Math.min(d, b);
  }
  return d;
}

// Capelli lunghi e mossi fino a metà schiena: calotta, ciocche che incorniciano il viso, chioma lungo la schiena.
// Viso libero; la parte dentro il corpo è tolta (così si vede solo fuori).
export function capelli(x, y, z) {
  let d = ellissoide(x, y - 7.6, z + 0.08, 0.7, 0.86, 0.83); // calotta
  d = smin(d, ellissoide(x, y - 6.6, z + 0.6, 0.78, 1.3, 0.42), 0.4); // dietro la testa
  d = smin(d, ellissoide(x, y - 4.4, z + 1.0, 0.86, 2.2, 0.32), 0.45); // lungo la schiena
  d = smin(d, ellissoide(Math.abs(x) - 0.6, y - 6.5, z + 0.02, 0.22, 1.3, 0.34), 0.28); // ciocche ai lati del viso
  d = smax(d, -ellissoide(x, y - 7.15, z - 0.58, 0.5, 0.82, 0.58), 0.08); // viso libero
  d = smax(d, -ellissoide(x, y - 8.44, z - 0.1, 0.03, 0.1, 0.6), 0.03); // riga in mezzo
  if (y < 7.6) {
    const giu = Math.min(1, (7.6 - y) * 1.5);
    d += 0.045 * Math.sin(y * 4.2 + Math.abs(x) * 2.5) * giu; // onde
    d += 0.018 * Math.sin(Math.atan2(x, z + 0.3) * 26 + y * 1.5) * giu; // ciocche
  }
  d = smax(d, 2.35 + 0.08 * Math.sin(x * 8) + 0.04 * Math.sin(x * 21) - y, 0.08); // punte a metà schiena
  d = smax(d, -(tronco(x, y, z) - 0.03), 0.04); // solo fuori dalla pelle
  return d;
}

export const PARTE_CORPO = { nome: 'corpo', sdf: corpo, min: [-2.6, -10.2, -1.5], max: [2.6, 8.45, 1.5], passo: 0.045, triangoli: 12000 };
export const PARTE_CAPELLI = { nome: 'capelli', sdf: capelli, min: [-1.15, 2.0, -1.45], max: [1.15, 8.6, 0.9], passo: 0.02, triangoli: 9000 };
