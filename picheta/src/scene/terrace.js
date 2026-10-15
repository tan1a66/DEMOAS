// Primer plano: suelo de la terraza, balaustrada, mesas redondas con sillas
// y guirnaldas de luces con algunos faroles colgados.
//
// Coordenadas (metros): suelo de la terraza en y = 0, la cámara mira hacia -Z (al sur,
// hacia la plaza). La balaustrada corre a lo largo de X.

import * as THREE from 'three';
import { GeoBag, at } from './build.js';
import { PATIO } from './casona.js';

export const PARAPET_Z = -1.85; // eje de la balaustrada
const RAIL_TOP = 0.92;
const HALF_LEN = 11; // la balaustrada sobresale del encuadre por ambos lados

/** Balaustre torneado low-poly (6 lados). */
function balusterGeometry() {
  const p = [
    [0.06, 0], [0.06, 0.04], [0.035, 0.07], [0.078, 0.3], [0.045, 0.48],
    [0.03, 0.54], [0.052, 0.58], [0.052, 0.66], [0.0, 0.66],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(p, 10);
}

/** Henequén (agave) en maceta: la planta de Yucatán. Base en el origen. */
function agaveBag() {
  const b = new GeoBag();
  const pot = [[0, 0], [0.2, 0], [0.26, 0.05], [0.3, 0.42], [0.34, 0.46], [0.33, 0.5], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  b.add(new THREE.LatheGeometry(pot, 18));
  const leaf = new THREE.ConeGeometry(0.055, 0.85, 5).translate(0, 0.425, 0);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
    const tilt = 0.35 + (i % 3) * 0.28;
    const s = 0.75 + ((i * 7) % 5) * 0.08;
    b.add(leaf, { y: 0.48, rx: Math.cos(a) * tilt, rz: -Math.sin(a) * tilt, sx: 1, sy: s, sz: 0.4 });
  }
  return b;
}

/** Silla de bistró: asiento redondo, patas abiertas y respaldo curvo. Mira hacia +Z. */
function chairBag() {
  const b = new GeoBag();
  b.add(new THREE.CylinderGeometry(0.21, 0.2, 0.04, 10), { y: 0.46 });
  for (const [x, z] of [[0.13, 0.13], [-0.13, 0.13], [0.13, -0.13], [-0.13, -0.13]]) {
    b.add(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 4), {
      x: x * 1.08, y: 0.23, z: z * 1.08, rx: -z * 0.35, rz: x * 0.35,
    });
  }
  // Respaldo: dos arcos y tres barrotes.
  const arc = (y, r) => b.add(new THREE.TorusGeometry(r, 0.016, 4, 10, Math.PI), { y, z: 0, rx: Math.PI / 2, rz: Math.PI });
  arc(0.84, 0.2);
  arc(0.66, 0.2);
  for (const a of [-1.15, 0, 1.15]) {
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), { x: Math.sin(a) * 0.2, y: 0.66, z: -Math.cos(a) * 0.2 });
  }
  return b;
}

/** Mesa redonda de un pie. */
function tableBag() {
  const b = new GeoBag();
  b.add(new THREE.CylinderGeometry(0.38, 0.38, 0.035, 28), { y: 0.74 });
  b.add(new THREE.CylinderGeometry(0.39, 0.37, 0.012, 28), { y: 0.72 });
  b.add(new THREE.CylinderGeometry(0.03, 0.035, 0.72, 10), { y: 0.37 });
  b.add(new THREE.CylinderGeometry(0.2, 0.23, 0.03, 16), { y: 0.015 });
  return b;
}

/** Copa / vaso low-poly para la mesa. */
function glassGeometry(h = 0.16) {
  const p = [[0.0, 0], [0.04, 0], [0.04, 0.008], [0.006, 0.02], [0.006, h * 0.5], [0.045, h * 0.75], [0.04, h]].map(
    ([r, y]) => new THREE.Vector2(r, y),
  );
  return new THREE.LatheGeometry(p, 7);
}

/**
 * Curva colgante (parábola, casi una catenaria) entre dos anclajes.
 * `sag` = cuánto baja en el centro.
 */
