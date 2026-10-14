// El "director": cada escena 3D es una toma con su propia escena y cámara. En cada cuadro se
// renderizan solo las tomas presentes (en orden), sobre un canvas transparente.
import type * as THREE from 'three';
import { estado } from '../lib/scroll';
import { tramo } from '../lib/mate';

export interface Toma {
  id: string;
  escena: THREE.Scene;
  camara: THREE.Camera;
  orden: number;
}

export const tomas = new Map<string, Toma>();

interface Tramo {
  desde: number;
  hasta: number;
  /** duración del fundido de entrada/salida (si no, la que pida la escena) */
  entrada?: number;
  salida?: number;
}

/** Tramos de la historia (escena + avance) en los que cada toma 3D existe. */
export const VENTANAS: Record<string, Tramo[]> = {
  corte: [{ desde: 0.45, hasta: 2.25 }],
  coleccion: [{ desde: 2.95, hasta: 4.0 }],
  // El fuego también abre el recorrido: es el fondo del umbral y se apaga cuando llega el corte.
  fuego: [
    { desde: -1, hasta: 0.92, salida: 0.42 },
    { desde: 3.97, hasta: 5.03 },
  ],
  fachada: [{ desde: 4.97, hasta: 6.0 }],
  cortina: [{ desde: 6.24, hasta: 7.99 }],
};

export function presente(id: string, h = estado.historia) {
  return VENTANAS[id].some((t) => h > t.desde && h < t.hasta);
}

/** 0..1 de entrada/salida dentro de la ventana (para fundidos de luz). */
export function presencia(id: string, entrada = 0.06, salida = 0.06, h = estado.historia) {
  let p = 0;
  for (const t of VENTANAS[id]) {
    const e = t.entrada ?? entrada;
    const s = t.salida ?? salida;
    p = Math.max(p, Math.min(tramo(h, t.desde, t.desde + e), 1 - tramo(h, t.hasta - s, t.hasta)));
  }
  return p;
}

export function hayTomaPresente() {
  for (const id of tomas.keys()) if (presente(id)) return true;
  return false;
}
