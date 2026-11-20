// Flecos: cientos de hilos (prismas de 3 caras) en una sola geometría estática.
// Todo el movimiento ocurre en el vertex shader:
//  · balanceo del conjunto (dos ángulos, el punto de giro arriba),
//  · el dedo aparta los hilos a su paso (uPush: punto local + fuerza),
//  · una brisa mínima, distinta para cada hilo.
// Cada objeto con flecos tiene su propio muelle de balanceo (FringeSwing).

import * as THREE from 'three';
import { Spring } from '../model/spring.js';

const FRINGE_PARS = /* glsl */ `
attribute vec4 aFr; // (t a lo largo del hilo, tono, oclusión, semilla)
uniform vec3 uPivot;
uniform vec2 uSwing;   // (giro alrededor de z, giro alrededor de x)
uniform vec4 uPush;    // (punto local xyz, fuerza)
uniform float uPushR;
uniform float uTime;
uniform float uBreeze;
uniform float uHang;   // longitud típica de los hilos (para el peso del balanceo)
varying float vAO;
varying float vTint;
varying float vT;
vec3 frRotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec3 frRotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 fringeDisplace(vec3 p, float t, float seed) {
  float w = pow(t, 1.35);
  // el dedo aparta los hilos (sobre todo la parte libre)
  vec3 d = p - uPush.xyz;
  float dist = length(d.xz);
  float fall = uPush.w * w * exp(-pow(dist / uPushR, 2.0)) * smoothstep(uPushR * 2.2, 0.0, abs(d.y));
  vec2 dir = dist > 1e-4 ? d.xz / dist : vec2(1.0, 0.0);
  p.xz += dir * fall * uPushR * 0.9;
  // brisa
  p.x += uBreeze * w * 0.006 * sin(uTime * 1.3 + seed * 6.2831 + p.y * 3.0);
  p.z += uBreeze * w * 0.004 * sin(uTime * 1.1 + seed * 4.1 + p.y * 2.0);
  // balanceo del conjunto, con más amplitud en las puntas
  vec3 q = p - uPivot;
  float k = 0.4 + 0.6 * w;
  q = frRotZ(q, uSwing.x * k);
  q = frRotX(q, uSwing.y * k);
  return q + uPivot;
}
`;

export function fringeUniforms({ pivot, hang, pushR = 0.12 }) {
  return {
    uPivot: { value: pivot.clone() },
    uSwing: { value: new THREE.Vector2() },
    uPush: { value: new THREE.Vector4(0, -100, 0, 0) },
    uPushR: { value: pushR },
    uTime: { value: 0 },
    uBreeze: { value: 1 },
    uHang: { value: hang },
    // tinte: el color nuevo baja por los hilos (de arriba abajo)
    uColA: { value: new THREE.Color() },
    uColB: { value: new THREE.Color() },
    uDyeFront: { value: 2 },
  };
}

