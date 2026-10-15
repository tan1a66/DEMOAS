// ─────────────────────────────────────────────────────────────────────────────
//  Vegetazione
//  - campo di henequén: centinaia di piante istanziate, che al primo scroll
//    spuntano dal terreno a ondata partendo dalla pianta protagonista
//  - alberi: rami a tubo + chioma di "ciuffi" di foglie (texture disegnata),
//    normali sferiche per un volume morbido, ombre a chiazze
//  - palme reali col tronco imbiancato alla base (come nella foto)
//  - vasi di terracotta con piante a foglia grande
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createLeafGeometry, createAgaveMaterial, rosetteLayout, leafMatrix, mulberry32 } from '../scene/agave.js';
import { SITE } from './hacienda.js';

// ── Campo di henequén ────────────────────────────────────────────────────────
export const FIELD = {
  rowStep: 2.4,
  plantStep: 1.9,
  // spiazzo davanti alla portada dove si stendeva la fibra ad asciugare
  yard: { x0: -16.5, x1: -3.5, z0: -53, z1: -41.5 },
};
const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

export function createField(quality) {
  const rnd = mulberry32(2024);
  const plants = [];
  const rows = quality.fieldRows; // file per lato
  const zMin = SITE.gateZ + 5;
  const zMax = quality.fieldZMax;
  for (let k = -rows; k <= rows + 3; k++) {
    const x = k * FIELD.rowStep;
    if (Math.abs(x - SITE.roadX) < 2.7) continue; // la strada
    for (let z = zMax; z > zMin; z -= FIELD.plantStep) {
      const px = x + (rnd() - 0.5) * 0.3;
      const pz = z + (rnd() - 0.5) * 0.4;
      if (Math.hypot(px, pz) < 1.2) continue; // posto della pianta protagonista
      if (inRect(px, pz, FIELD.yard, 0.8)) continue; // spiazzo dei tendederos
      const dist = Math.hypot(px, pz);
      plants.push({ x: px, z: pz, rot: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.3, delay: 0.04 + dist / 75 + rnd() * 0.05 });
    }
  }
  const layout = rosetteLayout(quality.fieldLeaves, { dried: 1 });
  const geo = createLeafGeometry(quality.fieldLeafSegments[0], quality.fieldLeafSegments[1], { teeth: false });
  const n = plants.length * layout.length;
  const aBend = new Float32Array(n);
  const aPhase = new Float32Array(n);
  const aTint = new Float32Array(n * 3);
  const aDry = new Float32Array(n);
  const aDelay = new Float32Array(n);
  const { material, depthMaterial, uniforms } = createAgaveMaterial({ grow: true });
  // in pieno giorno la luce emisferica finta e l'environment vanno ridotti
  material.envMapIntensity = 0.85;
  uniforms.uSkyFill.value.multiplyScalar(0.2);
  uniforms.uGroundFill.value.multiplyScalar(0.2);
  uniforms.uTransColor.value.multiplyScalar(0.6);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  const plantM = new THREE.Matrix4();
  const leafM = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let i = 0;
  for (const p of plants) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
    plantM.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    const tint = 0.74 + rnd() * 0.16;
    for (const L of layout) {
      leafMatrix(L, 1, leafM);
      mesh.setMatrixAt(i, leafM.premultiply(plantM));
      aBend[i] = L.bend;
      aPhase[i] = rnd() * Math.PI * 2;
      aTint.set([tint * L.tint[0], tint * L.tint[1] * 1.02, tint * L.tint[2]], i * 3);
      aDry[i] = L.dry;
      aDelay[i] = p.delay;
      i++;
    }
  }
  geo.setAttribute('aBend', new THREE.InstancedBufferAttribute(aBend, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));
  geo.setAttribute('aDry', new THREE.InstancedBufferAttribute(aDry, 1));
  geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(aDelay, 1));
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, uniforms, count: plants.length };
}

