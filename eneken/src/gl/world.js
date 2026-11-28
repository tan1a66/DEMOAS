// Il castello di Enekén sopra le nuvole, fatto con le opere dello studio:
// piazza 1 = la corte di Casa Skoura; una porta ad arco nel muro est e una scala portano alla
// piazza 2 = ODA Casa Rosa (l'arco a ogiva con la porta di legno nella vasca che riflette, le pietre conservate);
// attraverso l'arco una scala curva sale alla piazza 3 = il taller di Miguel Tapia (il disco di legno
// tornito nel muro e la sfera intagliata). Tutto in chukum e pietra chiara. Sotto, il mare di nuvole.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { G, patch, QUALITY, COMMON_FRAG } from './core.js';
import { GATE } from './courtyard.js';
import { makeWoodSphere } from './stool.js';

export const P1 = { x: 0, y: 0, z: -1, r: 10 };       // la terrazza aperta: lo studio e il salotto (Casa Skoura)
export const P2 = { x: 22.8, y: 3.2, z: GATE.z, r: 7.0 };
export const P3 = { x: 31.0, y: 7.6, z: -12.6, r: 6.0 };
const BASE = -16;              // fondo dei basamenti (nascosto nelle nuvole)
const CLOUD_Y = -9;
const POOL2 = { x: P2.x + 1.4, z: P2.z, r: 3.0, rim: 0.42 };
const ARCH = { w: 3.2, h: 4.8, d: 0.9, open: 1.5, spring: 2.4 };

function mat(color, key, { tri = 0.4, normal = 0.7, mottle = 0.3, rough = 0.88 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, envMapIntensity: 0.55 });
  return patch(m, { key, reveal: true, tri: { scale: tri, normal, amount: 0.5, mean: 0.42 }, mottle });
}

function annularSector(r0, r1, a0, a1, segs = 96) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) { const a = a0 + (a1 - a0) * (i / segs); i ? s.lineTo(Math.cos(a) * r1, Math.sin(a) * r1) : s.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); }
  for (let i = segs; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / segs); s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
  return s;
}
// estrusione verso l'alto: forma (sx, sy) → mondo (x, -z)
function extrudeUp(shape, h, bevel = 0.015, curveSegments = 64) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0);
  return g;
}
// arco a ogiva equilatero (le porte di ODA Casa Rosa): apice a 0.866·w sopra l'imposta
function ogiveHole(path, cx, w, spring) {
  path.moveTo(cx - w / 2, -0.01); path.lineTo(cx + w / 2, -0.01); path.lineTo(cx + w / 2, spring);
  path.absarc(cx - w / 2, spring, w, 0, Math.PI / 3, false);
  path.absarc(cx + w / 2, spring, w, (2 * Math.PI) / 3, Math.PI, false);
  path.lineTo(cx - w / 2, -0.01);
  return path;
}
function ogiveRing(w, spring, t) {
  const s = new THREE.Shape(), W = w + 2 * t;
  s.moveTo(-W / 2, 0); s.lineTo(-W / 2, spring);
  s.absarc(W / 2, spring, W, Math.PI, (2 * Math.PI) / 3, true);
  s.absarc(-W / 2, spring, W, Math.PI / 3, 0, true);
  s.lineTo(W / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, spring);
  s.absarc(-w / 2, spring, w, 0, Math.PI / 3, false);
  s.absarc(w / 2, spring, w, (2 * Math.PI) / 3, Math.PI, false);
  s.lineTo(-w / 2, 0); s.lineTo(-W / 2, 0);
  return s;
}
// muro con vano ad arco (forma nel piano u = orizzontale, v = altezza)
function archHole(path, cx, w, spring) {
  path.moveTo(cx - w / 2, -0.01); path.lineTo(cx + w / 2, -0.01); path.lineTo(cx + w / 2, spring);
  path.absarc(cx, spring, w / 2, 0, Math.PI, false); path.lineTo(cx - w / 2, -0.01);
  return path;
}
function archRing(w, spring, t) {
  const s = new THREE.Shape(), ro = w / 2 + t, ri = w / 2;
  s.moveTo(-ro, 0); s.lineTo(-ro, spring); s.absarc(0, spring, ro, Math.PI, 0, true); s.lineTo(ro, 0); s.lineTo(ri, 0); s.lineTo(ri, spring);
  s.absarc(0, spring, ri, 0, Math.PI, false); s.lineTo(-ri, 0); s.lineTo(-ro, 0);
  return s;
}

