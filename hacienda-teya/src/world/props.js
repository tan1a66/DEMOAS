// ─────────────────────────────────────────────────────────────────────────────
//  Elementi di scena delle sezioni
//  - Eventos: tavola imbandita nel giardino, sedie, candele e fili di lucine
//    che si accendono a onda quando arriva la sera
//  - Noches de Trova: chitarra appoggiata a una sedia sotto la lanterna
//  - luci notturne: lanterne, lampadario della loggia, candele (PointLight)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../scene/agave.js';
import { SITE } from './hacienda.js';

// area del ricevimento (prato a sinistra del viale)
export const EVENT = { x: -9.5, z: -76, w: 12, d: 10 };

// ── Sedia di legno (anche per la trova) ──────────────────────────────────────
function chairGeometry() {
  const parts = [];
  const add = (w, h, d, x, y, z) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(x, y, z);
    parts.push(b.toNonIndexed());
  };
  add(0.44, 0.04, 0.42, 0, 0.46, 0); // seduta
  for (const [x, z] of [
    [-0.19, -0.18],
    [0.19, -0.18],
    [-0.19, 0.18],
    [0.19, 0.18],
  ])
    add(0.035, 0.46, 0.035, x, 0.23, z);
  for (const x of [-0.19, 0.19]) add(0.035, 0.5, 0.035, x, 0.71, -0.18); // montanti dello schienale
  for (const y of [0.62, 0.74, 0.86]) add(0.38, 0.05, 0.02, 0, y, -0.18);
  return mergeGeometries(parts);
}

// ── Tavola imbandita ─────────────────────────────────────────────────────────
function createBanquet(mats, uniforms) {
  const g = new THREE.Group();
  const L = 9.0;
  const W = 1.1;
  const H = 0.76;
  const cloth = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.03, W + 0.3), cloth);
  top.position.y = H;
  const drape = new THREE.Mesh(new THREE.BoxGeometry(L + 0.32, 0.5, W + 0.32), cloth);
  drape.position.y = H - 0.26;
  top.castShadow = drape.castShadow = true;
  top.receiveShadow = drape.receiveShadow = true;
  g.add(top, drape);
  // sedie su entrambi i lati
  const chairGeo = chairGeometry();
  const seats = Math.floor(L / 0.75);
  const chairs = new THREE.InstancedMesh(chairGeo, mats.wood, seats * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let k = 0;
  for (let i = 0; i < seats; i++) {
    const x = -L / 2 + 0.4 + i * 0.75;
    for (const side of [-1, 1]) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? Math.PI : 0);
      m.compose(new THREE.Vector3(x, 0, side * (W / 2 + 0.38)), q, new THREE.Vector3(1, 1, 1));
      chairs.setMatrixAt(k++, m);
    }
  }
  chairs.castShadow = true;
  chairs.receiveShadow = true;
  g.add(chairs);
  // piatti
  const plateGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.015, 24);
  const plates = new THREE.InstancedMesh(plateGeo, new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.35 }), seats * 2);
  k = 0;
  for (let i = 0; i < seats; i++) {
    for (const side of [-1, 1]) {
      m.makeTranslation(-L / 2 + 0.4 + i * 0.75, H + 0.025, side * 0.32);
      plates.setMatrixAt(k++, m);
    }
  }
  g.add(plates);
  // candele in vetro lungo il centro + runner verde
  const candleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8);
  const candles = new THREE.InstancedMesh(candleGeo, mats.glow, Math.floor(L / 0.5));
  for (let i = 0; i < candles.count; i++) {
    m.makeTranslation(-L / 2 + 0.25 + i * 0.5, H + 0.09, (i % 2 ? 0.06 : -0.06));
    candles.setMatrixAt(i, m);
  }
  g.add(candles);
  const runner = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.06, 0.22), mats.leafDark);
  runner.position.y = H + 0.04;
  g.add(runner);
  return g;
}

// ── Fili di lucine (catenarie tra pali di legno) ─────────────────────────────
function createStringLights(mats, uniforms) {
  const g = new THREE.Group();
  const { x, z, w, d } = EVENT;
  const postH = 3.4;
  const corners = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, postH, 8);
  for (const [px, pz] of corners) {
    const p = new THREE.Mesh(postGeo, mats.wood);
    p.position.set(px, postH / 2, pz);
    p.castShadow = true;
    g.add(p);
  }
  const top = (c) => new THREE.Vector3(c[0], postH - 0.05, c[1]);
  // fili: perimetro + due diagonali
  const strands = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
    [corners[0], corners[2]],
    [corners[1], corners[3]],
  ];
  const bulbPos = [];
  const bulbDelay = [];
  const wire = [];
  strands.forEach(([a, b], si) => {
    const A = top(a);
    const B = top(b);
    const len = A.distanceTo(B);
    const sag = len * 0.07;
    const n = Math.floor(len / 0.42);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = A.clone().lerp(B, t);
      p.y -= 4 * sag * t * (1 - t);
      if (prev) wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
      if (i > 0 && i < n) {
        bulbPos.push(p.clone().add(new THREE.Vector3(0, -0.05, 0)));
        bulbDelay.push(si * 0.08 + t * 0.35);
      }
    }
  });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1b1612' })));

  // lampadine: si accendono a onda (aDelay) con un lieve tremolio
  const bulbGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const delay = new Float32Array(bulbDelay);
  bulbGeo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(delay, 1));
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a' });
  bulbMat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = uniforms.uLights;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDelay;\nvarying float vOn;\nuniform float uLights;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOn = smoothstep(aDelay, aDelay + 0.12, uLights * 1.4) * (0.92 + 0.08 * sin(uTime * 9.0 + aDelay * 80.0));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vOn;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.12, 4.0, vOn);');
  };
  bulbMat.customProgramCacheKey = () => 'bulbs';
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbPos.length);
  const m = new THREE.Matrix4();
  bulbPos.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    bulbs.setMatrixAt(i, m);
  });
  g.add(bulbs);
  return g;
}

