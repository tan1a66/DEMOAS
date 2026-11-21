// El recorrido: una sola cámara que viaja por la casa siguiendo el desplazamiento, sin paradas.
// "p" es continuo (0 = trenza, 1 = Makech, 2 = sala); el gesto mueve un objetivo y un muelle
// lleva la cámara hacia él con suavidad (y con inercia al soltar).

import * as THREE from 'three';
import { Spring, clamp } from './model/spring.js';

const HOLD = 0.22; // fracción del recorrido entre piezas en la que la cámara se queda en cada una

export class Journey {
  /**
   * count: piezas; introSpan: cuánto recorrido ocupa la entrada (la narración también la
   * decide el desplazamiento: si te paras, se para; si vuelves atrás, se deshace).
   *   s ∈ [0, introSpan) → entrada;  s = introSpan + i → pieza i.
   */
  constructor(count, introSpan = 0) {
    this.count = count;
    this.intro = introSpan;
    this.max = introSpan + count - 1;
    this.spring = new Spring(0, 5.5, 1);
  }

  get s() {
    return this.spring.x;
  }

  // progreso entre piezas (0 = trenza, 1 = Makech, 2 = sala, 3 = final). Cada pieza tiene una
  // pausa: alrededor de cada parada, una parte del desplazamiento deja la cámara quieta ante la
  // pieza (llega frenando y arranca despacio), para que dé tiempo a verla y a jugar con ella.
  get p() {
    const raw = Math.max(0, this.spring.x - this.intro);
    const i = Math.min(this.count - 1, Math.floor(raw));
    const x = raw - i;
    if (i >= this.count - 1) return this.count - 1;
    const h = HOLD;
    const u = clamp((x - h) / (1 - 2 * h), 0, 1);
    return i + u * u * u * (u * (u * 6 - 15) + 10);
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
      const raw = s - this.intro;
      if (dir > 0) t = Math.min(t, this.intro + Math.floor(raw + 1e-3) + 1);
      if (dir < 0) t = Math.max(t, this.intro + Math.ceil(raw - 1e-3) - 1);
    }
    if (t >= this.intro - 0.05) {
      const near = Math.round(t - this.intro);
      if (Math.abs(t - this.intro - near) < 0.42) t = this.intro + near;
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
    this.goS(this.intro + clamp(i, 0, this.count - 1));
  }

  next() {
    const t = this.spring.target - this.intro;
    if (t < -1e-3) this.go(0);
    else this.go(Math.floor(t + 1e-3) + 1);
  }

  prev() {
    const t = this.spring.target - this.intro;
    if (t <= 1e-3) this.goS(0);
    else this.go(Math.ceil(t - 1e-3) - 1);
  }

  jump(i) {
    this.spring.set(this.intro + i);
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
