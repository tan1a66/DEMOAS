import * as THREE from 'three';
import { lathe } from './geometry.js';

// La "colonnina": fusto dorico scanalato con capitello svasato, piedistallo del monumento.
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

  // Base modanata (plinto tondo, toro, scozia)
  add(
    lathe(
      [
        [1e-4, 0],
        [1.08, 0],
        [1.08, 0.07],
        [1.06, 0.085],
        [1.02, 0.1],
        [0.96, 0.112, 0.8],
        [0.9, 0.12],
        [0.78, 0.13],
        [0.72, 0.15, 0.75],
        [0.7, 0.175],
        [0.66, 0.19],
        [0.63, 0.2, 0.7],
      ],
      128
    ),
    aoMaterial
  );

  // Fusto snello e scanalato: il monumento poggia su una colonnina, come un calice.
  const shaftH = 0.95;
  add(flutedShaft({ height: shaftH, rBottom: 0.61, rTop: 0.56, flutes: 24, depth: 0.03 }), aoMaterial, 0.2);

  // Capitello che si apre (echino) e regge l'Inferno
  add(
    lathe(
      [
        [0.548, 0, 0.7],
        [0.58, 0.012],
        [0.6, 0.03],
        [0.592, 0.046],
        [0.565, 0.056, 0.7],
        [0.57, 0.08],
        [0.62, 0.1],
        [0.72, 0.13],
        [0.84, 0.16],
        [0.94, 0.19],
        [0.99, 0.212],
        [1.0, 0.24],
        [0.99, 0.262],
        [0.9, 0.27],
        [0.5, 0.272],
        [1e-4, 0.272],
      ],
      160
    ),
    aoMaterial,
    0.2 + shaftH
  );

  return { group, top: 0.2 + shaftH + 0.272 };
}
