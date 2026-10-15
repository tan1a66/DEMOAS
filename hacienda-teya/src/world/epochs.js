// ─────────────────────────────────────────────────────────────────────────────
//  Le epoche dell'hacienda (Antes → Hoy)
//
//  Lo stesso luogo in tre tempi, guidati dalla linea del tempo di "Historia":
//  - henequén (fine '800): binari Decauville con i carrelli di pencas e i
//    tendederos con la fibra stesa al sole davanti alla portada
//  - abbandono (metà '900): il henequén sparisce, il monte (boscaglia bassa)
//    si riprende i campi, l'intonaco cade (vedi RUIN_GLSL in materials.js)
//  - oggi: restauro, il monte si ritira, prato e alberi attorno alla casa
//
//  Lo stato arriva da update(era): { field, wild, clear, garden, props, sink }
//  (tutti 0…1, vedi eraState in era.js)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../scene/agave.js';
import { woodMaterial } from './materials.js';
import { SITE } from './hacienda.js';
import { FIELD, createTree, leafClusterTexture } from './vegetation.js';

// binario lungo la strada, sul lato destro (passa sotto l'arco della strada)
export const TRACK = { x: SITE.roadX + 1.4, gauge: 0.6, z0: 30, z1: SITE.gateZ - 4 };
// da dove si allarga il giardino di oggi
export const GARDEN_CENTER = new THREE.Vector2(SITE.roadX, SITE.gateZ + 4);

// materiali che svaniscono "come un ricordo" (alphaHash: dissolvenza a puntini)
function fading(mat) {
  mat.alphaHash = true;
  return mat;
}

// ── Binario Decauville ───────────────────────────────────────────────────────
function createTrack(woodMat) {
  const g = new THREE.Group();
  const len = TRACK.z0 - TRACK.z1;
  const railMat = fading(new THREE.MeshStandardMaterial({ color: '#3a3532', metalness: 0.7, roughness: 0.45 }));
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, len), railMat);
    r.position.set(TRACK.x + side * TRACK.gauge * 0.5, 0.085, (TRACK.z0 + TRACK.z1) / 2);
    r.castShadow = true;
    r.receiveShadow = true;
    g.add(r);
  }
  // traversine di legno, leggermente irregolari
  const rnd = mulberry32(31);
  const step = 0.65;
  const n = Math.floor(len / step);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.06, 0.13), woodMat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.08);
    m.compose(new THREE.Vector3(TRACK.x + (rnd() - 0.5) * 0.05, 0.03, TRACK.z0 - i * step), q, new THREE.Vector3(1, 1, 1));
    sleepers.setMatrixAt(i, m);
  }
  sleepers.receiveShadow = true;
  sleepers.castShadow = true;
  g.add(sleepers);
  return { group: g, mats: [railMat, woodMat] };
}

// ── Penca tagliata (foglia di henequén senza spine, a V) ─────────────────────
function pencaGeometry(rnd) {
  const L = 1.35 + rnd() * 0.3;
  const W = 0.11 + rnd() * 0.03;
  const geo = new THREE.PlaneGeometry(L, W, 8, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = (x + L / 2) / L; // 0 base → 1 punta
    const y = p.getY(i) * (1 - 0.75 * t * t); // si stringe verso la punta
    p.setXYZ(i, x, y, Math.abs(y) * 0.6 + Math.sin(t * Math.PI) * 0.03); // canale a V
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

// ── Carrello (plataforma) carico di pencas ───────────────────────────────────
function createCart(seed, woodMat, ironMat, leafMat) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 2.0), woodMat);
  deck.position.y = 0.36;
  g.add(deck);
  for (const side of [-1, 1]) {
    // sponde basse
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 2.0), woodMat);
    rail.position.set(side * 0.57, 0.46, 0);
    g.add(rail);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const zs of [-0.62, 0.62]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6), ironMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.24, zs);
    g.add(axle);
    for (const xs of [-0.3, 0.3]) {
      const w = new THREE.Mesh(wheelGeo, ironMat);
      w.position.set(xs, 0.24, zs);
      g.add(w);
    }
  }
  // tre strati di pencas legate, lungo il carrello
  const leaves = [];
  for (let layer = 0; layer < 4; layer++) {
    const count = 9 - layer * 2;
    for (let i = 0; i < count; i++) {
      const lg = pencaGeometry(rnd);
      lg.rotateY(Math.PI / 2 + (rnd() - 0.5) * 0.12 + (rnd() < 0.5 ? Math.PI : 0));
      lg.translate((i - (count - 1) / 2) * 0.12 + (rnd() - 0.5) * 0.03, 0.43 + layer * 0.05, (rnd() - 0.5) * 0.25);
      leaves.push(lg);
    }
  }
  const load = new THREE.Mesh(mergeGeometries(leaves), leafMat);
  g.add(load);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// ── Fibra stesa al sole: matasse color crema appese a un palo ────────────────
function fiberTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(77);
  for (let k = 0; k < 46; k++) {
    // una matassa: fili che scendono dal palo, legati in alto, sfrangiati in basso
    const cx = 12 + k * 22 + (rnd() - 0.5) * 6;
    const len = 190 + rnd() * 50;
    for (let i = 0; i < 26; i++) {
      const off = (rnd() - 0.5) * 16;
      const l = len * (0.8 + rnd() * 0.2);
      const shade = 200 + rnd() * 40;
      ctx.strokeStyle = `rgba(${shade}, ${shade * 0.93}, ${shade * 0.76}, ${0.55 + rnd() * 0.4})`;
      ctx.lineWidth = 0.8 + rnd() * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + off * 0.25, 2);
      ctx.bezierCurveTo(cx + off * 0.6, l * 0.35, cx + off + (rnd() - 0.5) * 6, l * 0.7, cx + off * 1.1 + (rnd() - 0.5) * 8, l);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function createDryingYard(woodMat) {
  const g = new THREE.Group();
  const y = FIELD.yard;
  const x0 = y.x0 + 1;
  const x1 = y.x1 - 1;
  const len = x1 - x0;
  const H = 1.9;
  const map = fiberTexture();
  const fiberMat = fading(
    new THREE.MeshStandardMaterial({ map, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85, color: '#fff7e6' }),
  );
  const postGeo = new THREE.CylinderGeometry(0.055, 0.07, H + 0.1, 7);
  const barGeo = new THREE.CylinderGeometry(0.035, 0.035, len + 0.4, 6);
  barGeo.rotateZ(Math.PI / 2);
  const rows = [y.z0 + 2.2, (y.z0 + y.z1) / 2, y.z1 - 2.2];
  rows.forEach((z, r) => {
    for (let i = 0; i <= 4; i++) {
      const p = new THREE.Mesh(postGeo, woodMat);
      p.position.set(x0 + (i / 4) * len, (H + 0.1) / 2 - 0.05, z);
      p.rotation.z = (Math.sin(i * 7.1 + r) * 0.5) * 0.04;
      g.add(p);
    }
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.position.set((x0 + x1) / 2, H - 0.06, z);
    g.add(bar);
    // la fibra ricade sui due lati del palo, con un po' di pancia
    const curtain = new THREE.PlaneGeometry(len, 1.4, 36, 3);
    const pos = curtain.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const down = (0.7 - py) / 1.4; // 0 in alto → 1 in basso
      pos.setZ(i, Math.sin(px * 1.7 + r) * 0.05 * down + down * down * 0.06);
    }
    curtain.translate(0, H - 0.06 - 0.7, 0);
    curtain.computeVertexNormals();
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(curtain, fiberMat);
      m.position.set((x0 + x1) / 2, 0, z + side * 0.04);
      if (side < 0) m.rotation.y = Math.PI;
      g.add(m);
    }
  });
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.children.filter((o) => o.material === fiberMat).forEach((o) => (o.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.35 })));
  return { group: g, mats: [fiberMat] };
}

