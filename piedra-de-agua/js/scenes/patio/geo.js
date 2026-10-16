// Utilidades de geometría: fusión, UV en metros, muros con vanos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function clean(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  }
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.morphAttributes = {};
  return geo;
}

export function merge(list) {
  const geos = list.filter(Boolean).map(clean);
  if (!geos.length) return new THREE.BufferGeometry();
  const out = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Coloca una geometría (posición, rotación euler, escala).
export function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m);
  return geo;
}

// Caja con su base en y0 (no centrada en altura).
export function box(w, h, d, x = 0, y0 = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  return place(g, x, y0 + h / 2, z, 0, ry, 0);
}

// UV en metros según la cara (proyección triplanar simple): texturas sin estirar.
export function worldUV(geo, scale = 1, offset = [0, 0]) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv.setXY(i, u * scale + offset[0], v * scale + offset[1]);
  }
  uv.needsUpdate = true;
  return geo;
}

// Muro recto de longitud `len` a lo largo de X local, con vanos rectangulares.
// openings: [{ c: centro en X, w: ancho, h: alto }]. Devuelve lista de cajas.
export function wallPieces(len, height, thick, openings = [], y0 = 0) {
  const out = [];
  const ops = [...openings].sort((a, b) => a.c - b.c);
  let x = -len / 2;
  for (const o of ops) {
    const l = o.c - o.w / 2, r = o.c + o.w / 2;
    if (l > x + 0.001) out.push(box(l - x, height, thick, (x + l) / 2, y0, 0));
    if (o.h < height) out.push(box(o.w, height - o.h, thick, o.c, y0 + o.h, 0));
    x = r;
  }
  if (x < len / 2 - 0.001) out.push(box(len / 2 - x, height, thick, (x + len / 2) / 2, y0, 0));
  return out;
}

// Perfil de arco de medio punto (para vanos y molduras).
export function archOpeningPath(path, w, hSpring, cx = 0, y0 = 0, segments = 24) {
  const r = w / 2;
  path.moveTo(cx - r, y0);
  path.lineTo(cx - r, y0 + hSpring);
  path.absarc(cx, y0 + hSpring, r, Math.PI, 0, true);
  path.lineTo(cx + r, y0);
  path.lineTo(cx - r, y0);
  return path;
}

// Invierte el sentido de los triángulos (para hacer piezas de dos caras).
export function flipped(g) {
  const geo = clean(g.clone());
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 3) {
    for (const a of [pos, nor, uv]) {
      const n = a.itemSize;
      for (let k = 0; k < n; k++) {
        const t = a.array[(i + 1) * n + k];
        a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k];
        a.array[(i + 2) * n + k] = t;
      }
    }
  }
  for (let i = 0; i < nor.array.length; i++) nor.array[i] *= -1;
  return geo;
}

export function twoSided(g) {
  return merge([g, flipped(g)]);
}

// Tubo a lo largo de una curva (hierro forjado, varillas).
export function tube(curve, radius = 0.01, segs = 24, radial = 5) {
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

// Curva 2D (en un plano local XY) a partir de puntos de control bezier cúbicos.
export function bez(p0, p1, p2, p3, z = 0) {
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(p0[0], p0[1], z), new THREE.Vector3(p1[0], p1[1], z),
    new THREE.Vector3(p2[0], p2[1], z), new THREE.Vector3(p3[0], p3[1], z),
  );
}

// Espiral (voluta) en el plano XY.
export class SpiralCurve extends THREE.Curve {
  constructor(r0 = 0.1, turns = 1.5, cx = 0, cy = 0, start = 0, dir = 1, z = 0) {
    super();
    Object.assign(this, { r0, turns, cx, cy, start, dir, z });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = this.start + this.dir * t * this.turns * Math.PI * 2;
    const r = this.r0 * (1 - t * 0.85);
    return target.set(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, this.z);
  }
}
