import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PISOS, TIPOS, ESTADOS } from '../data/hotel.js';
import { polar, arcFrame, boxGeo, arcSlab, ribbon, tint, Buckets, rng } from './geo.js';
import { floorMaterials, cutPlane, setDim } from './materials.js';
import { bush, vine } from './foliage.js';

// Dimensiones (m)
export const RF = 46; // fachada de vidrio
export const ROOM = 8.6; // fondo de habitación
export const CORR = 2.2; // pasillo
export const RB = RF + ROOM + CORR + 0.3; // fachada posterior
export const PB_H = 5;
export const H = 3.5;
export const SLAB = 0.3;
const CORE = 5 / RF; // medio ángulo del núcleo de elevadores
const RG = RF + 3; // vidrio de la planta baja (retranqueado: galería cubierta)

export const baseY = (nivel) => (nivel === 0 ? 0 : PB_H + (nivel - 1) * H);
export const TOP = baseY(7); // azotea

// Borde ondulado de balcones: la fase cambia en cada piso (fachada "en movimiento").
const edge = (nivel) => (a) => RF - (1.7 + 0.9 * (0.5 + 0.5 * Math.sin(a * 9 + nivel * 1.1)));

// Reparte las unidades de un piso sobre el arco (ángulos de cada una).
function layout(piso) {
  const units = piso.unidades.map((u) => ({ ...u, w: TIPOS[u.tipo].ancho }));
  const right = units.filter((u) => u.lado === 1);
  let a = CORE;
  for (const u of right) {
    u.a0 = a;
    u.a1 = a + u.w / RF;
    a = u.a1;
  }
  const left = units.filter((u) => u.lado === -1).reverse();
  a = -CORE;
  for (const u of left) {
    u.a1 = a;
    u.a0 = a - u.w / RF;
    a = u.a0;
  }
  for (const u of units) u.am = (u.a0 + u.a1) / 2;
  return { units, half: right.at(-1).a1 };
}

// Ayudantes para amueblar en el marco de una unidad: x = tangente (espejada en el ala
// izquierda), v = profundidad desde el vidrio (negativa = terraza), y desde el piso terminado.
const SOFT = new Set(['fabric', 'velvet', 'leather', 'throw']);
let LITE = false; // móvil: tapicería sin aristas redondeadas

function kit(b, frame, s = 1, rand = Math.random) {
  const at = (geo, x, y, v) => b.add(geo.userData.key, geo.translate(x * s, y + 0.03, -v), frame);
  const P = (key, x0, x1, y0, y1, v0, v1) => {
    const xa = x0 * s;
    const xb = x1 * s;
    const make = SOFT.has(key) && !LITE ? softBox : boxGeo;
    return b.add(key, make(Math.min(xa, xb), Math.max(xa, xb), y0 + 0.03, y1 + 0.03, -v1, -v0), frame);
  };
  const keyed = (g, key) => ((g.userData.key = key), g);
  // Cilindro vertical (mesas redondas, lámparas, macetas); O = óvalo (tina).
  const C = (key, x, v, r, y0, y1, seg = 20) => at(keyed(new THREE.CylinderGeometry(r, r, y1 - y0, seg), key), x, (y0 + y1) / 2, v);
  const O = (key, x, v, rx, rz, y0, y1) => at(keyed(new THREE.CylinderGeometry(1, 0.92, y1 - y0, 28).scale(rx, 1, rz), key), x, (y0 + y1) / 2, v);
  const S = (key, x, y, v, r) => at(keyed(new THREE.SphereGeometry(r, 14, 10), key), x, y, v);
  const L = (x, y, v, r) => {
    const p = new THREE.Vector3(x * s, y + 0.03, -v).applyMatrix4(frame);
    return b.add('leaf', bush(p, r, rand));
  };
  return { P, C, O, S, L };
}

