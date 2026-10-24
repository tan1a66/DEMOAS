// Palmas reales del patio, arecas en macetas, almendros de la banqueta y matas del jardín.
import * as THREE from 'three';
import { FL, GR, L } from './layout.js';
import { lathe, potGeometry, instanced, mat4, mergeGeometries, clean, place } from './kit.js';
import { rng } from './textures.js';

const PI = Math.PI;

// Fronda arqueada: tira con pliegue en V (los foliolos cuelgan), curvada por la gravedad.
export function frondGeometry({ length = 3.8, width = 1.6, e0 = 0.55, curl = 1.25, fold = 0.45, segs = 12 } = {}) {
  const g = new THREE.PlaneGeometry(1, 1, 2, segs);
  const spine = [];
  let x = 0, y = 0;
  const ds = length / segs;
  for (let j = 0; j <= segs; j++) {
    const t = j / segs;
    const a = e0 - curl * Math.pow(t, 1.35);
    spine.push({ x, y, tx: Math.cos(a), ty: Math.sin(a) });
    x += Math.cos(a) * ds; y += Math.sin(a) * ds;
  }
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i) + 0.5;
    const s = spine[Math.round(v * segs)];
    const taper = Math.sin(PI * Math.min(1, 0.15 + v * 0.95)) * (1 - v * 0.3);
    const w = u * width * taper;
    const droop = Math.abs(w) * fold;
    pos.setXYZ(i, s.x + s.ty * droop, s.y - s.tx * droop, w);
  }
  g.computeVertexNormals();
  return g;
}

function crossedPlanes(w, h, n = 3) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((i / n) * PI);
    parts.push(g);
  }
  return mergeGeometries(parts.map(clean));
}

