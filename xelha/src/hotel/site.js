import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polar, arcFrame, boxGeo, arcSlab, tint, Buckets, rng } from './geo.js';
import { ATMO } from './atmosphere.js';
import { ATLAS, bush, canopy, vegetationMaterial } from './foliage.js';

// Terreno: lote del hotel (x ±86, z −108..64) dentro de una retícula de calles de Mérida.
export const PLOT = { x0: -86, x1: 86, z0: -108, z1: 64 };
const GRID = 92;
const ROAD_X0 = 92;
const ROAD_Z0 = 70;
const inPlot = (x, z, m = 0) => x > PLOT.x0 - m && x < PLOT.x1 + m && z > PLOT.z0 - m && z < PLOT.z1 + m;

function groundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = ATMO.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vW;
        uniform float uNight;
        float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
        float fb(vec2 p) { return vn(p) * 0.5 + vn(p * 2.1 + 7.0) * 0.3 + vn(p * 4.3 + 3.0) * 0.2; }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vW.xz;
          bool plot = p.x > ${PLOT.x0.toFixed(1)} && p.x < ${PLOT.x1.toFixed(1)} && p.y > ${PLOT.z0.toFixed(1)} && p.y < ${PLOT.z1.toFixed(1)};
          vec3 lawn = mix(vec3(0.27, 0.42, 0.17), vec3(0.36, 0.5, 0.22), fb(p * 0.08));
          vec3 wild = mix(vec3(0.42, 0.45, 0.27), vec3(0.55, 0.5, 0.36), fb(p * 0.03));
          vec3 col = plot ? lawn : wild;
          float rx = abs(mod(p.x - ${ROAD_X0.toFixed(1)} + ${GRID / 2}.0, ${GRID}.0) - ${GRID / 2}.0);
          float rz = abs(mod(p.y - ${ROAD_Z0.toFixed(1)} + ${GRID / 2}.0, ${GRID}.0) - ${GRID / 2}.0);
          float d = min(rx, rz);
          if (!plot) {
            col = mix(col, vec3(0.74, 0.71, 0.64), 1.0 - step(8.5, d));
            col = mix(col, vec3(0.16, 0.16, 0.17) * (0.9 + 0.2 * vn(p * 0.5)), 1.0 - step(6.0, d));
            col = mix(col, vec3(0.85, 0.8, 0.6), (1.0 - step(0.12, d)) * step(0.5, fract((rx < rz ? p.y : p.x) * 0.25)));
          }
          diffuseColor.rgb = col;
        }`
      );
  };
  return mat;
}

// Mapea las UV (0..1) de una geometría a una región del atlas de vegetación.
function inRegion(geo, [u0, v0, u1, v1]) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return geo;
}
const bark = (geo, color) => tint(inRegion(geo.index ? geo.toNonIndexed() : geo, ATLAS.bark), color);

// Palma: tronco curvo + hojas con foliolos (textura), geometría única instanciada.
function palmGeometry() {
  const rand = rng(5);
  const parts = [];
  const h = 9;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, h * 0.5, 0), new THREE.Vector3(1.2, h, 0));
  parts.push(bark(new THREE.TubeGeometry(curve, 10, 0.19, 8, false), 0xb5aa98));
  const top = curve.getPoint(1);
  const [u0, v0, u1, v1] = ATLAS.frond;
  const vm = (v0 + v1) / 2;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + rand() * 0.3;
    const len = 3.8 + rand() * 1.3;
    const droop = 0.7 + rand() * 0.8;
    const rise = i % 2 ? 1.1 : 0.6;
    const segs = 8;
    const pos = [];
    const uv = [];
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const pt = (t, side) => {
        const r = t * len;
        const y = Math.sin(t * Math.PI * 0.55) * rise - t * t * droop * 2.2;
        const w = 0.95 * side;
        const fold = Math.abs(side) * -0.22;
        return new THREE.Vector3(Math.cos(ang) * r - Math.sin(ang) * w, y + fold, Math.sin(ang) * r + Math.cos(ang) * w);
      };
      const uvOf = (t, side) => [u0 + t * (u1 - u0), side === 0 ? vm : side < 0 ? v0 : v1];
      const quad = [[t0, 0], [t0, -1], [t1, 0], [t0, -1], [t1, -1], [t1, 0], [t0, 0], [t1, 0], [t0, 1], [t0, 1], [t1, 0], [t1, 1]];
      for (const [t, sd] of quad) {
        const q = pt(t, sd);
        pos.push(q.x + top.x, q.y + top.y, q.z + top.z);
        uv.push(...uvOf(t, sd));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(n.getX(k), Math.abs(n.getY(k)) + 0.8, n.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    parts.push(tint(g, new THREE.Color().setHSL(0.2, 0.15, 0.75 + rand() * 0.25)));
  }
  for (let i = 0; i < 5; i++) {
    const c = new THREE.SphereGeometry(0.17, 6, 4);
    c.translate(top.x + Math.cos(i * 1.3) * 0.3, top.y - 0.35, top.z + Math.sin(i * 1.3) * 0.3);
    parts.push(bark(c, 0x8a7a40));
  }
  return mergeGeometries(parts);
}

// Flamboyán: copa ancha y plana de flores rojo-naranja (árbol icónico de Mérida).
function flamboyanGeometry() {
  const rand = rng(9);
  const trunk = bark(new THREE.CylinderGeometry(0.22, 0.38, 4.6, 8).translate(0, 2.3, 0), 0x9a8a78);
  return mergeGeometries([trunk, canopy(new THREE.Vector3(0, 5.2, 0), 4.3, 1.1, 22, rand, { region: ATLAS.flower, size: 1.8 })]);
}

function treeGeometry(seed = 4, cards = 16) {
  const rand = rng(seed);
  const trunk = bark(new THREE.CylinderGeometry(0.16, 0.3, 3.4, 7).translate(0, 1.7, 0), 0x9a8a78);
  return mergeGeometries([trunk, canopy(new THREE.Vector3(0, 4.6, 0), 2.6, 1.9, cards, rand, { size: 1.6 })]);
}

function scatter(geo, mat, list, { shadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  list.forEach((it, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot ?? 0);
    m.compose(it.pos, q, new THREE.Vector3().setScalar(it.s ?? 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}

export function buildSite({ water, envMap, lite = false }) {
  const group = new THREE.Group();
  const rand = rng(21);
  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: 0xe2d4bc, roughness: 0.92 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xb38a62, roughness: 0.75 }),
    stucco: new THREE.MeshStandardMaterial({ color: 0xf1e7da, roughness: 0.9 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8f6040, roughness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b3a37, roughness: 0.8 }),
    green: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    leaf: vegetationMaterial(),
    water,
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), groundMaterial());
  ground.receiveShadow = true;
  ground.position.y = -0.02;
  group.add(ground);

  const b = new Buckets();
  // Patio: deck, alberca curva que replica el arco del edificio y un "cenote" circular.
  b.add('stone', arcSlab(15, 32, -0.8, 0.8, -0.02, 0.04));
  b.add('deck', arcSlab(26.8, 31, -0.62, 0.62, 0.04, 0.08));
  b.add('stone', arcSlab(19.2, 26.8, -0.6, 0.6, 0.04, 0.16));
  b.add('water', arcSlab(19.7, 26.3, -0.585, 0.585, 0.05, 0.17));
  const cen = polar(10.5, 0);
  const ring = new THREE.CylinderGeometry(3.6, 3.7, 0.3, 40).translate(cen.x, 0.12, cen.z);
  b.add('stone', ring);
  b.add('water', new THREE.CylinderGeometry(3.15, 3.15, 0.32, 40).translate(cen.x, 0.13, cen.z));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add('leaf', bush(new THREE.Vector3(cen.x + Math.cos(a) * 4.4, 0, cen.z + Math.sin(a) * 4.4), 0.7 + rand() * 0.5, rand));
  }
  // Camastros y sombrillas junto a la alberca.
  for (let a = -0.54; a <= 0.54; a += 0.072) {
    const P = (key, x0, x1, y0, y1, z0, z1) => b.add(key, boxGeo(x0, x1, y0, y1, z0, z1), arcFrame(a, 28.6, 0.08));
    for (const x of [-0.5, 0.5]) {
      P('wood', x - 0.33, x + 0.33, 0, 0.3, -1.0, 1.0);
      P('fabric', x - 0.3, x + 0.3, 0.3, 0.38, -0.95, 0.4);
      P('fabric', x - 0.3, x + 0.3, 0.3, 0.7, 0.4, 0.75);
    }
    if (Math.round(a / 0.072) % 2 === 0) {
      const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6).translate(0, 1.25, 0);
      const top = new THREE.ConeGeometry(1.5, 0.55, 10).translate(0, 2.55, 0);
      const p = polar(29.8, a, 0.08);
      b.add('dark', pole.translate(p.x, p.y, p.z));
      b.add('fabric', top.translate(p.x, p.y, p.z));
    }
  }
  // Andadores: eje central desde la calle y anillo alrededor del patio.
  b.add('stone', boxGeo(-1.8, 1.8, -0.02, 0.04, 4, PLOT.z1 + 6));
  b.add('stone', arcSlab(38.5, 41, -1.05, 1.05, -0.02, 0.04));
  // Luminarias de piso.
  for (let a = -1.0; a <= 1.0; a += 0.1) {
    const p = polar(39.6, a);
    b.add('dark', new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6).translate(p.x, 0.3, p.z));
    b.add('lamp', new THREE.CylinderGeometry(0.1, 0.1, 0.12, 6).translate(p.x, 0.66, p.z));
  }
  for (let z = 14; z < PLOT.z1; z += 6) {
    for (const x of [-2.4, 2.4]) {
      b.add('dark', new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6).translate(x, 0.3, z));
      b.add('lamp', new THREE.CylinderGeometry(0.1, 0.1, 0.12, 6).translate(x, 0.66, z));
    }
  }
  // Muro perimetral bajo y estacionamiento con acceso posterior.
  const W = (x0, x1, z0, z1) => b.add('stucco', boxGeo(x0, x1, 0, 1.6, z0, z1));
  W(PLOT.x0, PLOT.x1, PLOT.z0, PLOT.z0 + 0.4);
  W(PLOT.x0, -6, PLOT.z1 - 0.4, PLOT.z1);
  W(6, PLOT.x1, PLOT.z1 - 0.4, PLOT.z1);
  W(PLOT.x0, PLOT.x0 + 0.4, PLOT.z0, PLOT.z1);
  W(PLOT.x1 - 0.4, PLOT.x1, PLOT.z0, PLOT.z1);
  b.add('dark', boxGeo(-34, 34, -0.02, 0.03, -100, -66));
  for (let x = -31; x <= 31; x += 3.1) b.add('stone', boxGeo(x - 0.06, x + 0.06, 0.03, 0.04, -97, -91));
  group.add(b.build(mats));

  // Vegetación del lote.
  const palms = [];
  for (let a = -0.95; a <= 0.95; a += 0.11) palms.push({ pos: polar(33.5 + rand() * 2.5, a + (rand() - 0.5) * 0.04), rot: rand() * 6.28, s: 0.85 + rand() * 0.35 });
  for (let z = 16; z < PLOT.z1 - 4; z += 9) for (const x of [-6, 6]) palms.push({ pos: new THREE.Vector3(x, 0, z), rot: rand() * 6.28, s: 0.9 + rand() * 0.3 });
  for (let x = PLOT.x0 + 6; x < PLOT.x1; x += 11) palms.push({ pos: new THREE.Vector3(x, 0, PLOT.z0 - 6), rot: rand() * 6.28, s: 0.9 + rand() * 0.3 });
  const vegMat = vegetationMaterial();
  group.add(scatter(palmGeometry(), vegMat, palms));

  const flam = [
    [-30, 30], [30, 30], [-50, 45], [52, 44], [-20, 52], [22, 54], [-66, 20], [68, 18],
  ].map(([x, z]) => ({ pos: new THREE.Vector3(x, 0, z), rot: rand() * 6.28, s: 0.9 + rand() * 0.3 }));
  group.add(scatter(flamboyanGeometry(), vegMat, flam));

  const trees = [];
  for (let i = 0; i < 90; i++) {
    const x = PLOT.x0 + 4 + rand() * (PLOT.x1 - PLOT.x0 - 8);
    const z = PLOT.z0 + 4 + rand() * (PLOT.z1 - PLOT.z0 - 8);
    const r = Math.hypot(x, z);
    if (r < 62 && z < 30) continue; // edificio y patio
    if (Math.abs(x) < 9 && z > 0) continue; // andador
    if (z < -64 && Math.abs(x) < 36) continue; // estacionamiento
    trees.push({ pos: new THREE.Vector3(x, 0, z), rot: rand() * 6.28, s: 0.8 + rand() * 0.5 });
  }
  group.add(scatter(treeGeometry(), vegMat, trees));

  group.add(buildCity(rand, lite));
  return { group };
}

// Contexto urbano: casas de una y dos plantas con colores de Mérida, árboles y alumbrado.
function buildCity(rand, lite) {
  const group = new THREE.Group();
  const COLORS = [0xf3ebe0, 0xeccbb8, 0xeedab0, 0xc4d6df, 0xf0e3cf, 0xe3b9a0, 0xcfdcc2, 0xf5f1ea, 0xeac2bf, 0xf3ebe0, 0xf5f1ea];
  const houses = [];
  const trees = [];
  const lamps = [];
  const R = lite ? 480 : 720;
  const half = GRID / 2;
  for (let gx = -9; gx <= 9; gx++) {
    for (let gz = -9; gz <= 9; gz++) {
      const cx = ROAD_X0 + half + gx * GRID;
      const cz = ROAD_Z0 + half + gz * GRID;
      if (Math.hypot(cx, cz) > R) continue;
      if (inPlot(cx, cz, 20)) continue;
      const x0 = cx - half + 8.5;
      const x1 = cx + half - 8.5;
      const z0 = cz - half + 8.5;
      const z1 = cz + half - 8.5;
      // Casas alineadas a la calle en los cuatro lados de la manzana.
      const side = (ax, az, bx, bz, nx, nz) => {
        const len = Math.hypot(bx - ax, bz - az);
        let t = 0;
        while (t < len - 6) {
          const w = 7 + rand() * 5;
          const d = 11 + rand() * 9;
          const h = rand() < 0.8 ? 3.1 + rand() * 0.9 : 5.8 + rand() * 1.2;
          const ux = (bx - ax) / len;
          const uz = (bz - az) / len;
          const px = ax + ux * (t + w / 2) + nx * (d / 2);
          const pz = az + uz * (t + w / 2) + nz * (d / 2);
          const sx = Math.abs(ux) > 0.5 ? w - 0.3 : d;
          const sz = Math.abs(ux) > 0.5 ? d : w - 0.3;
          houses.push({ x: px, z: pz, sx, sz, h, c: COLORS[Math.floor(rand() * COLORS.length)] });
          t += w;
        }
      };
      side(x0, z0, x1, z0, 0, 1);
      side(x0, z1, x1, z1, 0, -1);
      side(x0, z0 + 24, x0, z1 - 24, 1, 0);
      side(x1, z0 + 24, x1, z1 - 24, -1, 0);
      for (let i = 0; i < 9; i++) trees.push([cx + (rand() - 0.5) * 36, cz + (rand() - 0.5) * 36, 0.8 + rand() * 0.8]);
      for (let i = 0; i < 4; i++) trees.push([x0 + rand() * (x1 - x0), z0 - 7.4, 0.55 + rand() * 0.3]);
      for (let k = 0; k < 4; k++) lamps.push([x0 + (k / 3) * (x1 - x0), z0 - 7.5], [x0 - 7.5, z0 + (k / 3) * (z1 - z0)]);
    }
  }
  // Algunas torres del norte de la ciudad, al fondo.
  for (let i = 0; i < 5; i++) {
    const a = -1.1 + (i / 4) * 2.2 + (rand() - 0.5) * 0.3;
    const r = 520 + rand() * 260;
    houses.push({ x: Math.sin(a) * r, z: -Math.cos(a) * r, sx: 14 + rand() * 6, sz: 14 + rand() * 6, h: 34 + rand() * 30, c: 0xece8e0 });
  }

  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const hm = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), houses.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  houses.forEach((h, i) => {
    m.makeScale(h.sx, h.h, h.sz).setPosition(h.x, 0, h.z);
    hm.setMatrixAt(i, m);
    hm.setColorAt(i, c.set(h.c));
  });
  hm.receiveShadow = true;
  group.add(hm);

  const tg = treeGeometry(12, 8);
  const tm = new THREE.InstancedMesh(tg, vegetationMaterial(), trees.length);
  const greens = [0xffffff, 0xe6efd6, 0xd8e4c8, 0xf2f0e0];
  trees.forEach(([x, z, s], i) => {
    m.makeScale(s, s * (0.8 + (i % 5) * 0.08), s).setPosition(x, 0, z);
    tm.setMatrixAt(i, m);
    tm.setColorAt(i, c.set(greens[i % greens.length]));
  });
  group.add(tm);

  const lg = new THREE.SphereGeometry(0.35, 6, 4).translate(0, 6, 0);
  const lm = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffc98a }), lamps.length);
  lamps.forEach(([x, z], i) => {
    m.makeTranslation(x, 0, z);
    lm.setMatrixAt(i, m);
  });
  lm.userData.nightOnly = true;
  group.add(lm);
  group.userData.lamps = lm;
  return group;
}
