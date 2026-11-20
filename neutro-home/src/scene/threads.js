// Hebras de la entrada: "un hilo → muchísimos → tres gruesos".
// Geometría estática (índice de muestra, ángulo, hebra); todo el movimiento ocurre en el
// vertex shader leyendo los ejes de los cabos que ya calcula la trenza.

import * as THREE from 'three';
import { BRAID } from '../config.js';
import { patchThreadsMaterial } from '../gl/fiberMaterial.js';

const SIDES = 3;
const STRIDE = 2; // una de cada dos muestras de la trenza basta para hebras tan finas
const S_MAX = 0.95; // sólo la parte de la trenza que se ve durante la entrada

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class Threads {
  constructor({ perStrand, braid, dye }) {
    const ds = BRAID.length / (BRAID.samples - 1);
    const rings = Math.floor(S_MAX / ds / STRIDE);
    const count = perStrand * 3;
    const ringVerts = SIDES;
    const vPerThread = rings * ringVerts;
    const total = vPerThread * count;
    const pos = new Float32Array(total * 3);
    const th = new Float32Array(total * 4);
    const sp = new Float32Array(total * 4);
    const rnd = rng(1234);
    const golden = Math.PI * (3 - Math.sqrt(5));
    let p = 0;
    for (let t = 0; t < count; t++) {
      const k = t % 3;
      const n = Math.floor(t / 3);
      // empaquetado en espiral de girasol dentro del óvalo (radio ≤ 0.78)
      const rr = 0.78 * Math.sqrt((n + 0.5) / perStrand);
      const ang = n * golden + k;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      const seed = rnd();
      // abertura: lateral con más peso en los bordes, algo de profundidad
      // más densidad en el centro, bordes suaves (casi gaussiana)
      const u = (rnd() + rnd() + rnd() - 1.5) / 1.5;
      const sx = u * 0.06;
      const sy = (rnd() + rnd() - 1) * 0.024;
      const phase = rnd() * Math.PI * 2;
      const tip = rnd() * 0.03;
      for (let m = 0; m < rings; m++) {
        for (let j = 0; j < ringVerts; j++) {
          pos[p * 3] = m * STRIDE;
          pos[p * 3 + 1] = j / SIDES;
          pos[p * 3 + 2] = t;
          th.set([k, px, py, seed], p * 4);
          sp.set([sx, sy, phase, tip], p * 4);
          p++;
        }
      }
    }
    const idx = new Uint32Array(count * (rings - 1) * SIDES * 6);
    let q = 0;
    for (let t = 0; t < count; t++) {
      const base = t * vPerThread;
      for (let m = 0; m < rings - 1; m++) {
        for (let j = 0; j < SIDES; j++) {
          const a = base + m * ringVerts + j;
          const b = base + m * ringVerts + ((j + 1) % SIDES);
          const c = a + ringVerts;
          const d = b + ringVerts;
          idx.set([a, b, c, b, d, c], q);
          q += 6;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    g.setAttribute('aThread', new THREE.BufferAttribute(th, 4));
    g.setAttribute('aSpray', new THREE.BufferAttribute(sp, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

    this.uniforms = {
      uStrands: braid.uniforms.uStrands,
      uOval: braid.uniforms.uOval,
      uDs: { value: ds },
      uLen: { value: BRAID.length },
      uBloom: { value: 0 },
      uSpray: { value: 0 },
      uGather: { value: 0 },
      uThreadK: { value: 0.16 },
      uThreadMin: { value: 0.00028 },
      uTime: { value: 0 },
      uTube: { value: 0 },
      uTipEnd: { value: 0.08 },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.6,
      sheen: 1,
      sheenColor: 0xffffff,
      sheenRoughness: 0.35,
      specularIntensity: 0.4,
    });
    patchThreadsMaterial(mat, this.uniforms, dye);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set({ bloom, spray, gather, time, tube, tipEnd }) {
    const u = this.uniforms;
    u.uTube.value = tube;
    u.uTipEnd.value = tipEnd;
    u.uBloom.value = bloom;
    u.uSpray.value = spray;
    u.uGather.value = gather;
    u.uTime.value = time;
    // hebras visibles aunque sean finísimas mientras están abiertas; agrupadas, a su tamaño real
    u.uThreadMin.value = 0.00028 * (1 - gather);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
