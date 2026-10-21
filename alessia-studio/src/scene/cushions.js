import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PIT } from '../layout.js';

// Cuscini morbidi: scatola arrotondata con rigonfiamento, curvata negli angoli del pit.
// Coordinate locali: x = lunghezza, y = spessore/altezza, z = verso il centro del pit.

function axisSamples(h, r, nFlat, nRound) {
  const out = [];
  const c = h - r;
  for (let i = 0; i < nRound; i++) out.push(-h + (r * i) / nRound);
  for (let i = 0; i <= nFlat; i++) out.push(-c + (2 * c * i) / nFlat);
  for (let i = 1; i <= nRound; i++) out.push(c + (r * i) / nRound);
  return out;
}

function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function puffyBox({ hx, hy, hz, r, flat = [16, 2, 8], round = 5, bulge = {}, seed = 0 }) {
  const { top = 0.03, bottom = 0.0, front = 0.015, back = 0.01, end = 0.012 } = bulge;
  const xs = axisSamples(hx, r, flat[0], round);
  const ys = axisSamples(hy, r, flat[1], round);
  const zs = axisSamples(hz, r, flat[2], round);
  const pos = [];
  const idx = [];
  // 6 facce della scatola: [asse fisso, segno, asse u, asse v]
  const faces = [
    [0, 1, 2, 1], [0, -1, 1, 2],
    [1, 1, 0, 2], [1, -1, 2, 0],
    [2, 1, 1, 0], [2, -1, 0, 1],
  ];
  const h = [hx, hy, hz];
  const samples = [xs, ys, zs];
  const inner = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [fa, sg, ua, va] of faces) {
    const us = samples[ua], vs = samples[va];
    const base = pos.length / 3;
    for (let j = 0; j < vs.length; j++) {
      for (let i = 0; i < us.length; i++) {
        const c = [0, 0, 0];
        c[fa] = sg * h[fa];
        c[ua] = us[i];
        c[va] = vs[j];
        p.set(c[0], c[1], c[2]);
        inner.set(
          THREE.MathUtils.clamp(p.x, -(hx - r), hx - r),
          THREE.MathUtils.clamp(p.y, -(hy - r), hy - r),
          THREE.MathUtils.clamp(p.z, -(hz - r), hz - r),
        );
        n.subVectors(p, inner).normalize();
        p.copy(inner).addScaledVector(n, r);
        // rigonfiamento: massimo al centro delle facce, nullo sugli spigoli
        const fx = 1 - (inner.x / (hx - r)) ** 2;
        const fy = 1 - (inner.y / (hy - r)) ** 2;
        const fz = 1 - (inner.z / (hz - r)) ** 2;
        let d = 0;
        d += (n.y > 0 ? top : bottom) * Math.abs(n.y) ** 1.5 * fx * fz;
        d += (n.z > 0 ? front : back) * Math.abs(n.z) ** 1.5 * fx * fy;
        d += end * Math.abs(n.x) ** 1.5 * fy * fz;
        // piccole irregolarità del tessuto imbottito
        d += 0.0025 * (hash(Math.round(inner.x * 6), Math.round(inner.y * 6), Math.round(inner.z * 6) + seed) - 0.5) * fx * fz;
        p.addScaledVector(n, d);
        pos.push(p.x, p.y, p.z);
      }
    }
    const nu = us.length;
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i, b = a + 1, c = a + nu, d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g = mergeVertices(g, 1e-5);
  // orientamento: le normali devono uscire
  g.computeVertexNormals();
  const pa = g.attributes.position, na = g.attributes.normal;
  let outward = 0;
  for (let i = 0; i < pa.count; i += 7) outward += pa.getX(i) * na.getX(i) + pa.getY(i) * na.getY(i) + pa.getZ(i) * na.getZ(i);
  if (outward < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    g.computeVertexNormals();
  }
  return g;
}

function tilt(g, angle) {
  // ruota attorno all'asse x locale: la parte alta va verso l'esterno (-z)
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-angle));
  return g;
}

