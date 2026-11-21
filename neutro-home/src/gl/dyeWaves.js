// Tinte en ondas: cada color nuevo entra por un extremo de la pieza y la recorre despacio; si
// llega otro antes de que el anterior termine, conviven (hasta tres ondas a la vez). Así los
// cambios pueden ser frecuentes sin dejar de ser lentos.
//
// En el shader, x es la posición a lo largo del flujo (0 → 1): la trenza de borla a borla, los
// flecos de arriba abajo. Cada onda i tiene su color y su frente; por detrás del frente, su color.

import * as THREE from 'three';

const N = 3;
const SHEEN_WHITE = new THREE.Color('#fff1dc');
const START = -0.3;
const END = 1.35;

export function sheenOf(target, color) {
  return target.copy(color).lerp(SHEEN_WHITE, 0.42).multiplyScalar(0.95);
}

export function waveUniforms(hex, { sheen = false, edge = 0.12 } = {}) {
  const c = new THREE.Color(hex);
  const u = {
    uDyeBase: { value: c.clone() },
    uDyeCol: { value: Array.from({ length: N }, () => c.clone()) },
    uDyeFront: { value: Array.from({ length: N }, () => -1) },
    uEdge: { value: edge },
  };
  if (sheen) {
    u.uDyeBaseSheen = { value: sheenOf(new THREE.Color(), c) };
    u.uDyeSheen = { value: Array.from({ length: N }, () => sheenOf(new THREE.Color(), c)) };
  }
  return u;
}

export const WAVE_GLSL = /* glsl */ `
uniform vec3 uDyeBase;
uniform vec3 uDyeCol[${N}];
uniform float uDyeFront[${N}];
uniform float uEdge;
float waveK(float f, float x) { return 1.0 - smoothstep(f - uEdge, f + uEdge, x); }
vec3 waveColor(float x) {
  vec3 c = uDyeBase;
  for (int i = 0; i < ${N}; i++) c = mix(c, uDyeCol[i], waveK(uDyeFront[i], x));
  return c;
}
`;

export const WAVE_SHEEN_GLSL = /* glsl */ `
uniform vec3 uDyeBaseSheen;
uniform vec3 uDyeSheen[${N}];
vec3 waveSheen(float x) {
  vec3 c = uDyeBaseSheen;
  for (int i = 0; i < ${N}; i++) c = mix(c, uDyeSheen[i], waveK(uDyeFront[i], x));
  return c;
}
// el borde de cada onda, un poco "mojado" (el tinte está entrando)
float waveWet(float x) {
  float w = 0.0;
  for (int i = 0; i < ${N}; i++) {
    float f = uDyeFront[i];
    w += step(-0.9, f) * exp(-pow((x - f) / (uEdge * 1.5), 2.0));
  }
  return min(w, 1.0);
}
`;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * targets: conjuntos de uniforms (de waveUniforms) que comparten las mismas ondas.
 * solids: materiales de un solo color que cambian cuando la onda pasa por su posición
 *         [{ material, pos, factor?, sheen? }].
 */
export class DyeWaves {
  constructor(targets, { duration = 3, solids = [] } = {}) {
    this.targets = Array.isArray(targets) ? targets : [targets];
    this.duration = duration;
    this.solids = solids;
    this.edge = this.targets[0].uEdge.value;
    this.base = this.targets[0].uDyeBase.value.clone();
    this.waves = [];
  }

  front(t) {
    const e = 0.5 * (t + t * t * (3 - 2 * t)); // casi constante, con un arranque suave
    return START + (END - START) * e;
  }

  push(hex) {
    if (this.waves.length >= N) this.base.copy(this.waves.shift().color);
    this.waves.push({ color: new THREE.Color(hex), t: 0 });
    this.write();
  }

  colorAt(x, out) {
    out.copy(this.base);
    for (const w of this.waves) {
      const f = this.front(w.t);
      out.lerp(w.color, 1 - smooth(f - this.edge, f + this.edge, x));
    }
    return out;
  }

  step(dt) {
    if (!this.waves.length) return false;
    for (const w of this.waves) w.t = Math.min(1, w.t + dt / this.duration);
    while (this.waves.length && this.waves[0].t >= 1) this.base.copy(this.waves.shift().color);
    this.write();
    return true;
  }

  write() {
    for (const u of this.targets) {
      u.uDyeBase.value.copy(this.base);
      if (u.uDyeBaseSheen) sheenOf(u.uDyeBaseSheen.value, this.base);
      for (let i = 0; i < N; i++) {
        const w = this.waves[i];
        if (w) {
          u.uDyeCol.value[i].copy(w.color);
          u.uDyeFront.value[i] = this.front(w.t);
          if (u.uDyeSheen) sheenOf(u.uDyeSheen.value[i], w.color);
        } else u.uDyeFront.value[i] = -1;
      }
    }
    for (const s of this.solids) {
      this.colorAt(s.pos, s.material.color).multiplyScalar(s.factor ?? 1);
      if (s.sheen) s.material.sheenColor.copy(s.material.color).lerp(SHEEN_WHITE, 0.45);
    }
  }
}
