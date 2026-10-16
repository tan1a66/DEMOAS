// Columna corintia procedural: basa ática, fuste estriado con éntasis,
// capitel con dos coronas de hojas de acanto, volutas y ábaco de lados cóncavos.
import * as THREE from 'three';
import { merge, place, twoSided, SpiralCurve, tube } from './geo.js?v=2';

function flutedShaft(y0, y1, r0, r1, flutes = 20, radial = 80, rows = 8) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = y0 + (y1 - y0) * v;
    const R = r0 + (r1 - r0) * Math.pow(v, 1.4);
    // las estrías mueren en redondo cerca de los extremos
    const fade = Math.min(1, Math.min(v, 1 - v) / 0.06);
    for (let i = 0; i <= radial; i++) {
      const u = i / radial;
      const a = u * Math.PI * 2;
      const ph = (u * flutes) % 1;
      const groove = ph > 0.12 && ph < 0.88 ? Math.sin(Math.PI * (ph - 0.12) / 0.76) : 0;
      const r = R * (1 - 0.055 * groove * fade);
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

// Hoja de acanto: lámina curvada sobre la campana con la punta vuelta hacia fuera.
function acanthusLeaf(width, height, baseR, flare, curl, lobes = 3, gx = 6, gy = 10) {
  const g = new THREE.PlaneGeometry(1, 1, gx, gy);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5; // 0..1 a lo ancho
    const v = p.getY(i) + 0.5; // 0..1 a lo alto
    // contorno: se estrecha hacia la punta, con lóbulos dentados
    const lobe = 0.12 * Math.abs(Math.sin(v * Math.PI * lobes));
    const halfW = (1 - Math.pow(v, 1.8) * 0.82 - lobe * v) * width * 0.5;
    const x = (u - 0.5) * 2 * halfW;
    const ang = x / baseR; // envolver sobre la campana
    // la hoja se separa del tambor y se curva en la punta
    const out = flare * Math.pow(v, 2.2) + curl * Math.pow(Math.max(0, v - 0.7) / 0.3, 2);
    const yy = v * height - curl * 0.6 * Math.pow(Math.max(0, v - 0.75) / 0.25, 2);
    // nervio central ligeramente en relieve y bordes hacia dentro (cóncava)
    const cup = 0.012 * (1 - Math.pow((u - 0.5) * 2, 2));
    const r = baseR + out + cup;
    p.setXYZ(i, Math.sin(ang) * r, yy, Math.cos(ang) * r);
  }
  g.computeVertexNormals();
  return twoSided(g);
}

function concaveAbacus(size, depth, inset) {
  const s = size / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-s, -s);
  sh.quadraticCurveTo(0, -s + inset, s, -s);
  sh.quadraticCurveTo(s - inset, 0, s, s);
  sh.quadraticCurveTo(0, s - inset, -s, s);
  sh.quadraticCurveTo(-s + inset, 0, -s, -s);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// Devuelve una geometría fusionada de columna completa de altura total H (base en y=0).
// detail: 2 = alto (planta baja en escritorio), 1 = medio, 0 = bajo (móvil / pisos altos)
export function corinthianColumn(H, { radius = 0.19, detail = 2 } = {}) {
  const hq = detail >= 2;
  const parts = [];
  const radial = [40, 60, 80][detail];
  // plinto y basa
  parts.push(place(new THREE.BoxGeometry(0.54, 0.1, 0.54), 0, 0.05, 0));
  parts.push(lathe([
    [0, 0.1], [0.26, 0.1], [0.268, 0.125], [0.258, 0.15], [0.236, 0.162], [0.222, 0.168],
    [0.218, 0.185], [0.228, 0.2], [0.232, 0.215], [0.222, 0.232], [0.205, 0.242], [radius + 0.004, 0.25], [radius, 0.26],
  ], [18, 28, 40][detail]));
  const capH = 0.56, abH = 0.09;
  const shaftTop = H - capH - abH;
  const topR = radius * 0.86;
  parts.push(flutedShaft(0.26, shaftTop, radius, topR, 20, radial, detail ? 8 : 5));
  // astrágalo
  const astr = new THREE.TorusGeometry(topR + 0.004, 0.017, detail ? 6 : 4, [16, 24, 36][detail]);
  astr.rotateX(Math.PI / 2);
  parts.push(place(astr, 0, shaftTop + 0.01, 0));
  // campana del capitel
  const bellR0 = topR - 0.008, bellR1 = topR + 0.06;
  parts.push(lathe([
    [0, shaftTop], [bellR0, shaftTop], [bellR0 + 0.004, shaftTop + capH * 0.4], [bellR0 + 0.02, shaftTop + capH * 0.8], [bellR1, shaftTop + capH], [0, shaftTop + capH],
  ], [16, 24, 36][detail]));
  // dos coronas de acanto
  const [gx, gy] = [[3, 5], [4, 7], [6, 10]][detail];
  const leafLow = acanthusLeaf(0.17, capH * 0.48, bellR0 + 0.006, 0.05, 0.035, 3, gx, gy);
  const leafHigh = acanthusLeaf(0.16, capH * 0.74, bellR0 + 0.004, 0.07, 0.045, 4, gx, gy);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(place(leafLow.clone(), 0, shaftTop + 0.02, 0, 0, a, 0));
    parts.push(place(leafHigh.clone(), 0, shaftTop + 0.04, 0, 0, a + Math.PI / 8, 0));
  }
  // volutas en las cuatro esquinas, bajo el ábaco
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const vol = tube(new SpiralCurve(0.045, 1.6, 0, 0, Math.PI * 0.5, -1), 0.011, [12, 18, 28][detail], detail ? 5 : 3);
    // la voluta mira hacia la diagonal, a la altura del ábaco
    vol.rotateY(Math.PI / 2);
    const cx = Math.sin(a) * (bellR1 + 0.06), cz = Math.cos(a) * (bellR1 + 0.06);
    parts.push(place(vol, cx, shaftTop + capH - 0.045, cz, 0, a - Math.PI / 2, 0));
    // tallo (caulículo) que sube a la voluta
    const stalk = new THREE.CylinderGeometry(0.012, 0.016, capH * 0.45, 6);
    parts.push(place(stalk, Math.sin(a) * (bellR1 + 0.02), shaftTop + capH * 0.68, Math.cos(a) * (bellR1 + 0.02), Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35));
  }
  // ábaco y flor central
  const ab = concaveAbacus(0.62, abH - 0.016, 0.07);
  parts.push(place(ab, 0, H - abH + 0.008, 0, 0, Math.PI / 4 * 0, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fl = new THREE.SphereGeometry(0.026, detail ? 8 : 5, detail ? 6 : 3);
    parts.push(place(fl, Math.sin(a) * 0.27, H - abH * 0.5, Math.cos(a) * 0.27, 0, 0, 0, 1, 0.8, 0.6));
  }
  return merge(parts);
}