// ── Chitarra (trova yucateca) ────────────────────────────────────────────────
function createGuitar(mats) {
  const g = new THREE.Group();
  // sagoma a otto: due cerchi raccordati
  const s = new THREE.Shape();
  const lower = 0.19;
  const upper = 0.145;
  const waist = 0.11;
  s.moveTo(0, -0.24);
  s.bezierCurveTo(lower * 1.35, -0.24, lower * 1.3, 0.02, waist, 0.06);
  s.bezierCurveTo(upper * 1.25, 0.1, upper * 1.2, 0.36, 0, 0.36);
  s.bezierCurveTo(-upper * 1.2, 0.36, -upper * 1.25, 0.1, -waist, 0.06);
  s.bezierCurveTo(-lower * 1.3, 0.02, -lower * 1.35, -0.24, 0, -0.24);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 }),
    [new THREE.MeshStandardMaterial({ color: '#c99654', roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#5a2f17', roughness: 0.4 })],
  );
  body.castShadow = true;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), new THREE.MeshBasicMaterial({ color: '#0d0907' }));
  hole.position.set(0, 0.12, 0.099);
  const rosette = new THREE.Mesh(new THREE.RingGeometry(0.048, 0.06, 32), new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.5 }));
  rosette.position.set(0, 0.12, 0.0995);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.012), mats.wood);
  bridge.position.set(0, -0.12, 0.1);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.03), new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.5 }));
  neck.position.set(0, 0.62, 0.075);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.025), mats.wood);
  head.position.set(0, 0.96, 0.07);
  head.rotation.x = -0.25;
  const strings = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.02 + i * 0.008;
    strings.push(x, -0.12, 0.108, x * 0.8, 0.88, 0.094);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  const str = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#d9d2c3' }));
  g.add(body, hole, rosette, bridge, neck, head, str);
  return g;
}

function createTrovaCorner(mats) {
  const g = new THREE.Group();
  const chair = new THREE.Mesh(chairGeometry(), mats.wood);
  chair.castShadow = true;
  chair.receiveShadow = true;
  const guitar = createGuitar(mats);
  guitar.position.set(0.05, 0.47, 0.32);
  guitar.rotation.set(-0.32, 0.12, 0.06);
  g.add(chair, guitar);
  return g;
}

// ── Insieme delle scene ──────────────────────────────────────────────────────
export function createProps(quality, mats, uniforms, hacienda) {
  const group = new THREE.Group();
  const banquet = createBanquet(mats, uniforms);
  banquet.position.set(EVENT.x, 0, EVENT.z);
  banquet.rotation.y = 0.08;
  group.add(banquet);
  group.add(createStringLights(mats, uniforms));

  const trova = createTrovaCorner(mats);
  trova.position.set(SITE.roadX + 4.6, SITE.terraceH + 0.08, SITE.casaZ + 1.1);
  trova.rotation.y = -0.5;
  group.add(trova);

  // luci della sera: lanterne, lampadario, tavola (intensità guidata da uNight)
  const lights = [];
  const addLight = (pos, color, intensity, distance) => {
    const l = new THREE.PointLight(color, 0, distance, 2);
    l.position.copy(pos);
    l.userData.base = intensity;
    group.add(l);
    lights.push(l);
  };
  addLight(hacienda.chandelier, '#ffb466', 9, 9);
  addLight(new THREE.Vector3(EVENT.x, 2.6, EVENT.z), '#ffc27a', 14, 14);
  const lanternWorld = hacienda.lanterns.map((l) => {
    l.updateWorldMatrix(true, false);
    return l.localToWorld(l.userData.lightOffset.clone().divideScalar(l.scale.x)).add(new THREE.Vector3(0, 0, 0.25));
  });
  lanternWorld.slice(0, quality.nightLights - 2).forEach((p) => addLight(p, '#ffad5c', 5, 7));
  return {
    group,
    update(night) {
      for (const l of lights) l.intensity = l.userData.base * night;
    },
  };
}
