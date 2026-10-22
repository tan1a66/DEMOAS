import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lathe, latheX, sweepTube, sweepRibbon } from './geometry.js';

// "Iustitia" senza figura: la spada piantata nel basamento, la bilancia in equilibrio
// sul pomolo e la benda annodata all'impugnatura. Origine = base della scultura.

const GUARD_Y = 0.98; // altezza dell'elsa
const PIVOT_Y = 1.325; // fulcro del giogo
const ARM = 0.4; // mezzo giogo
const HOOK_DROP = 0.034; // dal giogo al punto d'aggancio delle catene
const PAN_DROP = 0.44; // dall'aggancio al bordo del piatto
const PAN_R = 0.158; // raggio dei punti d'attacco sul piatto
const LINK_PITCH = 0.0175;

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const TMP = {
  hook: new THREE.Vector3(),
  rim: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  pp: new THREE.Vector3(),
  tmpQ: new THREE.Quaternion(),
  twistQ: new THREE.Quaternion(),
  qq: new THREE.Quaternion(),
  m: new THREE.Matrix4(),
};

function bladeGeometry(y0, y1, hw0, hw1, ht) {
  const ring = (y, hw, t) => [
    new THREE.Vector3(hw, y, 0),
    new THREE.Vector3(0, y, t),
    new THREE.Vector3(-hw, y, 0),
    new THREE.Vector3(0, y, -t),
  ];
  const a = ring(y0, hw0, ht * 0.8);
  const b = ring(y1, hw1, ht);
  const pos = [];
  const tri = (p, q, r) => {
    // Orienta il triangolo verso l'esterno (lontano dall'asse della lama).
    const n = new THREE.Vector3().subVectors(q, p).cross(new THREE.Vector3().subVectors(r, p));
    const c = new THREE.Vector3().add(p).add(q).add(r).divideScalar(3);
    c.y = 0;
    if (n.dot(c) < 0) [q, r] = [r, q];
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    tri(a[k], a[k1], b[k1]);
    tri(a[k], b[k1], b[k]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non indicizzata → facce nette (lama sfaccettata)
  return g;
}

function gripProfile(y0, len) {
  const pts = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + t * len;
    const barrel = 0.0165 + 0.0032 * Math.sin(Math.PI * t);
    const wire = 0.0016 * Math.pow(Math.abs(Math.sin((t * len * Math.PI) / 0.011)), 0.6);
    const ends = t < 0.06 || t > 0.94 ? 0.003 : 0;
    pts.push([barrel + wire + ends, y]);
  }
  return pts;
}

export class JusticeSculpture {
  constructor(material, ribbonMaterial) {
    this.group = new THREE.Group();
    this.material = material;
    this.angle = 0;
    this.vel = 0;
    this.time = 0;
    this.pans = [];
    this.#build(material, ribbonMaterial);
  }

  #mesh(geo, mat = this.material, parent = this.group) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  #build(mat, ribbonMat) {
    // Basamento tornito
    this.#mesh(
      lathe(
        [
          [0.27, 0],
          [0.273, 0.008],
          [0.271, 0.02],
          [0.262, 0.027],
          [0.25, 0.031],
          [0.248, 0.044],
          [0.238, 0.058],
          [0.228, 0.074],
          [0.224, 0.088],
          [0.228, 0.097],
          [0.232, 0.107],
          [0.228, 0.117],
          [0.216, 0.123],
          [0.2, 0.127],
          [0.19, 0.138],
          [0.17, 0.147],
          [0.12, 0.152],
          [0.05, 0.154],
          [0.0001, 0.154],
        ],
        96
      )
    );

    // Lama sfaccettata, piantata nel basamento
    this.#mesh(bladeGeometry(0.12, GUARD_Y, 0.024, 0.034, 0.0095));
    // Leggera "ferita" nel marmo dove entra la lama
    this.#mesh(lathe([[0.05, 0.15], [0.042, 0.158], [0.03, 0.161], [0.0001, 0.162]], 48));

    // Elsa: quillons leggermente ricurvi con terminali sferici e scudetto centrale
    const guardCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.175, GUARD_Y - 0.004, 0),
      new THREE.Vector3(-0.09, GUARD_Y + 0.014, 0),
      new THREE.Vector3(0, GUARD_Y + 0.018, 0),
      new THREE.Vector3(0.09, GUARD_Y + 0.014, 0),
      new THREE.Vector3(0.175, GUARD_Y - 0.004, 0),
    ]);
    this.#mesh(
      sweepTube(guardCurve, {
        segments: 64,
        radial: 18,
        radius: (t) => 0.0105 + 0.0065 * Math.pow(1 - Math.abs(2 * t - 1), 1.5),
      })
    );
    for (const s of [-1, 1]) {
      const knob = this.#mesh(new THREE.SphereGeometry(0.018, 24, 16));
      knob.position.set(0.178 * s, GUARD_Y - 0.006, 0);
    }
    const ecusson = this.#mesh(new RoundedBoxGeometry(0.056, 0.05, 0.036, 3, 0.008));
    ecusson.position.set(0, GUARD_Y + 0.014, 0);

    // Impugnatura con filo avvolto e pomolo
    const gripY = GUARD_Y + 0.038;
    const gripLen = 0.165;
    this.#mesh(lathe(gripProfile(gripY, gripLen), 48));
    const pY = gripY + gripLen;
    this.#mesh(
      lathe(
        [
          [0.0001, pY - 0.002],
          [0.016, pY - 0.002],
          [0.021, pY + 0.006],
          [0.03, pY + 0.016],
          [0.036, pY + 0.032],
          [0.037, pY + 0.044],
          [0.033, pY + 0.058],
          [0.024, pY + 0.07],
          [0.012, pY + 0.078],
          [0.009, pY + 0.084],
          [0.0095, pY + 0.092],
          [0.0001, pY + 0.096],
        ],
        48
      )
    );
    // Perno che regge il giogo
    this.#mesh(lathe([[0.0075, pY + 0.09], [0.0075, PIVOT_Y], [0.0001, PIVOT_Y + 0.002]], 24));

    // Giogo (ruota attorno a Z sul fulcro)
    this.beam = new THREE.Group();
    this.beam.position.y = PIVOT_Y;
    this.group.add(this.beam);
    const L = ARM;
    const half = [
      [0.0001, -L - 0.018],
      [0.008, -L - 0.016],
      [0.014, -L - 0.009],
      [0.016, -L],
      [0.014, -L + 0.009],
      [0.009, -L + 0.015],
      [0.0085, -L + 0.022],
      [0.0095, -0.3],
      [0.0115, -0.2],
      [0.014, -0.11],
      [0.0165, -0.06],
      [0.019, -0.04],
    ];
    const profile = [...half, ...half.slice().reverse().map(([r, y]) => [r, -y])];
    this.#mesh(latheX(profile, 40), mat, this.beam);
    this.#mesh(new THREE.SphereGeometry(0.03, 32, 20), mat, this.beam);
    // Pinnacolo a fiamma sopra il fulcro (fa da indice dell'equilibrio)
    const finial = this.#mesh(
      lathe(
        [
          [0.0001, 0.022],
          [0.012, 0.024],
          [0.016, 0.034],
          [0.012, 0.05],
          [0.0075, 0.07],
          [0.0045, 0.09],
          [0.0001, 0.115],
        ],
        32
      ),
      mat,
      this.beam
    );
    finial.position.y = 0.004;
    for (const s of [-1, 1]) {
      const ring = this.#mesh(new THREE.TorusGeometry(0.011, 0.0032, 10, 28), mat, this.beam);
      ring.position.set(s * L, -0.022, 0);
    }

    // Piatti
    const panGeo = lathe(
      [
        [0.0001, -0.052],
        [0.04, -0.051],
        [0.09, -0.044],
        [0.13, -0.029],
        [0.155, -0.011],
        [0.164, 0],
        [0.168, 0.004],
        [0.165, 0.009],
        [0.158, 0.007],
        [0.13, -0.018],
        [0.09, -0.032],
        [0.04, -0.04],
        [0.0001, -0.041],
      ],
      72
    );
    const footGeo = lathe([[0.0001, -0.052], [0.035, -0.052], [0.04, -0.062], [0.032, -0.07], [0.0001, -0.07]], 40);
    for (const s of [-1, 1]) {
      const pan = new THREE.Group();
      this.#mesh(panGeo, mat, pan);
      this.#mesh(footGeo, mat, pan);
      this.group.add(pan);
      this.pans.push({ side: s, group: pan, phi: 0, phiVel: 0, prevHookX: null, prevVx: 0 });
    }

    // Catenelle: 3 per piatto, maglie istanziate
    const linkGeo = new THREE.TorusGeometry(0.0072, 0.0021, 6, 14);
    linkGeo.scale(1, 1.55, 1);
    const length = Math.hypot(PAN_DROP, PAN_R);
    this.linksPerChain = Math.ceil(length / LINK_PITCH);
    this.chains = new THREE.InstancedMesh(linkGeo, mat, this.linksPerChain * 6);
    this.chains.castShadow = true;
    this.chains.receiveShadow = true;
    this.chains.frustumCulled = false;
    this.group.add(this.chains);

    // Benda annodata all'impugnatura, con due code che ricadono davanti all'elsa
    const tieY = gripY + 0.07;
    const loop = new THREE.CatmullRomCurve3(
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2 + Math.PI / 2;
        return new THREE.Vector3(Math.cos(a) * 0.0225, tieY + 0.002 * Math.sin(a * 2), Math.sin(a) * 0.0225);
      }),
      true
    );
    this.#mesh(sweepRibbon(loop, { segments: 96, width: () => 0.03, thickness: 0.003, side: new THREE.Vector3(0, 1, 0) }), ribbonMat);
    const knot = this.#mesh(new THREE.SphereGeometry(0.016, 24, 16), ribbonMat);
    knot.scale.set(1.25, 0.95, 0.75);
    knot.position.set(0, tieY, 0.027);

    const tail = (pts, w0, w1, tw) =>
      this.#mesh(
        sweepRibbon(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), {
          segments: 120,
          width: (t) => w0 + (w1 - w0) * t,
          thickness: 0.0028,
          twist: tw,
          side: new THREE.Vector3(1, 0, 0),
        }),
        ribbonMat
      );
    tail(
      [
        [0.008, tieY - 0.004, 0.03],
        [0.024, tieY - 0.05, 0.046],
        [0.03, GUARD_Y - 0.01, 0.054],
        [0.024, GUARD_Y - 0.09, 0.05],
        [0.04, GUARD_Y - 0.17, 0.058],
        [0.034, GUARD_Y - 0.25, 0.052],
        [0.046, GUARD_Y - 0.31, 0.06],
      ],
      0.03,
      0.042,
      (t) => 0.8 * Math.sin(t * 6) + 0.5 * t
    );
    tail(
      [
        [-0.008, tieY - 0.004, 0.03],
        [-0.03, tieY - 0.04, 0.044],
        [-0.046, GUARD_Y + 0.004, 0.05],
        [-0.05, GUARD_Y - 0.06, 0.056],
        [-0.064, GUARD_Y - 0.13, 0.05],
        [-0.06, GUARD_Y - 0.19, 0.058],
      ],
      0.03,
      0.04,
      (t) => -0.75 * Math.sin(t * 5.2 + 0.6) - 0.45 * t
    );

    this.update(0, 0);
  }

  // Sbilancia il giogo (es. all'arrivo dell'intro o con lo scroll veloce).
  nudge(impulse) {
    this.vel += impulse;
  }

  setAngle(a) {
    this.angle = a;
    this.vel = 0;
  }

  update(dt, scrollVelocity = 0) {
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    // Molla smorzata: la bilancia ritrova sempre l'equilibrio.
    const k = 5.5;
    const c = 1.25;
    const breath = 0.0025 * Math.sin(this.time * 0.45) + 0.0015 * Math.sin(this.time * 0.91 + 1.3);
    const acc = -k * (this.angle - breath) - c * this.vel + scrollVelocity;
    this.vel += acc * dt;
    this.angle += this.vel * dt;
    this.beam.rotation.z = this.angle;

    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);
    const g = 9.81;
    const { hook, rim, dir, pp, tmpQ, twistQ, qq, m } = TMP;
    let inst = 0;

    for (const pan of this.pans) {
      // Punto d'aggancio sotto l'estremità del giogo (nel sistema della scultura)
      const lx = pan.side * ARM;
      const ly = -HOOK_DROP;
      hook.set(lx * ca - ly * sa, PIVOT_Y + lx * sa + ly * ca, 0);

      // Pendolo: il piatto oscilla quando l'aggancio accelera di lato.
      if (dt > 0) {
        if (pan.prevHookX === null) pan.prevHookX = hook.x;
        const vx = (hook.x - pan.prevHookX) / dt;
        const ax = (vx - pan.prevVx) / dt;
        pan.prevHookX = hook.x;
        pan.prevVx = vx;
        const w2 = g / PAN_DROP;
        const pacc = -w2 * pan.phi - 1.6 * pan.phiVel - THREE.MathUtils.clamp(ax, -20, 20) / PAN_DROP;
        pan.phiVel += pacc * dt;
        pan.phi = THREE.MathUtils.clamp(pan.phi + pan.phiVel * dt, -0.25, 0.25);
      }
      pan.group.position.set(hook.x + Math.sin(pan.phi) * PAN_DROP, hook.y - Math.cos(pan.phi) * PAN_DROP, 0);
      pan.group.rotation.z = pan.phi;
      pan.group.updateMatrix();

      for (let c3 = 0; c3 < 3; c3++) {
        const a = Math.PI / 2 + (c3 * Math.PI * 2) / 3;
        rim.set(Math.cos(a) * PAN_R, 0.006, Math.sin(a) * PAN_R).applyMatrix4(pan.group.matrix);
        dir.subVectors(rim, hook);
        const len = dir.length();
        dir.normalize();
        tmpQ.setFromUnitVectors(UP, dir);
        for (let i = 0; i < this.linksPerChain; i++) {
          const t = (i + 0.5) * LINK_PITCH;
          if (t > len) {
            m.makeScale(0, 0, 0);
          } else {
            twistQ.setFromAxisAngle(dir, (i % 2) * (Math.PI / 2) + c3);
            qq.copy(twistQ).multiply(tmpQ);
            pp.copy(hook).addScaledVector(dir, t);
            m.compose(pp, qq, ONE);
          }
          this.chains.setMatrixAt(inst++, m);
        }
      }
    }
    this.chains.instanceMatrix.needsUpdate = true;
  }
}

export const JUSTICE_HEIGHT = PIVOT_Y + 0.12;
