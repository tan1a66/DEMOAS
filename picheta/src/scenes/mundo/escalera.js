import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plane, box } from './materials.js';

// LA ESCALERA: peldaños de travertino entre muros de enlucido, un techo
// inclinado de cuerdas tendidas, pasamanos de madera con su línea de luz y,
// arriba, el rellano con el aplique de latón perforado. Sube del reservado
// a la terraza.

export const STAIR = { x0: -7.6, x1: -6.4, z0: -23.6, z1: -29.6, rise: 4.4, steps: 25 };
export const LANDING = { z0: -29.6, z1: -31.2 };

export function stairY(z) {
  const S = STAIR;
  const t = THREE.MathUtils.clamp((S.z0 - z) / (S.z0 - S.z1), 0, 1);
  return t * S.rise;
}

export function buildEscalera(m, q) {
  const g = new THREE.Group();
  g.name = 'escalera';
  const S = STAIR;
  const W = S.x1 - S.x0;
  const xc = (S.x0 + S.x1) / 2;
  const run = (S.z0 - S.z1) / S.steps;
  const rise = S.rise / S.steps;

  // Peldaños macizos.
  const steps = [];
  for (let i = 0; i < S.steps; i++) {
    const h = (i + 1) * rise;
    steps.push(new THREE.BoxGeometry(W, h, run).translate(xc, h / 2, S.z0 - (i + 0.5) * run));
  }
  const stepMesh = new THREE.Mesh(mergeGeometries(steps), m.travertine);
  stepMesh.castShadow = stepMesh.receiveShadow = true;
  g.add(stepMesh);
  // Rellano.
  const landing = box(W, 0.2, LANDING.z0 - LANDING.z1, m.travertine);
  landing.position.set(xc, S.rise - 0.1, (LANDING.z0 + LANDING.z1) / 2);
  g.add(landing);

  // Muros laterales altos (de la planta baja al rellano).
  const len = S.z0 - LANDING.z1;
  const zc = (S.z0 + LANDING.z1) / 2;
  const hgt = S.rise + 3.2;
  for (const [x, ry] of [
    [S.x0, Math.PI / 2],
    [S.x1, -Math.PI / 2],
  ]) {
    const w = plane(len, hgt, m.plaster, 1.6);
    w.rotation.y = ry;
    w.position.set(x, hgt / 2, zc);
    g.add(w);
  }
  // Pared del fondo del rellano (con el aplique) — la terraza se abre a la izquierda.
  // Techo inclinado y cuerdas: a 2,6 m por encima de la línea de los peldaños.
  const slope = Math.atan2(S.rise, S.z0 - S.z1);
  const slopeLen = Math.hypot(S.rise, S.z0 - S.z1);
  const ceil = plane(W, slopeLen + 1.2, m.ceiling, 3);
  ceil.rotation.x = Math.PI / 2 + slope;
  ceil.position.set(xc, S.rise / 2 + 2.95, (S.z0 + S.z1) / 2);
  g.add(ceil);
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, W - 0.04, 7, 1, true).rotateZ(Math.PI / 2);
  {
    const uv = ropeGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * ((W - 0.04) / 0.16), uv.getX(i));
  }
  const nR = Math.floor((S.z0 - S.z1 + 1.2) / 0.088);
  const ropes = new THREE.InstancedMesh(ropeGeo, m.rope, nR);
  const M = new THREE.Matrix4();
  for (let i = 0; i < nR; i++) {
    const z = S.z0 + 0.6 - i * 0.088;
    M.makeTranslation(xc, stairY(z) + 2.62 + (Math.random() - 0.5) * 0.01, z);
    ropes.setMatrixAt(i, M);
  }
  g.add(ropes);

  // Pasamanos de madera en el muro izquierdo, con la línea de luz debajo.
  const railLen = Math.hypot(S.rise, S.z0 - S.z1);
  const rail = box(0.07, 0.09, railLen, m.walnut, 1);
  rail.rotation.x = slope;
  rail.position.set(S.x0 + 0.08, S.rise / 2 + 0.95, (S.z0 + S.z1) / 2);
  g.add(rail);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, railLen), m.led);
  led.rotation.x = slope;
  led.position.set(S.x0 + 0.08, S.rise / 2 + 0.9, (S.z0 + S.z1) / 2);
  g.add(led);

  // Luces: tres puntos cálidos a lo largo del pasamanos y el aplique del rellano.
  const lights = new THREE.Group();
  for (const f of [0.15, 0.5, 0.85]) {
    const z = S.z0 - f * (S.z0 - S.z1);
    const p = new THREE.PointLight('#ffb36a', 2.2, 2.6, 2);
    p.position.set(S.x0 + 0.2, stairY(z) + 0.8, z);
    lights.add(p);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), m.bulb);
  lamp.position.set(S.x1 - 0.06, S.rise + 2.0, LANDING.z1 + 0.6);
  g.add(lamp);
  const lampL = new THREE.PointLight('#ffb36e', 5, 5, 2);
  lampL.position.copy(lamp.position).add(new THREE.Vector3(-0.15, 0, 0));
  lights.add(lampL);
  g.add(lights);

  return { group: g, lights, update() {} };
}