function bend(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = x / R;
    const rho = R - z;
    // asse locale: centro di curvatura nell'origine, arco attorno ad a = 0 lungo +x mondo
    p.setXYZ(i, rho * Math.cos(a), y, rho * Math.sin(a));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// proxy = versione leggera, usata solo come ostacolo nel ray tracing del bake
export function buildCushions({ proxy = false } = {}) {
  const k = proxy ? 0.3 : 1;
  const R = proxy ? 2 : 5;
  const fl = (n) => Math.max(2, Math.round(n * k));
  const parts = [];
  const C = PIT.half - PIT.r; // distanza dei centri d'angolo dal centro del pit
  const rRiser = PIT.r - PIT.ring1.inset; // raggio d'angolo dell'alzata dietro la seduta
  const rInner = PIT.r - PIT.ring2.inset; // raggio d'angolo del bordo seduta
  const seatDepth = rRiser - rInner - 0.03;
  const seatT = 0.17;
  const gap = 0.012;
  const straight = 2 * C; // lunghezza del tratto rettilineo
  const nSide = 3;
  const seatLen = (straight - gap * nSide) / nSide;
  const seatMid = (rRiser + rInner) / 2;
  const backT = 0.19, backH = 0.54, backTilt = THREE.MathUtils.degToRad(13);
  const backMid = rRiser - 0.13;
  const seatTop = PIT.ring2.y + seatT;
  let seed = 1;

  const seatProto = (len, flatLen, bent = false) => puffyBox({
    hx: len / 2, hy: seatT / 2, hz: seatDepth / 2, r: 0.07,
    flat: [bent ? flatLen : fl(flatLen), 2, fl(10)], round: R, bulge: { top: 0.034, bottom: 0, front: 0.022, back: 0.012, end: 0.014 }, seed: seed++,
  });
  const backProto = (len, flatLen, bent = false) => tilt(puffyBox({
    hx: len / 2, hy: backH / 2, hz: backT / 2, r: 0.075,
    flat: [bent ? flatLen : fl(flatLen), fl(10), 2], round: R, bulge: { top: 0.012, bottom: 0.006, front: 0.034, back: 0.012, end: 0.014 }, seed: seed++,
  }), backTilt);

  // Lati: (direzione verso l'esterno del lato)
  const sides = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const m = new THREE.Matrix4();
  for (const [ox, oz] of sides) {
    // assi mondo: zLocale = verso il centro = -(ox,oz); xLocale = y × zLocale
    const ez = new THREE.Vector3(-ox, 0, -oz);
    const ey = new THREE.Vector3(0, 1, 0);
    const ex = new THREE.Vector3().crossVectors(ey, ez);
    for (let k = 0; k < nSide; k++) {
      const along = -C + gap / 2 + seatLen / 2 + k * (seatLen + gap);
      const center = (dist, y) => new THREE.Vector3(PIT.cx + ox * (C + dist) + ex.x * along, y, PIT.cz + oz * (C + dist) + ex.z * along);
      const seatC = center(seatMid - 0.015, PIT.ring2.y + seatT / 2);
      m.makeBasis(ex, ey, ez).setPosition(seatC);
      parts.push(seatProto(seatLen, 18).applyMatrix4(m));
      const backC = center(backMid, seatTop + backH / 2 * Math.cos(backTilt) - 0.01);
      m.makeBasis(ex, ey, ez).setPosition(backC);
      parts.push(backProto(seatLen, 18).applyMatrix4(m));
    }
  }

  // Angoli: cuscini curvati sull'arco
  const cornerCenters = [[C, C, 0], [-C, C, Math.PI / 2], [-C, -C, Math.PI], [C, -C, (3 * Math.PI) / 2]];
  for (const [cx, cz, a0] of cornerCenters) {
    const amid = a0 + Math.PI / 4;
    const place = (g, R) => {
      bend(g, R);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(-amid));
      g.translate(PIT.cx + cx, 0, PIT.cz + cz);
      return g;
    };
    const Rs = seatMid - 0.015;
    const lenS = Rs * (Math.PI / 2) - gap;
    const seat = seatProto(lenS, 16, true);
    seat.translate(0, PIT.ring2.y + seatT / 2, 0);
    parts.push(place(seat, Rs));
    const Rb = backMid;
    const lenB = Rb * (Math.PI / 2) - gap;
    const back = backProto(lenB, 18, true);
    back.translate(0, seatTop + backH / 2 * Math.cos(backTilt) - 0.01, 0);
    parts.push(place(back, Rb));
  }

  const g = mergeGeometries(parts.map((p) => {
    p.deleteAttribute('uv');
    return p;
  }));
  g.computeBoundingSphere();
  return g;
}
