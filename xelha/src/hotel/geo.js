import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// El edificio es un arco cóncavo alrededor del origen: el ángulo θ = 0 queda al fondo (−Z)
// y la fachada principal mira hacia el patio (+Z). Unidades en metros.
export const polar = (r, a, y = 0) => new THREE.Vector3(r * Math.sin(a), y, -r * Math.cos(a));

// Marco local sobre el arco: x = tangente (θ creciente), y = arriba, z = hacia el patio.
export function arcFrame(a, r, y = 0) {
  const t = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const inward = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  return new THREE.Matrix4().makeBasis(t, new THREE.Vector3(0, 1, 0), inward).setPosition(polar(r, a, y));
}

// Caja definida por sus límites (x0..x1, y0..y1, z0..z1) en coordenadas locales.
export function boxGeo(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  return g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// Sector de corona extruido: radios r0..r1 (pueden ser funciones de θ), ángulos a0..a1.
export function arcSlab(r0, r1, a0, a1, y0, y1, step = 0.02) {
  const inner = typeof r0 === 'function' ? r0 : () => r0;
  const outer = typeof r1 === 'function' ? r1 : () => r1;
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const r = outer(a);
    pts.push(new THREE.Vector2(r * Math.sin(a), r * Math.cos(a)));
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    const r = inner(a);
    pts.push(new THREE.Vector2(r * Math.sin(a), r * Math.cos(a)));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// Cinta vertical (vidrio de barandal) siguiendo una lista de puntos en planta.
export function ribbon(points, y0, y1) {
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
    const quad = [
      [a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z],
      [a.x, y0, a.z], [b.x, y1, b.z], [a.x, y1, a.z],
    ];
    for (const q of quad) {
      pos.push(...q);
      nor.push(n.x, n.y, n.z);
      uv.push(0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Agrupa geometrías por material y las fusiona: pocas llamadas de dibujo por piso.
export class Buckets {
  constructor() {
    this.map = new Map();
  }

  add(key, geo, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(g);
    return g;
  }

  build(materials, { castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.map) {
      const mat = materials[key];
      if (!mat) throw new Error(`Material desconocido: ${key}`);
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = key;
      mesh.castShadow = castShadow && !mat.transparent;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    this.map.clear();
    return group;
  }
}

// PRNG determinista (las escenas salen idénticas en cada carga).
export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