// Cojines, colchones y tapicería: cajas con aristas redondeadas.
function softBox(x0, x1, y0, y1, z0, z1) {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const r = Math.min(0.06, Math.min(w, h, d) * 0.4);
  return new RoundedBoxGeometry(w, h, d, 1, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// Planta: arbusto de tarjetas con textura de hojas.
function blob(b, rand, pos, r) {
  return b.add('leaf', bush(pos, r * 1.25, rand));
}

// ---------------------------------------------------------------- Mobiliario (lujo)
// Recámara: cabecera tapizada sobre panel de nogal, buroes con lámparas colgantes,
// banca al pie de la cama, credenza de mármol con obra de arte y sillón de lectura.
function bedroom({ P, C, S }, cx, hw) {
  const L = cx - hw;
  const R = cx + hw;
  P('wood', L, L + 0.05, 0, 3.0, 2.2, 5.7);
  P('velvet', L + 0.05, L + 0.17, 0.3, 1.5, 2.85, 5.1);
  P('wood', L + 0.17, L + 2.3, 0.1, 0.36, 3.0, 4.95);
  P('fabric', L + 0.2, L + 2.25, 0.36, 0.62, 3.02, 4.93);
  P('fabric', L + 0.6, L + 2.3, 0.58, 0.68, 2.98, 4.97);
  P('throw', L + 1.75, L + 2.33, 0.64, 0.72, 2.95, 5.0);
  P('fabric', L + 0.2, L + 0.42, 0.62, 1.05, 3.08, 3.95);
  P('fabric', L + 0.2, L + 0.42, 0.62, 1.05, 4.0, 4.87);
  P('fabric', L + 0.42, L + 0.62, 0.62, 0.92, 3.2, 3.92);
  P('fabric', L + 0.42, L + 0.62, 0.62, 0.92, 4.03, 4.75);
  P('velvet', L + 0.62, L + 0.76, 0.62, 0.86, 3.65, 4.3);
  P('leather', L + 2.45, L + 2.85, 0.1, 0.46, 3.25, 4.7);
  for (const v of [2.55, 5.4]) {
    P('wood', L + 0.17, L + 0.66, 0.05, 0.55, v - 0.25, v + 0.25);
    P('brass', L + 0.17, L + 0.66, 0.55, 0.57, v - 0.25, v + 0.25);
    C('dark', L + 0.42, v, 0.006, 1.3, 3.17, 4);
    S('lamp', L + 0.42, 1.22, v, 0.09);
  }
  P('rug', L + 1.2, R - 0.25, 0, 0.02, 2.3, 5.6);
  P('wood', R - 0.48, R - 0.04, 0.08, 0.62, 3.05, 4.95);
  P('marble', R - 0.5, R - 0.02, 0.62, 0.66, 3.03, 4.97);
  P('art', R - 0.05, R - 0.02, 1.15, 2.05, 3.4, 4.6);
  C('terracotta', R - 0.26, 3.45, 0.09, 0.66, 1.05);
  P('velvet', R - 1.3, R - 0.5, 0.12, 0.44, 0.7, 1.5);
  P('velvet', R - 0.5, R - 0.32, 0.12, 0.92, 0.7, 1.5);
  P('throw', R - 1.2, R - 0.55, 0.44, 0.5, 0.78, 1.42);
  C('brass', R - 0.42, 1.78, 0.015, 0, 1.5, 6);
  C('lamp', R - 0.42, 1.78, 0.2, 1.38, 1.68);
  C('marble', R - 1.75, 1.1, 0.26, 0.5, 0.53);
  C('brass', R - 1.75, 1.1, 0.03, 0, 0.5, 6);
}

// Baño: piso de mármol, doble lavabo de nogal con espejo, tina exenta y regadera de vidrio.
function bathroom({ P, O, C }, hw, rand, split = false) {
  P('interior', -hw, hw - 2.05, 0, 3.17, 5.95, 6.08);
  P('interior', hw - 1.13, hw - 1.0, 0, 3.17, 6.08, ROOM - 0.1);
  P('marble', -hw, hw - 1.13, 0, 0.012, 6.08, ROOM - 0.1);
  P('wood', -hw + 0.08, -hw + 0.6, 0.18, 0.84, 6.35, 7.95);
  P('marble', -hw + 0.06, -hw + 0.64, 0.84, 0.9, 6.32, 7.98);
  P('mirror', -hw + 0.03, -hw + 0.06, 1.15, 2.1, 6.45, 7.85);
  P('lamp', -hw + 0.05, -hw + 0.08, 2.2, 2.25, 6.45, 7.85);
  const tx = split ? -hw + 2.3 : -hw + 2.25;
  O('porcelain', tx, 7.75, 0.82, 0.4, 0, 0.56);
  O('dark', tx, 7.75, 0.72, 0.31, 0.5, 0.565);
  C('brass', tx + 0.85, 7.75, 0.025, 0, 1.0, 6);
  if (hw > 3) {
    P('rail', hw - 2.3, hw - 1.15, 0, 2.2, 7.25, 7.28);
    P('stone', hw - 2.3, hw - 1.15, 0, 0.02, 7.28, ROOM - 0.12);
    C('brass', hw - 1.7, 7.95, 0.14, 2.35, 2.38);
  }
  // Clóset de nogal y puerta de entrada.
  P('wood', hw - 0.62, hw - 0.04, 0, 2.6, 5.2, 5.95);
  P('brass', hw - 0.66, hw - 0.63, 0.9, 1.6, 5.5, 5.52);
  P('wood', hw - 0.95, hw - 0.12, 0, 2.4, ROOM + 0.1, ROOM + 0.14);
  if (rand() < 0.5) P('terracotta', -hw + 0.2, -hw + 0.5, 0, 0.35, 0.3, 0.6);
}

// Sala: sofá modular contra el muro, mesa de centro de mármol, sillones de piel y comedor redondo.
function living({ P, C, S, L }, x0, x1, armchairs = true) {
  P('fabric', x0, x0 + 0.95, 0.1, 0.42, 1.0, 3.4);
  P('fabric', x0 + 0.22, x0 + 0.93, 0.42, 0.53, 1.03, 2.2);
  P('fabric', x0 + 0.22, x0 + 0.93, 0.42, 0.53, 2.2, 3.37);
  P('fabric', x0, x0 + 0.26, 0.42, 0.88, 1.0, 3.4);
  P('fabric', x0 + 0.26, x0 + 0.95, 0.42, 0.62, 0.92, 1.08);
  P('fabric', x0 + 0.26, x0 + 0.95, 0.42, 0.62, 3.32, 3.48);
  P('velvet', x0 + 0.26, x0 + 0.4, 0.5, 0.84, 1.3, 1.78);
  P('velvet', x0 + 0.26, x0 + 0.4, 0.5, 0.84, 2.6, 3.08);
  P('throw', x0 + 0.5, x0 + 0.95, 0.53, 0.58, 2.6, 3.3);
  P('rug', x0 + 0.5, Math.min(x0 + 3.2, x1 - 0.2), 0, 0.02, 0.7, 3.7);
  const tx = x0 + 1.6;
  C('marble', tx, 2.2, 0.48, 0.34, 0.39, 32);
  C('brass', tx, 2.2, 0.32, 0.0, 0.34, 24);
  C('terracotta', tx + 0.1, 2.1, 0.07, 0.39, 0.6);
  if (armchairs && x1 - x0 > 3.4) {
    for (const v of [1.35, 3.05]) {
      P('leather', x0 + 2.45, x0 + 3.2, 0.12, 0.44, v - 0.4, v + 0.4);
      P('leather', x0 + 3.05, x0 + 3.22, 0.12, 0.86, v - 0.4, v + 0.4);
    }
  }
  // Lámpara de arco y planta grande junto al ventanal.
  C('brass', x0 + 0.35, 0.75, 0.02, 0, 1.85, 6);
  S('lamp', x0 + 0.35, 1.95, 0.75, 0.17);
  C('terracotta', x1 - 0.45, 0.55, 0.26, 0, 0.55);
  L(x1 - 0.45, 0.45, 0.55, 0.75);
  // Comedor para cuatro con lámpara colgante.
  const dx = Math.min(x1 - 1.3, x0 + 1.9);
  C('marble', dx, 4.55, 0.58, 0.72, 0.76, 32);
  C('brass', dx, 4.55, 0.07, 0.0, 0.72, 10);
  for (const [ox, ov] of [[0.78, 0], [-0.78, 0], [0, 0.78], [0, -0.78]]) {
    const cxx = dx + ox;
    const cvv = 4.55 + ov;
    P('velvet', cxx - 0.22, cxx + 0.22, 0.25, 0.47, cvv - 0.22, cvv + 0.22);
    if (ox) P('velvet', cxx + Math.sign(ox) * 0.2 - 0.06, cxx + Math.sign(ox) * 0.2 + 0.06, 0.25, 0.85, cvv - 0.22, cvv + 0.22);
    else P('velvet', cxx - 0.22, cxx + 0.22, 0.25, 0.85, cvv + Math.sign(ov) * 0.2 - 0.06, cvv + Math.sign(ov) * 0.2 + 0.06);
  }
  C('dark', dx, 4.55, 0.006, 2.0, 3.17, 4);
  S('brass', dx, 1.95, 4.55, 0.2);
  S('lamp', dx, 1.84, 4.55, 0.1);
}

// Cocina: gabinetes de nogal, cubierta de mármol y alacenas con luz inferior.
function kitchen({ P }, x0, x1) {
  P('wood', x0, x1, 0.08, 0.88, 5.3, 5.93);
  P('marble', x0 - 0.02, x1 + 0.02, 0.88, 0.93, 5.26, 5.93);
  P('dark', x0 + 0.3, x0 + 0.9, 0.93, 0.945, 5.4, 5.8);
  P('wood', x0, x1, 1.55, 2.4, 5.6, 5.93);
  P('lamp', x0 + 0.05, x1 - 0.05, 1.53, 1.55, 5.62, 5.7);
  for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.6) P('brass', x - 0.12, x + 0.12, 0.8, 0.82, 5.27, 5.29);
}

function balcony({ P, C }, cx, rand) {
  // Camastro de teca con cojín, mesa de mármol y linterna.
  P('woodLight', cx - 1.0, cx + 0.9, 0.08, 0.3, -1.3, -0.62);
  P('fabric', cx - 0.95, cx + 0.45, 0.3, 0.4, -1.27, -0.65);
  P('fabric', cx + 0.45, cx + 0.88, 0.3, 0.7, -1.27, -0.65);
  C('marble', cx + 1.25, -0.95, 0.2, 0.42, 0.45);
  C('brass', cx + 1.25, -0.95, 0.025, 0, 0.42, 6);
  if (rand() < 0.6) C('lamp', cx - 1.45, -0.6, 0.1, 0, 0.35, 8);
}

// Interior común: cortinas de lino a los lados del ventanal y luz indirecta en el plafón.
function windowDressing({ P }, hw) {
  P('fabric', -hw + 0.15, -hw + 0.7, 0.05, 3.12, 0.12, 0.2);
  P('fabric', hw - 0.7, hw - 0.15, 0.05, 3.12, 0.12, 0.2);
  P('lamp', -hw + 0.2, hw - 0.2, 3.1, 3.14, 0.28, 0.34);
}

// Tres tipologías: A estudio, B una recámara, C dos recámaras (en espejo).
function furnish(b, u, frame, rand) {
  const K = kit(b, frame, u.lado, rand);
  const M = { ...K, P: (key, x0, x1, ...r) => K.P(key, -x1, -x0, ...r), C: (key, x, ...r) => K.C(key, -x, ...r), S: (key, x, ...r) => K.S(key, -x, ...r) };
  const { P } = K;
  const hw = u.w / 2;
  bathroom(K, hw, rand, u.tipo === 'c');
  windowDressing(K, hw);
  if (u.tipo === 'a') {
    bedroom(K, -hw + 1.6, 1.6);
    // Cocineta de nogal y mármol contra el muro lateral, con dos bancos altos.
    P('wood', hw - 0.62, hw - 0.02, 0.08, 0.88, 2.4, 4.8);
    P('marble', hw - 0.66, hw - 0.02, 0.88, 0.93, 2.38, 4.82);
    P('wood', hw - 0.4, hw - 0.02, 1.55, 2.4, 2.4, 4.8);
    P('lamp', hw - 0.4, hw - 0.36, 1.53, 1.55, 2.45, 4.75);
    for (const v of [3.1, 4.0]) {
      K.C('leather', hw - 1.0, v, 0.19, 0.62, 0.7);
      K.C('brass', hw - 1.0, v, 0.02, 0, 0.62, 6);
    }
    P('velvet', 0.95, hw - 0.75, 0.12, 0.44, 0.75, 1.5);
    P('velvet', 0.95, hw - 0.75, 0.12, 0.84, 0.6, 0.78);
    K.C('terracotta', hw - 0.35, 0.5, 0.22, 0, 0.5);
    K.L(hw - 0.35, 0.42, 0.5, 0.6);
    balcony(K, 0, rand);
  } else if (u.tipo === 'b') {
    bedroom(K, -hw + 1.6, 1.6);
    P('interior', -hw + 3.2, -hw + 3.32, 0, 3.17, 2.3, 5.95);
    living(K, -hw + 3.32, hw);
    kitchen(K, -hw + 3.45, hw - 2.15);
    balcony(K, -1.6, rand);
    balcony(K, 1.8, rand);
  } else {
    bedroom(K, -hw + 1.6, 1.6);
    bedroom(M, -hw + 1.6, 1.6);
    P('interior', -hw + 3.2, -hw + 3.32, 0, 3.17, 2.3, 5.95);
    P('interior', hw - 3.32, hw - 3.2, 0, 3.17, 2.3, 5.95);
    living(K, -hw + 3.32, hw - 3.32, false);
    P('interior', -0.06, 0.06, 0, 3.17, 6.08, ROOM - 0.1);
    balcony(K, -3, rand);
    balcony(K, 0.2, rand);
    balcony(K, 3.2, rand);
  }
}

// ---------------------------------------------------------------- Constructor
export function buildBuilding({ envMap, water, resolution, lite = false }) {
  LITE = lite;
  const group = new THREE.Group();
  group.name = 'building';
  const levels = [];
  const rand = rng(11);

  const layouts = Object.fromEntries(PISOS.filter((p) => p.unidades).map((p) => [p.nivel, layout(p)]));
  const halfOf = (n) => layouts[n]?.half ?? 0;

  for (const piso of PISOS) {
    const n = piso.nivel;
    const y0 = baseY(n);
    const mats = floorMaterials(envMap);
    mats.water = water;
    const b = new Buckets();
    // El mobiliario va aparte: se oculta de lejos y solo proyecta sombra en la visita.
    const lvl = { piso, nivel: n, y0, mats, units: [], fb: new Buckets() };

    if (n >= 1 && n <= 6) buildRooms(b, lvl, layouts[n], halfOf(n + 1), rand);
    else if (n === 0) buildGround(b, lvl, halfOf(1), rand);
    else buildRooftop(b, lvl, halfOf(6), rand);

    lvl.group = b.build(mats);
    if (lvl.fb.map.size) {
      lvl.furniture = lvl.fb.build(mats, { castShadow: false });
      lvl.group.add(lvl.furniture);
    }
    delete lvl.fb;
    lvl.group.name = piso.id;
    group.add(lvl.group);
    buildShell(lvl, resolution);
    group.add(lvl.shell, lvl.lines);
    if (lvl.units.length) buildUnitHelpers(lvl);
    if (lvl.pick) group.add(lvl.pick, lvl.tiles);
    levels.push(lvl);
  }

  const core = buildCore(envMap);
  group.add(core.group);

  return {
    group,
    levels,
    core,
    // Atenúa todos los pisos menos uno (null = ninguno atenuado).
    setFocus(nivel, k = 1) {
      for (const l of levels) setDim(l.mats, nivel == null || l.nivel === nivel ? 0 : k * 0.8);
    },
  };
}

// ---------------------------------------------------------------- Pisos de habitaciones
function buildRooms(b, lvl, { units, half }, halfAbove, rand) {
  const n = lvl.nivel;
  const y0 = lvl.y0;
  const yc = y0 + H - SLAB;
  const hh = yc - y0;
  const r0 = edge(n);
  lvl.half = half;
  lvl.yc = yc;

  // Losa con borde ondulado, deck de terraza, piso interior y pasillo.
  b.add('stucco', arcSlab(r0, RB, -half, half, y0 - SLAB, y0, 0.012));
  b.add('woodLight', arcSlab(r0, RF, -half, half, y0, y0 + 0.04, 0.012));
  b.add('woodLight', arcSlab(RF, RF + ROOM, -half, half, y0, y0 + 0.03));
  b.add('stone', arcSlab(RF + ROOM, RB - 0.3, -half, half, y0, y0 + 0.03));

  // Jardinera continua en el borde + barandal de vidrio encima.
  const r0p = (a) => r0(a) + 0.55;
  b.add('stucco', arcSlab(r0, r0p, -half, half, y0, y0 + 0.5, 0.012));
  const pts = [];
  for (let a = -half; a <= half + 1e-6; a += 0.01) pts.push(polar(r0(a) + 0.04, a));
  b.add('rail', ribbon(pts, y0 + 0.5, y0 + 1.1));

  // Plantas en la jardinera y enredaderas colgando bajo la losa.
  for (let a = -half + 0.01; a < half; a += 0.022 + rand() * 0.012) {
    blob(b, rand, polar(r0(a) + 0.28, a, y0 + 0.3), 0.32 + rand() * 0.22);
    if (rand() < 0.5) b.add('leaf', vine(polar(r0(a) - 0.1, a, y0 + 0.4), 1.2 + rand() * 2.2, 0.7 + rand() * 0.5, rand));
  }

  // Fachadas de vidrio (dos alas), muro de pasillo y fachada posterior.
  for (const s of [-1, 1]) {
    const [a0, a1] = s > 0 ? [CORE, half] : [-half, -CORE];
    b.add('glass', arcSlab(RF - 0.04, RF + 0.04, a0, a1, y0 + 0.03, yc));
    b.add('interior', arcSlab(RF + ROOM - 0.1, RF + ROOM + 0.1, a0, a1, y0, yc));
  }
  b.add('stucco', arcSlab(RB - 0.3, RB, -half, half, y0, yc));
  backFacade(b, half, y0);

  // Muros divisorios que salen a la terraza como aletas.
  const bounds = new Set();
  units.forEach((u) => (bounds.add(u.a0.toFixed(5)), bounds.add(u.a1.toFixed(5))));
  for (const key of bounds) {
    const a = Number(key);
    const end = Math.abs(Math.abs(a) - half) < 1e-4;
    const t = end ? 0.35 : 0.22;
    const off = end ? (Math.sign(a) * -t) / 2 / RF : 0;
    b.add('stucco', boxGeo(-t / 2, t / 2, y0, yc, -(end ? RB : RF + ROOM), -(r0(a) + 0.05)), arcFrame(a + off, 0));
  }

  // Unidades: mobiliario, carpintería, luces de ventana.
  for (const u of units) {
    const frame = arcFrame(u.am, RF, y0);
    u.frame = frame;
    u.y0 = y0;
    u.center = polar(RF + ROOM * 0.45, u.am, y0 + 1.2);
    furnish(lvl.fb, u, frame, rand);
    const { P } = kit(b, frame, u.lado, rand);
    // Montantes y celosía de madera corrediza.
    P('dark', -0.04, 0.04, 0, hh - 0.03, -0.06, 0.06);
    const cs = (n + u.am * 10) % 2 > 1 ? 1 : -1;
    const x0 = cs * (u.w / 2 - 1.4);
    for (let i = 0; i < 9; i++) {
      const x = x0 - 0.6 + i * 0.15;
      P('wood', x - 0.03, x + 0.03, 0.05, hh - 0.1, -0.32, -0.26);
    }
    P('wood', x0 - 0.66, x0 + 0.66, hh - 0.14, hh - 0.08, -0.34, -0.24);
    // Luz interior (de noche): unas habitaciones encendidas, otras no.
    const lit = rand() < 0.78 ? 0.55 + rand() * 0.45 : 0.04;
    const g = new THREE.PlaneGeometry(u.w - 0.5, hh - 0.5).translate(0, hh / 2 + 0.03, -0.35);
    tint(g, new THREE.Color(1, 0.74, 0.42).multiplyScalar(lit));
    b.add('light', g, frame);
    lvl.units.push(u);
  }

  // Azoteas verdes en los extremos que sobresalen del piso de arriba.
  if (halfAbove < half - 1e-4) {
    for (const s of [-1, 1]) {
      const [a0, a1] = s > 0 ? [halfAbove, half] : [-half, -halfAbove];
      b.add('stucco', arcSlab(RF - 1.0, RB, a0, a1, yc, y0 + H));
      b.add('green', tint(arcSlab(RF - 0.2, RB - 0.6, a0 + 0.004, a1 - 0.004, y0 + H, y0 + H + 0.12), 0x6d8a46));
      for (let a = a0 + 0.01; a < a1 - 0.01; a += 0.03) {
        blob(b, rand, polar(RF + 0.4 + rand() * (ROOM + 1), a, y0 + H + 0.05), 0.35 + rand() * 0.5);
      }
      const rp = [];
      for (let a = a0; a <= a1 + 1e-6; a += 0.01) rp.push(polar(RF - 0.95, Math.min(a, a1)));
      b.add('rail', ribbon(rp, y0 + H, y0 + H + 1.05));
    }
  }
}

// Fachada posterior (a la calle): aletas verticales de madera y ventanas estrechas.
function backFacade(b, half, y0) {
  for (let a = -half + 0.012; a < half; a += 1.3 / RB) {
    b.add('wood', boxGeo(-0.06, 0.06, y0 - SLAB, y0 + H - SLAB, -(RB + 0.5), -RB), arcFrame(a, 0));
  }
  for (let a = -half + 0.04; a < half - 0.02; a += 4.2 / RB) {
    if (Math.abs(a) < CORE + 0.02) continue;
    b.add('dark', boxGeo(-0.4, 0.4, y0 + 0.9, y0 + 2.8, -(RB + 0.03), -(RB - 0.05)), arcFrame(a, 0));
  }
}

// ---------------------------------------------------------------- Planta baja
function buildGround(b, lvl, half, rand) {
  const yc = PB_H - SLAB;
  lvl.half = half;
  lvl.yc = yc;
  b.add('stone', arcSlab(RF - 4.5, RB, -half - 0.02, half + 0.02, -0.3, 0.02));
  for (const s of [-1, 1]) {
    const [a0, a1] = s > 0 ? [CORE, half - 0.01] : [-half + 0.01, -CORE];
    b.add('glass', arcSlab(RG - 0.05, RG + 0.05, a0, a1, 0.02, yc));
    for (let a = a0; a <= a1 + 1e-6; a += 0.045) b.add('dark', boxGeo(-0.05, 0.05, 0.02, yc, -(RG + 0.08), -(RG - 0.08)), arcFrame(a, 0));
    const lg = arcSlab(RG + 0.3, RG + 0.35, a0 + 0.01, a1 - 0.01, 0.4, yc - 0.4);
    tint(lg, new THREE.Color(1, 0.76, 0.45).multiplyScalar(0.8));
    b.add('light', lg);
  }
  // Columnas de la galería.
  for (let a = CORE + 0.07; a < half - 0.02; a += 0.11) {
    for (const s of [-1, 1]) {
      const c = new THREE.CylinderGeometry(0.3, 0.3, yc, 14).translate(0, yc / 2, 0);
      const p = polar(RF - 0.9, a * s);
      c.translate(p.x, 0, p.z);
      b.add('stucco', c);
    }
  }
  b.add('stucco', arcSlab(RB - 0.3, RB, -half, half, 0.02, yc));
  for (const s of [-1, 1]) b.add('stucco', boxGeo(-0.2, 0.2, 0.02, yc, -RB, -RG), arcFrame(s * (half - 0.004), 0));
  backFacade(b, half, PB_H - H);

  // Lobby: recepción frente al núcleo, salas, restaurante (ala derecha) y spa (ala izquierda).
  const Pc = kit(b, arcFrame(0, RG, 0)).P;
  Pc('wood', -2.4, 2.4, 0, 1.1, 2.2, 2.9);
  Pc('stone', -2.5, 2.5, 1.05, 1.15, 2.15, 2.95);
  for (const a of [0.2, 0.3, -0.2, -0.3]) {
    const P = kit(b, arcFrame(a, RG, 0)).P;
    P('fabric', -1.5, 1.5, 0, 0.42, 1.2, 2.0);
    P('fabric', -1.5, 1.5, 0, 0.85, 2.0, 2.2);
    P('fabric', -1.5, 1.5, 0, 0.42, 4.0, 4.8);
    P('woodLight', -0.8, 0.8, 0, 0.35, 2.6, 3.6);
    P('terracotta', -2.0, 2.0, 0, 0.02, 1.0, 5.0);
    blob(b, rand, polar(RG + 6.5, a + 0.03, 0.05), 0.7);
  }
  for (let a = 0.42; a < half - 0.06; a += 0.075) {
    for (const v of [1.8, 4.6]) {
      const P = kit(b, arcFrame(a, RG, 0)).P;
      P('woodLight', -0.5, 0.5, 0.72, 0.77, v - 0.5, v + 0.5);
      P('dark', -0.05, 0.05, 0, 0.72, v - 0.05, v + 0.05);
      for (const [x, dv] of [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75]]) P('wood', x - 0.2, x + 0.2, 0, 0.45, v + dv - 0.2, v + dv + 0.2);
    }
  }
  for (let a = -0.42; a > -half + 0.06; a -= 0.07) {
    const P = kit(b, arcFrame(a, RG, 0)).P;
    P('woodLight', -0.4, 0.4, 0, 0.6, 1.5, 3.5);
    P('fabric', -0.38, 0.38, 0.6, 0.72, 1.55, 3.45);
    blob(b, rand, polar(RG + 6, a, 0.05), 0.5);
  }
}