// ── Texture disegnate al volo ────────────────────────────────────────────────
export function leafClusterTexture(seed, hue = 95, lum = 16, sat = 34) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 95; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 104;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const l = 20 + rnd() * 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.fillStyle = `hsl(${hue + rnd() * 22 - 8}, ${sat + rnd() * 22}%, ${lum + rnd() * 22}%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, l * 0.5, l * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-l * 0.45, 0);
    ctx.lineTo(l * 0.45, 0);
    ctx.stroke();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(5);
  // fogliole lunghe e sottili ai due lati del rachide (lungo x)
  for (let i = 0; i < 120; i++) {
    const x = 10 + (i / 120) * 490;
    for (const side of [-1, 1]) {
      const len = 52 * Math.sin(Math.PI * (0.15 + 0.85 * (i / 120))) + 8;
      ctx.strokeStyle = `hsl(${88 + rnd() * 20}, ${38 + rnd() * 18}%, ${20 + rnd() * 16}%)`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(x + 10, 64 + side * len * 0.5, x + 22, 64 + side * len);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#6b6a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(512, 64);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// materiale delle foglie: alpha test, normali "sferiche" passate per istanza,
// leggero ondeggiare e un po' di luce che filtra (controluce)
export function foliageMaterial(map, uniforms) {
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aNormalDir;\nattribute float aSway;\nuniform float uTime;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aNormalDir;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        transformed.x += sin(uTime * 1.3 + aSway) * 0.05 * (position.y + 0.5);
        transformed.z += cos(uTime * 1.1 + aSway * 1.3) * 0.04 * (position.y + 0.5);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * vec3(0.18, 0.2, 0.06);`,
    );
  };
  mat.customProgramCacheKey = () => 'foliage';
  return mat;
}

function barkMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#5a4c40', roughness: 0.95 });
}

// ── Albero a chioma ampia (laurel/ceiba) ─────────────────────────────────────
function treeGeometry(rnd, height, spread) {
  const branches = [];
  const tips = [];
  const grow = (start, dir, len, radius, depth) => {
    const pts = [start.clone()];
    const d = dir.clone();
    let p = start.clone();
    const n = 5;
    for (let i = 1; i <= n; i++) {
      d.add(new THREE.Vector3((rnd() - 0.5) * 0.35, (rnd() - 0.4) * 0.15, (rnd() - 0.5) * 0.35)).normalize();
      p = p.clone().addScaledVector(d, len / n);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    branches.push(new THREE.TubeGeometry(curve, 8, radius, 6, false).toNonIndexed());
    if (depth <= 0 || radius < 0.05) {
      tips.push(p);
      return;
    }
    const kids = depth > 1 ? 3 : 4;
    for (let k = 0; k < kids; k++) {
      const a = (k / kids) * Math.PI * 2 + rnd();
      const nd = new THREE.Vector3(Math.cos(a) * spread, 0.55 + rnd() * 0.5, Math.sin(a) * spread).normalize();
      grow(curve.getPoint(0.75 + rnd() * 0.25), nd, len * (0.55 + rnd() * 0.2), radius * 0.55, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 1, 0), height * 0.42, height * 0.035, 3);
  return { geometry: mergeGeometries(branches), tips };
}

export function createTree({ seed = 1, height = 10, spread = 1.0, cards = 380, uniforms, hue = 95 }) {
  const rnd = mulberry32(seed);
  const { geometry, tips } = treeGeometry(rnd, height, spread);
  const group = new THREE.Group();
  const wood = new THREE.Mesh(geometry, barkMaterial());
  wood.castShadow = true;
  wood.receiveShadow = true;
  group.add(wood);

  // ciuffi di foglie attorno alle punte dei rami
  const center = new THREE.Vector3();
  tips.forEach((t) => center.add(t));
  center.divideScalar(tips.length);
  const plane = new THREE.PlaneGeometry(1.7, 1.7);
  const map = leafClusterTexture(seed * 7 + 3, hue);
  const mat = foliageMaterial(map, uniforms);
  const inst = new THREE.InstancedMesh(plane, mat, cards);
  const nDir = new Float32Array(cards * 3);
  const sway = new Float32Array(cards);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < cards; i++) {
    const tip = tips[Math.floor(rnd() * tips.length)];
    const off = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.3) * 0.7, rnd() - 0.5).normalize().multiplyScalar(0.4 + rnd() * 1.5);
    const p = tip.clone().add(off);
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    q.setFromEuler(e);
    const s = 0.8 + rnd() * 0.7;
    m.compose(p, q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m);
    // normale "sferica": dalla chioma verso l'esterno, nello spazio dell'istanza
    const dir = p.clone().sub(center).add(new THREE.Vector3(0, 1.2, 0)).normalize();
    const inv = q.clone().invert();
    dir.applyQuaternion(inv);
    nDir.set([dir.x, dir.y, dir.z], i * 3);
    sway[i] = rnd() * 6.28;
  }
  plane.setAttribute('aNormalDir', new THREE.InstancedBufferAttribute(nDir, 3));
  plane.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 1));
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: map, alphaTest: 0.45 });
  // la depth material legge l'alpha dal canale verde della mappa: serve la map come alphaMap
  inst.customDepthMaterial.map = map;
  group.add(inst);
  return group;
}

