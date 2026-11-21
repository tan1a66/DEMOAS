// Lámpara colgante MAKECH: una campana de hilos (cúpula) y, debajo, una larga columna de
// fleco que cae. Tejida a mano en Yucatán. Aquí: miles de hilos que se pueden tocar.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { IS_TOUCH } from '../config.js';
import { fringeGeometry, fringeMaterial, fringeDepthMaterial, fringeUniforms, FringeSwing } from './fringe.js';
import { DyeWaves } from '../gl/dyeWaves.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Perfil de la cúpula (radio, altura): desde la corona se abre, y abajo se cierra hacia el centro,
// donde los hilos se recogen en un nudo tejido; bajo el nudo, una lazada (el "elástico") y la borla.
const DOME = [
  [0.07, 0.0],
  [0.2, -0.03],
  [0.3, -0.09],
  [0.352, -0.18],
  [0.358, -0.27],
  [0.33, -0.355],
  [0.26, -0.435],
  [0.15, -0.495],
  [0.066, -0.53],
];
const KNOT = { y: -0.6, h: 0.15, r: 0.07 };
const BAND = { y: -0.69, h: 0.03, r: 0.05 };
const TASSEL_END = -1.15;

// nudo tejido: lóbulos de cuerda en espiga alrededor de un bulbo (como el de la foto)
function wovenKnot(mat) {
  const parts = [];
  const rows = 4;
  const per = 8;
  for (let row = 0; row < rows; row++) {
    const v = (row + 0.5) / rows;
    const y = KNOT.y + KNOT.h / 2 - v * KNOT.h;
    // bulbo: más ancho en el medio
    const rr = KNOT.r * (0.78 + 0.28 * Math.sin(Math.PI * v));
    for (let j = 0; j < per; j++) {
      const a = ((j + (row % 2) * 0.5) / per) * Math.PI * 2;
      const g = new THREE.SphereGeometry(1, 14, 10);
      g.scale(0.025, 0.036, 0.018);
      g.rotateZ(row % 2 ? 0.62 : -0.62); // espiga: una fila hacia un lado, la siguiente al otro
      g.rotateY(-a + Math.PI / 2);
      g.translate(Math.cos(a) * rr, y, Math.sin(a) * rr);
      parts.push(g);
    }
  }
  const core = new THREE.SphereGeometry(KNOT.r * 0.82, 24, 16);
  core.scale(1, 1.05, 1);
  core.translate(0, KNOT.y, 0);
  parts.push(core);
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

export class Makech {
  constructor({ position, color = '#C27E6E', ceilY }) {
    const rnd = rng(77);
    const threads = [];
    const domeCurve = new THREE.SplineCurve(DOME.map(([r, y]) => new THREE.Vector2(r, y)));
    const domeN = IS_TOUCH ? 900 : 1250;
    const colN = IS_TOUCH ? 520 : 700;

    // cúpula: cada hilo baja por la superficie y se recoge abajo, en el nudo
    // (la cúpula se mueve poco: es la borla la que se balancea)
    for (let n = 0; n < domeN; n++) {
      const a = (n / domeN) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
      const lay = 1 + (rnd() - 0.5) * 0.03;
      const pts = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const p = domeCurve.getPoint(i / steps);
        pts.push(new THREE.Vector3(Math.cos(a) * p.x * lay, p.y, Math.sin(a) * p.x * lay));
      }
      threads.push({ pts, r0: 0.0028, r1: 0.0024, tint: 0.88 + rnd() * 0.22, ao0: 0.8, ao1: 0.6 + rnd() * 0.2, t0: 0, t1: 0.42 });
    }
    // borla: sale de la lazada, se estrecha un poco y se abre al final; puntas cortadas a la par
    const top = BAND.y - BAND.h / 2 + 0.004;
    for (let n = 0; n < colN; n++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      const r0 = 0.012 + rr * 0.034;
      const r1 = 0.03 + rr * 0.085 + rnd() * 0.012;
      const yEnd = TASSEL_END - rnd() * 0.018;
      const pts = [];
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = top + (yEnd - top) * t;
        // cuello estrecho justo bajo la lazada, luego se abre poco a poco
        const r = r0 * (1 - 0.15 * Math.sin(Math.min(1, t * 3) * Math.PI)) + (r1 - r0) * Math.pow(t, 1.7);
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      threads.push({ pts, r0: 0.0026, r1: 0.0022, tint: 0.86 + rnd() * 0.24, ao0: 0.45, ao1: 0.55 + 0.45 * rr, t0: 0.48, t1: 1 });
    }

    this.uniforms = fringeUniforms({ pivot: new THREE.Vector3(0, 0, 0), hang: 1.0, pushR: 0.11 });
    const mat = fringeMaterial(this.uniforms, { color });
    this.mesh = new THREE.Mesh(fringeGeometry(threads, 0.31), mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = fringeDepthMaterial(this.uniforms);

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.add(this.mesh);

    // nudo y lazada (sólidos que siguen el balanceo de la borla)
    const fiber = (c, rough = 0.7) =>
      new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: rough,
        sheen: 1,
        sheenColor: new THREE.Color(c).lerp(new THREE.Color('#fff1dc'), 0.45),
        sheenRoughness: 0.4,
        specularIntensity: 0.3,
      });
    this.knotMat = fiber(color);
    this.bandMat = fiber(new THREE.Color(color).multiplyScalar(1.05), 0.45);
    this.solids = new THREE.Group();
    this.solids.add(wovenKnot(this.knotMat));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(BAND.r, BAND.r * 1.02, BAND.h, 40), this.bandMat);
    band.position.y = BAND.y;
    band.castShadow = true;
    this.solids.add(band);
    this.group.add(this.solids);

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
    this.dye = new DyeWaves(this.uniforms, {
      duration: 2.9,
      solids: [
        { material: crown.material, factor: 0.85, pos: 0 },
        { material: this.knotMat, pos: 0.44, sheen: true },
        { material: this.bandMat, pos: 0.47, factor: 1.05, sheen: true },
      ],
    });
    // zona que se puede tocar (cilindro en coordenadas locales)
    this.hit = { r: 0.4, y0: TASSEL_END - 0.04, y1: 0.02 };
  }

  setColor(hex) {
    this.dye.push(hex);
  }

  // el nudo y la lazada siguen el balanceo de los hilos (mismo giro que en el vertex shader)
  syncSolids() {
    const u = this.uniforms;
    const w = Math.pow(0.45, 1.35);
    const k = 0.4 + 0.6 * w;
    this.solids.rotation.set(u.uSwing.value.y * k, -u.uSpin.value * w, u.uSwing.value.x * k, 'XZY');
  }

  setOn(k) {
    this.light.intensity = 1.6 * k;
    this.glow.material.color.setScalar(0.6 + 0.6 * k);
  }
}