// ---------------------------------------------------------------- Rooftop
function buildRooftop(b, lvl, half, rand) {
  const y = TOP;
  lvl.half = half;
  lvl.yc = y + 3;
  b.add('stucco', arcSlab(RF - 0.8, RB, -half, half, y - SLAB, y));
  b.add('woodLight', arcSlab(RF + 3.4, RB - 0.4, -half + 0.01, half - 0.01, y, y + 0.06));
  b.add('stone', arcSlab(RF - 0.7, RF + 3.4, -half + 0.01, half - 0.01, y, y + 0.04));
  const pts = [];
  for (let a = -half; a <= half + 1e-6; a += 0.01) pts.push(polar(RB - 0.1, a));
  b.add('rail', ribbon(pts, y, y + 1.1));

  for (const s of [-1, 1]) {
    // Alberca infinita al frente (el agua cae hacia el patio).
    const [p0, p1] = s > 0 ? [CORE + 0.025, half - 0.12] : [-half + 0.12, -CORE - 0.025];
    b.add('stucco', arcSlab(RF - 0.6, RF + 3.3, p0, p1, y, y + 0.75));
    b.add('water', arcSlab(RF - 0.62, RF + 3.05, p0 + 0.006, p1 - 0.006, y + 0.75, y + 0.8));
    const ends = s > 0 ? [half - 0.12, half] : [-half, -half + 0.12];
    const er = [];
    for (let a = ends[0]; a <= ends[1] + 1e-6; a += 0.01) er.push(polar(RF - 0.7, Math.min(a, ends[1])));
    b.add('rail', ribbon(er, y, y + 1.1));
    // Camastros con sombrillas.
    for (let a = p0 + 0.03; a < p1 - 0.02; a += 0.05) {
      const P = kit(b, arcFrame(a, RF + 3.4, y)).P;
      P('woodLight', -0.35, 0.35, 0.03, 0.33, 0.4, 2.3);
      P('fabric', -0.32, 0.32, 0.33, 0.42, 0.45, 1.7);
      P('fabric', -0.32, 0.32, 0.33, 0.75, 0.45, 0.75);
    }
    // Pérgola con focos colgantes.
    const [g0, g1] = s > 0 ? [CORE + 0.04, half - 0.03] : [-half + 0.03, -CORE - 0.04];
    for (let a = g0; a <= g1 + 1e-6; a += 0.06) {
      for (const r of [RF + 5.4, RB - 1.2]) {
        const c = new THREE.BoxGeometry(0.22, 2.9, 0.22).translate(0, y + 1.45, 0);
        const p = polar(r, a);
        c.translate(p.x, 0, p.z);
        b.add('wood', c);
      }
    }
    b.add('wood', arcSlab(RF + 5.2, RF + 5.6, g0, g1, y + 2.9, y + 3.15));
    b.add('wood', arcSlab(RB - 1.4, RB - 1.0, g0, g1, y + 2.9, y + 3.15));
    for (let a = g0; a <= g1; a += 0.012) {
      b.add('wood', boxGeo(-0.05, 0.05, y + 3.15, y + 3.3, -(RB - 0.8), -(RF + 5)), arcFrame(a, 0));
      if (rand() < 0.5) {
        const l = new THREE.SphereGeometry(0.09, 6, 4);
        const p = polar(RF + 6 + rand() * 4.5, a, y + 2.4 + rand() * 0.4);
        l.translate(p.x, p.y, p.z);
        b.add('lamp', l);
      }
    }
    // Salas bajo la pérgola.
    for (let a = g0 + 0.05; a < g1 - 0.03; a += 0.11) {
      const P = kit(b, arcFrame(a, RF + 6.2, y)).P;
      P('fabric', -1.3, 1.3, 0, 0.42, 0.6, 1.4);
      P('fabric', -1.3, 1.3, 0, 0.8, 1.4, 1.6);
      P('woodLight', -0.6, 0.6, 0, 0.38, -0.5, 0.3);
      P('accent', -1.1, -0.7, 0.42, 0.62, 0.8, 1.2);
    }
    // Macetas en los extremos.
    for (let k = 0; k < 4; k++) blob(b, rand, polar(RF + 4 + k * 1.8, s * (half - 0.04), y), 0.6 + rand() * 0.3);
  }
  // Barra del bar, junto al núcleo.
  for (const s of [-1, 1]) {
    const P = kit(b, arcFrame(s * (CORE + 0.09), RF + 7.5, y)).P;
    P('stone', -2.2, 2.2, 0, 1.1, 0, 0.7);
    P('woodLight', -2.3, 2.3, 1.05, 1.13, -0.05, 0.75);
    for (let x = -1.8; x <= 1.8; x += 0.9) P('dark', x - 0.18, x + 0.18, 0, 0.75, -0.75, -0.4);
  }
  const lg = arcSlab(RF + 7, RB - 1.5, -half + 0.05, half - 0.05, y + 0.08, y + 0.1);
  tint(lg, new THREE.Color(1, 0.7, 0.35).multiplyScalar(0.22));
  b.add('light', lg);
}

