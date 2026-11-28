// Casa Skoura: el conversation pit, la piscina redonda, la grava blanca y el lote largo de Mérida.
// Medidas tomadas de skoura_fosa_cenital.jpg: la piscina (Ø 2,4 m) da la escala
// (1 px de la foto ≈ 1,07 cm). Norte (arriba en la foto) = -z. Centro de la piscina = origen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { G, patch, LAYER_UNDERWATER } from './core.js';
import { makeStool } from './stool.js';

export const POOL_R = 1.2;
export const POOL_DEPTH = 1.35;
export const LOT = { x0: -2.5, x1: 2.5, z0: -14, z1: 14 };
export const SOFA = { cx: 0.03, cz: -1.55, rOut: 1.6, rWall: 1.43, rSeat: 0.83 };
export const STOOL = { x: 0.03, z: -1.58, r: 0.2, h: 0.4 };
export const PLATFORM_Y = 0.44;   // el pit es un zócalo de chukum: desde fuera el respaldo mide más de 1 m (fotos 9/20, 12/20)

// Paleta (muestreada de las fotos, corregida a albedo)
const C = {
  // chukum al sol (video de Casa Skoura): terracota saturada, monolítica en piso, muros y casa
  terracotta: '#b9714d',   // piso del pit
  ring: '#b26a4d',         // respaldo de chukum
  wall: '#ad6b52',         // muros del lote
  house: '#b06e54',
  table: '#b56d4b',        // mesa larga de chukum frente a la casa
  stone: '#8f877d',        // losa gris y escalones
  stoneDark: '#6f675e',
  limestone: '#b39a72',    // fragmentos de muro antiguo (piedra caliza)
  carrizo: '#a3804f',      // carrizo (palos de madera clara) sobre los muros
  cushion: '#e4dccb',      // cojines marfil
  gravel: '#aaa295',       // grava blanca (en la foto, gris cálido)
  pool: '#7e8c84',         // chukum del vaso
  soil: '#3b3126',
  roofN: '#b7ada2',
};

function chukum(color, key, { tri = 0.4, normal = 0.7, mottle = 0.26, rough = 0.86, gobo = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, envMapIntensity: 0.55 });
  return patch(m, { key, gobo, reveal: true, tri: { scale: tri, normal, amount: 0.5, mean: 0.42 }, mottle });
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
// alone di luce calda sul muro (le lampade tonde di Skoura)
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,190,120,1)'); g.addColorStop(0.25, 'rgba(255,170,95,0.55)'); g.addColorStop(1, 'rgba(255,150,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const HALO_MAT = new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
function lamp(r) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(r * 16, r * 16), HALO_MAT);
  halo.position.z = 0.008;
  g.add(halo);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 32).rotateX(Math.PI / 2), LAMP_RING);
  ring.position.z = 0.015;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.62, 32), LAMP_LIGHT);
  disc.position.z = 0.031;
  g.add(ring, disc);
  return g;
}

