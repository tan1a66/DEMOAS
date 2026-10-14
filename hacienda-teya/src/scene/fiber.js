// ─────────────────────────────────────────────────────────────────────────────
//  Filo di henequén: materiale, tubo dinamico e corda simulata
//
//  - createFiberMaterial: crema, tre capi ritorti con rilievo e fibre; in modalità
//    "stitches" i punti seguono il vento del lino, compaiono al momento giusto e
//    si assestano (il filo tirato si stende sul tessuto)
//  - DynamicTube: tubo ricostruito ogni fotogramma lungo una polilinea
//  - Rope: filo libero con gravità e vento (Verlet), tra due estremi in moto
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { WAVE_GLSL, RAKE_GLSL } from './fabric.js';

const FIBER_PARS = /* glsl */ `
  uniform float uTwist; uniform float uBump;
  varying vec2 vFiberUv;
  float fh21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float fvn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fh21(i), fh21(i + vec2(1, 0)), f.x), mix(fh21(i + vec2(0, 1)), fh21(i + vec2(1, 1)), f.x), f.y); }
  // tre capi ritorti + fibre lungo l'elica (sfumano se più piccoli di un pixel)
  float fiberHeight(vec2 uv) {
    float helix = uv.y * 3.0 + uv.x * uTwist;
    float fw = fwidth(helix);
    float ply = mix(0.5 + 0.5 * cos(helix * 6.2831853), 0.5, smoothstep(0.18, 0.45, fw));
    float strands = mix(fvn(vec2(helix * 9.0, uv.x * 26.0)), 0.5, smoothstep(0.03, 0.08, fw));
    return ply * 0.8 + strands * 0.35;
  }
`;

const STITCH_VERT_PARS = /* glsl */ `
  attribute float aReveal; // istante in cui il punto è tirato e compare
  attribute float aArch;   // 0 ai fori → 1 al centro del punto
  uniform float uIntroTime; uniform float uWindTime; uniform float uEm; uniform vec4 uPoke; uniform float uArchAmp;
  ${WAVE_GLSL}
`;
// il punto appena tirato è ancora un'asola morbida, poi si stende sul lino
const STITCH_VERT = /* glsl */ `
  float age = uIntroTime - aReveal;
  if (age < 0.0) {
    transformed = vec3(0.0); // non ancora cucito: triangoli degeneri, invisibili
  } else {
    transformed.z += aArch * uArchAmp * exp(-age * 16.0);
    transformed.z += fabricWave(position.xy / uEm, uWindTime) * uEm + fabricPoke(position.xy, uPoke);
  }
`;

export function createFiberMaterial({ stitches = false, uniforms }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#efe4c6',
    roughness: 0.55,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#fff0cc'),
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vFiberUv;\n${stitches ? STITCH_VERT_PARS : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFiberUv = uv;\n${stitches ? STITCH_VERT : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FIBER_PARS}\n${RAKE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fh = fiberHeight(vFiberUv);
        float fibK = vFiberUv.y * 3.0 + vFiberUv.x * uTwist;
        float fib = mix(fvn(vec2(fibK * 14.0, vFiberUv.x * 90.0)), 0.5, smoothstep(0.02, 0.06, fwidth(fibK)));
        diffuseColor.rgb *= mix(0.8, 1.05, fh) * (0.94 + 0.1 * fib);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.04, 0.97, 0.86), fib * 0.25);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition); vec3 dpy = dFdy(-vViewPosition);
          float hx = dFdx(fh); float hy = dFdy(fh);
          vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - uBump * grad);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rakeLight(normal, diffuseColor.rgb, 16.0, 0.1);',
      );
  };
  // due varianti dello stesso materiale → chiavi di programma diverse
  mat.customProgramCacheKey = () => (stitches ? 'fiber-stitches' : 'fiber-rope');
  return mat;
}

