// La trenza: tres cabos que se enrollan alrededor de un eje plano (paralelo al muro).
// La CPU calcula sólo los ejes de los tres cabos (≈ 3 × 640 puntos) y los sube a una
// textura de datos; el vertex shader construye los tubos ovalados, normales y oclusión.
// Sin cambios de forma no se recalcula nada.

import * as THREE from 'three';
import { BRAID } from '../config.js';
import { braidUniforms, patchBraidMaterial, braidDepthMaterial } from '../gl/fiberMaterial.js';
import { smoothstep } from '../model/spring.js';

const ROWS = 8;
const TWO_PI = Math.PI * 2;
const PHASES = [0, TWO_PI / 3, (2 * TWO_PI) / 3];

export class Braid {
  constructor({ radial, dye, textures, envIntensity = 1 }) {
    const N = BRAID.samples;
    this.N = N;
    this.data = new Float32Array(N * ROWS * 4);
    this.tex = new THREE.DataTexture(this.data, N, ROWS, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;

    // Ejes de los cabos (temporal CPU).
    this.sx = [0, 1, 2].map(() => new Float32Array(N));
    this.sy = [0, 1, 2].map(() => new Float32Array(N));
    this.sz = [0, 1, 2].map(() => new Float32Array(N));
    this.sr = [0, 1, 2].map(() => new Float32Array(N));

    this.geometry = buildGeometry(N, radial);
    this.uniforms = braidUniforms(this.tex, BRAID);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.fiberAlbedo,
      normalMap: textures.fiberNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.74,
      sheen: 1,
      sheenColor: 0xffffff,
      sheenRoughness: 0.42,
      specularIntensity: 0.32,
      envMapIntensity: envIntensity,
    });
    patchBraidMaterial(this.material, this.uniforms, dye);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.customDepthMaterial = braidDepthMaterial(this.uniforms);
  }

  /**
   * center: { px, py, tx, ty } (Float32Array N) — eje en el plano del muro.
   * z: distancia al muro. st: función de estructura (ver hungStructure / introStructure).
   */
  update(center, z, st) {
    const { N, data, sx, sy, sz, sr } = this;
    const L = BRAID.length;
    const ds = L / (N - 1);
    const A = BRAID.ampLat;
    const B = BRAID.ampDepth;
    const out = { lat: 0, dep: 0, rad: 0, raw: 0 };

    for (let i = 0; i < N; i++) {
      const s = i * ds;
      const cx = center.px[i];
      const cy = center.py[i];
      // normal en el plano (tangente girada 90°)
      const nx = -center.ty[i];
      const ny = center.tx[i];
      for (let k = 0; k < 3; k++) {
        st(s, k, out);
        sx[k][i] = cx + nx * A * out.lat;
        sy[k][i] = cy + ny * A * out.lat;
        sz[k][i] = z + B * out.dep;
        sr[k][i] = out.rad;
        data[(7 * N + i) * 4 + k] = out.raw;
      }
      const o6 = (6 * N + i) * 4;
      data[o6] = cx;
      data[o6 + 1] = cy;
      data[o6 + 2] = z;
      data[o6 + 3] = s / L;
    }

    const uvScale = 1.12; // los cabos son algo más largos que el eje (recorrido en "8")
    for (let k = 0; k < 3; k++) {
      const X = sx[k];
      const Y = sy[k];
      const Z = sz[k];
      const R = sr[k];
      for (let i = 0; i < N; i++) {
        const a = i > 0 ? i - 1 : i;
        const b = i < N - 1 ? i + 1 : i;
        let tx = X[b] - X[a];
        let ty = Y[b] - Y[a];
        let tz = Z[b] - Z[a];
        const len = Math.hypot(tx, ty, tz) || 1;
        tx /= len;
        ty /= len;
        tz /= len;
        const o0 = ((2 * k) * N + i) * 4;
        const o1 = ((2 * k + 1) * N + i) * 4;
        data[o0] = X[i];
        data[o0 + 1] = Y[i];
        data[o0 + 2] = Z[i];
        data[o0 + 3] = i * ds * uvScale + k * 0.37;
        data[o1] = tx;
        data[o1 + 1] = ty;
        data[o1 + 2] = tz;
        data[o1 + 3] = R[i];
      }
    }
    this.tex.needsUpdate = true;
  }
}

