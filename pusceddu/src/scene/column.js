import * as THREE from 'three';
import { lathe } from './geometry.js';

// La "colonnina": un grande tamburo dorico scanalato che fa da piedistallo al monumento.
// Restituisce il gruppo e l'altezza del piano d'appoggio.

function flutedShaft({ height, rBottom, rTop, flutes, depth, fillet = 0.08 }) {
  const g = new THREE.CylinderGeometry(1, 1, height, flutes * 12, 24, true);
  g.translate(0, height / 2, 0);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = v.y / height;
    const R = rBottom + (rTop - rBottom) * k;
    const ang = Math.atan2(v.z, v.x);
    let u = ((ang / (Math.PI * 2)) * flutes) % 1;
    if (u < 0) u += 1;
    const w = (u - 0.5) / (0.5 - fillet);
    let d = Math.abs(w) < 1 ? depth * Math.sqrt(1 - w * w) : 0;
    // Le scanalature terminano arrotondate in alto e in basso.
    const end = Math.min(1, v.y / 0.08, (height - v.y) / 0.08);
    d *= end > 0 ? Math.sqrt(Math.max(0, 1 - (1 - end) * (1 - end))) : 0;
    const r = R - d;
    p.setXYZ(i, Math.cos(ang) * r, v.y, Math.sin(ang) * r);
    // Il fondo delle scanalature riceve meno luce.
    const ao = 1 - 0.32 * (d / depth);
    colors.set([ao, ao, ao], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export function buildPedestal(material, aoMaterial) {
  const group = new THREE.Group();
  const add = (geo, mat, y = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Base modanata
  add(
    lathe(
      [
        [1e-4, 0],
        [1.5, 0],
        [1.5, 0.06],
        [1.475, 0.074],
        [1.445, 0.1],
        [1.42, 0.122, 0.8],
        [1.4, 0.14, 0.85],
        [1.34, 0.15],
        [1.3, 0.168],
        [1.27, 0.18, 0.7],
      ],
      160
    ),
    aoMaterial
  );

  const shaftH = 0.86;
  add(flutedShaft({ height: shaftH, rBottom: 1.26, rTop: 1.23, flutes: 36, depth: 0.045 }), aoMaterial, 0.18);

  // Capitello: collarino, echino, abaco tondo
  add(
    lathe(
      [
        [1.215, 0, 0.7],
        [1.245, 0.01],
        [1.268, 0.025],
        [1.262, 0.04],
        [1.232, 0.05, 0.75],
        [1.236, 0.078],
        [1.29, 0.1],
        [1.345, 0.128],
        [1.375, 0.158],
        [1.37, 0.185],
        [1.345, 0.2],
        [1.2, 0.207],
        [0.6, 0.21],
        [1e-4, 0.21],
      ],
      160
    ),
    aoMaterial,
    0.18 + shaftH
  );

  return { group, top: 0.18 + shaftH + 0.21 };
}
