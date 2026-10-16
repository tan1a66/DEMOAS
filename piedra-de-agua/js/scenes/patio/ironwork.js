// Hierro forjado de estilo liberty: barandales de los balcones, abanicos de los
// sopraluces y rejillas de las puertas. Todo con tubos a lo largo de curvas.
import * as THREE from 'three';
import { merge, place, box, tube, bez, SpiralCurve } from './geo.js';

function mirrorX(points, cx) { return points.map(([x, y]) => [2 * cx - x, y]); }

function bezTube(pts, r, segs, radial, z = 0) {
  return tube(bez(...pts, z), r, segs, radial);
}

// Un tramo de barandal entre dos columnas, en el plano XY, centrado en x=0, base y=0.
export function railingBay(len, h = 1.0, hq = true) {
  const segs = hq ? 20 : 9, radial = hq ? 5 : 3, r = 0.0085;
  const parts = [];
  // pasamanos redondeado y zócalo
  const rail = new THREE.CylinderGeometry(0.03, 0.03, len, hq ? 10 : 6);
  rail.rotateZ(Math.PI / 2);
  parts.push(place(rail, 0, h, 0, 0, 0, 0, 1, 1, 1.25));
  parts.push(box(len, 0.03, 0.035, 0, h - 0.06, 0));
  parts.push(box(len, 0.035, 0.035, 0, 0.06, 0));
  const panels = Math.max(2, Math.round(len / 0.62));
  const pw = len / panels;
  const y0 = 0.08, y1 = h - 0.06, ph = y1 - y0;
  for (let i = 0; i <= panels; i++) {
    parts.push(box(0.022, ph, 0.022, -len / 2 + i * pw, y0, 0));
  }
  for (let i = 0; i < panels; i++) {
    const x0 = -len / 2 + i * pw;
    const cx = x0 + pw / 2;
    const P = (u, v) => [x0 + u * pw, y0 + v * ph];
    // barra central
    parts.push(box(0.016, ph * 0.5, 0.016, cx, y0 + ph * 0.06, 0));
    // golpes de látigo que suben hacia el centro (simétricos)
    const whip = [P(0.06, 0.04), P(0.0, 0.55), P(0.42, 0.42), P(0.47, 0.9)];
    parts.push(bezTube(whip, r, segs, radial));
    parts.push(bezTube(mirrorX(whip, cx), r, segs, radial));
    // volutas inferiores
    parts.push(tube(new SpiralCurve(pw * 0.13, 1.25, x0 + pw * 0.3, y0 + ph * 0.22, Math.PI * 0.2, 1), r, segs, radial));
    parts.push(tube(new SpiralCurve(pw * 0.13, 1.25, x0 + pw * 0.7, y0 + ph * 0.22, Math.PI * 0.8, -1), r, segs, radial));
    // arcos superiores en C con remate
    const c = [P(0.03, 0.97), P(0.2, 0.98), P(0.3, 0.8), P(0.18, 0.72)];
    parts.push(bezTube(c, r * 0.9, segs, radial));
    parts.push(bezTube(mirrorX(c, cx), r * 0.9, segs, radial));
    // flor: anillo en lo alto del eje
    const ring = new THREE.TorusGeometry(pw * 0.075, r, radial, hq ? 18 : 10);
    parts.push(place(ring, cx, y0 + ph * 0.72, 0));
    // pequeñas hojas a los lados de la flor
    for (const s of [-1, 1]) {
      const leaf = [P(0.5, 0.72), P(0.5 + s * 0.12, 0.8), P(0.5 + s * 0.2, 0.7), P(0.5 + s * 0.08, 0.64)];
      parts.push(bezTube(leaf, r * 0.8, Math.round(segs * 0.6), radial));
    }
  }
  return merge(parts);
}

