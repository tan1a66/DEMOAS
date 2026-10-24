// Faroles, ventiladores, mesas de T'HŌ Aperitivo, sillas Adirondack, lámpara del zaguán
// y el montaje del evento "Cena entre Las Palmeras".
import * as THREE from 'three';
import { FL, GR, L } from './layout.js';
import { lathe, instanced, mat4, mergeGeometries, clean, place, boxFromTo } from './kit.js';

const PI = Math.PI;
const merge = (parts) => mergeGeometries(parts.map(clean));

function wickerChair() {
  return merge([
    place(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 16), 0, 0.44, 0),
    place(new THREE.CylinderGeometry(0.3, 0.27, 0.26, 16, 1, true), 0, 0.29, 0),
    place(new THREE.CylinderGeometry(0.34, 0.3, 0.44, 18, 1, true, PI - 1.85, 3.7), 0, 0.68, 0),
    place(new THREE.CylinderGeometry(0.36, 0.355, 0.06, 18, 1, true, PI - 1.85, 3.7), 0, 0.92, 0),
    ...[[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]].map(([x, z]) => place(new THREE.CylinderGeometry(0.018, 0.015, 0.18, 5), x, 0.09, z)),
  ]);
}

function marbleTable() {
  return {
    top: place(new THREE.CylinderGeometry(0.43, 0.43, 0.035, 24), 0, 0.745, 0),
    base: merge([
      lathe([[0, 0], [0.26, 0], [0.24, 0.03], [0.06, 0.08], [0.045, 0.4], [0.06, 0.66], [0.16, 0.72], [0, 0.72]], 12),
    ]),
  };
}

function adirondack() {
  const parts = [];
  const seat = new THREE.BoxGeometry(0.62, 0.04, 0.6); seat.rotateX(0.12); seat.translate(0, 0.36, 0.05);
  parts.push(seat);
  for (let i = -2; i <= 2; i++) {
    const s = new THREE.BoxGeometry(0.1, 0.9, 0.025); s.translate(0, 0.45, 0); s.rotateX(-0.42); s.translate(i * 0.125, 0.32, -0.25);
    parts.push(s);
  }
  for (const sx of [-1, 1]) {
    parts.push(place(new THREE.BoxGeometry(0.12, 0.03, 0.7), sx * 0.38, 0.6, 0.08));
    parts.push(place(new THREE.BoxGeometry(0.05, 0.6, 0.05), sx * 0.36, 0.3, 0.38));
    parts.push(place(new THREE.BoxGeometry(0.05, 0.42, 0.05), sx * 0.3, 0.2, -0.2, 0, -0.3));
  }
  return merge(parts);
}

function lanternParts() {
  const dark = merge([
    place(new THREE.ConeGeometry(0.23, 0.2, 4), 0, 0.52, 0, PI / 4),
    place(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 6), 0, 0.64, 0),
    place(new THREE.BoxGeometry(0.33, 0.03, 0.33), 0, 0.42, 0),
    place(new THREE.BoxGeometry(0.2, 0.03, 0.2), 0, 0.0, 0),
    place(new THREE.ConeGeometry(0.06, 0.12, 4), 0, -0.07, 0, PI / 4, PI),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => {
      const g = new THREE.CylinderGeometry(0.012, 0.012, 0.44, 4);
      g.rotateZ(a * 0.17); g.rotateX(-b * 0.17);
      return g.translate(a * 0.125, 0.21, b * 0.125);
    }),
  ]);
  const glass = place(new THREE.CylinderGeometry(0.16, 0.1, 0.4, 4, 1, false), 0, 0.21, 0, PI / 4);
  return { dark, glass };
}

function fanMatrices(fans, t) {
  return fans.map(([x, y, z, sp]) => mat4(x, y, z, t * sp, 1));
}