function hangingCurve(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function buildTerrace(mat) {
  const group = new THREE.Group();
  const clay = new GeoBag();

  // ---------------------------------------------------------------- suelo
  // Mosaico de pasta, con el hueco del patio de la casona detrás de la cámara.
  const floor = new GeoBag();
  const { x0, x1, z0, z1 } = PATIO;
  const zFront = PARAPET_Z - 0.1;
  const zBack = 18;
  floor.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.3, z0 - zFront), { y: -0.15, z: (zFront + z0) / 2 });
  floor.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.3, zBack - z1), { y: -0.15, z: (z1 + zBack) / 2 });
  floor.add(new THREE.BoxGeometry(x0 + HALF_LEN, 0.3, z1 - z0), { y: -0.15, x: (x0 - HALF_LEN) / 2, z: (z0 + z1) / 2 });
  floor.add(new THREE.BoxGeometry(HALF_LEN - x1, 0.3, z1 - z0), { y: -0.15, x: (x1 + HALF_LEN) / 2, z: (z0 + z1) / 2 });
  // Cornisa del edificio bajo la terraza (se ve de reojo entre balaustres).
  clay.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.22, 0.5), { y: -0.36, z: PARAPET_Z - 0.05 });
  // Fachada del edificio hasta la calle.
  clay.add(new THREE.BoxGeometry(2 * HALF_LEN, 9.2, 0.4), { y: -5.0, z: PARAPET_Z + 0.1 });

  // ---------------------------------------------------------------- balaustrada
  clay.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.12, 0.36), { y: 0.06, z: PARAPET_Z });
  clay.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.1, 0.36), { y: RAIL_TOP - 0.05, z: PARAPET_Z });
  clay.add(new THREE.BoxGeometry(2 * HALF_LEN, 0.04, 0.4), { y: RAIL_TOP - 0.11, z: PARAPET_Z });

  // Pilastras: dejan libre el centro del encuadre.
  const pillars = [-10.6, -6.6, -2.4, 2.4, 6.6, 10.6];
  for (const x of pillars) {
    clay.box(0.34, RAIL_TOP + 0.06, 0.42, x, 0, PARAPET_Z);
    clay.box(0.42, 0.06, 0.5, x, RAIL_TOP + 0.06, PARAPET_Z);
    clay.box(0.4, 0.1, 0.48, x, 0, PARAPET_Z);
  }
  // Remates: bolas sobre peana en las pilastras sin poste.
  for (const x of [-10.6, 10.6]) {
    clay.add(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 14), { x, y: RAIL_TOP + 0.16, z: PARAPET_Z });
    clay.add(new THREE.SphereGeometry(0.13, 16, 10), { x, y: RAIL_TOP + 0.31, z: PARAPET_Z });
  }
  const baluster = balusterGeometry();
  for (let x = -HALF_LEN; x <= HALF_LEN; x += 0.21) {
    if (pillars.some((px) => Math.abs(px - x) < 0.3)) continue;
    clay.add(baluster, { x, y: 0.12, z: PARAPET_Z });
  }

  // ---------------------------------------------------------------- mesas y sillas
  const table = tableBag();
  const chair = chairBag();
  // [x, z, ángulos de las sillas alrededor]
  // La cámara está en (0, 1.22, 1.0): la nuestra queda abajo; las otras enmarcan la vista.
  const tables = [
    { x: 0.1, z: 0.25, chairs: [Math.PI * 0.8] }, // la nuestra: abajo, cortada por el encuadre
    { x: -1.05, z: -1.05, chairs: [Math.PI * 0.6, -Math.PI * 0.35] },
    { x: 1.35, z: -1.25, chairs: [Math.PI * 0.3, -Math.PI * 0.7] },
  ];
  const tops = [];
  for (const t of tables) {
    clay.addBag(table, at(t.x, 0, t.z));
    for (const a of t.chairs) {
      const cx = t.x + Math.sin(a) * 0.62;
      const cz = t.z + Math.cos(a) * 0.62;
      clay.addBag(chair, at(cx, 0, cz, a + Math.PI));
    }
    tops.push(new THREE.Vector3(t.x, 0.758, t.z));
  }

  // Sobre las mesas: copas y un plato (arcilla) + un farolillo (emisivo).
  const glass = glassGeometry();
  const plate = new THREE.CylinderGeometry(0.13, 0.1, 0.018, 12);
  const tableLights = new GeoBag();
  tops.forEach((p, i) => {
    clay.add(glass, { x: p.x + 0.12, y: p.y, z: p.z + 0.08 });
    if (i === 0) {
      clay.add(glass, { x: p.x - 0.16, y: p.y, z: p.z + 0.02, sy: 0.8 });
      clay.add(plate, { x: p.x - 0.02, y: p.y + 0.009, z: p.z + 0.16 });
    }
    // farolillo: base, cristal (emisivo), tapa
    clay.add(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 6), { x: p.x - 0.1, y: p.y + 0.01, z: p.z - 0.1 });
    tableLights.add(new THREE.CylinderGeometry(0.034, 0.034, 0.09, 6), { x: p.x - 0.1, y: p.y + 0.065, z: p.z - 0.1 });
    clay.add(new THREE.ConeGeometry(0.05, 0.05, 6), { x: p.x - 0.1, y: p.y + 0.135, z: p.z - 0.1 });
  });

  // ---------------------------------------------------------------- guirnaldas de luces
  // Postes finos sobre las pilastras; entre ellos la guirnalda cuelga como una sonrisa.
  const wires = new GeoBag();
  const bulbs = new GeoBag();
  const lanterns = new GeoBag();
  const poleX = [-6.6, -2.4, 2.4, 6.6];
  const POLE_TOP = 3.05;
  for (const x of poleX) {
    wires.add(new THREE.CylinderGeometry(0.016, 0.02, POLE_TOP - RAIL_TOP - 0.12, 5), {
      x, y: (POLE_TOP + RAIL_TOP + 0.12) / 2, z: PARAPET_Z,
    });
  }
  const bulbGeo = new THREE.IcosahedronGeometry(0.022, 1);
  const capGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.022, 5);
  const strands = [];
  for (let i = 0; i < poleX.length - 1; i++) {
    const a = new THREE.Vector3(poleX[i], POLE_TOP, PARAPET_Z);
    const b = new THREE.Vector3(poleX[i + 1], POLE_TOP, PARAPET_Z);
    // El tramo central cuelga en el hueco entre la catedral y la torre del reloj, con un farol al centro.
    strands.push({ curve: hangingCurve(a, b, i === 1 ? 0.95 : 0.8), lanterns: i === 1 ? [0.5] : [] });
  }
  // Dos guirnaldas que vienen desde detrás de la cámara: entran por arriba hacia los postes.
  strands.push({
    curve: hangingCurve(new THREE.Vector3(-2.4, POLE_TOP, PARAPET_Z), new THREE.Vector3(-0.55, 3.45, 3.4), 0.42),
    lanterns: [],
  });
  strands.push({
    curve: hangingCurve(new THREE.Vector3(2.4, POLE_TOP, PARAPET_Z), new THREE.Vector3(0.75, 3.45, 3.4), 0.38),
    lanterns: [],
  });

  const lanternPositions = [];
  for (const s of strands) {
    wires.add(new THREE.TubeGeometry(s.curve, 64, 0.0045, 3, false));
    const len = s.curve.getLength();
    const n = Math.round(len / 0.27);
    for (let i = 1; i < n; i++) {
      const p = s.curve.getPointAt(i / n);
      bulbs.add(bulbGeo, { x: p.x, y: p.y - 0.058, z: p.z });
      wires.add(capGeo, { x: p.x, y: p.y - 0.026, z: p.z });
    }
    // Faroles colgados: cuerpo hexagonal emisivo con tapa y cordón.
    for (const t of s.lanterns) {
      const p = s.curve.getPointAt(t);
      const drop = 0.26;
      wires.add(new THREE.CylinderGeometry(0.005, 0.005, drop, 3), { x: p.x, y: p.y - drop / 2, z: p.z });
      lanterns.add(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 6), { x: p.x, y: p.y - drop - 0.1, z: p.z });
      wires.add(new THREE.ConeGeometry(0.1, 0.08, 6), { x: p.x, y: p.y - drop + 0.03, z: p.z });
      wires.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6), { x: p.x, y: p.y - drop - 0.21, z: p.z });
      lanternPositions.push(new THREE.Vector3(p.x, p.y - drop - 0.1, p.z));
    }
  }

  // Henequén en macetas junto a la balaustrada (enmarcan la vista en pantallas anchas).
  const agave = agaveBag();
  clay.addBag(agave, at(-1.95, 0, PARAPET_Z + 0.55, 0.3));
  clay.addBag(agave, at(2.05, 0, PARAPET_Z + 0.5, 1.1, 0.85));

  group.add(clay.mesh(mat.clay));
  group.add(floor.mesh(mat.tiles, { cast: false }));
  group.add(wires.mesh(mat.wire, { cast: false, receive: false }));
  const bulbMesh = bulbs.mesh(mat.bulb, { cast: false, receive: false });
  const lanternMesh = lanterns.mesh(mat.lantern, { cast: false, receive: false });
  const tableLightMesh = tableLights.mesh(mat.lantern, { cast: false, receive: false });
  group.add(bulbMesh, lanternMesh, tableLightMesh);

  // Luz cálida real de las guirnaldas sobre mesas y balaustrada (sin sombras: barato).
  const lights = [new THREE.Vector3(-1.3, 2.05, -1.1), new THREE.Vector3(1.5, 2.05, -1.2)].map((p) => {
    const l = new THREE.PointLight('#FFB25E', 0, 7, 2);
    l.position.copy(p);
    group.add(l);
    return l;
  });
  // Y una muy cercana sobre nuestra mesa (el farolillo).
  const candle = new THREE.PointLight('#FF9E48', 0, 2.2, 2);
  candle.position.copy(tops[0]).add(new THREE.Vector3(-0.1, 0.12, -0.1));
  group.add(candle);

  return { group, lights, candle, lanternPositions, railTop: RAIL_TOP };
}