// ── Palma reale (Roystonea): tronco liscio, base imbiancata, chioma arcuata ──
let frondTex = null;
export function createPalm({ seed = 1, height = 12, uniforms }) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  // tronco: profilo con leggero rigonfiamento; colore per altezza (calce, grigio, verde)
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.26 * (1 - 0.25 * t) + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.6));
    pts.push(new THREE.Vector2(t > 0.86 ? r * 0.9 : r, t * height));
  }
  const trunkGeo = new THREE.LatheGeometry(pts, 14);
  const col = new Float32Array(trunkGeo.attributes.position.count * 3);
  const white = new THREE.Color('#e9e2d4');
  const grey = new THREE.Color('#8a857b');
  const green = new THREE.Color('#5f7a3a');
  for (let i = 0; i < trunkGeo.attributes.position.count; i++) {
    const y = trunkGeo.attributes.position.getY(i);
    const c = y < 1.6 ? white : y > height * 0.86 ? green : grey;
    const ring = 0.93 + 0.07 * Math.sin(y * 9);
    col.set([c.r * ring, c.g * ring, c.b * ring], i * 3);
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // fronde: nastri arcuati con la texture delle fogliole
  frondTex = frondTex || frondTexture();
  const mat = foliageMaterial(frondTex, uniforms);
  const fronds = [];
  const count = 14;
  for (let k = 0; k < count; k++) {
    const yaw = (k / count) * Math.PI * 2 + rnd() * 0.3;
    const lift = 0.6 - rnd() * 0.9; // alcune salgono, altre ricadono
    const len = 3.6 + rnd() * 0.8;
    const segs = 10;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = t * len;
      const y = Math.sin(t * 1.4) * lift * 1.6 - t * t * 1.6;
      const w = 0.75 * Math.sin(Math.PI * (0.1 + 0.9 * t)) + 0.1;
      for (const side of [-1, 1]) {
        pos.push(x, y - Math.abs(side) * w * 0.15, side * w);
        uv.push(t, side > 0 ? 1 : 0);
      }
    }
    for (let i = 0; i < segs; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
    fg.rotateY(yaw);
    fg.translate(0, height + 0.2, 0);
    fronds.push(fg);
  }
  const frondGeo = mergeGeometries(fronds);
  frondGeo.computeVertexNormals();
  const n = frondGeo.attributes.normal.array;
  // normali verso l'alto/esterno per un'illuminazione morbida
  const nd = new Float32Array(n.length);
  const p = frondGeo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const v = new THREE.Vector3(p[i], (p[i + 1] - height) + 1.5, p[i + 2]).normalize();
    nd.set([v.x, v.y, v.z], i);
  }
  frondGeo.setAttribute('aNormalDir', new THREE.BufferAttribute(nd, 3));
  frondGeo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(p.length / 3).fill(seed), 1));
  const crown = new THREE.Mesh(frondGeo, mat);
  crown.castShadow = true;
  g.add(crown);
  return g;
}