// ---------------------------------------------------------------- Núcleo con el nombre
function buildCore(envMap) {
  const group = new THREE.Group();
  const mats = floorMaterials(envMap);
  const b = new Buckets();
  const top = TOP + 5;
  b.add('stone', arcSlab(RF - 1.6, RB + 1.2, -CORE, CORE, -0.3, top));
  const f = arcFrame(0, RF - 1.6, 0);
  b.add('glass', boxGeo(-1.1, 1.1, 0.4, TOP + 1.5, -0.1, 0.06), f);
  b.add('dark', boxGeo(-1.25, 1.25, 0.3, TOP + 1.6, -0.12, 0.02), f);
  for (let y = PB_H; y < TOP; y += H) b.add('stone', boxGeo(-1.25, 1.25, y - 0.12, y + 0.12, -0.12, 0.1), f);
  group.add(b.build(mats));

  // Letrero "XELHA": letras de latón que brillan de noche.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '500 150px "Cormorant Garamond", Georgia, serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '42px';
  ctx.fillText('XELHA', 512 + 21, 116);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const signMat = new THREE.MeshStandardMaterial({
    color: 0xd8b26e,
    map: tex,
    alphaMap: tex,
    transparent: true,
    metalness: 0.7,
    roughness: 0.35,
    envMap,
    emissive: 0xffc57a,
    emissiveMap: tex,
    emissiveIntensity: 0,
    depthWrite: false,
    clippingPlanes: [cutPlane],
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.76), signMat);
  sign.applyMatrix4(arcFrame(0, RF - 1.75, TOP + 3.1));
  sign.position.y = TOP + 3.1;
  group.add(sign);
  return { group, mats, signMat, redraw: () => (tex.needsUpdate = true), canvas, ctx };
}

