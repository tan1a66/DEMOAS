// Figura femminile stilizzata che contiene il bacino (stessa scala: 1 unità ≈ 10 cm, sinfisi pubica a y ≈ 0).
// Proporzioni realistiche ma senza dettagli del viso; capelli raccolti in uno chignon basso.
// Le braccia sono staccate dai fianchi (si uniscono solo alla spalla): così camminando oscillano
// avanti e indietro senza trascinare la pelle dei fianchi.
import { smin, smax, smoothstep, ellissoide, cono } from './sdf.mjs';

const gamba = (x, y, z, s) => {
  let d = cono(x, y, z, s * 0.94, 0.2, -0.06, s * 0.6, -4.6, 0.04, 0.86, 0.42); // coscia piena
  d = smin(d, ellissoide(x - s * 0.6, y + 4.65, z - 0.08, 0.38, 0.4, 0.38), 0.15); // ginocchio
  d = smin(d, cono(x, y, z, s * 0.6, -4.7, 0.0, s * 0.42, -8.65, -0.12, 0.4, 0.19), 0.2); // gamba
  d = smin(d, ellissoide(x - s * 0.58, y + 5.95, z + 0.17, 0.36, 1.0, 0.37), 0.35); // polpaccio
  d = smin(d, cono(x, y, z, s * 0.42, -8.95, -0.2, s * 0.46, -9.1, 0.78, 0.21, 0.13), 0.16); // piede
  return d;
};

const braccio = (x, y, z, s) => {
  let d = cono(x, y, z, s * 1.62, 4.95, -0.2, s * 1.98, 2.15, -0.22, 0.38, 0.27); // omero
  d = smin(d, cono(x, y, z, s * 1.98, 2.15, -0.22, s * 2.28, -0.35, 0.02, 0.26, 0.18), 0.4); // avambraccio: il gomito è una curva continua, senza punta
  d = smin(d, ellissoide(x - s * 2.33, y + 0.85, z - 0.06, 0.13, 0.46, 0.25), 0.1); // mano
  return d;
};

// Proporzioni naturali (dalla silhouette di riferimento): spalle larghe quanto i fianchi, braccia e gambe piene,
// vita segnata, fianchi rotondi.
export function tronco(x, y, z) {
  const ax = Math.abs(x);
  // bacino e fianchi: il cavallo è subito sotto l'apparato (y ≈ -0,45), come in un corpo vero
  let d = ellissoide(x, y - 1.0, z + 0.12, 1.8, 1.46, 1.06);
  d = smin(d, ellissoide(x, y - 0.08, z + 0.12, 1.7, 0.42, 0.95), 0.4); // la base del bacino, larga, fino alle cosce
  d = smin(d, ellissoide(x, y - 2.65, z + 0.1, 1.22, 1.2, 0.8), 0.8); // vita
  d = smin(d, ellissoide(x, y - 3.9, z + 0.14, 1.46, 1.1, 0.9), 0.55); // torace e schiena
  d = smin(d, cono(x, y, z, -1.55, 4.98, -0.2, 1.55, 4.98, -0.2, 0.42, 0.42), 0.45); // spalle
  d = smin(d, Math.min(cono(x, y, z, -1.45, 5.0, -0.2, 0, 5.4, -0.2, 0.32, 0.32), cono(x, y, z, 1.45, 5.0, -0.2, 0, 5.4, -0.2, 0.32, 0.32)), 0.35); // trapezi
  d = smin(d, ellissoide(ax - 0.55, y - 3.6, z - 0.6, 0.56, 0.52, 0.5), 0.32); // seno pieno
  d = smin(d, ellissoide(ax - 0.62, y - 0.15, z + 0.86, 0.8, 0.78, 0.64), 0.42); // glutei rotondi
  d = smin(d, cono(x, y, z, 0, 4.95, -0.22, 0, 6.4, -0.08, 0.34, 0.3), 0.3); // collo
  let t = ellissoide(x, y - 7.15, z - 0.02, 0.7, 0.88, 0.82); // cranio
  t = smin(t, ellissoide(x, y - 6.7, z - 0.12, 0.5, 0.52, 0.56), 0.22); // mandibola
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

// Capelli lunghi e lisci fino a metà schiena, riga in mezzo, ciocche ai lati del viso.
// Viso libero; la parte dentro il corpo è tolta (così si vede solo fuori).
export function capelli(x, y, z) {
  let d = ellissoide(x, y - 7.25, z + 0.08, 0.78, 0.95, 0.9); // calotta
  // un'unica chioma dalla nuca a metà schiena: segue la curva della testa e poi della schiena, senza giunture
  const zc = -1.02 + 0.52 * smoothstep(4.0, 7.2, y) + 0.1 * smoothstep(3.6, 2.4, y);
  const xc = 0.06 * Math.sin(y * 1.3); // una leggera S lungo la chioma
  const largo = 0.8 + 0.12 * smoothstep(6.0, 3.5, y); // si apre appena verso le punte
  const chioma = (Math.hypot((x - xc) / largo, (z - zc) / 0.26) - 1) * 0.26; // sezione ovale morbida
  d = smin(d, smax(chioma, Math.max(y - 7.4, 2.3 - y), 0.2), 0.6);
  // ciocche lunghe che scendono ai lati del viso e ricadono davanti alle spalle, sul petto
  const ax = Math.abs(x);
  const ciocca = smin(
    cono(ax, y, z, 0.64, 6.7, 0.02, 0.92, 5.0, 0.22, 0.27, 0.22),
    cono(ax, y, z, 0.92, 5.0, 0.22, 0.9, 4.25, 0.62, 0.22, 0.1),
    0.35,
  );
  d = smin(d, ciocca, 0.45);
  d = smax(d, -ellissoide(x, y - 6.8, z - 0.6, 0.55, 0.85, 0.62), 0.08); // viso libero
  d = smax(d, -ellissoide(x, y - 8.12, z - 0.1, 0.03, 0.1, 0.6), 0.03); // riga in mezzo
  if (y < 7.3) d += 0.016 * Math.sin(Math.atan2(x, z + 0.3) * 30 + y * 0.6) * Math.min(1, (7.3 - y) * 1.5); // ciocche lisce
  d = smax(d, 2.25 + 0.55 * x * x + 0.04 * Math.sin(x * 13) - y, 0.12); // punte morbide a V, più lunghe al centro
  d = smax(d, -(tronco(x, y, z) - 0.03), 0.04); // solo fuori dalla pelle
  return d;
}

export const PARTE_CORPO = { nome: 'corpo', sdf: corpo, min: [-2.8, -9.3, -1.6], max: [2.8, 8.15, 1.6], passo: 0.045, triangoli: 12000 };
export const PARTE_CAPELLI = { nome: 'capelli', sdf: capelli, min: [-1.25, 2.0, -1.55], max: [1.25, 8.3, 0.95], passo: 0.02, triangoli: 9000 };
