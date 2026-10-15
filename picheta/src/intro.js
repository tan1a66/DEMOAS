// La película de entrada: "Abajo, el fuego. Arriba, Mérida."
// La cámara empieza en la cocina, frente al fogón del patio; sigue las brasas hacia arriba
// entre los portales, sale al cielo y se sienta en la terraza frente a la plaza.
//
// Cada keyframe: t (segundos), posición, inclinación (pitch, grados; + mira arriba) y giro (yaw).
// Para retocar la toma basta con mover estos números.

import * as THREE from 'three';

export const INTRO_KEYS = [
  { t: 0.0, p: [0.5, -7.7, 12.6], pitch: -9, yaw: 3 }, // cocina: el fuego al fondo, la barra delante
  { t: 1.6, p: [0.35, -7.5, 11.4], pitch: -4, yaw: 1.5 }, // nos acercamos despacio
  { t: 2.8, p: [0.2, -6.3, 10.6], pitch: 13, yaw: 0 }, // empezamos a subir con las brasas
  { t: 3.9, p: [0.1, -3.5, 10.2], pitch: 24, yaw: 0 }, // la planta alta: farolitos y buganvilias
  { t: 4.8, p: [0.0, -0.4, 9.6], pitch: 20, yaw: 0 }, // la cornisa y el cielo
  { t: 5.6, p: [0.0, 2.3, 8.0], pitch: 8, yaw: 0 }, // fuera: aparece la plaza tras la terraza
  { t: 6.5, p: [0.0, 2.0, 4.4], pitch: 4, yaw: 0 }, // planeo sobre la terraza
  { t: 7.6, p: [0.0, 1.22, 1.0], pitch: null, yaw: 0 }, // sentados (pitch = encuadre final)
];
export const INTRO_END = INTRO_KEYS[INTRO_KEYS.length - 1].t;

// Momentos de la coreografía de textos.
export const STAGES = { fire: 0.5, sky: 5.0, done: 6.7 };

// Al bajar con el scroll, la cámara vuelve a asomarse al patio: abajo, el fuego.
export const SCROLL_KEYS = [
  { t: 0, p: [0.0, 1.22, 1.0], pitch: null, yaw: 0 },
  { t: 0.25, p: [0.0, 2.2, 3.0], pitch: -24, yaw: 0 },
  { t: 0.55, p: [0.0, 4.6, 10.2], pitch: -84, yaw: 0 }, // sobre el patio: el fogón arriba en pantalla
  { t: 1, p: [0.0, 3.8, 10.0], pitch: -86, yaw: 0 },
];

/**
 * Spline de Hermite en el tiempo: la velocidad es continua entre keyframes
 * (tangentes por diferencias centradas) y nula al principio y al final.
 */
export class TimeSpline {
  constructor(keys, get) {
    this.t = keys.map((k) => k.t);
    this.v = keys.map(get);
    const n = keys.length;
    this.m = this.v.map((_, i) => {
      if (i === 0 || i === n - 1) return this.zero(this.v[i]);
      return this.scale(this.sub(this.v[i + 1], this.v[i - 1]), 1 / (this.t[i + 1] - this.t[i - 1]));
    });
  }
  zero(v) {
    return typeof v === 'number' ? 0 : new THREE.Vector3();
  }
  sub(a, b) {
    return typeof a === 'number' ? a - b : a.clone().sub(b);
  }
  scale(a, s) {
    return typeof a === 'number' ? a * s : a.clone().multiplyScalar(s);
  }
  /** Valor en el instante `time` (se satura en los extremos). */
  at(time, out) {
    const { t, v, m } = this;
    const n = t.length;
    if (time <= t[0]) return typeof v[0] === 'number' ? v[0] : out.copy(v[0]);
    if (time >= t[n - 1]) return typeof v[n - 1] === 'number' ? v[n - 1] : out.copy(v[n - 1]);
    let i = 0;
    while (time > t[i + 1]) i++;
    const dt = t[i + 1] - t[i];
    const s = (time - t[i]) / dt;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    if (typeof v[i] === 'number') return h00 * v[i] + h10 * dt * m[i] + h01 * v[i + 1] + h11 * dt * m[i + 1];
    return out
      .copy(v[i])
      .multiplyScalar(h00)
      .addScaledVector(m[i], h10 * dt)
      .addScaledVector(v[i + 1], h01)
      .addScaledVector(m[i + 1], h11 * dt);
  }
}

/** Trayectoria completa (posición + pitch + yaw) a partir de keyframes. */
export function makePath(keys, finalPitch) {
  const withPitch = keys.map((k) => ({ ...k, pitch: k.pitch ?? finalPitch }));
  return {
    pos: new TimeSpline(withPitch, (k) => new THREE.Vector3(...k.p)),
    pitch: new TimeSpline(withPitch, (k) => k.pitch),
    yaw: new TimeSpline(withPitch, (k) => k.yaw),
  };
}
