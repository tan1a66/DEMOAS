// Casa Skoura: el conversation pit, la piscina redonda, la grava blanca y el lote largo de Mérida.
// Medidas tomadas de skoura_fosa_cenital.jpg: la piscina (Ø 2,4 m) da la escala
// (1 px de la foto ≈ 1,07 cm). Norte (arriba en la foto) = -z. Centro de la piscina = origen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { patch, LAYER_UNDERWATER } from './core.js';
import { makeStool } from './logo3d.js';

export const POOL_R = 1.2;
export const POOL_DEPTH = 1.35;
export const LOT = { x0: -2.5, x1: 2.5, z0: -14, z1: 14 };
export const SOFA = { cx: 0.03, cz: -1.55, rOut: 1.6, rWall: 1.43, rSeat: 0.83 };
export const STOOL = { x: 0.03, z: -1.58, r: 0.2, h: 0.4 };
const PLATFORM_Y = 0.03;

// Paleta (muestreada de las fotos, corregida a albedo)
const C = {
  // chukum al sol (video de Casa Skoura): terracota saturada, monolítica en piso, muros y casa
  terracotta: '#a35c3f',   // piso del pit
  ring: '#9f5a40',         // respaldo de chukum
  wall: '#985843',         // muros del lote
  house: '#9b5a44',
  table: '#b56d4b',        // mesa larga de chukum frente a la casa
  stone: '#8f877d',        // losa gris y escalones
  stoneDark: '#6f675e',
  limestone: '#b39a72',    // fragmentos de muro antiguo (piedra caliza)
  carrizo: '#5c4234',      // celosía de carrizo sobre los muros
  cushion: '#e4dccb',      // cojines marfil
  gravel: '#aaa295',       // grava blanca (en la foto, gris cálido)
  pool: '#7e8c84',         // chukum del vaso
  soil: '#3b3126',
  roofN: '#b7ada2',
};

function chukum(color, key, { tri = 0.4, normal = 0.7, mottle = 0.26, rough = 0.86 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, envMapIntensity: 0.55 });
  return patch(m, { key, gobo: true, reveal: true, tri: { scale: tri, normal, amount: 0.5, mean: 0.42 }, mottle });
}

function annularSector(r0, r1, a0, a1, segs = 72) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs);
    const x = Math.cos(a) * r1, y = Math.sin(a) * r1;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / segs);
    s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
  }
  return s;
}

// Extruye una forma hacia arriba: (sx, sy) → (x, y, -z)
function extrudeUp(shape, h, bevel = 0.01, curveSegments = 48) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

// Lámpara redonda de muro: aro negro con disco de luz cálida
const LAMP_RING = patch(new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 0.5, metalness: 0.5 }), { key: 'lampRing', reveal: true });
const LAMP_LIGHT = patch(new THREE.MeshStandardMaterial({ color: 0xffe2bc, emissive: 0xffb466, emissiveIntensity: 2.2, roughness: 1 }), { key: 'lampLight', reveal: true });
function lamp(r) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 32).rotateX(Math.PI / 2), LAMP_RING);
  ring.position.z = 0.015;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.62, 32), LAMP_LIGHT);
  disc.position.z = 0.031;
  g.add(ring, disc);
  return g;
}