export function buildFurniture(root, M) {
  M.mimbre.side = THREE.DoubleSide;
  const out = {};

  /* ---------- T'HŌ Aperitivo ---------- */
  const tables = [[-11.2, -18.6], [-10.5, -22.2], [-11.2, -25.6], [5.8, -11.7], [-7.3, -23.8, GR]];
  const chairM = [], topM = [], baseM = [];
  tables.forEach(([x, z, y = FL], i) => {
    topM.push(mat4(x, y, z)); baseM.push(mat4(x, y, z));
    const n = i >= 4 ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * PI * 2 + i * 0.6;
      chairM.push(mat4(x + Math.sin(a) * 0.74, y, z + Math.cos(a) * 0.74, a + PI));
    }
  });
  out.tables = tables.map(([x, z, y = FL]) => [x, y, z]);
  const t = marbleTable();
  root.add(instanced(wickerChair(), M.mimbre, chairM));
  root.add(instanced(t.top, M.marmolMesa, topM));
  root.add(instanced(t.base, M.mimbre, baseM));
  // floreritos
  root.add(instanced(place(new THREE.IcosahedronGeometry(0.07, 0), 0, 0.84, 0), M.flores, topM.map((m) => m.clone()), { cast: false }));

  /* ---------- Adirondack en la grava ---------- */
  const ad = [[7.4, -20.9, 2.7], [8.6, -22.2, -1.7], [7.1, -22.7, 0.4]];
  root.add(instanced(adirondack(), M.mimbre, ad.map(([x, z, ry]) => mat4(x, GR, z, ry))));
  root.add(instanced(merge([place(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 18), 0, 0.5, 0), place(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), 0, 0.25, 0)]), M.mimbre, [mat4(7.75, GR, -21.9)]));

  /* ---------- Faroles ---------- */
  const lan = [];
  for (const x of [-7.4, -3.8, 0, 3.8, 7.45]) lan.push([x, -11.6, 4.35]);
  for (const z of [-15.0, -18.6, -22.2, -25.6]) lan.push([-10.9, z, 4.45]);
  const lp = lanternParts();
  const lanM = lan.map(([x, z, y]) => mat4(x, y, z));
  root.add(instanced(lp.dark, M.hierroOscuro, lanM));
  root.add(instanced(lp.glass, M.farolVidrio, lanM, { cast: false }));
  const chains = lan.map(([x, z, y]) => place(new THREE.CylinderGeometry(0.01, 0.01, 7.18 - (y + 0.67), 4), x, (7.18 + y + 0.67) / 2, z));
  const chainMesh = new THREE.Mesh(merge(chains), M.hierroOscuro); root.add(chainMesh);

  /* ---------- Ventiladores de techo ---------- */
  const fanGeo = merge([
    place(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), 0, 0.15, 0),
    place(new THREE.CylinderGeometry(0.1, 0.09, 0.12, 12), 0, -0.02, 0),
    ...[0, 1, 2, 3].map((k) => place(new THREE.BoxGeometry(0.62, 0.012, 0.13), Math.cos(k * PI / 2) * 0.4, -0.05, Math.sin(k * PI / 2) * 0.4, -k * PI / 2)),
  ]);
  const fans = [[-4.6, 5.38, -0.6, 1.4], [4.6, 5.38, -0.6, -1.3], [-5.6, 6.85, -11.6, 1.6], [5.6, 6.85, -11.6, 1.5], [-10.9, 6.85, -20.4, -1.4]];
  const fanIm = instanced(fanGeo, M.moldura, fanMatrices(fans, 0), { cast: false });
  root.add(fanIm);
  out.updateFans = (time) => {
    fanMatrices(fans, time).forEach((m, i) => fanIm.setMatrixAt(i, m));
    fanIm.instanceMatrix.needsUpdate = true;
  };

  /* ---------- Lámpara de flecos y consola del zaguán ---------- */
  const lampY = 4.35, lampZ = -5.9;
  const drum = new THREE.Mesh(merge([
    place(new THREE.CylinderGeometry(0.74, 0.74, 0.5, 30, 1, true), 0, lampY + 0.25, lampZ),
    place(new THREE.CircleGeometry(0.74, 30), 0, lampY + 0.5, lampZ, 0, -PI / 2),
  ]), M.lino);
  M.lino.side = THREE.DoubleSide;
  root.add(drum);
  const fringe = new THREE.CylinderGeometry(0.75, 0.75, 0.42, 30, 1, true);
  const fuv = fringe.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setX(i, fuv.getX(i) * 9);
  fringe.translate(0, lampY - 0.18, lampZ);
  root.add(new THREE.Mesh(fringe, M.fleco));
  root.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.012, 0.012, 5.7 - lampY - 0.5, 4), 0, (5.7 + lampY + 0.5) / 2, lampZ), M.hierroOscuro));
  const con = new THREE.Mesh(merge([
    boxFromTo(1.45, FL, -5.2, 1.88, FL + 0.9, -4.0),
  ]), M.puertaBlanca);
  con.castShadow = true; con.receiveShadow = true; root.add(con);
  root.add(new THREE.Mesh(lathe([[0, 0], [0.09, 0], [0.13, 0.12], [0.07, 0.3], [0.05, 0.36], [0, 0.36]], 12).translate(1.66, FL + 0.9, -4.6), M.vidrio));
  const flowers = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, d = 0.05 + (i % 4) * 0.06;
    flowers.push(place(new THREE.IcosahedronGeometry(0.07 + (i % 3) * 0.02, 0), 1.66 + Math.cos(a) * d, FL + 1.38 + (i % 5) * 0.07, -4.6 + Math.sin(a) * d));
  }
  root.add(new THREE.Mesh(merge(flowers.filter((_, i) => i % 3)), M.verdeMesa));
  root.add(new THREE.Mesh(merge(flowers.filter((_, i) => !(i % 3))), M.flores));

  /* ---------- Evento: Cena entre Las Palmeras ---------- */
  const ev = new THREE.Group();
  const { x: ex, z0, z1 } = L.eventTable;
  const zc = (z0 + z1) / 2, len = Math.abs(z1 - z0);
  const cloth = new THREE.Mesh(merge([
    boxFromTo(-0.6, 0, -len / 2, 0.6, 0.77, len / 2),
    boxFromTo(-0.62, 0.74, -len / 2 - 0.02, 0.62, 0.78, len / 2 + 0.02),
  ]), M.mantel);
  cloth.position.set(ex, GR, zc); cloth.castShadow = true; cloth.receiveShadow = true;
  ev.add(cloth);
  const evChair = merge([
    place(new THREE.BoxGeometry(0.44, 0.05, 0.44), 0, 0.46, 0),
    place(new THREE.BoxGeometry(0.42, 0.42, 0.035), 0, 0.72, -0.2),
    ...[[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]].map(([x, z]) => place(new THREE.BoxGeometry(0.035, 0.46, 0.035), x, 0.23, z)),
  ]);
  const ecM = [];
  for (let z = z0 - 0.45; z > z1 + 0.3; z -= 0.78) {
    ecM.push(mat4(ex - 0.92, 0, z, PI / 2));
    ecM.push(mat4(ex + 0.92, 0, z, -PI / 2));
  }
  ecM.push(mat4(ex, 0, z0 + 0.55, PI)); ecM.push(mat4(ex, 0, z1 - 0.55, 0));
  const chairsGroup = new THREE.Group(); chairsGroup.position.set(0, GR, 0);
  chairsGroup.add(instanced(evChair, M.mimbre, ecM));
  ev.add(chairsGroup);
  // camino de mesa: follaje y flores blancas
  const greenM = [], whiteM = [], candleM = [];
  for (let z = z0 - 0.3; z > z1 + 0.3; z -= 0.22) {
    greenM.push(mat4(ex + (Math.sin(z * 7) * 0.08), 0.83, z, z * 3, 0.13 + Math.abs(Math.sin(z * 5)) * 0.06, 0, 0, 0.09));
    if (Math.round(z / 0.22) % 3 === 0) whiteM.push(mat4(ex + Math.cos(z * 9) * 0.1, 0.9, z, 0, 0.075));
  }
  for (let z = z0 - 0.7; z > z1 + 0.5; z -= 1.1) for (const s of [-1, 1]) candleM.push(mat4(ex + s * 0.22, 0.79, z));
  const decoGroup = new THREE.Group(); decoGroup.position.set(0, GR, 0);
  decoGroup.add(instanced(new THREE.IcosahedronGeometry(1, 1), M.verdeMesa, greenM, { cast: false }));
  decoGroup.add(instanced(new THREE.IcosahedronGeometry(1, 0), M.flores, whiteM, { cast: false }));
  decoGroup.add(instanced(place(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), 0, 0.06, 0), M.farolVidrio, candleM, { cast: false }));
  ev.add(decoGroup);
  // guirnaldas de focos entre las palmas
  const palm = (i) => L.palms[i];
  const pairs = [[1, 5], [6, 4], [1, 4], [6, 5]];
  const bulbs = [], wires = [];
  for (const [a, b] of pairs) {
    const A = new THREE.Vector3(palm(a)[0], GR + 5.2, palm(a)[1]);
    const B = new THREE.Vector3(palm(b)[0], GR + 5.0, palm(b)[1]);
    const n = 22;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = A.clone().lerp(B, t);
      p.y -= Math.sin(PI * t) * 1.1;
      if (i > 0 && i < n) bulbs.push(mat4(p.x, p.y - 0.06, p.z, 0, 0.055));
      if (prev) {
        const mid = prev.clone().add(p).multiplyScalar(0.5);
        const d = p.clone().sub(prev);
        const m = new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), new THREE.Vector3(1, d.length(), 1));
        wires.push(m);
      }
      prev = p;
    }
  }
  const bulbIm = instanced(new THREE.IcosahedronGeometry(1, 1), M.foco, bulbs, { cast: false });
  const wireIm = instanced(new THREE.CylinderGeometry(0.008, 0.008, 1, 3), M.hierroOscuro, wires, { cast: false });
  ev.add(bulbIm); ev.add(wireIm);
  root.add(ev);

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  out.setEvent = (e) => {
    ev.visible = e > 0.001;
    const c = smooth(0, 0.45, e);
    cloth.scale.set(1, Math.max(0.001, smooth(0, 0.2, e)), Math.max(0.001, c));
    chairsGroup.scale.set(1, Math.max(0.001, smooth(0.25, 0.65, e)), 1);
    const d = smooth(0.45, 0.8, e);
    decoGroup.visible = d > 0.001;
    decoGroup.scale.set(1, Math.max(0.001, d), 1);
    const k = smooth(0.55, 1, e);
    bulbIm.count = Math.round(bulbs.length * k);
    wireIm.count = Math.round(wires.length * k);
  };
  out.setEvent(0);
  return out;
}
