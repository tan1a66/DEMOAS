// Vegetación: copas de laurel como nubes de arcilla (varias esferas suaves fundidas, con la
// oclusión pintada en los vértices) y palmeras para la silueta de la ciudad.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './build.js';

/** Ruido 3D barato (suma de senos) para abollar las esferas. */
const lumpy = (x, y, z, s) =>
  Math.sin(x * 3.1 + s) * Math.sin(y * 2.7 + s * 1.3) * Math.sin(z * 3.3 + s * 0.7) +
  0.5 * Math.sin(x * 6.3 - s) * Math.sin(y * 5.9 + s) * Math.sin(z * 6.7);

/**
 * Variantes de copa (radio ~1, centrada en el origen, base aplanada).
 * Atributos: position, normal, color (oclusión: más oscura abajo y en los pliegues).
 */
export function canopyGeometries(count = 4, seed = 3) {
  const rand = rng(seed);
  const out = [];
  for (let v = 0; v < count; v++) {
    const parts = [];
    const blobs = [{ x: 0, y: 0.05, z: 0, r: 0.72 }];
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.35 + rand() * 0.3;
      blobs.push({ x: Math.cos(a) * d, y: -0.1 + rand() * 0.45, z: Math.sin(a) * d, r: 0.38 + rand() * 0.24 });
    }
    for (const b of blobs) {
      let g = new THREE.IcosahedronGeometry(1, 2);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      const pos = g.attributes.position;
      const s = rand() * 10;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const k = 1 + 0.09 * lumpy(x, y, z, s);
        pos.setXYZ(i, b.x + x * b.r * k, b.y + y * b.r * k * 0.88, b.z + z * b.r * k);
      }
      g.computeVertexNormals();
      parts.push(g);
    }
    const geo = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
    // Oclusión pintada: base y centro más oscuros, como una copa real llena de sombra.
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const h = THREE.MathUtils.smoothstep(y, -0.75, 0.75);
      const r = Math.hypot(x, y * 0.8, z);
      const c = (0.5 + 0.5 * h) * (0.72 + 0.28 * THREE.MathUtils.smoothstep(r, 0.55, 1.05));
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    out.push(geo);
  }
  return out;
}

/** Tronco con dos ramas, altura unitaria (se escala en Y por instancia). */
export function trunkGeometry() {
  const parts = [
    new THREE.CylinderGeometry(0.16, 0.3, 1, 7).translate(0, 0.5, 0),
    new THREE.CylinderGeometry(0.07, 0.13, 0.55, 6).translate(0, 0.27, 0).rotateZ(0.6).translate(0.02, 0.62, 0),
    new THREE.CylinderGeometry(0.06, 0.12, 0.5, 6).translate(0, 0.25, 0).rotateZ(-0.55).rotateY(1.9).translate(-0.02, 0.7, 0.02),
  ].map((g) => {
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  });
  return mergeGeometries(parts, false);
}

/**
 * Palmera (cocotero) para el horizonte: tronco curvo y hojas colgantes de doble cara.
 * Devuelve una geometría con position + normal, base en el origen.
 */
export function palmGeometry(height = 11, seed = 1) {
  const rand = rng(seed);
  const lean = (rand() - 0.5) * 2.4;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(lean * t * t, height * t, 0));
  }
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.2, 6, false);
  const top = pts[pts.length - 1];
  const parts = [trunk];
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const len = 3.2 + rand() * 0.8;
    const g = new THREE.PlaneGeometry(0.55, len, 1, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + len / 2; // 0 en la base de la hoja
      const k = y / len;
      // La hoja se estrecha y cae hacia la punta.
      p.setX(i, p.getX(i) * (1 - k * 0.85));
      p.setY(i, y * 0.55 - k * k * len * 0.65);
      p.setZ(i, y * 0.85);
    }
    g.rotateY((f / fronds) * Math.PI * 2 + rand() * 0.3);
    g.translate(top.x, top.y, top.z);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const back = g.clone();
    const idx = back.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i], idx[i + 2]] = [idx[i + 2], idx[i]];
    back.computeVertexNormals();
    parts.push(g, back);
  }
  trunk.deleteAttribute('uv');
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
}
