// Palmas del patio: tronco anillado algo inclinado y una corona de hojas pinnadas (raquis que se
// arquea y foliolos que cuelgan). Todo en una sola geometría por palmera; la brisa mueve las hojas
// en el vertex shader (con el mismo reloj que las sombras de hojas del muro).

import * as THREE from 'three';
import { sunlight } from '../gl/sunlight.js';
import { patchSunlight } from '../gl/sunlight.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const WIND = /* glsl */ `
attribute vec3 aWind; // (peso en la hoja, fase, peso del foliolo)
uniform float uTime;
vec3 palmWind(vec3 p) {
  float t = uTime;
  float sway = sin(t * 0.7 + aWind.y) * 0.6 + sin(t * 1.3 + aWind.y * 2.3) * 0.4;
  p.x += sway * 0.06 * aWind.x;
  p.y += (sin(t * 0.9 + aWind.y * 1.7) - 0.4) * 0.035 * aWind.x;
  p.z += sin(t * 0.8 + aWind.y * 0.7) * 0.04 * aWind.x;
  p.y += sin(t * 3.1 + aWind.y * 9.0 + p.x * 4.0) * 0.012 * aWind.z;
  return p;
}
`;

function frond(P, C, W, I, top, rnd, opts) {
  const { azim, elev, len, droop, tint } = opts;
  const dirH = new THREE.Vector3(Math.cos(azim), 0, Math.sin(azim));
  const side = new THREE.Vector3(-dirH.z, 0, dirH.x);
  const n = 34;
  const rach = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * len;
    const h = s * Math.cos(elev);
    const v = s * Math.sin(elev) - droop * s * s;
    rach.push(top.clone().addScaledVector(dirH, h).add(new THREE.Vector3(0, v, 0)));
  }
  const phase = rnd() * 6.28;
  const green = new THREE.Color(tint);
  for (let i = 2; i < n; i++) {
    const a = rach[i];
    const b = rach[i + 1];
    const t = i / n;
    const tang = b.clone().sub(a).normalize();
    const L = 0.62 * Math.sin(Math.PI * Math.min(1, t * 1.08)) * (0.85 + 0.3 * rnd()) + 0.08;
    const w = 0.035 + 0.015 * rnd();
    for (const sgn of [-1, 1]) {
      // foliolo: sale hacia el lado y cuelga (más cuanto más lejos del tronco)
      const out = side.clone().multiplyScalar(sgn).addScaledVector(tang, 0.35);
      out.y -= 0.35 + 0.5 * t + 0.25 * rnd();
      out.normalize();
      const mid = a.clone().addScaledVector(out, L * 0.5);
      const tip = a.clone().addScaledVector(out, L).add(new THREE.Vector3(0, -L * 0.25 * (0.5 + t), 0));
      const wv = tang.clone().multiplyScalar(w);
      const base = P.length / 3;
      const pts = [a.clone().sub(wv), a.clone().add(wv), mid.clone().sub(wv.clone().multiplyScalar(0.8)), mid.clone().add(wv.clone().multiplyScalar(0.8)), tip];
      const col = green.clone().multiplyScalar(0.8 + 0.35 * rnd());
      pts.forEach((p, k) => {
        P.push(p.x, p.y, p.z);
        const shade = k < 2 ? 0.75 : k < 4 ? 0.95 : 1.05;
        C.push(col.r * shade, col.g * shade, col.b * shade);
        W.push(t, phase, k < 2 ? 0 : k < 4 ? 0.5 : 1);
      });
      I.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
  }
  // raquis: una cinta fina
  const base = P.length / 3;
  for (let i = 0; i <= n; i++) {
    const p = rach[i];
    const t = i / n;
    const ww = 0.022 * (1 - 0.7 * t);
    P.push(p.x - side.x * ww, p.y, p.z - side.z * ww, p.x + side.x * ww, p.y, p.z + side.z * ww);
    const c = green.clone().lerp(new THREE.Color('#8a7a3a'), 0.5);
    C.push(c.r, c.g, c.b, c.r, c.g, c.b);
    W.push(t, phase, 0, t, phase, 0);
    if (i < n) {
      const a = base + i * 2;
      I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
}

function palmGeometry(seed, height, lean) {
  const rnd = rng(seed);
  const P = [];
  const C = [];
  const W = [];
  const I = [];
  // tronco: curva suave, anillos (cicatrices de hojas) en el color
  const leanDir = new THREE.Vector3(Math.cos(lean.a), 0, Math.sin(lean.a));
  const segs = 22;
  const ring = 9;
  const center = (t) =>
    new THREE.Vector3(0, t * height, 0).addScaledVector(leanDir, lean.k * height * t * t);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = center(t);
    const r = 0.17 * (1 - 0.38 * t) * (i === 0 ? 1.25 : 1);
    const band = 0.5 + 0.5 * Math.sin(t * height * 26);
    const col = new THREE.Color('#8d7d68').multiplyScalar(0.78 + 0.22 * band);
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      P.push(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r);
      C.push(col.r, col.g, col.b);
      W.push(0, 0, 0);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      I.push(a, b, a + ring, b, b + ring, a + ring);
    }
  }
  // corona
  const top = center(1).add(new THREE.Vector3(0, 0.05, 0));
  const nf = 15;
  for (let f = 0; f < nf; f++) {
    const old = f >= nf - 4; // hojas bajas, más viejas y amarillentas
    frond(P, C, W, I, top, rnd, {
      azim: (f / nf) * Math.PI * 2 * 2.618 + rnd() * 0.3,
      elev: old ? -0.35 - rnd() * 0.4 : 0.1 + rnd() * 0.75,
      len: 1.7 + rnd() * 0.6,
      droop: 0.22 + rnd() * 0.14,
      tint: old ? '#7f7a3a' : rnd() < 0.5 ? '#3f5d2c' : '#4b6a30',
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(W, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function buildPalms(spots, groundY) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sunlight.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = palmWind(vec3(position));');
  };
  mat.customProgramCacheKey = () => 'palm';
  spots.forEach((s, i) => {
    const m = new THREE.Mesh(palmGeometry(31 + i * 17, s.h, { a: s.lean ?? i * 2.1, k: s.k ?? 0.08 }), mat);
    m.position.set(s.x, groundY, s.z);
    m.rotation.y = i * 1.3;
    group.add(m);
  });
  return group;
}

// Suelo del patio: losas de piedra junto a la galería y, más allá, el jardín.
export function patioGroundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  mat.onBeforeCompile = (shader) => {
    patchSunlight(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
float pgHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pgNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pgHash(i), pgHash(i + vec2(1, 0)), u.x), mix(pgHash(i + vec2(0, 1)), pgHash(i + vec2(1, 1)), u.x), u.y); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec2 q = vWPos.xz;
  // losas grandes de piedra caliza
  vec2 g = q / vec2(0.9, 0.6);
  g.x += floor(g.y) * 0.5;
  vec2 f = fract(g);
  float joint = smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 0.9);
  float tone = 0.88 + 0.12 * pgHash(floor(g));
  vec3 stone = vec3(0.78, 0.7, 0.58) * tone * mix(0.7, 1.0, joint) * (0.9 + 0.1 * pgNoise(q * 3.0));
  // jardín: verde con manchas, algo de tierra
  float n = pgNoise(q * 0.8) * 0.6 + pgNoise(q * 3.3) * 0.4;
  vec3 grass = mix(vec3(0.16, 0.24, 0.08), vec3(0.3, 0.36, 0.13), n);
  grass = mix(grass, vec3(0.42, 0.33, 0.22), smoothstep(0.62, 0.8, pgNoise(q * 0.5 + 7.0)) * 0.6);
  float garden = smoothstep(9.2, 9.6, vWPos.z + 0.3 * pgNoise(q * 1.5));
  diffuseColor.rgb = mix(stone, grass, garden);
}`
      );
  };
  mat.customProgramCacheKey = () => 'patio-ground';
  return mat;
}
