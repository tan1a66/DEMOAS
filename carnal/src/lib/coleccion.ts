// Mapeo compartido entre la rotonda 3D y la ficha técnica: avance de la sección → corte al frente.
import { clamp, suave, tramo } from './mate';

export const COLECCION = { inicio: 0.09, fin: 0.95 };

/**
 * Índice continuo del corte al frente. Cada corte "descansa" un rato al frente (meseta)
 * y el círculo gira entre uno y otro.
 */
export function indiceColeccion(p: number, n: number) {
  const t = clamp(tramo(p, COLECCION.inicio, COLECCION.fin) * n - 0.5, 0, n - 1);
  const i = Math.floor(t);
  if (i >= n - 1) return n - 1;
  return i + suave(t - i, 0.28, 0.72);
}
