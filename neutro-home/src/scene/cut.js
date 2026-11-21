// La sombra del corte. En la entrada, bajo los hilos que acaban de nacer, la cámara baja por el muro
// y encuentra la sombra de la trenza ya hecha: larguísima, con su nudo; unas tijeras de sastre
// cortan las hebras a la medida de la borla, el sobrante cae y la trenza se levanta (se cuelga).
// Las piezas que hacen esa sombra no se ven (sólo proyectan sombra): una trenza, su borla, las
// tijeras y el mechón cortado.

import * as THREE from 'three';
import { BRAID } from '../config.js';
import { Braid, hungStructure } from './braid.js';
import { Tassel, TASSEL_PIVOT } from './tassel.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// invisible para la cámara, pero proyecta sombra
function shadowOnly(material) {
  material.colorWrite = false;
  material.depthWrite = false;
  return material;
}

// Media tijera de sastre en el plano xy, eje en el origen, punta hacia −x.
// sgn = 1: hoja de arriba con el ojo redondo (pulgar); −1: hoja de abajo con el ojo largo (dedos).
function halfShears(mat, sgn) {
  const g = new THREE.Group();
  const L = 0.155;
  // hoja: filo recto, lomo curvo, punta fina
  const s = new THREE.Shape();
  s.moveTo(0.012, 0);
  s.lineTo(-L, 0.0008 * sgn);
  s.quadraticCurveTo(-L * 0.5, 0.026 * sgn, -0.012, 0.022 * sgn);
  s.lineTo(0.012, 0.016 * sgn);
  s.lineTo(0.012, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0025, bevelEnabled: false }), mat);
  g.add(blade);
  // brazo hacia el ojo (se separa del otro)
  const arm = new THREE.Shape();
  arm.moveTo(0.008, 0.004 * sgn);
  arm.lineTo(0.062, 0.02 * sgn);
  arm.lineTo(0.062, 0.03 * sgn);
  arm.lineTo(0.006, 0.013 * sgn);
  arm.lineTo(0.008, 0.004 * sgn);
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(arm, { depth: 0.004, bevelEnabled: false }), mat));
  // ojos: redondo para el pulgar, alargado para los dedos (con su apoyo)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.27, 8, 28), mat);
  if (sgn > 0) {
    ring.scale.set(0.02, 0.02, 0.02);
    ring.position.set(0.08, 0.034, 0.002);
  } else {
    ring.scale.set(0.033, 0.022, 0.02);
    ring.position.set(0.091, -0.036, 0.002);
    const rest = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.004), mat);
    rest.position.set(0.1, -0.062, 0.002);
    rest.rotation.z = -0.5;
    g.add(rest);
  }
  g.add(ring);
  if (sgn > 0) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 16), mat);
    screw.rotation.x = Math.PI / 2;
    g.add(screw);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

export class ShadowCut {
  /**
   * shadow: dónde cae la sombra (en el muro): x, yTop (arranque de la trenza, bajo los hilos),
   * yKnot (nudo). sunDir: dirección hacia el sol; z: separación de las piezas respecto al muro.
   */
  constructor({ dye, textures, shadow, sunDir, z = 0.3 }) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const d = sunDir.clone().normalize();
    const kx = -d.x / d.z;
    const ky = d.y / d.z;
    // posición real (fuera del muro) de un punto cuya sombra cae en (x, y)
    this.toReal = (x, y) => new THREE.Vector2(x - kx * z, y + ky * z);
    this.z = z;
    const top = this.toReal(shadow.x, shadow.yTop);
    const knot = this.toReal(shadow.x, shadow.yKnot);
    this.knot = knot;

