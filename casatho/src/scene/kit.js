// Piezas básicas de geometría y un "lote" que fusiona todo lo estático por material
// (pocas llamadas de dibujo = fluido en iPhone).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function place(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m);
  return geo;
}

function clean(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

export class Batch {
  constructor() { this.groups = new Map(); }
  add(key, geo) {
    if (!this.groups.has(key)) this.groups.set(key, []);
    this.groups.get(key).push(clean(geo));
    return geo;
  }
  build(materials, parent, shadowFlags = {}) {
    for (const [key, list] of this.groups) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, materials[key]);
      const f = shadowFlags[key] || { cast: true, receive: true };
      mesh.castShadow = f.cast; mesh.receiveShadow = f.receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.name = key;
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

/* ---------- Primitivas ---------- */

// Caja definida por esquinas (más fácil de razonar en planta).
export function boxFromTo(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  return place(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// Plano horizontal con UV en metros (para texturas que se repiten).
export function floor(x0, z0, x1, z1, y, tile = 1, uOff = 0, vOff = 0) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile + uOff, -pos.getZ(i) / tile + vOff);
  return g;
}

// Caja con UV en metros en la cara superior (para banquetas, escalones).
export function slab(x0, y0, z0, x1, y1, z1, tile = 1) {
  const g = boxFromTo(x0, y0, z0, x1, y1, z1);
  const pos = g.attributes.position, uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
    else if (nx > 0.5) uv.setXY(i, pos.getZ(i) / tile, pos.getY(i) / tile);
    else uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  }
  return g;
}

export function lathe(profile, segs = 20) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

// Tímpano/enjuta de un arco: rectángulo con el medio punto recortado, extruido en Z.
export function archPanel(xl, xr, ySpring, yTop, r, depth) {
  const mid = (xl + xr) / 2;
  const s = new THREE.Shape();
  s.moveTo(xl, ySpring);
  s.lineTo(mid - r, ySpring);
  s.absarc(mid, ySpring, r, Math.PI, 0, true);
  s.lineTo(xr, ySpring);
  s.lineTo(xr, yTop);
  s.lineTo(xl, yTop);
  s.lineTo(xl, ySpring);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Medio disco (para vidrios bajo los arcos de celosía).
export function halfDisc(r, segs = 20) {
  return new THREE.CircleGeometry(r, segs, 0, Math.PI);
}

/* ---------- Órdenes clásicos estilizados ---------- */

// Columna jónica: basa, fuste con éntasis y capitel con volutas.
export function ionicColumn(h, r) {
  const parts = [];
  const shaftH = h - 0.62;
  // basa ática
  parts.push(lathe([[0, 0], [r * 1.42, 0], [r * 1.42, 0.06], [r * 1.3, 0.1], [r * 1.36, 0.14], [r * 1.18, 0.2], [r * 1.12, 0.24], [r * 1.02, 0.26], [0, 0.26]], 22));
  // fuste
  const prof = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const rr = r * (1 - 0.13 * Math.pow(t, 1.6)) * (1 + 0.025 * Math.sin(Math.PI * t * 0.8));
    prof.push([rr, 0.26 + t * shaftH]);
  }
  prof.unshift([0, 0.26]); prof.push([0, 0.26 + shaftH]);
  parts.push(lathe(prof, 22));
  const top = 0.26 + shaftH;
  const rt = r * 0.87;
  // collarino y equino
  parts.push(place(new THREE.TorusGeometry(rt * 1.02, 0.028, 6, 22), 0, top + 0.02, 0, 0, Math.PI / 2));
  parts.push(lathe([[0, 0], [rt * 1.05, 0], [rt * 1.28, 0.1], [rt * 1.3, 0.14], [0, 0.14]], 22).translate(0, top + 0.04, 0));
  // banda de volutas
  const vw = rt * 3.0, vy = top + 0.2;
  parts.push(place(new THREE.BoxGeometry(vw * 0.78, 0.13, rt * 2.05), 0, vy, 0));
  for (const sx of [-1, 1]) {
    parts.push(place(new THREE.CylinderGeometry(0.1, 0.1, rt * 2.15, 14), sx * vw * 0.42, vy - 0.03, 0, 0, Math.PI / 2));
    for (const sz of [-1, 1]) {
      parts.push(place(new THREE.TorusGeometry(0.06, 0.018, 5, 12), sx * vw * 0.42, vy - 0.03, sz * rt * 1.08, 0, 0));
    }
  }
  // ábaco
  parts.push(place(new THREE.BoxGeometry(rt * 2.75, 0.06, rt * 2.75), 0, top + 0.31, 0));
  parts.push(place(new THREE.BoxGeometry(rt * 2.6, 0.04, rt * 2.6), 0, top + 0.355, 0));
  return mergeGeometries(parts.map(clean), false);
}

export function baluster(h = 0.62) {
  return lathe([
    [0, 0], [0.065, 0], [0.065, 0.05], [0.045, 0.07], [0.075, h * 0.3], [0.068, h * 0.42],
    [0.036, h * 0.62], [0.04, h * 0.82], [0.055, h * 0.88], [0.055, h], [0, h],
  ], 10);
}

// Maceta blanca redondeada.
export function potGeometry(r = 0.42, h = 0.75) {
  return lathe([[0, 0.02], [r * 0.62, 0], [r * 0.95, h * 0.35], [r, h * 0.7], [r * 0.94, h * 0.97], [r * 1.02, h], [r * 0.88, h], [r * 0.88, h * 0.92], [0, h * 0.92]], 18);
}

export function instanced(geo, mat, matrices, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = receive;
  im.computeBoundingSphere();
  return im;
}

export function mat4(x, y, z, ry = 0, s = 1, rx = 0, rz = 0, sy = s, sz = s) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(s, sy, sz));
}

export { mergeGeometries, clean };