export function buildCourtyard(scene) {
  // puntos de las puertas (tappe) y la hoja de madera que se abre
  const hotspots = { nosotros: new THREE.Vector3(0.15, 1.35, -4.55), vision: new THREE.Vector3(1.95, 1.35, 2.55), contacto: new THREE.Vector3() };
  const doorPivot = new THREE.Group();
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
  const mConc = chukum('#8c8077', 'concrete', { tri: 0.8, normal: 0.6, mottle: 0.3, rough: 0.8 });
  const mConcStep = mConc;
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
    gs.moveTo(LOT.x0, LOT.z1); gs.lineTo(LOT.x1, LOT.z1); gs.lineTo(LOT.x1, LOT.z0); gs.lineTo(LOT.x0, LOT.z0); gs.lineTo(LOT.x0, LOT.z1);
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
    add(extrudeUp(shape, PLATFORM_Y, 0.02, 96), mTerra);
    G.uWaterY.value = PLATFORM_Y - 0.07;


  }

  // --- vaso de la piscina (sólo se ve a través del agua)
  const poolMat = (side) => patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.pool), roughness: 0.75, envMapIntensity: 0.0, side }), {
    key: 'pool' + side, gobo: true, underwater: true, grain: false, tri: { scale: 0.7, normal: 0.9, amount: 0.4, mean: 0.42 }, mottle: 0.18,
  });
  const mPool = poolMat(THREE.FrontSide);
  {
    const wallG = new THREE.CylinderGeometry(POOL_R, POOL_R, POOL_DEPTH, 128, 6, true);
    const w = add(wallG, poolMat(THREE.BackSide), { cast: false, layer: LAYER_UNDERWATER });
    w.position.y = PLATFORM_Y - POOL_DEPTH / 2;
    const floor = add(new THREE.CircleGeometry(POOL_R, 96).rotateX(-Math.PI / 2), mPool, { cast: false, layer: LAYER_UNDERWATER });
    floor.position.y = PLATFORM_Y - POOL_DEPTH;
    // escalera única en la diagonal sureste (foto 15/20): los mismos peldaños cuadrados de concreto
    // suben desde la grava, cruzan el zócalo y bajan dentro de la piscina
    const dir = new THREE.Vector2(1, 1).normalize();
    const TREAD = 0.3, RISE = PLATFORM_Y / 2, W = 0.62, GAP = 0.012;
    const mStepUW = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#8c8077'), roughness: 0.8, envMapIntensity: 0.0 }), {
      key: 'stepsUW', gobo: true, underwater: true, grain: false, tri: { scale: 0.8, normal: 0.6, amount: 0.3, mean: 0.42 }, mottle: 0.3,
    });
    const step = (t, top, bottom, uw) => {
      const h = top - bottom;
      const st = add(new RoundedBoxGeometry(W, h, TREAD - GAP, 2, 0.01), uw ? mStepUW : mConcStep, uw ? { cast: false, layer: LAYER_UNDERWATER } : {});
      st.position.set(dir.x * t, bottom + h / 2, dir.y * t);
      st.rotation.y = Math.PI / 4;
    };
    // fuera: dos peldaños desde la grava hasta el zócalo
    step(2.25 + TREAD / 2, RISE, 0, false);
    step(1.95 + TREAD / 2, PLATFORM_Y + 0.004, 0, false);
    // sobre el zócalo: dos peldaños al nivel del piso
    step(1.65 + TREAD / 2, PLATFORM_Y + 0.006, PLATFORM_Y - 0.1, false);
    step(1.35 + TREAD / 2, PLATFORM_Y + 0.006, PLATFORM_Y - 0.1, false);
    // dentro del agua: cuatro peldaños hacia el centro
    for (let k = 1; k <= 4; k++) step(1.2 - k * TREAD + TREAD / 2, PLATFORM_Y - k * RISE, PLATFORM_Y - POOL_DEPTH, true);
  }

  // --- losas de piedra gris: centro del pit, camino norte y diagonal de los escalones
  {
    // dentro del sofá el piso es el mismo chukum (no hay losa de cemento): el taburete se apoya directo
    const stool = makeStool(STOOL.r, STOOL.h);
    stool.position.set(STOOL.x, PLATFORM_Y + 0.008 + STOOL.h / 2, STOOL.z);
    stool.castShadow = stool.receiveShadow = true;
    group.add(stool);
    // mesa larga de chukum en el eje, frente a la puerta de la casa (video y skoura_fosa_lateral.jpg)
    // barra larga: nace dentro de la casa norte y sale al patio por la cancelería abierta (foto 3/10)
    {
      const mTop = chukum('#c69a82', 'tableTop', { tri: 0.6, normal: 0.3, mottle: 0.18, rough: 0.55 });
      const mBase = chukum(C.table, 'table', { tri: 0.5, normal: 0.6, mottle: 0.2, rough: 0.75 });
      const mW = chukum('#6b4129', 'woodStool', { tri: 0.9, normal: 0.4, mottle: 0.3, rough: 0.6 });
      // seduta intrecciata a righe (foto 3/10)
      const mWoven = patch(new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 0.9 }), {
        key: 'woven', gobo: true, reveal: true,
        fragNormal: `{ float f = fract(vWPos.x * 22.0); vec3 st = f < 0.18 ? vec3(0.62, 0.22, 0.16) : (f > 0.55 && f < 0.62 ? vec3(0.35, 0.3, 0.25) : vec3(1.0));
          diffuseColor.rgb *= st * (0.88 + 0.12 * step(0.5, fract(vWPos.z * 90.0))); }`,
      });
      const z0 = -7.4, z1 = -3.4, x = 0.3;
      const top = add(new RoundedBoxGeometry(0.9, 0.1, z1 - z0, 2, 0.015), mTop);
      top.position.set(x, 0.95, (z0 + z1) / 2);
      const base = add(new RoundedBoxGeometry(0.66, 0.9, 1.2, 2, 0.02), mBase);
      base.position.set(x + 0.08, 0.45, z1 - 0.66);
      // rejillas oscuras en la base (ventilación), como en la foto 9/20
      const mVent = patch(new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 }), { key: 'vent', reveal: true });
      for (const [vx, vz, ry, w] of [[x + 0.08 - 0.335, z1 - 0.66, -Math.PI / 2, 0.75], [x + 0.08, z1 - 0.055, 0, 0.42]]) {
        const v = add(new THREE.PlaneGeometry(w, 0.26), mVent, { cast: false }); v.position.set(vx, 0.22, vz); v.rotation.y = ry;
        for (let i = 1; i < 6; i++) { const sl = add(new THREE.BoxGeometry(ry ? 0.012 : w, 0.012, ry ? w : 0.012), mBase, { cast: false }); sl.position.set(vx + (ry ? -0.004 : 0), 0.09 + i * 0.043, vz + (ry ? 0 : 0.004)); }
      }
      // vassoio di legno con il modellino della casa (foto 9/20 e 3/10)
      const mTray = chukum('#7a4a2c', 'tray', { tri: 1.0, normal: 0.3, mottle: 0.3, rough: 0.5 });
      const tray = add(new RoundedBoxGeometry(0.22, 0.05, 0.62, 2, 0.008), mTray); tray.position.set(x + 0.05, 1.025, -3.95);
      for (const [dz, h, w] of [[-0.14, 0.12, 0.13], [0.12, 0.16, 0.15]]) {
        const hs = new THREE.Shape(); hs.moveTo(-w / 2, 0); hs.lineTo(-w / 2, h); hs.lineTo(0, h + w * 0.55); hs.lineTo(w / 2, h); hs.lineTo(w / 2, 0); hs.lineTo(-w / 2, 0);
        const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.16, bevelEnabled: false }); hg.rotateY(Math.PI / 2);
        const hm = add(hg, mTray); hm.position.set(x - 0.03, 1.05, -3.95 + dz - 0.08);
      }
      const cab = add(new RoundedBoxGeometry(0.66, 0.92, 2.2, 2, 0.01), mW);
      cab.position.set(x, 0.46, z0 + 1.3);
      // taburetes altos de madera a lo largo de la barra
      for (const z of [-4.3, -3.75, -5.4]) {
        const g = new THREE.Group();
        const seat = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.05, 0.36, 2, 0.01), mWoven);
        seat.position.y = 0.7;
        g.add(seat);
        for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.04), mW);
          l.position.set(lx, 0.34, lz);
          g.add(l);
        }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), mW);
        bar.position.set(0, 0.25, -0.14); g.add(bar);
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(x - 0.62, 0, z);
        group.add(g);
      }
    }
    // asiento redondo con cojín blanco, al otro lado de la piscina (disco claro de la foto cenital)
    {
      const [sx, sz] = [-1.2, 2.05];
      const b = add(new THREE.CylinderGeometry(0.62, 0.62, 0.52, 64), chukum(C.ring, 'roundSeat'));
      b.position.set(sx, 0.26, sz);
      const c = add(new THREE.CylinderGeometry(0.56, 0.57, 0.12, 64), mCushion);
      c.position.set(sx, 0.58, sz);
      const r = add(new THREE.TorusGeometry(0.56, 0.055, 12, 64).rotateX(Math.PI / 2), mCushion);
      r.position.set(sx, 0.58, sz);
    }
    // franja de concreto pigmentado en el eje: de la barra, por el respaldo y bajo el taburete, hasta el agua (foto 15/20)
    const axis = add(new RoundedBoxGeometry(0.86, 0.02, 1.22, 2, 0.006), mConc, { cast: false });
    axis.position.set(0.03, PLATFORM_Y + 0.004, -1.77);
    const axisN = add(new RoundedBoxGeometry(0.86, 0.03, 0.5, 2, 0.006), mConc, { cast: false });
    axisN.position.set(0.03, 0.015, -3.35);
    // piedras redondas en la grava (arriba de la foto)
    for (const [x, z, r] of [[-0.86, -3.95, 0.18], [-1.28, -3.6, 0.16], [0.98, -3.9, 0.19], [1.36, -3.52, 0.15], [-1.05, -4.35, 0.15], [1.12, -4.33, 0.16]]) {
      const s = add(new THREE.CylinderGeometry(r, r * 1.02, 0.04, 40), mStone, { cast: false });
      s.position.set(x, 0.015, z);
    }

  }

  // --- el sofá semicircular: respaldo de chukum, base, cojines y rollos
  {
    const g = new THREE.Group();
    g.position.set(SOFA.cx, PLATFORM_Y, SOFA.cz);
    group.add(g);
    const addS = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
    const cut = Math.asin(0.43 / SOFA.rOut);
    addS(extrudeUp(annularSector(SOFA.rWall, SOFA.rOut, 0, Math.PI / 2 - cut), 0.68, 0.02), mRing);
    addS(extrudeUp(annularSector(SOFA.rWall, SOFA.rOut, Math.PI / 2 - cut, Math.PI / 2 + cut, 12), 0.68, 0.02), mConc);
    addS(extrudeUp(annularSector(SOFA.rWall, SOFA.rOut, Math.PI / 2 + cut, Math.PI), 0.68, 0.02), mRing);
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
    const mIn = chukum('#7a4a36', 'interior', { tri: 0.4, normal: 0.4, mottle: 0.2, rough: 0.9, gobo: false });
    const D = 4.4;
    const room = add(new THREE.BoxGeometry(hw * 2 - 0.3, 3.25, D), Object.assign(mIn, { side: THREE.BackSide }), { cast: false });
    room.position.set(0, 1.625, z1 - T - D / 2);
    const mFloorIn = chukum('#8d6a52', 'floorIn', { tri: 0.6, normal: 0.3, mottle: 0.15, rough: 0.6, gobo: false });
    const fl = add(new THREE.PlaneGeometry(hw * 2 - 0.3, D).rotateX(-Math.PI / 2), mFloorIn, { cast: false });
    fl.position.set(0, 0.004, z1 - T - D / 2);
    const mWood = chukum('#5a3424', 'woodIn', { tri: 0.8, normal: 0.3, mottle: 0.25, rough: 0.55, gobo: false });
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
    const mGlass = patch(new THREE.MeshStandardMaterial({ color: 0x0a0d0d, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6, transparent: true, opacity: 0.2, depthWrite: false }), { key: 'glass', reveal: true, grain: false });
    const zf = z1 - T * 0.55;
    const bar = (w, h, x, y, z = zf) => { const b = add(new THREE.BoxGeometry(w, h, 0.05), mSteel, { cast: false }); b.position.set(x, y, z); };
    // fijo a la izquierda y montante arriba; las dos hojas centrales están abiertas hacia dentro
    const HINGE = -0.6, TR = 2.32;
    for (const x of [OP.x0 + 0.03, HINGE, OP.x1 - 0.03]) bar(0.05, OP.h, x, OP.h / 2);
    bar(OP.x1 - OP.x0, 0.05, (OP.x0 + OP.x1) / 2, TR);
    bar(OP.x1 - OP.x0, 0.05, (OP.x0 + OP.x1) / 2, OP.h - 0.03);
    bar(HINGE - OP.x0, 0.05, (OP.x0 + HINGE) / 2, 0.03);
    bar(0.03, TR, (OP.x0 + HINGE) / 2, TR / 2);
    for (const [w, h, cx, cy] of [[HINGE - OP.x0, TR, (OP.x0 + HINGE) / 2, TR / 2], [OP.x1 - OP.x0, OP.h - TR, (OP.x0 + OP.x1) / 2, (TR + OP.h) / 2]]) {
      const gl = add(new THREE.PlaneGeometry(w, h), mGlass, { cast: false, receive: false });
      gl.renderOrder = 3;
      gl.position.set(cx, cy, zf - 0.01);
    }
    const leafW = (OP.x1 - HINGE) / 2;
    const leaf = (hx, dir, ang) => {
      const g = new THREE.Group();
      g.position.set(hx, 0, zf);
      g.rotation.y = ang;
      const part = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), mSteel); m.position.set(x, y, 0); g.add(m); };
      part(0.045, TR - 0.02, dir * 0.02, TR / 2);
      part(0.045, TR - 0.02, dir * (leafW - 0.02), TR / 2);
      part(leafW, 0.045, dir * leafW / 2, 0.03);
      part(leafW, 0.045, dir * leafW / 2, TR - 0.04);
      part(leafW, 0.03, dir * leafW / 2, TR * 0.5);
      part(0.03, TR - 0.02, dir * leafW / 2, TR / 2);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(leafW, TR), mGlass);
      gm.renderOrder = dir > 0 ? 1 : 2;
      gm.position.set(dir * leafW / 2, TR / 2, 0);
      g.add(gm);
      group.add(g);
    };
    leaf(HINGE + 0.03, 1, 1.35);
    leaf(OP.x1 - 0.03, -1, -1.35);
    const wz = z1 - T * 0.5;
    for (let i = 0; i <= 2; i++) {
      bar(0.045, WIN.y1 - WIN.y0, WIN.x0 + (WIN.x1 - WIN.x0) * (i / 2), (WIN.y0 + WIN.y1) / 2, wz);
      bar(WIN.x1 - WIN.x0, 0.045, (WIN.x0 + WIN.x1) / 2, WIN.y0 + (WIN.y1 - WIN.y0) * (i / 2), wz);
    }
    const wb = add(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), patch(new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.08, envMapIntensity: 1.2 }), { key: 'winBack', reveal: true }), { cast: false });
    wb.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, wz - 0.03);
    // lámparas redondas en los muros (los "ojos" de luz de Skoura)
    for (const [x, y, z, ry] of [[LOT.x0 + 0.005, 1.75, -2.4, Math.PI / 2], [LOT.x0 + 0.005, 1.75, 1.6, Math.PI / 2], [LOT.x1 - 0.005, 1.75, -1.2, -Math.PI / 2], [LOT.x1 - 0.005, 1.75, 2.8, -Math.PI / 2]]) {
      const l = lamp(0.06); l.position.set(x, y, z); l.rotation.y = ry; group.add(l);
    }
  }

  // --- casa sur (fotos 1/20, 9/20, 12/20): capanna estrecha con óculo, ventanal en retícula,
  //     puerta de madera entre dos lámparas, cancelería de acero y escalera exterior de chukum al este
  {
    const zS = 4.4, T = 0.3, xW = LOT.x0, xE = 1.25, eave = 6.2, ridge = 7.4;
    const cx = (xW + xE) / 2;
    const L = (x) => -x;                       // la fachada mira al norte: x local = -x del mundo
    const DOOR = [0.35, 0.95, 2.3], GLZ = [-1.95, -0.25, 2.45], OCU = [0.62, 5.0, 0.36], GRID = [-1.95, -0.45, 3.55, 5.9];
    const f = new THREE.Shape();
    const pts = [[xE, 0], [DOOR[1], 0], [DOOR[1], DOOR[2]], [DOOR[0], DOOR[2]], [DOOR[0], 0], [GLZ[1], 0], [GLZ[1], GLZ[2]],
      [GLZ[0], GLZ[2]], [GLZ[0], 0], [xW, 0], [xW, eave], [cx, ridge], [xE, eave], [xE, 0]];
    pts.forEach(([x, y], i) => (i ? f.lineTo(L(x), y) : f.moveTo(L(x), y)));
    const oc = new THREE.Path(); oc.absarc(L(OCU[0]), OCU[1], OCU[2], 0, Math.PI * 2, true); f.holes.push(oc);
    const gw = new THREE.Path();
    gw.moveTo(L(GRID[0]), GRID[2]); gw.lineTo(L(GRID[1]), GRID[2]); gw.lineTo(L(GRID[1]), GRID[3]); gw.lineTo(L(GRID[0]), GRID[3]); gw.lineTo(L(GRID[0]), GRID[2]);
    f.holes.push(gw);
    const fac = add(new THREE.ExtrudeGeometry(f, { depth: T, bevelEnabled: false, curveSegments: 40 }), mHouse);
    fac.rotation.y = Math.PI; fac.position.set(0, 0, zS + T);
    const D = 5.6;
    const up = add(new THREE.BoxGeometry(xE - xW, eave - 2.9, D), mHouse);
    up.position.set(cx, 2.9 + (eave - 2.9) / 2, zS + T + D / 2);
    const pr = new THREE.Shape(); pr.moveTo(xW - cx, 0); pr.lineTo(0, ridge - eave); pr.lineTo(xE - cx, 0); pr.lineTo(xW - cx, 0);
    const roof = add(new THREE.ExtrudeGeometry(pr, { depth: D + T, bevelEnabled: false }), mHouse);
    roof.position.set(cx, eave, zS);
    // interior en penumbra detrás de la cancelería y del ventanal
    const room = add(new THREE.BoxGeometry(xE - xW - 0.2, 2.9, D), Object.assign(chukum('#7c4c38', 'interiorS', { tri: 0.4, normal: 0.3, mottle: 0.2, gobo: false }), { side: THREE.BackSide }), { cast: false });
    room.position.set(cx, 1.45, zS + T + D / 2);
    const bed = add(new RoundedBoxGeometry(1.5, 0.45, 2.0, 3, 0.06), mCushion); bed.position.set(-1.1, 0.25, zS + T + 1.6);
    const upIn = add(new THREE.PlaneGeometry(GRID[1] - GRID[0], GRID[3] - GRID[2]), patch(new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.9 }), { key: 'upIn', reveal: true }), { cast: false });
    upIn.rotation.y = Math.PI; upIn.position.set((GRID[0] + GRID[1]) / 2, (GRID[2] + GRID[3]) / 2, zS + T + 0.6);
    // cortina blanca a un lado del ventanal
    const curtain = add(new THREE.PlaneGeometry(0.45, GRID[3] - GRID[2] - 0.1), patch(new THREE.MeshStandardMaterial({ color: 0xefe9df, roughness: 1, side: THREE.DoubleSide }), { key: 'curtain', reveal: true }), { cast: false });
    curtain.rotation.y = Math.PI; curtain.position.set(GRID[0] + 0.3, (GRID[2] + GRID[3]) / 2, zS + T + 0.12);
    // puerta de madera (tablones verticales)
    const mDoor = chukum('#b0703f', 'doorWood', { tri: 1.2, normal: 0.5, mottle: 0.35, rough: 0.6 });
    const dw = DOOR[1] - DOOR[0];
    doorPivot.position.set(DOOR[0], 0, zS + T * 0.6);
    const door = new THREE.Mesh(new THREE.BoxGeometry(dw, DOOR[2], 0.05), mDoor);
    door.position.set(dw / 2, DOOR[2] / 2, 0);
    door.castShadow = door.receiveShadow = true;
    doorPivot.add(door);
    group.add(doorPivot);
    // símbolo de planta arquitectónica: cuarto de círculo del barrido de la hoja, dibujado fino en el piso
    const mLine = new THREE.MeshBasicMaterial({ color: 0xf3ead9, transparent: true, opacity: 0.85, depthWrite: false });
    const arc = add(new THREE.RingGeometry(dw - 0.006, dw + 0.006, 48, 1, 0, Math.PI / 2).rotateX(-Math.PI / 2), mLine, { cast: false, receive: false });
    arc.position.set(DOOR[0], 0.012, zS);
    arc.rotation.y = 0;
    const leafL = add(new THREE.PlaneGeometry(0.012, dw).rotateX(-Math.PI / 2), mLine, { cast: false, receive: false });
    leafL.position.set(DOOR[0], 0.012, zS - dw / 2);
    hotspots.contacto.set((DOOR[0] + DOOR[1]) / 2, 1.2, zS);
    // cancelería (3 x 3) y ventanal (3 x 4) de acero negro
    const mSteelS = patch(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.6 }), { key: 'steelS', reveal: true });
    const mGlassS = patch(new THREE.MeshStandardMaterial({ color: 0x0b0e0e, roughness: 0.03, envMapIntensity: 1.8, transparent: true, opacity: 0.25, depthWrite: false }), { key: 'glassS', reveal: true, grain: false });
    const grid = (x0, x1, y0, y1, nx, ny, z) => {
      for (let i = 0; i <= nx; i++) { const b = add(new THREE.BoxGeometry(0.045, y1 - y0, 0.05), mSteelS, { cast: false }); b.position.set(x0 + (x1 - x0) * (i / nx), (y0 + y1) / 2, z); }
      for (let j = 0; j <= ny; j++) { const b = add(new THREE.BoxGeometry(x1 - x0, 0.045, 0.05), mSteelS, { cast: false }); b.position.set((x0 + x1) / 2, y0 + (y1 - y0) * (j / ny), z); }
      const g = add(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mGlassS, { cast: false, receive: false });
      g.rotation.y = Math.PI; g.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + 0.01);
    };
    grid(GLZ[0], GLZ[1], 0, GLZ[2], 3, 3, zS + T * 0.5);
    grid(GRID[0], GRID[1], GRID[2], GRID[3], 3, 4, zS + T * 0.5);
    const ring = add(new THREE.TorusGeometry(OCU[2] - 0.02, 0.025, 10, 48), mSteelS, { cast: false });
    ring.position.set(OCU[0], OCU[1], zS + T * 0.5);
    const og = add(new THREE.CircleGeometry(OCU[2], 48), mGlassS, { cast: false, receive: false });
    og.rotation.y = Math.PI; og.position.set(OCU[0], OCU[1], zS + T * 0.5);
    for (const x of [0.12, 1.12]) { const l = lamp(0.06); l.position.set(x, 2.2, zS - 0.002); l.rotation.y = Math.PI; group.add(l); }
    // escalera exterior de chukum pegada al muro este (sube hacia la planta alta)
    const n = 11, rise = 2.9 / n, run = 0.28, z0 = zS - n * run;
    for (let i = 0; i < n; i++) {
      const h = (i + 1) * rise;
      const st = add(new RoundedBoxGeometry(1.05, h, run + 0.01, 2, 0.012), mRing);
      st.position.set(LOT.x1 - 0.55, h / 2, z0 + i * run + run / 2);
    }
    const land = add(new RoundedBoxGeometry(1.05, 2.9, 0.9, 2, 0.012), mRing);
    land.position.set(LOT.x1 - 0.55, 1.45, zS + 0.45);
    // tótems de rodajas de madera al pie de la escalera (piezas de Miguel Tapia)
    const mTot = chukum('#6e4128', 'totem', { tri: 1.4, normal: 0.6, mottle: 0.45, rough: 0.6 });
    for (const [x, z, k] of [[1.15, z0 + 0.15, 6], [1.0, z0 + 0.55, 4]]) {
      for (let i = 0; i < k; i++) {
        const r = 0.13 + 0.04 * Math.sin(i * 1.7 + x * 5);
        const d = add(new THREE.CylinderGeometry(r, r * 1.04, 0.19, 28), mTot);
        d.position.set(x, 0.1 + i * 0.2, z);
        d.rotation.y = i * 0.9;
      }
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
    const poles = [];
    let seed = 3;
    const rr = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (const x of [LOT.x0 - 0.15, LOT.x1 + 0.15]) {
      for (let z = -4.6; z < 9.5; z += 0.055 + rr() * 0.03) {
        poles.push({ x: x + (rr() - 0.5) * 0.08, z, h: 0.95 + rr() * 0.55, r: 0.018 + rr() * 0.016, tx: (rr() - 0.5) * 0.08, tz: (rr() - 0.5) * 0.08, k: rr() });
      }
    }
    const pg = new THREE.CylinderGeometry(0.85, 1, 1, 6).translate(0, 0.5, 0);
    const pm = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.carrizo), roughness: 0.85, envMapIntensity: 0.6 }), {
      key: 'carrizoPoles', gobo: true, reveal: true,
      fragNormal: 'diffuseColor.rgb *= 0.75 + 0.5 * eNoise2(vec2(vWPos.y * 9.0, vWPos.z * 3.0 + vWPos.x * 3.0));',
    });
    const im = new THREE.InstancedMesh(pg, pm, poles.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    poles.forEach((p, i) => {
      q.setFromEuler(e.set(p.tx, 0, p.tz));
      m4.compose(new THREE.Vector3(p.x, 4.45, p.z), q, new THREE.Vector3(p.r, p.h, p.r));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.setScalar(0.7 + p.k * 0.5));
    });
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
    void m;
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
    const a = add(ruin(1.3, 1.05, 2.55, 0.5), mL); a.position.set(-1.85, 1.275, -4.2); a.rotation.y = 0.05;
    const b = add(ruin(4.1, 0.6, 2.45, 0.45), mL); b.position.set(2.05, 1.225, -4.22); b.rotation.y = -0.08;
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

  return { group, hotspots, doorPivot };
}
