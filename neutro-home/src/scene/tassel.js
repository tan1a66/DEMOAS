// Borla: un cuello envuelto (hilo enrollado) + cientos de hebras que caen, algo desordenadas.
// Geometría estática; el balanceo es una transformación rígida + un retraso del fleco
// (uLag) aplicado en el vertex shader.

import * as THREE from 'three';
import { TASSEL, BRAID } from '../config.js';
import { patchTasselMaterial, tasselDepthMaterial } from '../gl/fiberMaterial.js';

const TOP = 0.034; // el cuello cubre el final de la trenza
const BOTTOM = TOP - TASSEL.collarHeight;
export const TASSEL_PIVOT = BOTTOM;
export const TASSEL_TOP = TOP;

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTasselGeometry(side, seed) {
  const rnd = mulberry(seed);
  const P = [];
  const N = [];
  const T = [];
  const UV = [];
  const F = [];
  const PART = [];
  const I = [];
  const flowAt = (t) => (side < 0 ? -0.015 - 0.16 * t : 1.015 + 0.16 * t);
  const depthScale = 0.86;

  // ---------------- cuello
  const rc = TASSEL.collarRadius;
  const segA = 36;
  const segY = 66;
  const base = 0;
  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    const y = TOP - v * TASSEL.collarHeight;
    // perfil: bordes redondeados, ligero abombado
    const edge = Math.min(v, 1 - v);
    const lip = Math.sqrt(Math.min(1, edge / 0.12));
    const wrap = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 11);
    const r = rc * (0.84 + 0.16 * lip) * (1 + 0.035 * Math.sin(v * Math.PI)) * (1 + 0.022 * wrap * lip);
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      P.push(r * ca, y, r * sa * depthScale);
      const ny = v < 0.12 ? 0.9 * (1 - v / 0.12) : v > 0.88 ? -0.9 * ((v - 0.88) / 0.12) : 0;
      const n = new THREE.Vector3(ca, ny, sa / depthScale).normalize();
      N.push(n.x, n.y, n.z);
      T.push(-sa, 0, ca * depthScale, -1);
      UV.push((i / segA) * ((2 * Math.PI * rc) / BRAID.uvRepeat), y / 0.11);
      const ao = (0.72 + 0.28 * lip) * (v < 0.2 ? 0.85 + 0.75 * v : 1) * (0.84 + 0.16 * wrap);
      F.push(0, flowAt(0), 0.97, ao);
      PART.push(0);
    }
  }
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segA; i++) {
      const a = base + j * (segA + 1) + i;
      const b = a + 1;
      const c = a + segA + 1;
      const d = c + 1;
      I.push(a, b, c, b, d, c);
    }
  }

  // ---------------- hebras
  const sides = 3;
  const segs = 6;
  const L0 = TASSEL.fiberLength;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const tng = new THREE.Vector3();
  const startY = BOTTOM + 0.014;
  for (let f = 0; f < TASSEL.fibers; f++) {
    const ang = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd());
    const r0 = rc * 0.9 * rr;
    const len = L0 * (0.9 + 0.14 * rnd()) * (1 - 0.06 * (1 - rr));
    const flare = 1.32 + 0.3 * rnd();
    const swirl = (rnd() - 0.5) * 0.35;
    const thick = TASSEL.fiberRadius * (0.75 + 0.6 * rnd());
    const tint = 0.86 + 0.2 * rnd();
    const jx = (rnd() - 0.5) * 0.012;
    const jz = (rnd() - 0.5) * 0.012;
    const start = new THREE.Vector3(Math.cos(ang) * r0, startY, Math.sin(ang) * r0 * depthScale);
    const a1 = ang + swirl;
    const r1 = r0 * flare + 0.006 * rnd();
    const end = new THREE.Vector3(Math.cos(a1) * r1 + jx, startY - len, Math.sin(a1) * r1 * depthScale + jz);
    const mid = start.clone().lerp(end, 0.45);
    mid.x += Math.cos(ang) * 0.004 + (rnd() - 0.5) * 0.006;
    mid.z += (Math.sin(ang) * 0.004 + (rnd() - 0.5) * 0.006) * depthScale;
    const vb = P.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // bezier cuadrática start → mid → end
      const q0 = tmpA.copy(start).lerp(mid, t);
      const q1 = tmpB.copy(mid).lerp(end, t);
      const c = tmpC.copy(q0).lerp(q1, t);
      tng.copy(q1).sub(q0).normalize();
      e2.set(0, 0, 1).addScaledVector(tng, -tng.z).normalize();
      e1.crossVectors(e2, tng);
      const rad = thick * (1 - 0.45 * t);
      for (let k = 0; k < sides; k++) {
        const th = (k / sides) * Math.PI * 2 + f;
        const cx = Math.cos(th);
        const sx = Math.sin(th);
        const nx = e1.x * cx + e2.x * sx;
        const ny = e1.y * cx + e2.y * sx;
        const nz = e1.z * cx + e2.z * sx;
        P.push(c.x + nx * rad, c.y + ny * rad, c.z + nz * rad);
        N.push(nx, ny, nz);
        T.push(tng.x, tng.y, tng.z, -1);
        UV.push((t * len) / BRAID.uvRepeat + f * 0.13, k / sides + rnd() * 0.02);
        const ao = (0.5 + 0.5 * rr) * (0.62 + 0.38 * Math.min(1, t / 0.22));
        F.push(t, flowAt(t), tint, ao);
        PART.push(1);
      }
    }
    for (let s = 0; s < segs; s++) {
      for (let k = 0; k < sides; k++) {
        const a = vb + s * sides + k;
        const b = vb + s * sides + ((k + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        I.push(a, b, c, b, d, c);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('tangent', new THREE.Float32BufferAttribute(T, 4));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('aFiber', new THREE.Float32BufferAttribute(F, 4));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(PART, 1));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

export class Tassel {
  constructor(side, { dye, textures, envIntensity = 1 }) {
    this.side = side;
    // uWrap: el cuello se enrolla de arriba abajo; uDrop: el fleco cae desde el cuello (cierre)
    this.uniforms = { uLag: { value: 0 }, uPivot: { value: TASSEL_PIVOT }, uWrap: { value: 1 }, uDrop: { value: 1 } };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.fiberAlbedo,
      normalMap: textures.fiberNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.76,
      sheen: 1,
      sheenColor: 0xffffff,
      sheenRoughness: 0.45,
      specularIntensity: 0.3,
      envMapIntensity: envIntensity,
    });
    patchTasselMaterial(mat, this.uniforms, dye);
    this.mesh = new THREE.Mesh(buildTasselGeometry(side, side < 0 ? 7 : 19), mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = tasselDepthMaterial(this.uniforms);
    this.mesh.frustumCulled = false;
  }

  // end: extremo de la trenza { x, y, dx, dy } (dirección hacia fuera); lag en radianes.
  place(end, z, lag) {
    this.mesh.position.set(end.x, end.y, z);
    this.mesh.rotation.z = Math.atan2(end.dx, -end.dy);
    this.uniforms.uLag.value = lag;
  }
}
