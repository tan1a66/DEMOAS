// El recorrido: una sola cámara que viaja por la casa siguiendo el desplazamiento, sin paradas.
// "p" es continuo (0 = trenza, 1 = Makech, 2 = sala); el gesto mueve un objetivo y un muelle
// lleva la cámara hacia él con suavidad (y con inercia al soltar).

import * as THREE from 'three';
import { Spring, clamp } from './model/spring.js';

// Cada pieza tiene una pausa: un tramo del desplazamiento en el que la cámara se queda quieta ante
// ella. Entre una pieza y la siguiente la cámara va al paso del dedo (sin acelerar), con sólo un
// arranque y una llegada suaves. La pausa añade recorrido; no se recupera con velocidad.
const HOLD = 0.25; // medio tramo de pausa a cada lado de una pieza (en unidades de desplazamiento)
const SEG = 1 + 2 * HOLD; // de una pieza a la siguiente: pausa + viaje (1) + pausa
const CORNER = 0.15; // arranque y llegada suaves (fracción del viaje)
const VMAX = 1 / (1 - CORNER);

// viaje 0..1 → progreso 0..1 con velocidad constante en el centro (perfil trapezoidal)
function travel(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < CORNER) return (VMAX * u * u) / (2 * CORNER);
  if (u > 1 - CORNER) return 1 - (VMAX * (1 - u) * (1 - u)) / (2 * CORNER);
  return VMAX * (u - CORNER / 2);
}

export class Journey {
  /**
   * count: piezas; introSpan: cuánto recorrido ocupa la entrada (la narración también la
   * decide el desplazamiento: si te paras, se para; si vuelves atrás, se deshace).
   *   s ∈ [0, introSpan) → entrada;  s = introSpan + i·SEG → pieza i.
   */
  constructor(count, introSpan = 0) {
    this.count = count;
    this.intro = introSpan;
    this.max = introSpan + (count - 1) * SEG;
    this.spring = new Spring(0, 5.5, 1);
  }

  get s() {
    return this.spring.x;
  }

  // posición de desplazamiento de la pieza i
  stopS(i) {
    return this.intro + clamp(i, 0, this.count - 1) * SEG;
  }

  // desplazamiento que corresponde a un progreso p (para saltos de prueba)
  sOf(p) {
    const i = Math.floor(p);
    const f = p - i;
    return this.intro + i * SEG + (f > 0 ? HOLD + f : 0);
  }

  // progreso entre piezas (0 = trenza, 1 = Makech, 2 = sala, 3 = final)
  get p() {
    const raw = Math.max(0, this.spring.x - this.intro);
    const k = Math.min(this.count - 1, Math.floor(raw / SEG));
    if (k >= this.count - 1) return this.count - 1;
    return k + travel(raw - k * SEG - HOLD);
  }

  // ¿dónde termina el desplazamiento si se suelta con esta inercia? nunca más allá de la pieza
  // siguiente (cada pieza tiene su pausa) y, si queda cerca de una, se posa en ella
  settle(target) {
    const s = this.spring.x;
    const dir = Math.sign(target - s);
    let t = target;
    if (s < this.intro) {
      if (dir > 0) t = Math.min(t, this.intro);
    } else {
      const raw = (s - this.intro) / SEG;
      if (dir > 0) t = Math.min(t, this.stopS(Math.floor(raw + 1e-3) + 1));
      if (dir < 0) t = Math.max(t, this.stopS(Math.ceil(raw - 1e-3) - 1));
    }
    if (t >= this.intro - 0.05) {
      const near = Math.round((t - this.intro) / SEG);
      if (Math.abs(t - this.stopS(near)) < 0.42 * SEG) t = this.stopS(near);
    }
    this.goS(t, 3.2);
  }

  get introT() {
    return this.intro > 0 ? clamp(this.spring.x / this.intro, 0, 1) : 1;
  }

  get target() {
    return this.spring.target;
  }

  // pieza más cercana
  get index() {
    return Math.round(this.p);
  }

  get moving() {
    const s = this.spring;
    return Math.abs(s.v) > 1e-3 || Math.abs(s.x - s.target) > 1e-3;
  }

  // desplazamiento continuo (rueda, dedo)
  setTarget(x) {
    this.spring.omega = 5.5;
    this.spring.target = clamp(x, 0, this.max);
  }

  scrollBy(d) {
    this.setTarget(this.spring.target + d);
  }

  goS(x, omega = 2.6) {
    const to = clamp(x, 0, this.max);
    this.spring.target = to;
    this.spring.omega = omega + Math.max(0, Math.abs(this.spring.x - to) - 1) * 0.5;
  }

  // ir a una pieza (marcas laterales, flecha, teclado): vuelo algo más lento
  go(i) {
    this.goS(this.stopS(i));
  }

  next() {
    const t = (this.spring.target - this.intro) / SEG;
    if (t < -1e-3) this.go(0);
    else this.go(Math.floor(t + 1e-3) + 1);
  }

  prev() {
    const t = (this.spring.target - this.intro) / SEG;
    if (t <= 1e-3) this.goS(0);
    else this.go(Math.ceil(t - 1e-3) - 1);
  }

  jump(i) {
    this.spring.set(this.stopS(i));
  }

  jumpS(x) {
    this.spring.set(clamp(x, 0, this.max));
  }

  update(dt) {
    const h = Math.min(dt, 1 / 20) / 3;
    for (let k = 0; k < 3; k++) this.spring.step(h);
    if (!this.moving) this.spring.x = this.spring.target;
  }
}

/**
 * keys: [{ pos, look, fov, stop? }] — puntos de la trayectoria (las piezas llevan stop = índice).
 * Devuelve una función que, para un progreso p, da posición, mirada y campo de visión.
 */
export function buildPath(keys) {
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.look), false, 'centripetal');
  const stopKeys = keys.map((k, i) => (k.stop !== undefined ? i : -1)).filter((i) => i >= 0);
  const n = keys.length - 1;
  const out = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30 };
  return (p) => {
    const i = clamp(Math.floor(p), 0, stopKeys.length - 2);
    const f = clamp(p - i, 0, 1);
    const k = stopKeys[i] + (stopKeys[i + 1] - stopKeys[i]) * f; // índice continuo de punto
    const u = k / n;
    posCurve.getPoint(u, out.pos);
    lookCurve.getPoint(u, out.look);
    const k0 = Math.floor(k);
    const k1 = Math.min(n, k0 + 1);
    out.fov = keys[k0].fov + (keys[k1].fov - keys[k0].fov) * (k - k0);
    return out;
  };
}