// ── Vaso di terracotta con pianta a foglie grandi ────────────────────────────
let bigLeafTex = null;
function bigLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d6b2a';
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.bezierCurveTo(-30, 170, 10, 30, 64, 6);
  ctx.bezierCurveTo(118, 30, 158, 170, 64, 250);
  ctx.fill();
  ctx.strokeStyle = '#8fae5a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.lineTo(64, 12);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let y = 40; y < 230; y += 22) {
    ctx.beginPath();
    ctx.moveTo(64, y + 14);
    ctx.lineTo(18, y - 6);
    ctx.moveTo(64, y + 14);
    ctx.lineTo(110, y - 6);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPotPlant({ seed = 1, mats, uniforms, scale = 1 }) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const pts = [
    [0, 0],
    [0.2, 0],
    [0.24, 0.05],
    [0.3, 0.42],
    [0.34, 0.46],
    [0.34, 0.52],
    [0.3, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mats.terracotta);
  pot.castShadow = true;
  pot.receiveShadow = true;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mats.soilPot);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.48;
  g.add(pot, soil);
  bigLeafTex = bigLeafTex || bigLeafTexture();
  const mat = foliageMaterial(bigLeafTex, uniforms);
  const leaves = [];
  const k = 7;
  for (let i = 0; i < k; i++) {
    const stemH = 0.5 + rnd() * 0.5;
    const pl = new THREE.PlaneGeometry(0.42, 0.7);
    pl.translate(0, 0.35, 0);
    pl.rotateX(-0.6 - rnd() * 0.5);
    pl.translate(0, stemH, 0);
    pl.rotateY((i / k) * Math.PI * 2 + rnd() * 0.4);
    pl.translate(0, 0.48, 0);
    leaves.push(pl);
  }
  const lg = mergeGeometries(leaves);
  const nd = new Float32Array(lg.attributes.position.count * 3);
  for (let i = 0; i < lg.attributes.position.count; i++) {
    const v = new THREE.Vector3(lg.attributes.position.getX(i), 0.8, lg.attributes.position.getZ(i)).normalize();
    nd.set([v.x, v.y, v.z], i * 3);
  }
  lg.setAttribute('aNormalDir', new THREE.BufferAttribute(nd, 3));
  lg.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(lg.attributes.position.count).fill(seed), 1));
  const plant = new THREE.Mesh(lg, mat);
  plant.castShadow = true;
  g.add(plant);
  g.scale.setScalar(scale);
  return g;
}

// ── Disposizione nel sito ────────────────────────────────────────────────────
export function createVegetation(quality, mats, uniforms) {
  const group = new THREE.Group();
  const cards = quality.treeCards;
  const trees = [
    // dentro il cortile, vicino alla portada: le chiome si vedono sopra il muro
    [-7, -64, 1, 11, 1.0],
    [12, -66, 2, 12, 1.1],
    [-14, -82, 3, 10, 1.0],
    [21, -84, 4, 11, 1.05],
    // fuori dai muri: masse scure sullo sfondo
    [-30, -60, 5, 13, 1.1],
    [36, -62, 6, 12, 1.0],
    [-32, -84, 7, 14, 1.2],
    [38, -90, 8, 13, 1.1],
    [-18, -104, 9, 12, 1.0],
    [24, -106, 10, 13, 1.0],
  ];
  for (const [x, z, seed, h, sp] of trees.slice(0, quality.treeCount)) {
    const t = createTree({ seed, height: h, spread: sp, cards, uniforms });
    t.position.set(x, 0, z);
    t.rotation.y = seed * 1.7;
    group.add(t);
  }
  // viale di palme reali verso la Casa Principal
  for (const z of [-67, -74, -81]) {
    for (const side of [-1, 1]) {
      const p = createPalm({ seed: Math.round(z * side), height: 11 + ((z * side) % 3), uniforms });
      p.position.set(SITE.roadX + side * 3.8, 0, z);
      group.add(p);
    }
  }
  // vasi sulla terrazza e ai piedi della scalinata (come nelle foto)
  const potSpots = [
    [SITE.roadX - 3.9, SITE.stairFrontZ + 0.2, 0, 1.15],
    [SITE.roadX + 3.9, SITE.stairFrontZ + 0.2, 0, 1.15],
    [SITE.roadX - 7, SITE.casaZ + SITE.terraceDepth - 0.17, SITE.terraceH + 0.5, 0.75],
    [SITE.roadX + 7, SITE.casaZ + SITE.terraceDepth - 0.17, SITE.terraceH + 0.5, 0.75],
    [SITE.roadX - 11, SITE.casaZ + SITE.terraceDepth - 0.17, SITE.terraceH + 0.5, 0.75],
    [SITE.roadX + 11, SITE.casaZ + SITE.terraceDepth - 0.17, SITE.terraceH + 0.5, 0.75],
    [SITE.gateX - 1.6, SITE.gateZ + 0.5, 0, 0.9],
    [SITE.gateX + 1.6, SITE.gateZ + 0.5, 0, 0.9],
  ];
  group.userData.modern = []; // cose di oggi: spariscono nelle epoche passate
  potSpots.forEach(([x, z, y, s], i) => {
    const p = createPotPlant({ seed: 11 + i, mats, uniforms, scale: s });
    p.position.set(x, y, z);
    group.add(p);
    if (i >= 6) group.userData.modern.push(p); // i vasi davanti alla portada
  });
  return group;
}
