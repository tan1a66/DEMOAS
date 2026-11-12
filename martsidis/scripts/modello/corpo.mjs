// Figura femminile stilizzata che contiene il bacino (stessa scala: 1 unità ≈ 10 cm, sinfisi pubica a y ≈ 0).
// Volumi morbidi senza dettagli del viso: una silhouette elegante, non un manichino.
import { smin, ellissoide, cono } from './sdf.mjs';

const gamba = (x, y, z, s) =>
  smin(
    smin(
      cono(x, y, z, s * 0.82, 0.3, -0.08, s * 0.56, -4.1, 0.02, 0.9, 0.47), // coscia
      cono(x, y, z, s * 0.56, -4.1, 0.02, s * 0.44, -7.9, -0.12, 0.45, 0.25), // gamba
      0.25,
    ),
    cono(x, y, z, s * 0.44, -8.25, -0.22, s * 0.5, -8.42, 0.85, 0.27, 0.17), // piede
    0.22,
  );

const braccio = (x, y, z, s) =>
  smin(
    smin(
      cono(x, y, z, s * 1.72, 4.75, -0.22, s * 2.02, 2.05, -0.25, 0.4, 0.29),
      cono(x, y, z, s * 2.02, 2.05, -0.25, s * 2.18, -0.35, 0.02, 0.29, 0.2),
      0.12,
    ),
    ellissoide(x - s * 2.22, y + 0.85, z - 0.08, 0.17, 0.45, 0.27),
    0.12,
  );

export function corpo(x, y, z) {
  // tronco: bacino, vita, torace, spalle
  let d = ellissoide(x, y - 0.75, z + 0.12, 1.9, 1.65, 1.12);
  d = smin(d, ellissoide(x, y - 2.65, z + 0.12, 1.32, 1.35, 0.86), 0.6);
  d = smin(d, ellissoide(x, y - 3.95, z + 0.15, 1.52, 1.2, 0.95), 0.5);
  d = smin(d, cono(x, y, z, -1.55, 4.85, -0.22, 1.55, 4.85, -0.22, 0.5, 0.5), 0.45);
  // seno e glutei, appena accennati
  d = smin(d, ellissoide(Math.abs(x) - 0.58, y - 3.62, z - 0.62, 0.5, 0.48, 0.42), 0.3);
  d = smin(d, ellissoide(Math.abs(x) - 0.62, y - 0.35, z + 0.82, 0.8, 0.85, 0.62), 0.4);
  // collo e testa
  d = smin(d, cono(x, y, z, 0, 5.0, -0.22, 0, 6.25, -0.08, 0.42, 0.36), 0.3);
  d = smin(d, ellissoide(x, y - 7.0, z - 0.02, 0.78, 1.0, 0.9), 0.25);
  // gambe e braccia
  d = smin(d, Math.min(gamba(x, y, z, -1), gamba(x, y, z, 1)), 0.32);
  d = smin(d, Math.min(braccio(x, y, z, -1), braccio(x, y, z, 1)), 0.14);
  return d;
}

export const PARTE_CORPO = { nome: 'corpo', sdf: corpo, min: [-2.7, -8.8, -1.6], max: [2.7, 8.15, 1.6], passo: 0.05, triangoli: 9000 };
