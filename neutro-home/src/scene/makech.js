// Lámpara colgante MAKECH: una campana de hilos (cúpula) y, debajo, una larga columna de
// fleco que cae. Tejida a mano en Yucatán. Aquí: miles de hilos que se pueden tocar.

import * as THREE from 'three';
import { IS_TOUCH } from '../config.js';
import { fringeGeometry, fringeMaterial, fringeDepthMaterial, fringeUniforms, FringeSwing } from './fringe.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Perfil de la cúpula (radio, altura) desde la corona hasta el borde y el fleco corto.
const DOME = [
  [0.07, 0.0],
  [0.19, -0.02],
  [0.29, -0.07],
  [0.345, -0.15],
  [0.36, -0.25],
  [0.345, -0.33],
  [0.3, -0.4],
];

export class Makech {
  constructor({ position, color = '#b26a57', ceilY }) {
    const rnd = rng(77);
    const threads = [];
    const domeCurve = new THREE.SplineCurve(DOME.map(([r, y]) => new THREE.Vector2(r, y)));
    const domeN = IS_TOUCH ? 900 : 1250;
    const colN = IS_TOUCH ? 520 : 700;

    // cúpula: cada hilo baja por la superficie y termina en un fleco corto bajo el borde
    for (let n = 0; n < domeN; n++) {
      const a = (n / domeN) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
      const lay = 1 + (rnd() - 0.5) * 0.035;
      const tailLen = 0.03 + rnd() * 0.07;
      const pts = [];
      const steps = 11;
      for (let i = 0; i <= steps; i++) {
        const p = domeCurve.getPoint(i / steps);
        pts.push(new THREE.Vector3(Math.cos(a) * p.x * lay, p.y, Math.sin(a) * p.x * lay));
      }
      const last = pts[pts.length - 1];
      for (let i = 1; i <= 2; i++) {
        const k = i / 2;
        pts.push(new THREE.Vector3(last.x * (1 - 0.06 * k), last.y - tailLen * k, last.z * (1 - 0.06 * k)));
      }
      threads.push({ pts, r0: 0.0028, r1: 0.0024, tint: 0.88 + rnd() * 0.22, ao0: 0.8, ao1: 0.7 + rnd() * 0.25 });
    }
    // columna: fleco largo que cae desde dentro de la cúpula
    for (let n = 0; n < colN; n++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.05 + Math.sqrt(rnd()) * 0.15;
      const yEnd = -1.02 - rnd() * 0.06 + (r - 0.12) * 0.25;
      const pts = [];
      const steps = 7;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -0.3 + (yEnd + 0.3) * t;
        const rr = r * (1 - 0.18 * t) * (1 + 0.06 * Math.sin(t * Math.PI));
        pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
      }
      const outer = r / 0.2;
      threads.push({ pts, r0: 0.0026, r1: 0.0022, tint: 0.86 + rnd() * 0.24, ao0: 0.45, ao1: 0.55 + 0.45 * outer });
    }

    this.uniforms = fringeUniforms({ pivot: new THREE.Vector3(0, 0, 0), hang: 1.0, pushR: 0.11 });
    const mat = fringeMaterial(this.uniforms, { color });
    this.mesh = new THREE.Mesh(fringeGeometry(threads, 0.31), mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = fringeDepthMaterial(this.uniforms);

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.add(this.mesh);

    // corona tejida y cable hasta el techo
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.08, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.85), roughness: 0.8 })
    );
    crown.position.y = 0.012;
    this.group.add(crown);
    const cableLen = ceilY - position.y;
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, cableLen, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.5 })
    );
    cable.position.y = cableLen / 2;
    this.group.add(cable);

    // luz cálida dentro de la campana: se enciende al llegar
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false })
    );
    this.glow.position.y = -0.22;
    this.group.add(this.glow);
    this.light = new THREE.PointLight(0xffc98a, 0, 2.4, 1.6);
    this.light.position.y = -0.3;
    this.group.add(this.light);

    this.swing = new FringeSwing(this.uniforms, { omega: 2.2, zeta: 0.14 });
    // zona que se puede tocar (cilindro en coordenadas locales)
    this.hit = { r: 0.4, y0: -1.08, y1: 0.02 };
  }

  setOn(k) {
    this.light.intensity = 1.6 * k;
    this.glow.material.color.setScalar(0.6 + 0.6 * k);
  }
}