export function buildCourtyard(scene) {
  const group = new THREE.Group();
  group.name = 'patio';
  scene.add(group);
  const add = (geo, mat, { cast = true, receive = true, layer } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    if (layer !== undefined) m.layers.set(layer);
    group.add(m);
    return m;
  };

  const mTerra = chukum(C.terracotta, 'terra');
  const mRing = chukum(C.ring, 'ring');
  const mWall = chukum(C.wall, 'wall', { tri: 0.25, normal: 0.55, mottle: 0.34 });
  const mHouse = chukum(C.house, 'house', { tri: 0.25, normal: 0.5, mottle: 0.32 });
  const mStone = chukum(C.stone, 'stone', { tri: 0.9, normal: 0.8, mottle: 0.22, rough: 0.8 });
  const mStoneDark = chukum(C.stoneDark, 'stoneDark', { tri: 0.9, normal: 0.8, mottle: 0.2, rough: 0.8 });
  const mRoofN = chukum(C.roofN, 'roofN', { tri: 0.3, normal: 0.8, mottle: 0.25, rough: 0.9 });
  const mSoil = chukum(C.soil, 'soil', { tri: 0.8, normal: 1.5, mottle: 0.35, rough: 1 });

  const mGravel = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.gravel), roughness: 0.95, envMapIntensity: 0.5 }), {
    key: 'gravel', gobo: true, reveal: true, tri: { tex: 'pebble', scale: 1.9, normal: 2.0, amount: 0.9, mean: 0.36 },
  });
  const mCushion = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.cushion), roughness: 0.96, envMapIntensity: 0.6 }), {
    key: 'cushion', gobo: true, reveal: true,
    fragNormal: /* glsl */ `
      { // tejido de lino: trama fina
        vec2 q = vWPos.xz * 420.0 + vWPos.y * 300.0;
        float w = sin(q.x) * sin(q.y);
        diffuseColor.rgb *= 0.965 + 0.035 * w + 0.04 * (eFbm2(vWPos.xz * 14.0) - 0.5);
      }`,
  });

  // --- grava (todo el lote) y tierra de los vecinos
  {
    // grava con el hueco de la piscina
    const gs = new THREE.Shape();
    gs.moveTo(LOT.x0, 4.6); gs.lineTo(LOT.x1, 4.6); gs.lineTo(LOT.x1, -9.2); gs.lineTo(LOT.x0, -9.2); gs.lineTo(LOT.x0, 4.6);
    const h = new THREE.Path(); h.absarc(0, 0, POOL_R, 0, Math.PI * 2, true); gs.holes.push(h);
    const gg = new THREE.ShapeGeometry(gs, 96); gg.rotateX(-Math.PI / 2);
    add(gg, mGravel, { cast: false });
  }
  {
    // tierra de los jardines vecinos, con el hueco del lote
    const ss = new THREE.Shape();
    ss.moveTo(-20, 30); ss.lineTo(20, 30); ss.lineTo(20, -30); ss.lineTo(-20, -30); ss.lineTo(-20, 30);
    const h = new THREE.Path();
    h.moveTo(LOT.x0 - 0.1, -LOT.z0); h.lineTo(LOT.x0 - 0.1, -LOT.z1); h.lineTo(LOT.x1 + 0.1, -LOT.z1); h.lineTo(LOT.x1 + 0.1, -LOT.z0); h.lineTo(LOT.x0 - 0.1, -LOT.z0);
    ss.holes.push(h);
    const sg = new THREE.ShapeGeometry(ss); sg.rotateX(-Math.PI / 2);
    const soil = add(sg, mSoil, { cast: false });
    soil.position.y = -0.01;
  }

  // --- plataforma de chukum: unión suavizada de dos círculos, con el hueco de la piscina
  {
    const cA = { x: 0.01, z: -1.61, r: 2.08 }, cB = { x: 0, z: 0, r: 1.79 };
    const o = { x: 0, z: -0.8 };
    const N = 360, rad = new Float32Array(N);
    const exit = (c, dx, dz) => {
      const fx = o.x - c.x, fz = o.z - c.z;
      const b = fx * dx + fz * dz, cc = fx * fx + fz * fz - c.r * c.r;
      return -b + Math.sqrt(Math.max(0, b * b - cc));
    };
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      rad[i] = Math.max(exit(cA, dx, dz), exit(cB, dx, dz));
    }
    const sm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let acc = 0, w = 0;
      for (let k = -9; k <= 9; k++) { const ww = Math.exp(-(k * k) / 30); acc += rad[(i + k + N) % N] * ww; w += ww; }
      sm[i] = Math.max(rad[i], acc / w);
    }
    const shape = new THREE.Shape();
    for (let i = 0; i <= N; i++) {
      const a = ((i % N) / N) * Math.PI * 2;
      const x = o.x + Math.cos(a) * sm[i % N], z = o.z + Math.sin(a) * sm[i % N];
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, POOL_R, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    add(extrudeUp(shape, PLATFORM_Y, 0.008, 96), mTerra, { cast: false });

    // camino de chukum hacia la entrada (sur), como en skoura_ingreso.jpg
    const path = add(new RoundedBoxGeometry(1.25, PLATFORM_Y, 7.4, 2, 0.008), mTerra, { cast: false });
    path.position.set(0, PLATFORM_Y / 2, 5.4);
  }

  // --- vaso de la piscina (sólo se ve a través del agua)
  const poolMat = (side) => patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.pool), roughness: 0.75, envMapIntensity: 0.0, side }), {
    key: 'pool' + side, gobo: true, underwater: true, grain: false, tri: { scale: 0.7, normal: 0.9, amount: 0.4, mean: 0.42 }, mottle: 0.18,
  });
  const mPool = poolMat(THREE.FrontSide);
  const mStepsUW = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.stone), roughness: 0.8, envMapIntensity: 0.0 }), {
    key: 'stepsUW', gobo: true, underwater: true, grain: false, tri: { scale: 0.9, normal: 0.8, amount: 0.4, mean: 0.42 }, mottle: 0.2,
  });
  {
    const wallG = new THREE.CylinderGeometry(POOL_R, POOL_R, POOL_DEPTH + PLATFORM_Y, 128, 6, true);
    const w = add(wallG, poolMat(THREE.BackSide), { cast: false, layer: LAYER_UNDERWATER });
    w.position.y = (PLATFORM_Y - POOL_DEPTH) / 2;
    const floor = add(new THREE.CircleGeometry(POOL_R, 96).rotateX(-Math.PI / 2), mPool, { cast: false, layer: LAYER_UNDERWATER });
    floor.position.y = -POOL_DEPTH;
    // escalones cuadrados en diagonal (sureste), bajando hacia el centro
    const dir = new THREE.Vector2(1, 1).normalize();
    const steps = [[0.27, -0.98], [0.54, -0.73], [0.81, -0.48], [1.06, -0.24]];
    for (const [t, top] of steps) {
      const h = top + POOL_DEPTH;
      const st = add(new RoundedBoxGeometry(0.62, h, 0.26, 2, 0.012), mStepsUW, { cast: false, layer: LAYER_UNDERWATER });
      st.position.set(dir.x * t, -POOL_DEPTH + h / 2, dir.y * t);
      st.rotation.y = -Math.PI / 4;
    }
  }

  // --- losas de piedra gris: centro del pit, camino norte y diagonal de los escalones
  {
    // dentro del sofá el piso es el mismo chukum (no hay losa de cemento): el taburete se apoya directo
    const stool = makeStool(STOOL.r, STOOL.h);
    stool.position.set(STOOL.x, PLATFORM_Y + 0.008 + STOOL.h / 2, STOOL.z);
    stool.castShadow = stool.receiveShadow = true;
    group.add(stool);
    // mesa larga de chukum en el eje, frente a la puerta de la casa (video y skoura_fosa_lateral.jpg)
    // entre la fachada (z -4.65) y el respaldo del sofá (z -3.15): no toca ninguno de los dos
    const n = add(new RoundedBoxGeometry(0.82, 0.92, 1.2, 3, 0.03), chukum(C.table, 'table', { tri: 0.5, normal: 0.6, mottle: 0.2, rough: 0.75 }));
    n.position.set(0.18, 0.46, -3.95);
    const d = add(new RoundedBoxGeometry(0.62, 0.05, 1.9, 2, 0.01), mStone, { cast: false });
    const dir = new THREE.Vector2(1, 1).normalize();
    d.position.set(dir.x * 2.1, PLATFORM_Y + 0.006, dir.y * 2.1);
    d.rotation.y = Math.PI / 4;
    // piedras redondas en la grava (arriba de la foto)
    for (const [x, z, r] of [[-0.86, -3.95, 0.18], [-1.28, -3.6, 0.16], [0.98, -3.9, 0.19], [1.36, -3.52, 0.15], [-1.05, -4.35, 0.15], [1.12, -4.33, 0.16]]) {
      const s = add(new THREE.CylinderGeometry(r, r * 1.02, 0.04, 40), mStone, { cast: false });
      s.position.set(x, 0.015, z);
    }
    // disco de piedra clara (abajo a la izquierda en la foto)
    const disc = add(new THREE.CylinderGeometry(0.58, 0.6, 0.07, 72), chukum('#c9c4bc', 'disc', { tri: 0.7, normal: 0.7, mottle: 0.1 }), { cast: true });
    disc.position.set(-1.03, 0.035, 1.42);
  }

  // --- el sofá semicircular: respaldo de chukum, base, cojines y rollos
  {
    const g = new THREE.Group();
    g.position.set(SOFA.cx, 0, SOFA.cz);
    group.add(g);
    const addS = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
    addS(extrudeUp(annularSector(SOFA.rWall, SOFA.rOut, 0, Math.PI), 0.68, 0.02), mRing);
    addS(extrudeUp(annularSector(SOFA.rSeat, SOFA.rWall, 0, Math.PI), 0.3, 0.014), mTerra);
    // luces redondas empotradas en el frente de la base (video)
    for (const a of [0.32, 0.95, 1.57, 2.19, 2.82]) {
      const l = lamp(0.035);
      l.position.set(Math.cos(a) * (SOFA.rSeat - 0.004), 0.15, -Math.sin(a) * (SOFA.rSeat - 0.004));
      l.lookAt(0, 0.15, 0);
      g.add(l);
    }
    // cojines del asiento (4 piezas) — almohadillas redondeadas
    const gap = 0.012;
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI + gap, a1 = ((i + 1) / 4) * Math.PI - gap;
      const cg = extrudeUp(annularSector(SOFA.rSeat + 0.03, SOFA.rWall - 0.02, a0, a1, 24), 0.13, 0.045, 16);
      const c = addS(cg, mCushion);
      c.position.y = 0.3;
    }
    // rollos del respaldo (3 piezas) — toro parcial
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * Math.PI + 0.02, a1 = ((i + 1) / 3) * Math.PI - 0.02;
      const tg = new THREE.TorusGeometry(SOFA.rWall - 0.13, 0.12, 20, 48, a1 - a0);
      tg.rotateZ(a0);
      tg.rotateX(-Math.PI / 2);
      tg.scale(1, 0.92, 1);
      const t = addS(tg, mCushion);
      t.position.y = 0.43 + 0.105;
      // extremos redondeados
      for (const a of [a0, a1]) {
        const cap = addS(new THREE.SphereGeometry(0.12, 20, 14), mCushion);
        cap.scale.set(1, 0.92, 1);
        cap.position.set(Math.cos(a) * (SOFA.rWall - 0.13), 0.535, -Math.sin(a) * (SOFA.rWall - 0.13));
      }
    }
  }

  // --- muros altos del lote y la casa a dos aguas (al norte)
  {
    const H = 4.6;
    for (const x of [LOT.x0 - 0.15, LOT.x1 + 0.15]) {
      const w = add(new RoundedBoxGeometry(0.3, H, LOT.z1 - LOT.z0, 2, 0.02), mWall);
      w.position.set(x, H / 2, (LOT.z0 + LOT.z1) / 2);
    }
    const back = add(new RoundedBoxGeometry(LOT.x1 - LOT.x0 + 0.6, H, 0.3, 2, 0.02), mWall);
    back.position.set(0, H / 2, LOT.z1 + 0.15);
    // casa a dos aguas (cumbrera norte-sur), fachada al patio como en el video:
    // gran vano con cancelería de acero negro y vidrio, ventana cuadrada arriba a la izquierda
    const z1 = -4.65, z0 = -14, eave = 6.0, ridge = 7.9, hw = 2.65, T = 0.32;
    const OP = { x0: -1.35, x1: 1.65, h: 2.95 }, WIN = { x0: -1.6, x1: -0.3, y0: 4.15, y1: 5.45 };
    const fac = new THREE.Shape();
    fac.moveTo(-hw, 0); fac.lineTo(OP.x0, 0); fac.lineTo(OP.x0, OP.h); fac.lineTo(OP.x1, OP.h); fac.lineTo(OP.x1, 0);
    fac.lineTo(hw, 0); fac.lineTo(hw, eave); fac.lineTo(0, ridge); fac.lineTo(-hw, eave); fac.lineTo(-hw, 0);
    const wh = new THREE.Path();
    wh.moveTo(WIN.x0, WIN.y0); wh.lineTo(WIN.x0, WIN.y1); wh.lineTo(WIN.x1, WIN.y1); wh.lineTo(WIN.x1, WIN.y0); wh.lineTo(WIN.x0, WIN.y0);
    fac.holes.push(wh);
    const facade = add(new THREE.ExtrudeGeometry(fac, { depth: T, bevelEnabled: false }), mHouse);
    facade.position.set(0, 0, z1 - T);
    // volumen de la casa detrás de la fachada (planta alta maciza) y cubierta
    const upper = add(new THREE.BoxGeometry(hw * 2, eave - 3.25, z1 - T - z0), mHouse);
    upper.position.set(0, 3.25 + (eave - 3.25) / 2, (z0 + z1 - T) / 2);
    const prof = new THREE.Shape();
    prof.moveTo(-hw, 0); prof.lineTo(0, ridge - eave); prof.lineTo(hw, 0); prof.lineTo(-hw, 0);
    const r = add(new THREE.ExtrudeGeometry(prof, { depth: z1 - T - z0, bevelEnabled: false }), mHouse);
    r.position.set(0, eave, z0);
    // interior visible por el vano: comedor en penumbra cálida
    const mIn = chukum('#7a4a36', 'interior', { tri: 0.4, normal: 0.4, mottle: 0.2, rough: 0.9 });
    const D = 4.4;
    const room = add(new THREE.BoxGeometry(hw * 2 - 0.3, 3.25, D), Object.assign(mIn, { side: THREE.BackSide }), { cast: false });
    room.position.set(0, 1.625, z1 - T - D / 2);
    const mFloorIn = chukum('#8d6a52', 'floorIn', { tri: 0.6, normal: 0.3, mottle: 0.15, rough: 0.6 });
    const fl = add(new THREE.PlaneGeometry(hw * 2 - 0.3, D).rotateX(-Math.PI / 2), mFloorIn, { cast: false });
    fl.position.set(0, 0.004, z1 - T - D / 2);
    const mWood = chukum('#5a3424', 'woodIn', { tri: 0.8, normal: 0.3, mottle: 0.25, rough: 0.55 });
    const tbl = add(new RoundedBoxGeometry(1.0, 0.06, 2.2, 2, 0.01), mWood); tbl.position.set(0.2, 0.76, z1 - T - 2.0);
    const ped = add(new THREE.CylinderGeometry(0.18, 0.24, 0.73, 24), mWood); ped.position.set(0.2, 0.365, z1 - T - 2.0);
    const dark = add(new THREE.PlaneGeometry(0.95, 2.2), patch(new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }), { key: 'darkDoor', reveal: true }), { cast: false });
    dark.position.set(-0.9, 1.1, z1 - T - D + 0.02);
    // lámpara de papel (como en skoura_comedor.jpg)
    const lantern = add(new THREE.SphereGeometry(0.32, 32, 20), patch(new THREE.MeshStandardMaterial({ color: 0xf3e6d2, emissive: 0xffcf96, emissiveIntensity: 1.4, roughness: 1 }), { key: 'lantern', reveal: true }), { cast: false });
    lantern.position.set(0.2, 2.2, z1 - T - 2.0);
    const inLight = new THREE.PointLight(0xffc58a, 6, 6, 1.6);
    inLight.position.set(0.2, 2.0, z1 - T - 2.0);
    group.add(inLight);
    // cancelería de acero negro y vidrio
    const mSteel = patch(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.6 }), { key: 'steel', reveal: true });
    const mGlass = patch(new THREE.MeshStandardMaterial({ color: 0x0a0d0d, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6, transparent: true, opacity: 0.32, depthWrite: false }), { key: 'glass', reveal: true });
    const zf = z1 - T * 0.55;
    const bar = (w, h, x, y, z = zf) => { const b = add(new THREE.BoxGeometry(w, h, 0.05), mSteel, { cast: false }); b.position.set(x, y, z); };
    for (const x of [OP.x0 + 0.03, -0.6, 0.15, 0.9, OP.x1 - 0.03]) bar(0.05, OP.h, x, OP.h / 2);
    bar(OP.x1 - OP.x0, 0.05, (OP.x0 + OP.x1) / 2, 2.32);
    bar(OP.x1 - OP.x0, 0.05, (OP.x0 + OP.x1) / 2, OP.h - 0.03);
    const gl = add(new THREE.PlaneGeometry(OP.x1 - OP.x0, OP.h), mGlass, { cast: false, receive: false });
    gl.position.set((OP.x0 + OP.x1) / 2, OP.h / 2, zf - 0.01);
    const wz = z1 - T * 0.5;
    for (let i = 0; i <= 3; i++) {
      bar(0.035, WIN.y1 - WIN.y0, WIN.x0 + (WIN.x1 - WIN.x0) * (i / 3), (WIN.y0 + WIN.y1) / 2, wz);
      bar(WIN.x1 - WIN.x0, 0.035, (WIN.x0 + WIN.x1) / 2, WIN.y0 + (WIN.y1 - WIN.y0) * (i / 3), wz);
    }
    const wb = add(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), patch(new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.08, envMapIntensity: 1.2 }), { key: 'winBack', reveal: true }), { cast: false });
    wb.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, wz - 0.03);
    // lámparas redondas en los muros (los "ojos" de luz de Skoura)
    for (const [x, y, z, ry] of [[LOT.x0 + 0.005, 1.75, -2.4, Math.PI / 2], [LOT.x0 + 0.005, 1.75, 1.6, Math.PI / 2], [LOT.x1 - 0.005, 1.75, -1.2, -Math.PI / 2], [LOT.x1 - 0.005, 1.75, 2.8, -Math.PI / 2]]) {
      const l = lamp(0.06); l.position.set(x, y, z); l.rotation.y = ry; group.add(l);
    }
  }

  // --- celosía de carrizo sobre los muros laterales (en el video, sobre ambos muros)
  {
    const m = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.carrizo), roughness: 0.85, envMapIntensity: 0.5 }), {
      key: 'carrizo', gobo: true, reveal: true,
      fragNormal: /* glsl */ `
        {
          float u = (abs(vNormal.x) > 0.5 ? vWPos.z : vWPos.x) * 55.0;
          float cane = fract(u + eNoise2(vec2(floor(u), 1.0)) * 0.3);
          float sh = smoothstep(0.0, 0.18, cane) * smoothstep(1.0, 0.75, cane);
          float knot = smoothstep(0.92, 1.0, fract(vWPos.y * 2.2 + eHash12(vec2(floor(u), 3.0))));
          diffuseColor.rgb *= (0.55 + 0.45 * sh) * (1.0 - 0.3 * knot) * (0.8 + 0.4 * eHash12(vec2(floor(u), 7.0)));
        }`,
    });
    for (const x of [LOT.x0 - 0.12, LOT.x1 + 0.12]) {
      const c = add(new THREE.BoxGeometry(0.06, 1.15, LOT.z1 - LOT.z0 - 9.4), m);
      c.position.set(x, 4.6 + 0.575, (LOT.z0 + 9.4 + LOT.z1) / 2);
    }
  }
  // --- fragmentos de muro antiguo a los lados del vano (mampostería de piedra caliza conservada)
  {
    const mL = chukum(C.limestone, 'limestone', { tri: 1.1, normal: 1.6, mottle: 0.4, rough: 0.95 });
    mL.onBeforeCompile = ((orig) => (sh) => {
      orig(sh);
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', `
        { // poros y oquedades de la piedra coralina
          float pit = smoothstep(0.6, 0.78, eNoise3(vWPos * 7.0)) + 0.6 * smoothstep(0.66, 0.8, eNoise3(vWPos * 19.0 + 3.1));
          diffuseColor.rgb *= 1.0 - 0.5 * clamp(pit, 0.0, 1.0);
          diffuseColor.rgb *= 0.85 + 0.3 * eFbm2(vWPos.xy * 1.7 + vWPos.z);
        }
        #include <lights_fragment_begin>`);
    })(mL.onBeforeCompile);
    const ruin = (seed, w, h, d) => {
      const g = new THREE.BoxGeometry(w, h, d, 18, 30, 6);
      const pos = g.attributes.position;
      const v = new THREE.Vector3();
      const n3 = (x, y, z) => Math.sin(x * 3.1 + seed) * Math.sin(y * 2.3 + seed * 1.7) * Math.sin(z * 4.1 + seed * 0.6)
        + 0.5 * Math.sin(x * 9.7 + seed * 2.0) * Math.sin(y * 8.3 + seed) + 0.25 * Math.sin(y * 21.0 + x * 13.0 + seed);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const top = (v.y + h / 2) / h;
        // borde superior erosionado e irregular, caras abombadas
        const bite = top > 0.75 ? (top - 0.75) * 4 * (0.5 + 0.5 * Math.sin(v.x * 5.0 + seed * 3.0)) : 0;
        v.y -= bite * h * 0.22;
        const k = 1 + 0.05 * n3(v.x, v.y, v.z);
        v.x *= k; v.z *= 1 + 0.12 * n3(v.z, v.x, v.y);
        v.x += 0.04 * n3(v.y, v.z, v.x);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    };
    const a = add(ruin(1.3, 1.25, 2.35, 0.42), mL); a.position.set(-1.92, 1.175, -4.2); a.rotation.y = 0.05;
    const b = add(ruin(4.1, 0.55, 2.2, 0.4), mL); b.position.set(2.17, 1.1, -4.22); b.rotation.y = -0.08;
    const l = lamp(0.05); l.position.set(-1.72, 1.55, -3.98); group.add(l);
  }

  // --- vecinos: azoteas y jardines (sólo se ven desde el dron)
  {
    const roofs = [[-6.2, 4.0, -8.5, 6, 11], [6.4, 3.4, 7.5, 6.5, 12], [-6.6, 6.2, 6.5, 6, 9], [6.8, 5.6, -9.0, 6.5, 8]];
    for (const [x, y, z, w, d] of roofs) {
      const b = add(new THREE.BoxGeometry(w, y, d), mRoofN);
      b.position.set(x, y / 2, z);
      // pretil de la azotea
      for (const [px, pz, pw, pd] of [[0, d / 2, w, 0.16], [0, -d / 2, w, 0.16], [w / 2, 0, 0.16, d], [-w / 2, 0, 0.16, d]]) {
        const p = add(new THREE.BoxGeometry(pw, 0.4, pd), mRoofN);
        p.position.set(x + px, y + 0.2, z + pz);
      }
      // tinaco
      const t = add(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 28), chukum('#2a2a2a', 'tinaco', { tri: 0.5, normal: 0.3, mottle: 0.05, rough: 0.6 }));
      t.position.set(x + w * 0.25, y + 0.7, z - d * 0.3);
    }
  }

  return { group };
}
