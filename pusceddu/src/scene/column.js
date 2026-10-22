import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lathe } from './geometry.js';

// Colonnina dorica: plinto, base attica, fusto scanalato con entasi, capitello.
// Restituisce il gruppo e l'altezza del piano d'appoggio (abaco).

const FLUTES = 20;

function flutedShaft({ height, rBottom, rTop, depth = 0.02, fillet = 0.07 }) {
  const g = new THREE.CylinderGeometry(1, 1, height, FLUTES * 14, 48, true);
  g.translate(0, height / 2, 0);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = v.y / height;
    // Entasi: leggero rigonfiamento a un terzo dell'altezza.
    const R = rBottom + (rTop - rBottom) * Math.pow(k, 1.25) + 0.006 * Math.sin(Math.PI * Math.min(1, k * 1.5));
    const ang = Math.atan2(v.z, v.x);
    let u = ((ang / (Math.PI * 2)) * FLUTES) % 1;
    if (u < 0) u += 1;
    const w = (u - 0.5) / (0.5 - fillet);
    let d = Math.abs(w) < 1 ? depth * Math.sqrt(1 - w * w) : 0;
    // Le scanalature terminano arrotondate in alto e in basso.
    const end = Math.min(1, v.y / 0.07, (height - v.y) / 0.07);
    d *= end > 0 ? Math.sqrt(Math.max(0, 1 - (1 - end) * (1 - end))) : 0;
    const r = R - d;
    p.setXYZ(i, Math.cos(ang) * r, v.y, Math.sin(ang) * r);
  }
  g.computeVertexNormals();
  return g;
}

export function buildColumn(material, { shaftHeight = 1.5 } = {}) {
  const group = new THREE.Group();
  const add = (geo, y = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Plinto quadrato
  add(new RoundedBoxGeometry(0.84, 0.13, 0.84, 3, 0.012), 0.065);
  let y = 0.13;

  // Base attica: toro, scozia, toro
  const base = [
    [0.37, 0],
    [0.375, 0.006],
    [0.38, 0.02],
    [0.378, 0.034],
    [0.368, 0.046],
    [0.352, 0.052],
    [0.34, 0.056],
    [0.322, 0.064],
    [0.318, 0.076],
    [0.326, 0.082],
    [0.336, 0.092],
    [0.338, 0.104],
    [0.33, 0.116],
    [0.316, 0.122],
    [0.304, 0.126],
    [0.302, 0.14],
  ];
  add(lathe(base, 96), y);
  y += 0.14;

  const rBottom = 0.3;
  const rTop = 0.262;
  add(flutedShaft({ height: shaftHeight, rBottom, rTop }), y);
  y += shaftHeight;

  // Collarino (astragalo), echino e abaco
  const cap = [
    [rTop - 0.004, 0],
    [rTop + 0.012, 0.004],
    [rTop + 0.016, 0.014],
    [rTop + 0.01, 0.024],
    [rTop - 0.002, 0.028],
    [rTop - 0.002, 0.05],
    [rTop + 0.004, 0.056],
    [rTop + 0.006, 0.062],
    [rTop + 0.03, 0.068],
    [rTop + 0.07, 0.08],
    [rTop + 0.095, 0.096],
    [rTop + 0.104, 0.112],
    [rTop + 0.1, 0.122],
    [0.32, 0.124],
  ];
  add(lathe(cap, 96), y);
  y += 0.124;
  add(new RoundedBoxGeometry(0.76, 0.085, 0.76, 3, 0.01), y + 0.0425);
  y += 0.085;

  return { group, top: y };
}

// Plinto moderno (parallelepipedo con zoccolo) per le altre opere del percorso.
export function buildPlinth(material, { w = 0.7, h = 1, d = 0.7 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h - 0.05, d, 3, 0.012), material);
  body.position.y = 0.05 + (h - 0.05) / 2;
  const foot = new THREE.Mesh(new RoundedBoxGeometry(w + 0.06, 0.06, d + 0.06, 2, 0.01), material);
  foot.position.y = 0.03;
  const lip = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, 0.04, d + 0.04, 2, 0.01), material);
  lip.position.y = h - 0.02;
  for (const m of [body, foot, lip]) {
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  return { group, top: h };
}