export function buildPlants(root, M, { quality = 1 } = {}) {
  const r = rng(91);
  const out = {};

  /* ---------- Palmas reales ---------- */
  M.tronco.map.repeat.set(1, 7);
  const trunks = [], shafts = [];
  const fr = [[], [], []];
  for (const [x, z, h] of L.palms) {
    trunks.push(lathe([[0, -0.2], [0.44, -0.2], [0.4, 0.15], [0.32, 0.6], [0.29, h * 0.16], [0.3, h * 0.34], [0.34, h * 0.52], [0.31, h * 0.7], [0.26, h * 0.85], [0, h * 0.85]], 14).translate(x, GR, z));
    shafts.push(lathe([[0, h * 0.85], [0.265, h * 0.85], [0.29, h * 0.92], [0.25, h * 0.985], [0.14, h * 1.01], [0, h * 1.02]], 14).translate(x, GR, z));
    const top = GR + h * 0.99;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * PI * 2 + r() * 0.35;
      const kind = i % 3;
      fr[kind].push(mat4(x, top - kind * 0.12, z, az, 0.88 + r() * 0.26));
    }
  }
  const trunkMesh = new THREE.Mesh(mergeGeometries(trunks.map(clean)), M.tronco);
  const shaftMesh = new THREE.Mesh(mergeGeometries(shafts.map(clean)), M.capitel);
  for (const m of [trunkMesh, shaftMesh]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
  const frondKinds = [
    frondGeometry({ length: 3.6, width: 1.7, e0: 1.05, curl: 1.55, fold: 0.5 }),
    frondGeometry({ length: 4.0, width: 1.8, e0: 0.45, curl: 1.35, fold: 0.5 }),
    frondGeometry({ length: 3.8, width: 1.7, e0: -0.1, curl: 1.1, fold: 0.55 }),
  ];
  fr.forEach((list, k) => {
    const im = instanced(frondKinds[k], M.fronda, list);
    im.customDepthMaterial = M.frondaDepth;
    root.add(im);
  });

  /* ---------- Arecas en macetas ---------- */
  const potted = [
    [-1.32, FL, 0.6], [1.32, FL, 0.6], [-1.45, FL, -9.35], [1.45, FL, -9.35],
    [-4.4, GR, -26.95], [2.8, GR, -26.95], [6.3, GR, -26.95], [-8.1, GR, -26.9],
    [-12.05, FL, -20.4], [-12.05, FL, -16.8], [9.15, GR, -18.5], [9.15, GR, -22.6],
    [-12.0, FL, -10.6], [9.0, FL, -10.6], [-8.2, GR, -14.3], [8.9, GR, -14.2],
    [-12.4, FL, -2.0], [12.4, FL, -2.0],
  ];
  const ground = [[-4.4, 0.25, 5.4], [-9.6, 0.25, 4.0], [-14.6, 0.25, 5.6], [-12.2, 0.25, 2.2], [4.6, 0.25, 6.7], [10.4, 0.25, 6.6], [15.5, 0.25, 6.2], [-16.5, 0.24, -6], [16.4, 0.24, -5]];
  const potM = [], canes = [], arecaM = [];
  const areca = (x, y, z, s) => {
    const nC = 3;
    for (let c = 0; c < nC; c++) {
      const a = r() * PI * 2, d = 0.06 + r() * 0.08, hc = (0.9 + r() * 0.8) * s;
      const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
      canes.push(place(new THREE.CylinderGeometry(0.022, 0.03, hc, 5), cx, y + hc / 2, cz, 0, Math.cos(a) * 0.08, Math.sin(a) * 0.08));
      const nF = 4;
      for (let f = 0; f < nF; f++) {
        arecaM.push(mat4(cx, y + hc, cz, r() * PI * 2, (0.75 + r() * 0.4) * s, 0, (r() - 0.5) * 0.5));
      }
    }
  };
  for (const [x, y, z] of potted) { potM.push(mat4(x, y, z, 0, 1)); areca(x, y + 0.7, z, 1.15); }
  for (const [x, y, z] of ground) areca(x, y, z, 1.0);
  // macetas con pasto alto en el portón
  for (const s of [-1, 1]) potM.push(mat4(s * 2.62, 0.25, 7.3, 0, 0.95));
  root.add(instanced(potGeometry(0.44, 0.78), M.maceta, potM));
  const caneMesh = new THREE.Mesh(mergeGeometries(canes.map(clean)), M.capitel);
  caneMesh.castShadow = true; root.add(caneMesh);
  const arecaIm = instanced(frondGeometry({ length: 1.7, width: 0.95, e0: 1.2, curl: 1.9, fold: 0.3, segs: 8 }), M.areca, arecaM);
  arecaIm.customDepthMaterial = M.arecaDepth;
  root.add(arecaIm);

  /* ---------- Almendros ---------- */
  const trees = [
    [-6.0, 0.15, 10.6, 1.05], [6.4, 0.15, 10.6, 1.0], [-18.0, 0.15, 10.6, 0.95], [18.6, 0.15, 10.6, 1.05], [-30, 0.15, 10.6, 1], [31, 0.15, 10.6, 1],
    [-24, 0.15, 28.8, 1], [-11.5, 0.15, 28.8, 1.1], [5.6, 0.15, 28.8, 0.95], [12.5, 0.15, 28.8, 1.05], [25, 0.15, 28.8, 1],
    [-17.5, 0.24, -15, 1.15], [-19.5, 0.24, -26, 1.2], [15.8, 0.24, -19, 1.15], [16.2, 0.24, -30.5, 1.2],
    [-6, 0, -35, 1.25], [6.5, 0, -36, 1.2], [-21.5, 0.24, -3.5, 1.0], [21.5, 0.24, -6, 1.0],
  ];
  const tTrunks = [], cards = [];
  const tiers = [[3.9, 4.0, 40], [5.0, 3.4, 32], [6.1, 2.6, 22], [7.0, 1.6, 10]];
  for (const [x, y, z, s] of trees) {
    tTrunks.push(lathe([[0, 0], [0.26, 0], [0.2, 0.4], [0.17, 2.4], [0.14, 3.6], [0, 3.6]], 8).scale(s, s, s).translate(x, y, z));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + r();
      const br = new THREE.CylinderGeometry(0.04, 0.08, 2.0, 5);
      br.translate(0, 1.0, 0);
      br.rotateZ(-1.15); br.rotateY(a);
      tTrunks.push(br.scale(s, s, s).translate(x, y + 3.45 * s, z));
    }
    for (const [ty, rad, n] of tiers) {
      for (let i = 0; i < n * quality; i++) {
        const a = r() * PI * 2, d = rad * Math.sqrt(0.25 + r() * 0.75);
        cards.push(mat4(x + Math.cos(a) * d * s, y + (ty + (r() - 0.5) * 0.5) * s, z + Math.sin(a) * d * s, r() * PI * 2, (1.15 + r() * 0.45) * s, (r() - 0.5) * 0.9, (r() - 0.5) * 0.5));
      }
    }
  }
  const tMesh = new THREE.Mesh(mergeGeometries(tTrunks.map(clean)), M.troncoAlmendro);
  tMesh.castShadow = true; tMesh.receiveShadow = true; root.add(tMesh);
  const cardGeo = new THREE.PlaneGeometry(1, 1); cardGeo.rotateX(-PI / 2);
  const cardIm = instanced(cardGeo, M.almendro, cards);
  cardIm.customDepthMaterial = M.almendroDepth;
  root.add(cardIm);

  /* ---------- Matas de pasto ---------- */
  const tufts = [];
  const free = (x, z) => Math.abs(x) > 1.75 && !(Math.abs(x) < 2.3 && z < 3.2);
  for (let i = 0; i < 120 * quality; i++) {
    const x = -17.2 + r() * 15.2, z = 1.8 + r() * 5.8;
    if (free(x, z)) tufts.push(mat4(x, 0.25, z, r() * PI, 0.7 + r() * 0.5));
  }
  for (let i = 0; i < 46 * quality; i++) {
    const x = 1.9 + r() * 15.5, z = 5.6 + r() * 2.0;
    if (free(x, z)) tufts.push(mat4(x, 0.25, z, r() * PI, 0.7 + r() * 0.45));
  }
  for (let x = 2.4; x < 12.8; x += 0.85 + r() * 0.4) tufts.push(mat4(x, 0.24, 1.85 + r() * 0.3, r() * PI, 0.75 + r() * 0.3));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) tufts.push(mat4(s * 2.62 + (r() - 0.5) * 0.2, 0.96, 7.3 + (r() - 0.5) * 0.2, r() * PI, 1.25));
  const tuftIm = instanced(crossedPlanes(0.85, 0.95), M.pastoMata, tufts, { cast: true, receive: false });
  tuftIm.customDepthMaterial = M.pastoMataDepth;
  root.add(tuftIm);

  /* ---------- Cortina de hojas de la intro (delante de la cámara) ---------- */
  const curtain = new THREE.Group();
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const curtainLeaves = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const m = new THREE.Mesh(leafGeo, M.almendro);
    const bx = side * (0.2 + r() * 2.4), by = 0.9 + r() * 3.0;
    m.position.set(bx, by, (r() - 0.5) * 1.2);
    m.rotation.set((r() - 0.5) * 0.8, (r() - 0.5) * 0.8, r() * PI);
    m.scale.setScalar(1.7 + r() * 1.1);
    m.userData.base = m.position.clone();
    m.userData.side = side;
    curtainLeaves.push(m); curtain.add(m);
  }
  curtain.position.set(0, 0, 25.5);
  curtain.visible = false;
  root.add(curtain);
  out.curtain = curtain; out.curtainLeaves = curtainLeaves;
  return out;
}