// Abanico liberty para un sopraluce de medio punto (radio R), base en y=0.
export function fanTransom(R, hq = true, { rays = 9 } = {}) {
  const segs = hq ? 26 : 14, radial = hq ? 5 : 3, r = 0.013;
  const parts = [];
  // marco del arco
  const arc = new THREE.TorusGeometry(R, 0.03, radial + 1, hq ? 48 : 28, Math.PI);
  parts.push(arc);
  parts.push(box(2 * R, 0.05, 0.05, 0, -0.025, 0));
  // semicírculo interior (sol)
  const sun = new THREE.TorusGeometry(R * 0.22, r * 1.2, radial, hq ? 24 : 14, Math.PI);
  parts.push(sun);
  // rayos ondulados del sol al arco
  for (let i = 0; i < rays; i++) {
    const a = Math.PI * (i + 0.5) / rays;
    const ca = Math.cos(a), sa = Math.sin(a);
    const p0 = [ca * R * 0.22, sa * R * 0.22];
    const p3 = [ca * R * 0.98, sa * R * 0.98];
    const off = (i % 2 ? 1 : -1) * R * 0.06;
    const p1 = [ca * R * 0.45 - sa * off, sa * R * 0.45 + ca * off];
    const p2 = [ca * R * 0.75 + sa * off, sa * R * 0.75 - ca * off];
    parts.push(bezTube([p0, p1, p2, p3], r, segs, radial));
  }
  // corona de golpes de látigo entre rayos
  const ringR = R * 0.68;
  for (let i = 0; i < rays - 1; i++) {
    const a0 = Math.PI * (i + 0.5) / rays, a1 = Math.PI * (i + 1.5) / rays, am = (a0 + a1) / 2;
    const p0 = [Math.cos(a0) * ringR, Math.sin(a0) * ringR];
    const p3 = [Math.cos(a1) * ringR, Math.sin(a1) * ringR];
    const p1 = [Math.cos(am) * ringR * 0.82, Math.sin(am) * ringR * 0.82];
    const p2 = [Math.cos(am) * ringR * 1.12, Math.sin(am) * ringR * 1.12];
    parts.push(bezTube([p0, p1, p2, p3], r * 0.85, Math.round(segs * 0.7), radial));
  }
  // volutas en los arranques
  for (const s of [-1, 1]) {
    parts.push(tube(new SpiralCurve(R * 0.12, 1.3, s * R * 0.62, R * 0.14, s > 0 ? Math.PI : 0, s), r, segs, radial));
  }
  return merge(parts);
}

// Rejilla para el vidrio superior de una hoja de puerta (w × h), base en y=0, centrada en x.
export function leafGrille(w, h, hq = true) {
  const segs = hq ? 20 : 10, radial = hq ? 4 : 3, r = 0.008;
  const parts = [];
  const P = (u, v) => [(u - 0.5) * w, v * h];
  parts.push(box(0.014, h, 0.014, 0, 0, 0));
  const s1 = [P(0.5, 0.05), P(0.05, 0.25), P(0.1, 0.62), P(0.5, 0.7)];
  parts.push(bezTube(s1, r, segs, radial));
  parts.push(bezTube(mirrorX(s1, 0), r, segs, radial));
  const s2 = [P(0.5, 0.7), P(0.85, 0.78), P(0.8, 0.98), P(0.55, 0.95)];
  parts.push(bezTube(s2, r, segs, radial));
  parts.push(bezTube(mirrorX(s2, 0), r, segs, radial));
  const ring = new THREE.TorusGeometry(w * 0.09, r, radial, 14);
  parts.push(place(ring, 0, h * 0.38, 0));
  return merge(parts);
}

// Cresta ornamental (remate superior de marcos), en el plano XY, base en y=0.
export function crest(w, h, hq = true) {
  const segs = hq ? 22 : 12, radial = hq ? 4 : 3, r = 0.012;
  const parts = [];
  const P = (u, v) => [(u - 0.5) * w, v * h];
  const a = [P(0.5, 0.95), P(0.35, 0.95), P(0.25, 0.1), P(0.02, 0.15)];
  parts.push(bezTube(a, r, segs, radial));
  parts.push(bezTube(mirrorX(a, 0), r, segs, radial));
  parts.push(tube(new SpiralCurve(h * 0.22, 1.2, -w * 0.38, h * 0.36, Math.PI, -1), r, segs, radial));
  parts.push(tube(new SpiralCurve(h * 0.22, 1.2, w * 0.38, h * 0.36, 0, 1), r, segs, radial));
  const bud = new THREE.SphereGeometry(r * 3, 8, 6);
  parts.push(place(bud, 0, h, 0));
  return merge(parts);
}