// ── Monte: boscaglia bassa istanziata che cresce e poi si ritira ─────────────
function scrubMaterial(map, uniforms) {
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWild = uniforms.uWild;
    shader.uniforms.uClear = uniforms.uClear;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aNormalDir;
        attribute float aSway;
        attribute vec2 aGrow; // (ritardo, 1 = vicino alla casa: si taglia col restauro)
        uniform float uTime;
        uniform float uWild;
        uniform float uClear;`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aNormalDir;')
      .replace(
        '#include <begin_vertex>',
        `float g = smoothstep(aGrow.x, aGrow.x + 0.35, uWild);
        g *= 1.0 - aGrow.y * smoothstep(aGrow.x * 0.5, aGrow.x * 0.5 + 0.4, uClear);
        vec3 transformed = position * g;
        transformed.x += sin(uTime * 1.2 + aSway) * 0.04 * position.y;
        transformed.z += cos(uTime * 1.0 + aSway * 1.3) * 0.03 * position.y;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * vec3(0.2, 0.2, 0.1);`,
    );
  };
  mat.customProgramCacheKey = () => 'scrub';
  return mat;
}

function bushGeometry() {
  // ciuffi inclinati e sfalsati: da ogni lato la sagoma resta irregolare
  const rnd = mulberry32(12);
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const w = 1.3 + rnd() * 0.9;
    const p = new THREE.PlaneGeometry(w, w * (0.75 + rnd() * 0.3));
    p.rotateX((rnd() - 0.5) * 0.7 - (k > 3 ? 1.0 : 0)); // gli ultimi due quasi orizzontali
    p.rotateY((k / 6) * Math.PI * 2 + rnd() * 0.5);
    p.translate((rnd() - 0.5) * 0.7, 0.45 + rnd() * 0.55, (rnd() - 0.5) * 0.7);
    parts.push(p);
  }
  const geo = mergeGeometries(parts);
  // normali "sferiche" dal centro della chioma
  const pos = geo.attributes.position;
  const nd = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i) - 0.2, pos.getZ(i)).normalize();
    v.y += 0.5;
    v.normalize();
    nd.set([v.x, v.y, v.z], i * 3);
  }
  geo.setAttribute('aNormalDir', new THREE.BufferAttribute(nd, 3));
  return geo;
}

function createScrub(quality, uniforms, keepClear) {
  const rnd = mulberry32(404);
  const step = quality.scrubStep;
  const spots = [];
  for (let x = -92; x < 100; x += step) {
    for (let z = -170; z < 46; z += step) {
      const px = x + (rnd() - 0.5) * step * 0.9;
      const pz = z + (rnd() - 0.5) * step * 0.9;
      if (keepClear(px, pz)) continue;
      const dGate = Math.hypot(px - SITE.gateX, pz - SITE.gateZ);
      const dGarden = Math.hypot(px - GARDEN_CENTER.x, pz - GARDEN_CENTER.y);
      // vicino alla portada più bassa: la facciata resta leggibile
      const s = (0.75 + rnd() * rnd() * 1.5) * THREE.MathUtils.lerp(0.7, 1, THREE.MathUtils.smoothstep(dGate, 6, 24));
      spots.push({ x: px, z: pz, s, delay: 0.04 + rnd() * 0.42 + dGate / 420, near: dGarden < 64 ? 1 : 0 });
    }
  }
  const geo = bushGeometry();
  const map = leafClusterTexture(91, 72, 22, 24); // monte secco: verde oliva più chiaro
  const mesh = new THREE.InstancedMesh(geo, scrubMaterial(map, uniforms), spots.length);
  const grow = new Float32Array(spots.length * 2);
  const sway = new Float32Array(spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s * (0.9 + rnd() * 0.3), p.s, p.s * (0.9 + rnd() * 0.3)));
    mesh.setMatrixAt(i, m);
    grow[i * 2] = p.delay;
    grow[i * 2 + 1] = p.near;
    sway[i] = rnd() * 6.28;
  });
  geo.setAttribute('aGrow', new THREE.InstancedBufferAttribute(grow, 2));
  geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 1));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ── Il giardino di oggi: alberi piantati dopo il restauro ────────────────────
const GARDEN_TREES = [
  // x, z, seme, altezza, chioma, ritardo
  [-14, -38, 21, 10, 1.1, 0.0],
  [24, -42, 22, 11, 1.0, 0.12],
  [-25, -21, 23, 9, 1.05, 0.25],
  [26, -20, 24, 10, 1.1, 0.3],
  [-11, -7, 25, 9, 1.0, 0.4],
  [16, -5, 26, 10, 1.0, 0.45],
  [-31, -44, 27, 12, 1.15, 0.15],
  [33, -46, 28, 11, 1.1, 0.2],
];

export function createEpochs(quality, mats, uniforms, { modern = [] } = {}) {
  const group = new THREE.Group();

  // l'epoca del henequén
  const woodPast = fading(woodMaterial());
  const ironPast = fading(new THREE.MeshStandardMaterial({ color: '#2b2622', metalness: 0.6, roughness: 0.55 }));
  const leafPast = fading(new THREE.MeshStandardMaterial({ color: '#66764f', roughness: 0.55, side: THREE.DoubleSide }));
  const track = createTrack(woodPast);
  group.add(track.group);
  const carts = [
    [TRACK.z1 + 11, 3],
    [-16, 5],
  ].map(([z, seed]) => {
    const c = createCart(seed, woodPast, ironPast, leafPast);
    c.position.set(TRACK.x, 0, z);
    group.add(c);
    return c;
  });
  const yard = createDryingYard(woodPast);
  group.add(yard.group);
  const pastMats = [woodPast, ironPast, leafPast, ...track.mats, ...yard.mats];

  // il monte: lontano dalla strada, dalla casa e dal punto di vista della Historia
  const keepClear = (x, z) =>
    (x > SITE.courtMinX - 5 && x < SITE.courtMaxX + 5 && z > -132 && z < SITE.gateZ + 2.5) ||
    (Math.abs(x - SITE.roadX) < 3.6 && z > SITE.gateZ - 2) ||
    Math.hypot(x - 9.5, z + 24) < 9 ||
    Math.hypot(x - 15, z + 19) < 8 ||
    Math.hypot(x, z) < 2.2;
  const scrub = createScrub(quality, uniforms, keepClear);
  group.add(scrub);

  // il giardino di oggi
  const trees = GARDEN_TREES.slice(0, quality.gardenTrees).map(([x, z, seed, h, sp, delay]) => {
    const t = createTree({ seed, height: h, spread: sp, cards: quality.treeCards, uniforms });
    t.position.set(x, 0, z);
    t.rotation.y = seed;
    t.userData.delay = delay;
    t.visible = false;
    group.add(t);
    return t;
  });

  return {
    group,
    update(era) {
      // oggetti dell'epoca del henequén: svaniscono come un ricordo
      const o = 1 - era.props;
      pastMats.forEach((m) => (m.opacity = o));
      const show = o > 0.01;
      yard.group.visible = show;
      carts.forEach((c) => (c.visible = show));
      // il binario resta e poi sprofonda sotto la terra e il prato
      track.group.position.y = -0.16 * era.sink;
      track.group.visible = era.sink < 0.999;
      scrub.visible = era.wild > 0.001;
      for (const t of trees) {
        const k = THREE.MathUtils.smoothstep(era.garden, t.userData.delay * 0.6, t.userData.delay * 0.6 + 0.45);
        t.visible = k > 0.001;
        t.scale.setScalar(0.12 + 0.88 * (1 - Math.pow(1 - k, 2)));
      }
      for (const m of modern) m.visible = era.garden > 0.3;
    },
  };
}