// ---------------------------------------------------------------- Volumen de selección y brillo
const shellMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffc977) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform float uTime; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float scan = smoothstep(0.92, 1.0, sin(vW.y * 2.2 - uTime * 3.0) * 0.5 + 0.5);
        float a = (0.16 + pow(f, 2.5) * 0.7 + scan * 0.12) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });

function buildShell(lvl, resolution) {
  const n = lvl.nivel;
  const half = lvl.half + 0.012;
  const y0 = n === 0 ? -0.05 : n === 7 ? TOP - SLAB : lvl.y0 - SLAB - 0.04;
  const y1 = n === 0 ? PB_H - SLAB + 0.03 : n === 7 ? TOP + 3.4 : lvl.y0 + H - SLAB + 0.04;
  const r0 = n === 0 ? RF - 4.6 : RF - 2.75;
  const r1 = RB + 0.6;
  lvl.shell = new THREE.Mesh(arcSlab(r0, r1, -half, half, y0, y1), shellMaterial());
  lvl.shell.renderOrder = 5;
  lvl.shell.userData.nivel = n;
  lvl.box = { r0, r1, half, y0, y1 };

  // Contorno luminoso (aristas del volumen).
  const seg = [];
  const arc = (r, y) => {
    for (let a = -half; a < half - 1e-6; a += 0.02) {
      const p = polar(r, a, y);
      const q = polar(r, Math.min(a + 0.02, half), y);
      seg.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  };
  for (const y of [y0, y1]) for (const r of [r0, r1]) arc(r, y);
  for (const a of [-half, half]) {
    for (const r of [r0, r1]) {
      const p = polar(r, a, y0);
      seg.push(p.x, y0, p.z, p.x, y1, p.z);
    }
    const p = polar(r0, a, y0);
    const q = polar(r1, a, y0);
    seg.push(p.x, y0, p.z, q.x, y0, q.z, p.x, y1, p.z, q.x, y1, q.z);
  }
  const geo = new LineSegmentsGeometry().setPositions(seg);
  const mat = new LineMaterial({
    color: 0xffd58f,
    linewidth: 2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    resolution,
  });
  lvl.lines = new LineSegments2(geo, mat);
  lvl.lines.renderOrder = 6;
  lvl.labelAnchor = polar(RB + 1.5, half + 0.02, (y0 + y1) / 2);
  lvl.mid = (y0 + y1) / 2;
}

// Cajas invisibles por habitación (selección) y losetas de color por disponibilidad.
function buildUnitHelpers(lvl) {
  const units = lvl.units;
  const hh = H - SLAB;
  const pick = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }), units.length);
  const tiles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [cutPlane] }),
    units.length
  );
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  units.forEach((u, i) => {
    u.index = i;
    // Caja de selección: habitación + terraza.
    m.copy(u.frame).multiply(new THREE.Matrix4().compose(
      new THREE.Vector3(0, hh / 2, -(ROOM - 1.8) / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(u.w * 0.97, hh, ROOM + 1.8)
    ));
    pick.setMatrixAt(i, m);
    m.copy(u.frame).multiply(new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.06, -(ROOM - 0.2) / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(u.w - 0.3, 1, ROOM - 0.35)
    ));
    tiles.setMatrixAt(i, m);
    tiles.setColorAt(i, c.set(ESTADOS[u.estado].color));
  });
  pick.userData.nivel = lvl.nivel;
  tiles.renderOrder = 2;
  lvl.pick = pick;
  lvl.tiles = tiles;
}