export function buildWorld(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'castillo';
  scene.add(group);
  const add = (geo, m, { cast = true, receive = true } = {}) => {
    const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = receive; group.add(o); return o;
  };
  const mWall = mat('#ad6b52', 'w_wall', { tri: 0.25, normal: 0.55, mottle: 0.34 });
  const mBase = mat('#9c5a43', 'w_base', { tri: 0.18, normal: 0.9, mottle: 0.45, rough: 0.95 });
  const mFloor = mat('#b9714d', 'w_floor', { tri: 0.4, normal: 0.6, mottle: 0.3 });
  const mStone = mat('#d8c3a5', 'w_stone', { tri: 1.1, normal: 1.0, mottle: 0.3, rough: 0.9 });
  const mWood = mat('#7a4a2c', 'w_wood', { tri: 1.3, normal: 0.6, mottle: 0.45, rough: 0.6 });
  const mDark = mat('#2b1c15', 'w_dark', { tri: 0.3, normal: 0.2, mottle: 0.1, rough: 0.9 });

  // ---------------------------------------------------------------- piazza 1: terrazza aperta sul cielo
  const PORTAL_X = 9.3;
  {
    const t = add(new THREE.CylinderGeometry(P1.r, P1.r * 1.06, P1.y - BASE, 128), mBase);
    t.position.set(P1.x, (P1.y + BASE) / 2 - 0.002, P1.z);
    const top = add(new THREE.CylinderGeometry(P1.r + 0.05, P1.r + 0.05, 0.3, 128), mFloor);
    top.position.set(P1.x, -0.152, P1.z);
    const corn = add(new THREE.TorusGeometry(P1.r + 0.06, 0.09, 10, 160).rotateX(Math.PI / 2), mStone);
    corn.position.set(P1.x, -0.32, P1.z);
    // basamento sotto il padiglione nord (la casa)
    const hb = add(new THREE.BoxGeometry(8.8, -BASE, 11.0), mBase);
    hb.position.set(0, BASE / 2 - 0.002, -10.1);
    // parapetto basso (0,7 m): tutto resta aperto; varco a est per l'arco e la scala
    for (const [a0, a1] of [[0.2, Math.PI * 1.5 - 0.2], [Math.PI * 1.5 + 0.2, Math.PI * 2 - 0.2]]) {
      const pp = add(extrudeUp(annularSector(P1.r - 0.26, P1.r, a0, a1), 0.7), mWall);
      pp.position.set(P1.x, P1.y, P1.z);
    }
    // l'arco libero sul bordo: la porta verso la piazza 2 (Visión)
    const W2 = 4.2, Hh = 5.2, op = 2.6, sp = 2.9;
    const ps = new THREE.Shape();
    ps.moveTo(-W2 / 2, 0); ps.lineTo(W2 / 2, 0); ps.lineTo(W2 / 2, Hh); ps.lineTo(-W2 / 2, Hh); ps.lineTo(-W2 / 2, 0);
    ps.holes.push(archHole(new THREE.Path(), 0, op, sp));
    const pw = add(new THREE.ExtrudeGeometry(ps, { depth: 0.5, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 32 }), mWall);
    pw.rotation.y = -Math.PI / 2; pw.position.set(PORTAL_X - 0.25, 0, GATE.z);
    const pr = add(new THREE.ExtrudeGeometry(archRing(op, sp, 0.18), { depth: 0.6, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 32 }), mStone);
    pr.rotation.y = -Math.PI / 2; pr.position.set(PORTAL_X - 0.3, 0, GATE.z);
  }

  // ---------------------------------------------------------------- scala dalla porta est alla piazza 2
  const xs0 = PORTAL_X + 0.3, xs1 = P2.x - P2.r + 0.1, W = 3.2;
  {
    const N = Math.round(P2.y / 0.2), run = (xs1 - xs0) / N;
    const prof = new THREE.Shape();
    prof.moveTo(xs0, CLOUD_Y - 2); prof.lineTo(xs0, -0.001);
    for (let k = 1; k <= N; k++) { prof.lineTo(xs0 + (k - 1) * run, k * 0.2); prof.lineTo(xs0 + k * run, k * 0.2); }
    prof.lineTo(xs1, CLOUD_Y - 2); prof.lineTo(xs0, CLOUD_Y - 2);
    const st = add(new THREE.ExtrudeGeometry(prof, { depth: W, bevelEnabled: false }), mFloor);
    st.position.z = GATE.z - W / 2;
    // spallette inclinate
    for (const side of [-1, 1]) {
      const ch = new THREE.Shape();
      ch.moveTo(xs0, CLOUD_Y - 2); ch.lineTo(xs0, 1.15); ch.lineTo(xs1, P2.y + 0.95); ch.lineTo(xs1, CLOUD_Y - 2); ch.lineTo(xs0, CLOUD_Y - 2);
      const cg = add(new THREE.ExtrudeGeometry(ch, { depth: 0.24, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), mWall);
      cg.position.z = GATE.z + side * (W / 2 + 0.12) - 0.12;
    }
  }

  // ---------------------------------------------------------------- piazza 2 (Visión)
  let reflector = null;
  const archDoors = [];
  {
    const t = add(new THREE.CylinderGeometry(P2.r, P2.r * 1.06, P2.y - BASE, 128), mBase);
    t.position.set(P2.x, (P2.y + BASE) / 2, P2.z);
    const top = add(new THREE.CylinderGeometry(P2.r + 0.05, P2.r + 0.05, 0.3, 128), mFloor);
    top.position.set(P2.x, P2.y - 0.15, P2.z);
    // parapetto con due aperture: ovest (arrivo della scala) ed est (scala curva)
    for (const [a0, a1] of [[0.3, Math.PI - 0.3], [Math.PI + 0.3, 2 * Math.PI - 0.3]]) {
      const pp = add(extrudeUp(annularSector(P2.r - 0.3, P2.r, a0, a1), 0.95), mWall);
      pp.position.set(P2.x, P2.y, P2.z);
    }
    // vasca tonda con bordo, e l'acqua che riflette come uno specchio
    const rim = add(extrudeUp(annularSector(POOL2.r, POOL2.r + 0.35, 0, Math.PI * 2, 128), POOL2.rim + 0.06), mStone);
    rim.position.set(POOL2.x, P2.y, POOL2.z);
    const bed = add(new THREE.CircleGeometry(POOL2.r, 96).rotateX(-Math.PI / 2), mDark, { cast: false });
    bed.position.set(POOL2.x, P2.y + 0.01, POOL2.z);
    const s = QUALITY.refract;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    reflector = new Reflector(new THREE.CircleGeometry(POOL2.r, 96), {
      textureWidth: Math.round(size.x * s), textureHeight: Math.round(size.y * s), color: 0x8fa5a0, clipBias: 0.003,
    });
    reflector.rotateX(-Math.PI / 2);
    reflector.position.set(POOL2.x, P2.y + POOL2.rim - 0.04, POOL2.z);
    reflector.visible = false;
    group.add(reflector);

    // il grande arco nella vasca: muro di terracotta, arco di pietra chiara, porta di legno
    const baseY = P2.y + POOL2.rim - 0.06;
    const ws = new THREE.Shape();
    ws.moveTo(-ARCH.w / 2, 0); ws.lineTo(ARCH.w / 2, 0); ws.lineTo(ARCH.w / 2, ARCH.h - 0.5); ws.lineTo(ARCH.w / 2 - 0.5, ARCH.h - 0.5);
    ws.lineTo(ARCH.w / 2 - 0.5, ARCH.h); ws.lineTo(-ARCH.w / 2 + 0.9, ARCH.h); ws.lineTo(-ARCH.w / 2 + 0.9, ARCH.h - 0.25); ws.lineTo(-ARCH.w / 2, ARCH.h - 0.25); ws.lineTo(-ARCH.w / 2, 0);
    ws.holes.push(ogiveHole(new THREE.Path(), 0, ARCH.open, ARCH.spring));
    const wall = add(new THREE.ExtrudeGeometry(ws, { depth: ARCH.d, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 40 }), mWall);
    wall.rotation.y = -Math.PI / 2; wall.position.set(POOL2.x - ARCH.d / 2, baseY, POOL2.z);
    const ring = add(new THREE.ExtrudeGeometry(ogiveRing(ARCH.open, ARCH.spring, 0.3), { depth: ARCH.d + 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 40 }), mStone);
    ring.rotation.y = -Math.PI / 2; ring.position.set(POOL2.x - ARCH.d / 2 - 0.06, baseY, POOL2.z);
    const key = add(new RoundedBoxGeometry(ARCH.d + 0.2, 0.5, 0.42, 2, 0.02), mStone);
    key.position.set(POOL2.x, baseY + ARCH.spring + ARCH.open * 0.866 + 0.32, POOL2.z);
    // gradini di pietra che emergono dall'acqua, da entrambi i lati
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const g = add(new RoundedBoxGeometry(0.5, 0.2 + k * 0.0, ARCH.open + 0.4, 2, 0.02), mStone);
      g.position.set(POOL2.x + side * (ARCH.d / 2 + 0.25 + k * 0.5), baseY - 0.02 - k * 0.16, POOL2.z);
    }
    // ante di legno incernierate ai lati del vano
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(POOL2.x + ARCH.d / 2 - 0.1, baseY, POOL2.z + side * ARCH.open / 2);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, ARCH.spring, ARCH.open / 2 - 0.02), mWood);
      leaf.position.set(0, ARCH.spring / 2, -side * (ARCH.open / 4));
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);
      group.add(pivot);
      archDoors.push({ pivot, side });
    }
    // lunetta di legno a ogiva sopra le ante
    const fs = new THREE.Shape(), w = ARCH.open;
    fs.moveTo(-w / 2, 0); fs.lineTo(w / 2, 0); fs.absarc(-w / 2, 0, w, 0, Math.PI / 3, false); fs.absarc(w / 2, 0, w, (2 * Math.PI) / 3, Math.PI, false);
    const fan = add(new THREE.ShapeGeometry(fs, 24), mWood);
    fan.rotation.y = -Math.PI / 2; fan.position.set(POOL2.x + ARCH.d / 2 - 0.12, baseY + ARCH.spring, POOL2.z);
    // pietre conservate (le rovine di Casa Rosa) ai bordi della vasca
    const mLime = mat('#c9b48e', 'w_lime', { tri: 1.2, normal: 1.8, mottle: 0.45, rough: 0.95 });
    const ruin = (seed, w, h, d) => {
      const g = new THREE.BoxGeometry(w, h, d, 14, 24, 5), p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const top = (v.y + h / 2) / h;
        v.y -= (top > 0.7 ? (top - 0.7) * 3.3 * (0.5 + 0.5 * Math.sin(v.x * 5 + seed * 3)) : 0) * h * 0.25;
        const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.3 + seed * 1.7) * Math.sin(v.z * 4.1 + seed) + 0.4 * Math.sin(v.y * 9 + v.x * 7 + seed);
        v.x *= 1 + 0.06 * n; v.z *= 1 + 0.12 * n;
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    };
    for (const [x, z, w, h, d, ry] of [[P2.x - 2.2, P2.z - 3.6, 1.6, 2.4, 0.5, 0.5], [P2.x + 3.1, P2.z + 3.4, 1.0, 1.7, 0.45, -0.7], [P2.x + 3.6, P2.z - 3.2, 0.7, 1.1, 0.5, 0.9]]) {
      const r = add(ruin(x, w, h, d), mLime); r.position.set(x, P2.y + h / 2 - 0.05, z); r.rotation.y = ry;
    }
  }

  // ---------------------------------------------------------------- scale curve (gradini pieni, parapetti a gradini)
  const stair = (S, C, E, y0, y1, width, sides) => {
    const N = Math.round((y1 - y0) / 0.2), rise = (y1 - y0) / N;
    const bez = (t, o) => o.set((1 - t) ** 2 * S.x + 2 * (1 - t) * t * C.x + t * t * E.x, 0, (1 - t) ** 2 * S.z + 2 * (1 - t) * t * C.z + t * t * E.z);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3();
    for (let k = 0; k < N; k++) {
      bez(k / N, a); bez((k + 1) / N, b);
      m.copy(a).add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b) + 0.04, ang = Math.atan2(b.x - a.x, b.z - a.z);
      const top = y0 + (k + 1) * rise, h = top - CLOUD_Y + 2;
      const st = add(new THREE.BoxGeometry(width, h, len), mFloor);
      st.position.set(m.x, top - h / 2, m.z); st.rotation.y = ang;
      const rx = Math.cos(ang), rz = -Math.sin(ang);
      for (const side of sides) {
        const off = side * (width / 2 + 0.13);
        const pw = add(new THREE.BoxGeometry(0.26, 1.0, len), mWall);
        pw.position.set(m.x + rx * off, top + 0.48, m.z + rz * off); pw.rotation.y = ang;
      }
    }
  };
  // la scala curva dalla piazza 2 alla piazza 3
  stair(new THREE.Vector3(P2.x + P2.r - 0.1, 0, P2.z), new THREE.Vector3(P3.x + 4.0, 0, -0.6), new THREE.Vector3(P3.x, 0, P3.z + P3.r - 0.1), P2.y, P3.y, 3.2, [1, -1]);
  // la grande scala d'ingresso: sale dal mare di nuvole fino al bordo sud della terrazza del salotto
  stair(new THREE.Vector3(10.5, 0, 26.0), new THREE.Vector3(0.3, 0, 18.5), new THREE.Vector3(0, 0, P1.z + P1.r - 0.1), CLOUD_Y + 1.2, P1.y, 5.2, [-1, 1]);

  // ---------------------------------------------------------------- piazza 3 (Contacto) e il disco solare
  {
    const t = add(new THREE.CylinderGeometry(P3.r, P3.r * 1.08, P3.y - BASE, 128), mBase);
    t.position.set(P3.x, (P3.y + BASE) / 2, P3.z);
    const top = add(new THREE.CylinderGeometry(P3.r + 0.05, P3.r + 0.05, 0.3, 128), mFloor);
    top.position.set(P3.x, P3.y - 0.15, P3.z);
    const pp = add(extrudeUp(annularSector(P3.r - 0.3, P3.r, -Math.PI / 2 + 0.32, Math.PI * 1.5 - 0.32), 0.95), mWall);
    pp.position.set(P3.x, P3.y, P3.z);
    // muro con il disco e due archi
    const WW = 7.8, HH = 5.8, zc = P3.z - P3.r + 0.75;
    const sh = new THREE.Shape();
    sh.moveTo(-WW / 2, 0); sh.lineTo(WW / 2, 0); sh.lineTo(WW / 2, HH - 0.6); sh.lineTo(WW / 2 - 0.8, HH - 0.6); sh.lineTo(WW / 2 - 0.8, HH); sh.lineTo(-WW / 2, HH); sh.lineTo(-WW / 2, 0);
    const disc = new THREE.Path(); disc.absarc(0, 3.2, 1.6, 0, Math.PI * 2, true); sh.holes.push(disc);
    sh.holes.push(archHole(new THREE.Path(), -2.75, 1.1, 2.3));
    sh.holes.push(archHole(new THREE.Path(), 2.75, 1.1, 2.3));
    const w = add(new THREE.ExtrudeGeometry(sh, { depth: 0.75, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 48 }), mWall);
    w.position.set(P3.x, P3.y, zc - 0.375);
    for (const x of [-2.75, 2.75]) {
      const r = add(new THREE.ExtrudeGeometry(archRing(1.1, 2.3, 0.22), { depth: 0.85, bevelEnabled: false, curveSegments: 32 }), mStone);
      r.position.set(P3.x + x, P3.y, zc - 0.425);
    }
    const dr = add(new THREE.TorusGeometry(1.62, 0.12, 16, 96), mStone);
    dr.position.set(P3.x, P3.y + 3.2, zc + 0.39);
    // il disco di legno tornito di Miguel Tapia, incastonato nel muro (come nella sua foto con il disco e la sfera)
    const dc = document.createElement('canvas'); dc.width = dc.height = 512;
    const dx = dc.getContext('2d');
    dx.fillStyle = '#6e3a22'; dx.fillRect(0, 0, 512, 512);
    let sd = 3; const RR = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let r = 4; r < 256; r += 2 + RR() * 5) {   // anelli di crescita del tronco
      dx.strokeStyle = `rgba(${40 + RR() * 30},${18 + RR() * 12},${8 + RR() * 8},${0.25 + RR() * 0.35})`;
      dx.lineWidth = 1 + RR() * 2.5; dx.beginPath();
      dx.ellipse(256 + (RR() - 0.5) * 6, 256 + (RR() - 0.5) * 6, r, r * (0.97 + RR() * 0.04), 0, 0, Math.PI * 2); dx.stroke();
    }
    for (let i = 0; i < 9; i++) {   // fessure radiali del legno stagionato
      const a = RR() * Math.PI * 2; dx.strokeStyle = 'rgba(25,10,5,0.55)'; dx.lineWidth = 1.5;
      dx.beginPath(); dx.moveTo(256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150); dx.lineTo(256 + Math.cos(a) * (230 + RR() * 24), 256 + Math.sin(a) * (230 + RR() * 24)); dx.stroke();
    }
    const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace; dt.anisotropy = 4;
    const mDisc = patch(new THREE.MeshStandardMaterial({ map: dt, roughness: 0.55, envMapIntensity: 0.7 }), { key: 'w_disc', reveal: true });
    const mDiscSide = mat('#5c3020', 'w_discSide', { tri: 2, normal: 0.6, mottle: 0.4, rough: 0.6 });
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 0.34, 96, 1), [mDiscSide, mDisc, mDisc]);
    disk.rotation.x = Math.PI / 2; disk.position.set(P3.x, P3.y + 3.2, zc + 0.1);
    disk.castShadow = disk.receiveShadow = true;
    group.add(disk);
    // la sfera intagliata su un piedistallo di pietra
    const ped = add(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 48), mStone);
    ped.position.set(P3.x + 2.0, P3.y + 0.5, P3.z + 0.6);
    const sph = makeWoodSphere(0.45);
    sph.position.set(P3.x + 2.0, P3.y + 1.45, P3.z + 0.6);
    sph.castShadow = sph.receiveShadow = true;
    group.add(sph);
  }

  // ---------------------------------------------------------------- torri (la silhouette del castello)
  for (const [x, z, r, topY] of [[-10.6, -10.0, 2.6, 13.5], [39.5, -20.0, 2.2, 17.0], [-7.4, 9.8, 2.0, 10.0]]) {
    const tw = add(new THREE.CylinderGeometry(r, r * 1.1, topY - BASE, 64), mWall);
    tw.position.set(x, (topY + BASE) / 2, z);
    const cr = add(new THREE.CylinderGeometry(r + 0.18, r + 0.18, 0.7, 64), mWall);
    cr.position.set(x, topY + 0.35 - 0.2, z);
    const cap = add(new THREE.CylinderGeometry(r + 0.24, r + 0.24, 0.16, 64), mStone);
    cap.position.set(x, topY - 0.55, z);
    // feritoie scure
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const sl = add(new THREE.BoxGeometry(0.18, 0.9, 0.06), mDark, { cast: false });
      sl.position.set(x + Math.cos(a) * (r + 0.01), topY - 3 - (i % 2) * 2.4, z + Math.sin(a) * (r + 0.01));
      sl.rotation.y = -a + Math.PI / 2;
    }
  }

  // ---------------------------------------------------------------- isole lontane nella foschia
  for (const [x, y, z, r] of [[-42, -2, -58, 6], [64, 1, -36, 5], [36, -4, 52, 4.5]]) {
    const b = add(new THREE.CylinderGeometry(r, r * 1.15, y - BASE, 48), mBase, { cast: false });
    b.position.set(x, (y + BASE) / 2, z);
    const ws = new THREE.Shape(); ws.moveTo(-2.2, 0); ws.lineTo(2.2, 0); ws.lineTo(2.2, 4.4); ws.lineTo(-2.2, 4.4); ws.lineTo(-2.2, 0);
    ws.holes.push(archHole(new THREE.Path(), 0, 1.6, 2.4));
    const aw = add(new THREE.ExtrudeGeometry(ws, { depth: 0.8, bevelEnabled: false, curveSegments: 24 }), mWall, { cast: false });
    aw.position.set(x, y, z); aw.rotation.y = Math.atan2(-x, -z);
  }

  // ---------------------------------------------------------------- banco di nuvole (volumetrico, a strati)
  // N piani sovrapposti campionano la stessa densità 3D (fBm con distorsione): da sopra si legge come un
  // volume morbido, con le cime illuminate dal sole e le valli in ombra azzurrina; lontano sfuma nel cielo.
  const layers = QUALITY.dpr > 1.5 && window.innerWidth < 900 ? 6 : 8;
  const cloudU = Object.assign({}, G, { uFogCol: { value: new THREE.Color(0x9da1b0) }, uFade: { value: 0 } });
  const cloudMats = [];
  for (let i = 0; i < layers; i++) {
    const h = i / (layers - 1);
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, cloudU, { uH: { value: h } }),
      defines: { E_REVEAL: '' },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWPos;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        #include <common>
        ${COMMON_FRAG}
        uniform vec3 uFogCol;
        uniform float uH, uFade;
        float dens(vec2 xz, float h){
          vec2 q = xz * 0.028 + vec2(uTime * 0.004, uTime * 0.0018);
          vec2 w = vec2(eFbm2(q * 0.7 + 3.1), eFbm2(q * 0.7 + 8.4));
          float n = eFbm2(q + w * 1.4) * 0.72 + eFbm2(q * 3.1 + w * 2.0 + 1.7) * 0.28;
          // più in alto serve più densità: cime a cavolfiore, valli tra i cumuli
          return smoothstep(0.34 + h * 0.3, 0.48 + h * 0.3, n);
        }
        void main(){
          float d = dens(vWPos.xz, uH);
          if (d < 0.01) discard;
          float dl = dens(vWPos.xz + vec2(-1.4, -0.9), min(1.0, uH + 0.18));   // verso il sole: auto-ombra
          float lit = clamp(0.5 + uH * 0.55 - (dl - d) * 0.35, 0.0, 1.0);
          vec3 col = mix(vec3(0.58, 0.63, 0.73), vec3(1.0, 0.985, 0.96), lit);
          float dist = length(vWPos.xz - cameraPosition.xz);
          float far = smoothstep(120.0, 520.0, dist);
          col = mix(col, uFogCol, far);
          float a = d * mix(0.42, 0.62, uH) * (1.0 - far * 0.35) * uFade;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb = eFinish(gl_FragColor.rgb, 0.0);
        }`,
    });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), m);
    pl.position.y = CLOUD_Y - 4 + h * 7.5;
    pl.renderOrder = 1 + i;                 // dal basso verso l'alto (la camera è sempre sopra)
    pl.frustumCulled = false;
    group.add(pl);
    cloudMats.push(m);
  }
  // base opaca sotto gli strati (niente vuoto tra le nuvole)
  const floorM = new THREE.MeshBasicMaterial({ color: 0x8e98aa, fog: true });
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), floorM);
  cf.position.y = CLOUD_Y - 4.6; cf.renderOrder = 0;
  group.add(cf);
  const puffMat = { set opacity(v) { for (const m of cloudMats) m.uniforms.uFade.value = Math.min(1, v / 0.85); cf.visible = v > 0.05; } };

  const hotContacto = new THREE.Vector3(POOL2.x, P2.y + POOL2.rim + 1.6, POOL2.z);
  const hotVision = new THREE.Vector3(PORTAL_X, 1.3, GATE.z);
  return {
    group, reflector, archDoors, puffMat, hotContacto, hotVision,
    setArchOpen(k) { for (const d of archDoors) d.pivot.rotation.y = d.side * (0.22 + 1.2 * k); },
  };
}
