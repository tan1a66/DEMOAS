// El corte (sólo en sombra): después del nudo las hebras siguen larguísimas; unas tijeras entran,
// cortan a la medida de la borla y el sobrante cae. Las piezas están fuera de cuadro: lo que se ve
// es su sombra en el muro.

import * as THREE from 'three';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// media tijera: hoja afilada + ojo del mango, en el plano xy, con el eje en el origen
function halfScissors(mat, sgn) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0.012, 0.0);
  s.lineTo(-0.135, 0.002 * sgn);
  s.quadraticCurveTo(-0.075, 0.016 * sgn, 0.0, 0.012 * sgn);
  s.lineTo(0.035, 0.006 * sgn);
  s.lineTo(0.012, 0.0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false }), mat);
  blade.castShadow = true;
  g.add(blade);
  const shank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.004), mat);
  shank.position.set(0.045, -0.006 * sgn, 0.0015);
  shank.rotation.z = -0.25 * sgn;
  shank.castShadow = true;
  g.add(shank);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0045, 6, 20), mat);
  ring.position.set(0.085, -0.02 * sgn, 0.0015);
  ring.scale.set(1.25, 0.9, 1);
  ring.castShadow = true;
  g.add(ring);
  return g;
}

export class Cut {
  constructor() {
    this.group = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.8, roughness: 0.35 });
    // tijeras
    this.scissors = new THREE.Group();
    this.a = halfScissors(steel, 1);
    this.b = halfScissors(steel, -1);
    this.scissors.add(this.a, this.b);
    this.group.add(this.scissors);
    // sobrante que cae: un mechón de hebras rectas
    const rnd = rng(77);
    const pos = [];
    const idx = [];
    const N = 150;
    const L = 0.5;
    const r = 0.0016;
    for (let n = 0; n < N; n++) {
      const a = rnd() * Math.PI * 2;
      const rr = 0.012 + Math.sqrt(rnd()) * 0.05;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr * 0.86;
      const len = L * (0.85 + 0.3 * rnd());
      const base = pos.length / 3;
      for (const y of [0, -len]) {
        for (let k = 0; k < 3; k++) {
          const t = (k / 3) * Math.PI * 2 + n;
          pos.push(x + Math.cos(t) * r, y, z + Math.sin(t) * r);
        }
      }
      for (let k = 0; k < 3; k++) {
        const k1 = (k + 1) % 3;
        idx.push(base + k, base + k1, base + 3 + k, base + k1, base + 3 + k1, base + 3 + k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.piece = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc27e6e, roughness: 0.8 }));
    this.piece.castShadow = true;
    this.group.add(this.piece);
    this.group.visible = false;
  }

  /**
   * cutY: altura del corte (borde inferior de la borla), at: punto del eje de la borla (x, z).
   * enter: 0..1 las tijeras llegan desde la derecha; open: apertura (rad); fall: segundos de caída
   * del sobrante (< 0: aún colgado); away: 0..1 las tijeras se retiran.
   */
  set({ at, cutY, enter, open, fall, away, visible }) {
    this.group.visible = visible;
    if (!visible) return;
    const out = (1 - enter) * 0.55 + away * 0.6;
    this.scissors.position.set(at.x + 0.09 + out, cutY, at.z + 0.01);
    this.scissors.rotation.set(0, 0.25, -0.08 + 0.12 * away);
    this.scissors.scale.setScalar(1.45);
    this.a.rotation.z = open;
    this.b.rotation.z = -open;
    this.scissors.visible = enter > 0.001 && away < 0.999;
    if (fall < 0) {
      this.piece.position.set(at.x, cutY, at.z);
      this.piece.rotation.set(0, 0, 0);
      this.piece.visible = false;
    } else {
      const d = 0.5 * 9.0 * fall * fall;
      this.piece.position.set(at.x - 0.02 * fall, cutY - d, at.z + 0.05 * fall);
      this.piece.rotation.set(0.3 * fall, 0, 0.5 * fall);
      this.piece.visible = d < 2.5;
    }
  }
}
