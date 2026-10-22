import * as THREE from 'three';

// LEGAL DESIGN: un nodo di marmo (trifoglio) che, scorrendo, si scioglie in un anello
// perfetto. Dal groviglio alla chiarezza. Origine = centro del nodo.

const SEGMENTS = 360;
const RADIAL = 20;
const TUBE = 0.052;
const RK = 0.2; // raggio del nodo
const RC = 0.29; // raggio dell'anello finale

class MorphCurve extends THREE.Curve {
  constructor() {
    super();
    this.m = 0;
    this.arcLengthDivisions = 600;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const u = t * Math.PI * 4; // il trifoglio fa due giri attorno all'asse
    const cs = Math.cos(1.5 * u);
    const kx = RK * (2 + cs) * 0.5 * Math.cos(u);
    const ky = RK * (2 + cs) * 0.5 * Math.sin(u);
    const kz = RK * Math.sin(1.5 * u) * 0.5;
    const a = u / 2; // l'anello invece fa un solo giro
    const cx = RC * Math.cos(a);
    const cy = RC * Math.sin(a);
    const m = this.m;
    return target.set(kx + (cx - kx) * m, ky + (cy - ky) * m, kz * (1 - m));
  }
}

export class MorphKnot {
  constructor(material) {
    this.curve = new MorphCurve();
    const count = (SEGMENTS + 1) * (RADIAL + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const idx = [];
    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.value = -1;
    this.set(0);
    // Le venature restano "attaccate" al marmo mentre il nodo si scioglie.
    geo.setAttribute('marbleRest', geo.attributes.position.clone());
  }

  // m: 0 = nodo, 1 = anello
  set(m) {
    m = THREE.MathUtils.clamp(m, 0, 1);
    if (Math.abs(m - this.value) < 0.0015) return;
    this.value = m;
    // Easing morbido: il nodo "si scioglie" e poi si assesta.
    this.curve.m = m * m * (3 - 2 * m);
    this.curve.needsUpdate = true;
    const frames = this.curve.computeFrenetFrames(SEGMENTS, true);
    const pos = this.mesh.geometry.attributes.position;
    const nor = this.mesh.geometry.attributes.normal;
    const P = new THREE.Vector3();
    const N = new THREE.Vector3();
    let k = 0;
    for (let i = 0; i <= SEGMENTS; i++) {
      this.curve.getPointAt(i / SEGMENTS, P);
      const n = frames.normals[i];
      const b = frames.binormals[i];
      for (let j = 0; j <= RADIAL; j++) {
        const v = (j / RADIAL) * Math.PI * 2;
        const s = Math.sin(v);
        const c = -Math.cos(v);
        N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
        pos.setXYZ(k, P.x + TUBE * N.x, P.y + TUBE * N.y, P.z + TUBE * N.z);
        nor.setXYZ(k, N.x, N.y, N.z);
        k++;
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}

export const KNOT_RADIUS = RC + TUBE;