export function fringeMaterial(uniforms, { color, roughness = 0.72, sheen = 1, sheenColor, emissive }) {
  uniforms.uColA.value.set(color);
  uniforms.uColB.value.set(color);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness,
    sheen,
    sheenColor: sheenColor || new THREE.Color('#fff1dc').multiplyScalar(0.75),
    sheenRoughness: 0.4,
    specularIntensity: 0.3,
    emissive: emissive || 0x000000,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FRINGE_PARS}`)
      .replace(
        '#include <begin_vertex>',
        'vec3 transformed = fringeDisplace(vec3(position), aFr.x, aFr.w);\nvAO = aFr.z; vTint = aFr.y; vT = aFr.x;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAO;\nvarying float vTint;\nvarying float vT;\nuniform vec3 uColA;\nuniform vec3 uColB;\nuniform float uDyeFront;')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\nvec3 dyeC = mix(uColB, uColA, smoothstep(uDyeFront - 0.14, uDyeFront + 0.14, vT));\ndiffuseColor.rgb *= dyeC * vTint * vAO;'
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor *= mix(dyeC, vec3(1.0), 0.45) * (0.4 + 0.6 * vAO);\n#endif'
      );
  };
  mat.customProgramCacheKey = () => 'fringe';
  return mat;
}

export function fringeDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FRINGE_PARS}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = fringeDisplace(vec3(position), aFr.x, aFr.w);');
  };
  m.customProgramCacheKey = () => 'fringe-depth';
  return m;
}

/**
 * threads: [{ pts: Vector3[] (de arriba abajo), r0, r1, tint, ao0, ao1 }]
 * Devuelve una BufferGeometry con prismas triangulares a lo largo de cada hilo.
 */
export function fringeGeometry(threads, seedBase = 0) {
  const sides = 3;
  let verts = 0;
  let tris = 0;
  for (const th of threads) {
    verts += th.pts.length * sides;
    tris += (th.pts.length - 1) * sides * 2;
  }
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const fr = new Float32Array(verts * 4);
  const idx = new Uint32Array(tris * 3);
  const T = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const X = new THREE.Vector3(1, 0, 0);
  let v = 0;
  let q = 0;
  threads.forEach((th, n) => {
    const P = th.pts;
    const m = P.length;
    const base = v;
    const seed = ((n * 0.6180339 + seedBase) % 1 + 1) % 1;
    const rot = seed * Math.PI * 2;
    for (let i = 0; i < m; i++) {
      const a = P[Math.max(0, i - 1)];
      const b = P[Math.min(m - 1, i + 1)];
      T.subVectors(b, a).normalize();
      const ref = Math.abs(T.z) < 0.9 ? Z : X;
      e2.copy(ref).addScaledVector(T, -T.dot(ref)).normalize();
      e1.crossVectors(e2, T);
      const t = i / (m - 1);
      const r = th.r0 + (th.r1 - th.r0) * t;
      const ao = th.ao0 + (th.ao1 - th.ao0) * t;
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2 + rot;
        const cx = Math.cos(ang);
        const sx = Math.sin(ang);
        const nx = e1.x * cx + e2.x * sx;
        const ny = e1.y * cx + e2.y * sx;
        const nz = e1.z * cx + e2.z * sx;
        pos[v * 3] = P[i].x + nx * r;
        pos[v * 3 + 1] = P[i].y + ny * r;
        pos[v * 3 + 2] = P[i].z + nz * r;
        nrm[v * 3] = nx;
        nrm[v * 3 + 1] = ny;
        nrm[v * 3 + 2] = nz;
        fr[v * 4] = t;
        fr[v * 4 + 1] = th.tint;
        fr[v * 4 + 2] = ao;
        fr[v * 4 + 3] = seed;
        v++;
      }
    }
    for (let i = 0; i < m - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const a = base + i * sides + k;
        const b = base + i * sides + ((k + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = d;
        idx[q++] = c;
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aFr', new THREE.BufferAttribute(fr, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Tinte que baja por los hilos (y materiales sólidos que cambian a la vez).
export class FringeDye {
  constructor(uniformList, solids = []) {
    this.us = uniformList;
    this.solids = solids; // [{ material, factor }]
    this.t = 1;
    this.from = [];
    this.to = new THREE.Color();
  }

  set(hexList) {
    // hexList: un color para todo, o una lista (un color por juego de uniforms / sólido)
    const pick = (i) => (Array.isArray(hexList) ? hexList[i % hexList.length] : hexList);
    this.us.forEach((u, i) => {
      if (this.t < 1) u.uColA.value.copy(u.uColB.value); // si estaba a medias, parte del destino
      u.uDyeFront.value = -0.25;
      u.uColB.value.set(pick(i));
    });
    this.from = this.solids.map((s) => s.material.color.clone());
    this.targets = this.solids.map((s) => new THREE.Color(pick(s.index || 0)).multiplyScalar(s.factor || 1));
    this.t = 0;
  }

  step(dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / 1.1);
    const e = this.t < 0.5 ? 4 * this.t ** 3 : 1 - (-2 * this.t + 2) ** 3 / 2;
    for (const u of this.us) u.uDyeFront.value = -0.25 + 1.5 * e;
    this.solids.forEach((s, i) => s.material.color.copy(this.from[i]).lerp(this.targets[i], e));
    if (this.t >= 1) {
      for (const u of this.us) {
        u.uColA.value.copy(u.uColB.value);
        u.uDyeFront.value = 2;
      }
    }
    return true;
  }
}

// Balanceo del conjunto + dedo. Péndulo lento y pesado (flecos de algodón).
export class FringeSwing {
  constructor(uniforms, { omega = 2.6, zeta = 0.16 } = {}) {
    this.u = uniforms;
    this.sx = new Spring(0, omega, zeta);
    this.sz = new Spring(0, omega * 1.07, zeta);
    this.push = 0;
    this.pushTarget = 0;
    this.active = false;
  }

  // impulso (por ejemplo, el aire que mueve la cámara al pasar o el gesto del dedo)
  kick(vx, vz) {
    this.sx.v += vx;
    this.sz.v += vz;
    this.active = true;
  }

  touch(localPoint, strength) {
    this.u.uPush.value.set(localPoint.x, localPoint.y, localPoint.z, this.u.uPush.value.w);
    this.pushTarget = strength;
    this.active = true;
  }

  release() {
    this.pushTarget = 0;
    this.active = true;
  }

  step(dt, time) {
    this.u.uTime.value = time;
    if (!this.active) return false;
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < 4; i++) {
      this.sx.step(h / 4);
      this.sz.step(h / 4);
    }
    this.sx.x = Math.max(-0.5, Math.min(0.5, this.sx.x));
    this.sz.x = Math.max(-0.5, Math.min(0.5, this.sz.x));
    this.push += (this.pushTarget - this.push) * (1 - Math.exp(-dt * (this.pushTarget > this.push ? 14 : 4)));
    this.u.uSwing.value.set(this.sx.x, this.sz.x);
    this.u.uPush.value.w = this.push;
    this.active = !(this.sx.resting && this.sz.resting && this.push < 0.002 && this.pushTarget === 0);
    return true;
  }
}
