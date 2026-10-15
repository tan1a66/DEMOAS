// Zanates: los pájaros negros que al atardecer dan vueltas sobre la Plaza Grande.
// Pocos de día, muchos con la puesta de sol, ninguno de noche.

import * as THREE from 'three';
import { rng } from './build.js';

const MAX = 34;

/** Silueta de pájaro: cuerpo, dos alas (aWing = cuánto se mueve el vértice) y cola. */
function birdGeometry() {
  const v = [];
  const w = [];
  const tri = (a, b, c, wa = 0, wb = 0, wc = 0) => {
    v.push(...a, ...b, ...c);
    w.push(wa, wb, wc);
  };
  // cuerpo (rombo alargado)
  tri([0, 0, 0.28], [-0.06, 0, 0], [0, 0.05, 0]);
  tri([0, 0, 0.28], [0, 0.05, 0], [0.06, 0, 0]);
  tri([0, 0, -0.3], [0, 0.05, 0], [-0.06, 0, 0]);
  tri([0, 0, -0.3], [0.06, 0, 0], [0, 0.05, 0]);
  // alas
  tri([-0.05, 0, 0.1], [-0.6, 0, -0.06], [-0.05, 0, -0.1], 0.1, 1, 0.1);
  tri([0.05, 0, 0.1], [0.05, 0, -0.1], [0.6, 0, -0.06], 0.1, 0.1, 1);
  // cola larga (el zanate macho tiene una cola enorme)
  tri([0, 0, -0.26], [-0.11, 0, -0.62], [0.11, 0, -0.62]);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1));
  g.computeVertexNormals();
  return g;
}

export function buildBirds() {
  const rand = rng(42);
  const geo = birdGeometry();
  const phases = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) phases[i] = rand() * 6.28;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const material = new THREE.MeshBasicMaterial({ color: '#211915', side: THREE.DoubleSide });
  const uTime = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        attribute float aWing;
        attribute float aPhase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float flap = sin(uTime * 13.0 + aPhase);
        transformed.y += flap * 0.32 * aWing;
        transformed.x *= 1.0 - 0.18 * abs(flap) * aWing;`,
      );
  };

  const mesh = new THREE.InstancedMesh(geo, material, MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;

  // Cada pájaro gira alrededor de un centro sobre la plaza, cerca de la catedral.
  const birds = Array.from({ length: MAX }, (_, i) => ({
    r: 14 + rand() * 26,
    h: 9 + rand() * 18,
    speed: (0.07 + rand() * 0.07) * (rand() < 0.8 ? 1 : -1),
    a: rand() * Math.PI * 2,
    wob: rand() * 6.28,
    cx: -10 + rand() * 18,
    cz: -62 - rand() * 22,
    s: 0.85 + rand() * 0.35,
    order: i,
  }));

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const look = new THREE.Matrix4();
  const where = (b, t, out) =>
    out.set(
      b.cx + Math.cos(b.a + t * b.speed) * b.r,
      b.h + Math.sin(t * 0.6 + b.wob) * 1.8,
      b.cz + Math.sin(b.a + t * b.speed) * b.r * 0.55,
    );

  function update(t, dt, palette) {
    uTime.value = t;
    // De día unos pocos; al caer el sol, la bandada entera; de noche duermen.
    const amount = (1 - palette.stars) * (0.3 + 0.7 * palette.lanterns) * (1 - THREE.MathUtils.smoothstep(palette.moonlight, 0.1, 0.6));
    const count = Math.round(MAX * amount);
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      const b = birds[i];
      where(b, t, pos);
      where(b, t + 0.2, ahead);
      look.lookAt(ahead, pos, up);
      q.setFromRotationMatrix(look);
      scale.setScalar(b.s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  const group = new THREE.Group();
  group.add(mesh);
  return { group, update };
}
