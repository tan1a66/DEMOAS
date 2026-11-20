// El recorrido: una sola cámara que viaja por la casa siguiendo el desplazamiento, sin paradas.
// "p" es continuo (0 = trenza, 1 = Makech, 2 = Xux); el gesto mueve un objetivo y un muelle
// lleva la cámara hacia él con suavidad (y con inercia al soltar).

import * as THREE from 'three';
import { Spring, clamp } from './model/spring.js';

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

  // progreso entre piezas (0 = trenza, 1 = Makech, 2 = Xux)
  get p() {
    return Math.max(0, this.spring.x - this.intro);
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