    // trenza (eje vertical, s = 0 abajo, en el nudo)
    const L = (top.y - knot.y) * 1.0;
    const N = Math.round((L * BRAID.samples) / BRAID.length);
    this.braid = new Braid({ radial: 8, dye, textures, samples: N, length: L });
    const c = { px: new Float32Array(N).fill(knot.x), py: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N).fill(1) };
    for (let i = 0; i < N; i++) c.py[i] = knot.y + (i / (N - 1)) * L;
    this.braid.update(c, z, hungStructure(0.9, L, 0.14));
    shadowOnly(this.braid.material);
    this.group.add(this.braid.mesh);
    // arriba la trenza nace de las hebras: un manojo que se abre hacia los hilos de verdad
    const rb = rng(31);
    const bp = [];
    const bi = [];
    const BR = 0.0016;
    const bTop = 0.34;
    for (let n = 0; n < 150; n++) {
      const a = rb() * Math.PI * 2;
      const r0 = 0.012 + Math.sqrt(rb()) * 0.035;
      const r1 = 0.03 + Math.sqrt(rb()) * 0.11;
      const len = bTop * (0.75 + 0.35 * rb());
      const base = bp.length / 3;
      const steps = 4;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const rr = r0 + (r1 - r0) * t * t;
        const aa = a + (rb() - 0.5) * 0.15;
        for (let j = 0; j < 3; j++) {
          const th = (j / 3) * Math.PI * 2 + n;
          bp.push(Math.cos(aa) * rr + Math.cos(th) * BR, t * len - 0.06, Math.sin(aa) * rr * 0.8 + Math.sin(th) * BR);
        }
      }
      for (let k = 0; k < steps; k++) {
        for (let j = 0; j < 3; j++) {
          const j1 = (j + 1) % 3;
          const p0 = base + k * 3;
          bi.push(p0 + j, p0 + j1, p0 + 3 + j, p0 + j1, p0 + 3 + j1, p0 + 3 + j);
        }
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    bg.setIndex(bi);
    bg.computeVertexNormals();
    this.broom = new THREE.Mesh(bg, shadowOnly(new THREE.MeshStandardMaterial()));
    this.broom.castShadow = true;
    this.broom.position.set(knot.x, top.y, z);
    this.topY = top.y;
    this.group.add(this.broom);

    // borla (cuello cerrado, hebras larguísimas hasta el corte)
    this.tassel = new Tassel(-1, { dye, textures });
    shadowOnly(this.tassel.mesh.material);
    this.tassel.place({ x: knot.x, y: knot.y, dx: 0, dy: -1 }, z, 0);
    this.group.add(this.tassel.mesh);
    // altura del corte: la medida de la borla
    this.cutY = knot.y + TASSEL_PIVOT + 0.014 - 0.215;

    // tijeras
    const steel = shadowOnly(new THREE.MeshStandardMaterial({ color: 0x55504a }));
    this.shears = new THREE.Group();
    this.a = halfShears(steel, 1);
    this.b = halfShears(steel, -1);
    this.shears.add(this.a, this.b);
    this.shears.scale.setScalar(1.15);
    this.group.add(this.shears);

    // el mechón que se corta: hebras rectas, un poco abiertas en la punta cortada
    const rnd = rng(77);
    const pos = [];
    const idx = [];
    const r = 0.0015;
    for (let n = 0; n < 170; n++) {
      const a = rnd() * Math.PI * 2;
      const rr = 0.014 + Math.sqrt(rnd()) * 0.052;
      const x = Math.cos(a) * rr;
      const zz = Math.sin(a) * rr * 0.86;
      const len = 0.49 * (0.86 + 0.28 * rnd());
      const base = pos.length / 3;
      for (const [y, k] of [[0, 1.08], [-len, 1.0]]) {
        for (let j = 0; j < 3; j++) {
          const t = (j / 3) * Math.PI * 2 + n;
          pos.push(x * k + Math.cos(t) * r, y, zz * k + Math.sin(t) * r);
        }
      }
      for (let j = 0; j < 3; j++) {
        const j1 = (j + 1) % 3;
        idx.push(base + j, base + j1, base + 3 + j, base + j1, base + 3 + j1, base + 3 + j);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.piece = new THREE.Mesh(g, shadowOnly(new THREE.MeshStandardMaterial()));
    this.piece.castShadow = true;
    this.group.add(this.piece);
  }

  /**
   * long: largo de las hebras antes del corte (× la borla); cut: ya cortado; fall: segundos de
   * caída del sobrante; enter/close/away: tijeras; lift: la trenza se levanta (sale de cuadro).
   */
  set({ visible, grow = 1, long, cut, fall, enter, open, away, lift, sway }) {
    this.group.visible = visible;
    if (!visible) return;
    const up = lift * 1.15;
    this.braid.mesh.position.y = up;
    this.broom.position.y = this.topY + up;
    this.broom.scale.y = Math.max(0.001, grow);
    this.tassel.mesh.position.y = this.knot.y + up;
    this.tassel.uniforms.uWrap.value = 1;
    this.tassel.uniforms.uDrop.value = cut ? 1 : long;
    this.tassel.uniforms.uLag.value = sway;
    // tijeras: llegan de la derecha, abiertas, con el cruce de las hojas en las hebras
    const reach = (1 - enter) * 0.6 + away * 0.7;
    this.shears.position.set(this.knot.x + 0.1 + reach, this.cutY + 0.004 + away * 0.06, this.z + 0.012);
    this.shears.rotation.set(0, 0, -0.05 + 0.1 * away);
    this.a.rotation.z = open / 2;
    this.b.rotation.z = -open / 2;
    this.shears.visible = enter > 0.001 && away < 0.999;
    // el sobrante cae (con un leve giro)
    if (!cut) {
      this.piece.visible = false;
    } else {
      const dy = 0.5 * 9.0 * fall * fall;
      this.piece.position.set(this.knot.x - 0.015 * fall, this.cutY - dy, this.z + 0.04 * fall);
      this.piece.rotation.set(0.25 * fall, 0, 0.35 * fall);
      this.piece.visible = dy < 2.4;
    }
  }
}