// ombre dei punti: stessa comparsa e stesso vento del materiale
export function createStitchDepthMaterial(uniforms) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${STITCH_VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${STITCH_VERT}`);
  };
  mat.customProgramCacheKey = () => 'fiber-stitches-depth';
  return mat;
}

// ── Frame a trasporto parallelo lungo una polilinea ─────────────────────────
const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * Riempie gli array di un tubo lungo pts.
 * @returns numero di vertici scritti
 */
export function writeTube(pts, count, radiusAt, radial, pos, nor, uv, offset = 0, uOffset = 0, refUp = null) {
  let v = offset;
  let s = uOffset;
  let prevN = null;
  for (let i = 0; i < count; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(count - 1, i + 1)];
    _t.subVectors(b, a).normalize();
    if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
    if (!prevN) {
      _n.copy(refUp || (Math.abs(_t.y) < 0.9 ? _tmp.set(0, 1, 0) : _tmp.set(1, 0, 0)));
      _n.addScaledVector(_t, -_n.dot(_t)).normalize();
      prevN = new THREE.Vector3().copy(_n);
    } else {
      _n.copy(prevN).addScaledVector(_t, -prevN.dot(_t));
      if (_n.lengthSq() < 1e-10) _n.copy(prevN);
      _n.normalize();
      prevN.copy(_n);
    }
    _b.crossVectors(_t, _n);
    const r = radiusAt(i);
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const nx = c * _n.x + sn * _b.x;
      const ny = c * _n.y + sn * _b.y;
      const nz = c * _n.z + sn * _b.z;
      pos[v * 3] = pts[i].x + r * nx;
      pos[v * 3 + 1] = pts[i].y + r * ny;
      pos[v * 3 + 2] = pts[i].z + r * nz;
      nor[v * 3] = nx;
      nor[v * 3 + 1] = ny;
      nor[v * 3 + 2] = nz;
      uv[v * 2] = s;
      uv[v * 2 + 1] = j / radial;
      v++;
    }
  }
  return v - offset;
}

export function tubeIndex(rings, radial, offset = 0, out = []) {
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = offset + i * (radial + 1) + j;
      const b = a + radial + 1;
      out.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return out;
}

// ── Tubo dinamico (filo libero) ──────────────────────────────────────────────
export class DynamicTube {
  constructor(maxPoints, radial, material) {
    this.max = maxPoints;
    this.radial = radial;
    const verts = maxPoints * (radial + 1);
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.uv = new Float32Array(verts * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(tubeIndex(maxPoints, radial));
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.visible = false;
  }

  /** pts: Vector3[] in coordinate mondo; radiusAt(i) */
  update(pts, radiusAt) {
    const n = Math.min(pts.length, this.max);
    if (n < 2) {
      this.mesh.visible = false;
      return;
    }
    writeTube(pts, n, radiusAt, this.radial, this.pos, this.nor, this.uv);
    this.geometry.setDrawRange(0, (n - 1) * this.radial * 6);
    for (const k of ['position', 'normal', 'uv']) this.geometry.attributes[k].needsUpdate = true;
    this.mesh.visible = true;
  }
}

// ── Corda (Verlet): estremi vincolati, gravità, vento, lunghezza fissata ──────
const GRAVITY = new THREE.Vector3(0, -6.5, 0);
const _d = new THREE.Vector3();

export class Rope {
  constructor(n) {
    this.n = n;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.q = Array.from({ length: n }, () => new THREE.Vector3());
    this.ready = false;
  }

  reset(a, b) {
    for (let i = 0; i < this.n; i++) {
      this.p[i].lerpVectors(a, b, i / (this.n - 1));
      this.q[i].copy(this.p[i]);
    }
    this.ready = true;
  }

  /**
   * @param a,b     estremi (mondo)
   * @param length  lunghezza totale del filo
   * @param dt      passo (s)
   * @param wind    vettore di vento (accelerazione)
   */
  step(a, b, length, dt, wind) {
    if (!this.ready) this.reset(a, b);
    const n = this.n;
    const h = Math.min(dt, 1 / 30);
    // integrazione Verlet con smorzamento
    for (let i = 1; i < n - 1; i++) {
      const p = this.p[i];
      _d.subVectors(p, this.q[i]).multiplyScalar(0.94);
      this.q[i].copy(p);
      p.add(_d).addScaledVector(GRAVITY, h * h);
      if (wind) p.addScaledVector(wind, h * h * (0.7 + 0.3 * Math.sin(i * 0.9)));
    }
    this.p[0].copy(a);
    this.p[n - 1].copy(b);
    // vincoli di lunghezza
    const rest = length / (n - 1);
    for (let it = 0; it < 14; it++) {
      for (let i = 0; i < n - 1; i++) {
        const p1 = this.p[i];
        const p2 = this.p[i + 1];
        _d.subVectors(p2, p1);
        const dist = _d.length() || 1e-6;
        const diff = (dist - rest) / dist;
        const w1 = i === 0 ? 0 : 0.5;
        const w2 = i + 1 === n - 1 ? 0 : 0.5;
        const k = w1 + w2 || 1;
        p1.addScaledVector(_d, (diff * w1) / k);
        p2.addScaledVector(_d, (-diff * w2) / k);
      }
      this.p[0].copy(a);
      this.p[n - 1].copy(b);
    }
    return this.p;
  }
}
