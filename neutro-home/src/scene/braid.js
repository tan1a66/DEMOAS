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
 * Entrada, directamente sobre la trenza ya colgada (eje real en el muro):
 * un hilo baja por la cola izquierda → se abre en muchísimas hebras → tres cabos gruesos →
 * se trenzan de arriba abajo → las puntas se atan en la borla.
 * p = { cut, front, scale, split, loose, thin, core, spread, sep, bloom, tube, tipEnd, taper, done, phase }
 *   cut    — por debajo de este s todavía no hay hilo (el hilo "baja").
 *   front  — frente de trenzado; por encima la trenza está hecha.
 *   scale  — grosor global (crece hasta 1).
 *   split  — 0: los tres cabos coinciden (un único eje); 1: tres cabos separados.
 *   loose  — volumen de los cabos sueltos (por debajo del frente) respecto a los trenzados.
 *   thin   — grosor relativo del hilo único inicial.
 *   core   — alma del cabo suelto respecto al haz completo (las hebras de fuera se ven).
 *   spread, sep — cómo se abren y separan los cabos sueltos.
 *   bloom  — punto (s) donde el hilo único se abre en hebras (por debajo: hebras).
 *   tube   — 0..1, aparición de los tres cabos gruesos.
 *   tipEnd, taper — puntas: por debajo de tipEnd sólo hebras; el tubo se deshace en "taper".
 *   done   — 0..1, paso final a la trenza colgada definitiva (con su borla).
 */
export function introStructure(p) {
  const L = BRAID.length;
  const P = BRAID.period;
  const T = BRAID.taperLen;
  const blend = P * 1.1;
  const hung = hungStructure(p.phase);
  const h = { lat: 0, dep: 0, rad: 0, raw: 0 };
  return (s, k, o) => {
    const above = smoothstep(p.front, p.front + blend, s);
    const below = Math.max(0, p.front - s);
    const sp = p.split;
    // por encima del frente: trenzado (misma fase que la trenza colgada)
    const tB = (TWO_PI * s) / P + p.phase + PHASES[k];
    // por debajo: los tres cabos sueltos siguen la fase del frente; cuando el frente avanza,
    // uno pasa por encima del central y luego el otro, como al trenzar a mano
    const tL = (TWO_PI * p.front) / P + p.phase + PHASES[k];
    const looseAmp = p.scale * (1 + p.spread * smoothstep(0, 0.35, below)) + p.sep;
    const latL = Math.sin(tL) * looseAmp;
    const depL = Math.sin(2 * tL) * 1.6 * p.scale;
    // extremo derecho: ya está terminado (se estrecha hacia su borla)
    const gR = smoothstep(0, T, L - s);
    const ampR = 0.36 + 0.64 * gR;
    let lat = (latL + (Math.sin(tB) * p.scale - latL) * above) * sp * ampR;
    let dep = (depL + (Math.sin(2 * tB) * p.scale - depL) * above) * sp * ampR;
    const rad = (p.loose + (1 - p.loose) * above) * p.scale;
    o.raw = rad; // tamaño del haz de hebras (sin afilar)
    // hilo único (sólo el cabo 0, fino) por encima del punto donde se abre
    const single = k === 0 ? smoothstep(p.bloom - 0.02, p.bloom + 0.012, s) * smoothstep(0, 0.03, s) : 0;
    const taper = smoothstep(p.tipEnd - 0.01, p.tipEnd + p.taper, s);
    const core = p.core + (1 - p.core) * above;
    let r = Math.max(rad * p.tube * taper * core, p.thin * p.scale * single) * (0.7 + 0.3 * gR);
    // el hilo todavía no ha llegado por debajo de "cut"
    r *= smoothstep(p.cut, p.cut + 0.025, s);
    if (p.done > 0) {
      hung(s, k, h);
      const d = p.done;
      lat += (h.lat - lat) * d;
      dep += (h.dep - dep) * d;
      r += (h.rad - r) * d;
    }
    o.lat = lat;
    o.dep = dep;
    o.rad = r;
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