// Trenza colgada: estructura completa, que se estrecha hacia las borlas.
export function hungStructure(phase = 0) {
  const L = BRAID.length;
  const P = BRAID.period;
  const T = BRAID.taperLen;
  return (s, k, o) => {
    const e = Math.min(s, L - s);
    const g = smoothstep(0, T, e);
    const amp = 0.36 + 0.64 * g;
    const t = (TWO_PI * s) / P + phase + PHASES[k];
    o.lat = amp * Math.sin(t);
    o.dep = amp * Math.sin(2 * t);
    o.rad = 0.7 + 0.3 * g;
    o.raw = o.rad;
    return o;
  };
}

/**
 * Entrada: un hilo → muchísimas hebras → tres cabos gruesos → trenza.
 * p = { front, scale, split, loose, spread, sep, bloom, tube, tipEnd }
 *   front  — posición (s) del frente de trenzado; por encima la trenza está hecha.
 *   scale  — grosor global (crece hasta 1).
 *   split  — 0: los tres cabos coinciden (un único eje); 1: tres cabos separados.
 *   loose  — grosor relativo de los cabos sueltos.
 *   spread — cuánto se abren los cabos sueltos por debajo del frente.
 *   sep    — separación fija entre los cabos sueltos (en unidades de ampLat).
 *   bloom  — punto (s) donde el hilo único se abre en hebras (por debajo: hebras).
 *   tube   — 0..1, aparición de los tres cabos gruesos (envuelven las hebras agrupadas).
 *   tipEnd — por debajo de este s los cabos no tienen tubo: las puntas son muchas hebras.
 */
export function introStructure(p) {
  const P = BRAID.period;
  const blend = P * 1.1;
  return (s, k, o) => {
    const above = smoothstep(p.front, p.front + blend, s);
    const below = Math.max(0, p.front - s);
    const sp = p.split;
    // por encima del frente: trenzado
    const tB = (TWO_PI * s) / P + PHASES[k];
    // por debajo: los tres cabos cuelgan quietos, a la misma distancia entre sí
    const tL = PHASES[k];
    const looseAmp = p.scale * (1 + p.spread * smoothstep(0, 0.35, below)) + p.sep;
    const latL = Math.sin(tL) * looseAmp;
    const depL = Math.sin(2 * tL) * 0.6 * p.scale;
    o.lat = (latL + (Math.sin(tB) * p.scale - latL) * above) * sp;
    o.dep = (depL + (Math.sin(2 * tB) * p.scale - depL) * above) * sp;
    const rad = (p.loose + (1 - p.loose) * above) * p.scale;
    o.raw = rad; // tamaño del haz de hebras (sin afilar)
    // hilo único (sólo el cabo 0) por encima del punto donde se abre
    const single = k === 0 ? smoothstep(p.bloom - 0.02, p.bloom + 0.012, s) * smoothstep(0, 0.03, s) : 0;
    // cabos gruesos: envuelven las hebras salvo en las puntas, que siguen siendo hebras sueltas
    const tube = p.tube * smoothstep(p.tipEnd - 0.004, p.tipEnd + 0.022, s);
    o.rad = rad * Math.max(single, tube);
    return o;
  };
}

function buildGeometry(N, R) {
  const ring = R + 1;
  const vertsPerStrand = N * ring;
  const count = vertsPerStrand * 3;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const tan = new Float32Array(count * 4);
  let p = 0;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < ring; j++) {
        pos[p * 3] = i;
        pos[p * 3 + 1] = j / R;
        pos[p * 3 + 2] = k;
        nrm[p * 3 + 2] = 1;
        tan[p * 4] = 1;
        tan[p * 4 + 3] = -1;
        p++;
      }
    }
  }
  const idx = new (count > 65535 ? Uint32Array : Uint16Array)((N - 1) * R * 6 * 3);
  let q = 0;
  for (let k = 0; k < 3; k++) {
    const base = k * vertsPerStrand;
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < R; j++) {
        const a = base + i * ring + j;
        const b = a + 1;
        const c = a + ring;
        const d = c + 1;
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = d;
        idx[q++] = c;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return g;
}
