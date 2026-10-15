// Utilidades para construir geometría low-poly y fusionarla en pocas mallas
// (todo comparte el mismo material de "arcilla", así que fusionar = menos draw calls).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Acumula geometrías transformadas y las fusiona en una sola. */
export class GeoBag {
  constructor() {
    this.parts = [];
  }

  /** Añade una geometría con posición, rotación (euler en radianes) y escala. */
  add(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    return this.addMatrix(geo, m);
  }

  addMatrix(geo, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    // Solo posición y normal: así todas las piezas son compatibles al fusionar.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    this.parts.push(g);
    return this;
  }

  /** Caja apoyada en el suelo: (x, z) es el centro de la base, y la cota inferior. */
  box(w, h, d, x, y, z, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), { x, y: y + h / 2, z, ry });
  }

  /** Añade otra bolsa transformada por una matriz (para piezas compuestas reutilizables). */
  addBag(bag, matrix) {
    bag.parts.forEach((g) => this.addMatrix(g, matrix));
    return this;
  }

  merge() {
    const geo = mergeGeometries(this.parts, false);
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    geo.computeBoundingSphere();
    return geo;
  }

  mesh(material, { cast = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(this.merge(), material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

/** Matriz a partir de posición + rotación Y (atajo frecuente). */
export const at = (x, y, z, ry = 0, s = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(s, s, s),
  );

/**
 * Fachada con arcos (portales): rectángulo extruido con huecos de arco de medio punto.
 * El origen es el centro inferior de la cara frontal; la fachada mira a +Z.
 */
export function arcadeGeometry({ width, height, depth = 0.6, arches, archWidth, archHeight, sill = 0, segments = 6 }) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();

  const step = width / arches;
  const r = archWidth / 2;
  for (let i = 0; i < arches; i++) {
    const cx = -width / 2 + step * (i + 0.5);
    const hole = new THREE.Path();
    hole.moveTo(cx - r, sill);
    hole.lineTo(cx + r, sill);
    hole.lineTo(cx + r, archHeight - r);
    hole.absarc(cx, archHeight - r, r, 0, Math.PI, false);
    hole.lineTo(cx - r, sill);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments });
  geo.translate(0, 0, -depth);
  return geo;
}

/** Generador pseudoaleatorio con semilla: la escena es siempre idéntica. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
