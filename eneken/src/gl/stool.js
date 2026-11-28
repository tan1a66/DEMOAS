// Taburete de Casa Skoura: tres rodajas de tronco apiladas, en madera (parota aceitada).
import * as THREE from 'three';
import { patch } from './core.js';
import { WOOD } from './glsl.js';

// Esfera de radio 1 (k = 0) o taburete de tres rodajas apiladas (k = 1).
export function shapeSphere(geo, polar, meanR, k = 0, stoolR = 1, stoolH = 2) {
  const base = geo.userData.base || (geo.userData.base = geo.attributes.position.array.slice());
  const pos = geo.attributes.position.array;
  const m = 2 + k * 8.0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const rr = Math.pow(Math.pow(Math.hypot(x, z), m) + Math.pow(Math.abs(y), m), 1 / m) || 1;
    const yy = y / rr;
    const joint = Math.max(Math.exp(-((yy - 0.333) ** 2) / 0.0035), Math.exp(-((yy + 0.333) ** 2) / 0.0035));
    const groove = 1 - 0.1 * joint * k;
    const rx = 1 + (stoolR - 1) * k, ry = 1 + (stoolH / 2 - 1) * k;
    pos[i] = (x / rr) * rx * groove;
    pos[i + 1] = yy * ry;
    pos[i + 2] = (z / rr) * rx * groove;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export function makeStool(r, h) {
  const geo = new THREE.SphereGeometry(1, 64, 64);
  shapeSphere(geo, null, 1, 1, 1, 2);
  const uniforms = {
    uRingAxis: { value: new THREE.Vector3(0.03, 0, -0.02) },
    uScale: { value: new THREE.Vector3(r, h / 2, r) },
    uWoodEarly: { value: new THREE.Color('#82462c') },
    uWoodLate: { value: new THREE.Color('#3a1a10') },
    uWoodPore: { value: new THREE.Color('#2a130c') },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 });
  patch(mat, {
    key: 'stool', gobo: true, reveal: true, uniforms,
    vertHead: 'varying vec3 vObj;',
    vertMain: 'vObj = transformed;',
    fragHead: `varying vec3 vObj; uniform vec3 uRingAxis; uniform vec3 uScale; ${WOOD}`,
    fragNormal: `{ float wr; diffuseColor.rgb = eWoodAlbedo(vObj * uScale - uRingAxis, wr); roughnessFactor = wr * 0.85; }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(r, h / 2, r);
  m.name = 'taburete';
  return m;
}

