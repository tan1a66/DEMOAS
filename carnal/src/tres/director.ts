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

/** Tramo de la historia (escena + avance) en el que cada toma 3D existe. */
export const VENTANAS: Record<string, [number, number]> = {
  corte: [0.45, 2.25],
  coleccion: [2.95, 4.0],
  fuego: [3.97, 5.03],
  fachada: [4.97, 6.0],
  cortina: [6.24, 7.99],
};

export function presente(id: string, h = estado.historia) {
  const v = VENTANAS[id];
  return h > v[0] && h < v[1];
}

/** 0..1 de entrada/salida dentro de la ventana (para fundidos de luz). */
export function presencia(id: string, entrada = 0.06, salida = 0.06, h = estado.historia) {
  const [a, b] = VENTANAS[id];
  return Math.min(tramo(h, a, a + entrada), 1 - tramo(h, b - salida, b));
}

export function hayTomaPresente() {
  for (const id of tomas.keys()) if (presente(id)) return true;
  return false;
}
