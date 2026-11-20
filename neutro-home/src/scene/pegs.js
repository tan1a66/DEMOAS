// Ganchos de cedro torneados (como los "ganchos de hamaca" que incluye la pieza):
// cuello delgado junto al muro que se abre en una cabeza redondeada.

import * as THREE from 'three';
import { PEGS } from '../config.js';

const PROFILE = [
  // [radio, distancia al muro]
  [0.0, 0.0],
  [0.027, 0.0],
  [0.0272, 0.003],
  [0.0225, 0.009],
  [0.0185, 0.02],
  [0.017, 0.04],
  [0.0172, 0.08],
  [0.019, 0.094],
  [0.026, 0.106],
  [0.035, 0.116],
  [0.0405, 0.126],
  [0.0415, 0.134],
  [0.0385, 0.142],
  [0.03, 0.1485],
  [0.017, 0.1525],
  [0.0, 0.154],
];

export function buildPegs(textures, xs) {
  const pts = [];
  // perfil suavizado con una curva
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  for (const p of curve.getPoints(48)) pts.push(new THREE.Vector2(Math.max(0, p.x), p.y));
  pts[0].set(0, 0);
  pts[pts.length - 1].set(0, PROFILE[PROFILE.length - 1][1]);
  const geo = new THREE.LatheGeometry(pts, 40);
  geo.rotateX(Math.PI / 2); // eje del torneado → hacia fuera del muro (+z)

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: textures.cedar,
    roughness: 0.62,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    sheen: 0.3,
    sheenColor: new THREE.Color('#e0a070'),
    sheenRoughness: 0.6,
    envMapIntensity: 0.8,
  });
  const group = new THREE.Group();
  for (const x of xs) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, PEGS.y, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
