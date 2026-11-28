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
// puerta en el muro este (sale hacia la escalera de la segunda plaza)
export const GATE = { z: -0.4, w: 1.3, h: 2.9 };
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
  const hotspots = { nosotros: new THREE.Vector3(0.0, 1.6, -4.55), vision: new THREE.Vector3(LOT.x1 + 0.1, 1.4, GATE.z), contacto: new THREE.Vector3() };
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

  // --- grava: un anillo alrededor del salotto (la plaza es abierta, sin muros)
  {
    const gs = new THREE.Shape(); gs.absarc(0, 0.9, 3.35, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, POOL_R, 0, Math.PI * 2, true); gs.holes.push(h);
    const gg = new THREE.ShapeGeometry(gs, 96); gg.rotateX(-Math.PI / 2);
    const g = add(gg, mGravel, { cast: false }); g.position.y = 0.003;
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

  // --- la casa a dos aguas (al norte): un pabellón aislado al fondo de la plaza
  {
    // lo studio di Enekén: padiglione a capanna a doppia altezza, aperto sul salotto con la grande vetrata
    const z1 = -4.65, z0 = -15.4, eave = 7.0, ridge = 9.8, hw = 4.0, T = 0.32, WT = 0.3;
    const OP = { x0: -2.3, x1: 2.3, h: 3.7 }, WIN = { x0: -3.1, x1: -1.5, y0: 4.9, y1: 6.3 };
    const fac = new THREE.Shape();
    fac.moveTo(-hw, 0); fac.lineTo(OP.x0, 0); fac.lineTo(OP.x0, OP.h); fac.lineTo(OP.x1, OP.h); fac.lineTo(OP.x1, 0);
    fac.lineTo(hw, 0); fac.lineTo(hw, eave); fac.lineTo(0, ridge); fac.lineTo(-hw, eave); fac.lineTo(-hw, 0);
    const wh = new THREE.Path();
    wh.moveTo(WIN.x0, WIN.y0); wh.lineTo(WIN.x0, WIN.y1); wh.lineTo(WIN.x1, WIN.y1); wh.lineTo(WIN.x1, WIN.y0); wh.lineTo(WIN.x0, WIN.y0);
    fac.holes.push(wh);
    const facade = add(new THREE.ExtrudeGeometry(fac, { depth: T, bevelEnabled: false }), mHouse);
    facade.position.set(0, 0, z1 - T);
    // muri laterali, muro di fondo, solaio e tetto (si vedono da fuori: la terrazza è aperta)
    const D = (z1 - T) - z0;
    const mIn = chukum('#b77c60', 'interior', { tri: 0.35, normal: 0.4, mottle: 0.3, rough: 0.92, gobo: false });
    for (const x of [-hw + WT / 2, hw - WT / 2]) {
      const w = add(new THREE.BoxGeometry(WT, eave, D), mHouse); w.position.set(x, eave / 2, z0 + D / 2);
      const wi = add(new THREE.PlaneGeometry(D, eave), mIn, { cast: false }); wi.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      wi.position.set(x + (x < 0 ? WT / 2 + 0.002 : -WT / 2 - 0.002), eave / 2, z0 + D / 2);
    }
    const bw = add(new THREE.BoxGeometry(hw * 2, eave, WT), mHouse); bw.position.set(0, eave / 2, z0 + WT / 2);
    const bwi = add(new THREE.PlaneGeometry(hw * 2 - 2 * WT, eave), mIn, { cast: false }); bwi.position.set(0, eave / 2, z0 + WT + 0.002);
    const ceil = add(new THREE.BoxGeometry(hw * 2, 0.25, D), mHouse); ceil.position.set(0, eave - 0.125, z0 + D / 2);
    const prof = new THREE.Shape();
    prof.moveTo(-hw, 0); prof.lineTo(0, ridge - eave); prof.lineTo(hw, 0); prof.lineTo(-hw, 0);
    const r = add(new THREE.ExtrudeGeometry(prof, { depth: z1 - T - z0, bevelEnabled: false }), mHouse);
    r.position.set(0, eave, z0);
    // pavimento in cotto (come gli interni di Casa Skoura)
    const mTile = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#a8603f'), roughness: 0.62, envMapIntensity: 0.5 }), {
      key: 'tiles', reveal: true, mottle: 0.25,
      fragNormal: `{ vec2 g = abs(fract(vWPos.xz * 3.333) - 0.5); float l = smoothstep(0.47, 0.5, max(g.x, g.y));
        diffuseColor.rgb *= (1.0 - 0.3 * l) * (0.9 + 0.2 * eHash12(floor(vWPos.xz * 3.333))); }`,
    });
    const fl = add(new THREE.PlaneGeometry(hw * 2 - 2 * WT, D).rotateX(-Math.PI / 2), mTile, { cast: false });
    fl.position.set(0, 0.004, z0 + D / 2);

    // --- dentro: il tavolo di lavoro con i plastici
    const mWood = chukum('#6b3f27', 'woodIn', { tri: 1.2, normal: 0.4, mottle: 0.35, rough: 0.5, gobo: false });
    const tz = -10.2, tx = -1.35;
    const top = add(new RoundedBoxGeometry(1.5, 0.08, 3.4, 2, 0.012), mWood); top.position.set(tx, 0.78, tz);
    for (const [lx, lz] of [[-0.62, -1.55], [0.62, -1.55], [-0.62, 1.55], [0.62, 1.55]]) {
      const lg = add(new THREE.BoxGeometry(0.08, 0.74, 0.08), mWood); lg.position.set(tx + lx, 0.37, tz + lz);
    }
    // plastico rosso (taller_maqueta_roja): volumi di terracotta a capanna
    const mRed = chukum('#a3412a', 'modelRed', { tri: 3, normal: 0.2, mottle: 0.15, rough: 0.8, gobo: false });
    const mWhite = chukum('#ece7dc', 'modelWhite', { tri: 3, normal: 0.2, mottle: 0.08, rough: 0.9, gobo: false });
    const gable = (w, h, d, m) => {
      const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h); sh.lineTo(0, h + w * 0.45); sh.lineTo(w / 2, h); sh.lineTo(w / 2, 0); sh.lineTo(-w / 2, 0);
      return add(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }), m);
    };
    const base = add(new THREE.BoxGeometry(0.9, 0.02, 1.1), mWood); base.position.set(tx, 0.83, tz - 0.8);
    for (const [dx, dz, w, h, d] of [[-0.25, -0.35, 0.22, 0.2, 0.55], [0.15, -0.25, 0.18, 0.28, 0.4], [0.05, 0.25, 0.3, 0.12, 0.35]]) {
      const g = gable(w, h, d, mRed); g.position.set(tx + dx, 0.84, tz - 0.8 + dz);
    }
    const ring = add(new THREE.TorusGeometry(0.12, 0.035, 10, 32).rotateX(Math.PI / 2), mRed); ring.position.set(tx + 0.25, 0.86, tz - 1.05);
    // plastico bianco (taller_maqueta_blanca)
    const base2 = add(new THREE.BoxGeometry(0.8, 0.02, 0.9), mWood); base2.position.set(tx, 0.83, tz + 0.9);
    for (const [dx, dz, w, h, d] of [[-0.2, 0.1, 0.25, 0.16, 0.5], [0.18, -0.15, 0.2, 0.24, 0.3], [0.15, 0.25, 0.28, 0.1, 0.25]]) {
      const b = add(new THREE.BoxGeometry(w, h, d), mWhite); b.position.set(tx + dx, 0.84 + h / 2, tz + 0.9 + dz);
    }
    // sgabelli e una sedia di legno
    for (const [sx, sz] of [[tx + 1.05, tz - 0.6], [tx + 1.05, tz + 0.7]]) {
      const st = add(new THREE.CylinderGeometry(0.2, 0.22, 0.46, 28), mWood); st.position.set(sx, 0.23, sz);
    }

    // --- parete di fondo: le tavole dello studio appese (foto reali, a dimensione misurata)
    const tl = new THREE.TextureLoader();
    // URL statici: così nel pacchetto entrano solo queste sei foto
    const prints = [
      new URL('../assets/fotos/taller_axonometria.jpg', import.meta.url).href,
      new URL('../assets/fotos/taller_estructura.jpg', import.meta.url).href,
      new URL('../assets/fotos/taller_maqueta_roja.jpg', import.meta.url).href,
      new URL('../assets/fotos/taller_obra_alberca.jpg', import.meta.url).href,
      new URL('../assets/fotos/skoura_fosa_cenital.jpg', import.meta.url).href,
      new URL('../assets/fotos/oda_rosa_puerta_ojiva.jpg', import.meta.url).href,
    ];
    const mFrame = chukum('#2c1d15', 'frame', { tri: 1, normal: 0.2, mottle: 0.1, rough: 0.6, gobo: false });
    prints.forEach((n, i) => {
      const t = tl.load(n);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const m = patch(new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, envMapIntensity: 0.3 }), { key: 'print', reveal: true });
      const col = i % 3, row = Math.floor(i / 3);
      const w = 0.95, h = 1.17, x = -1.35 + (col - 1) * 1.3, y = 2.0 + (1 - row) * 1.5, z = z0 + WT + 0.03;
      const fr = add(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), mFrame, { cast: false }); fr.position.set(x, y, z);
      const ph = add(new THREE.PlaneGeometry(w, h), m, { cast: false }); ph.position.set(x, y, z + 0.017);
    });
    // --- parete sinistra: il disco di legno di Miguel (come nella sua foto), la sfera e i totem
    const mDiscF = chukum('#5a2d1c', 'discF', { tri: 2.5, normal: 0.5, mottle: 0.35, rough: 0.55, gobo: false });
    const disc = add(new THREE.CylinderGeometry(0.95, 0.95, 0.16, 72), mDiscF); disc.rotation.z = Math.PI / 2; disc.position.set(-hw + WT + 0.09, 3.3, -9.0);
    const ped = add(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 40), mWhite); ped.position.set(-hw + 0.9, 0.525, -11.6);
    const sph = makeStool(0.36, 0.72); sph.geometry.dispose(); sph.geometry = new THREE.SphereGeometry(1, 48, 36); sph.scale.setScalar(0.36);
    sph.position.set(-hw + 0.9, 1.41, -11.6); sph.castShadow = true; group.add(sph);
    const mTot = chukum('#6e4128', 'totemIn', { tri: 1.4, normal: 0.6, mottle: 0.45, rough: 0.6, gobo: false });
    for (const [x, z, k] of [[-hw + 0.7, -7.0, 7], [-hw + 1.1, -6.6, 4]]) {
      for (let i = 0; i < k; i++) { const rr = 0.15 + 0.05 * Math.sin(i * 1.7 + x * 5); const d = add(new THREE.CylinderGeometry(rr, rr * 1.04, 0.21, 28), mTot); d.position.set(x, 0.11 + i * 0.22, z); d.rotation.y = i * 0.9; }
    }
    // --- parete destra: scaffale con libri e plastici
    for (let i = 0; i < 4; i++) {
      const sh = add(new THREE.BoxGeometry(0.4, 0.04, 3.2), mWood); sh.position.set(hw - WT - 0.2, 0.9 + i * 0.75, -10.0);
      for (let k = 0; k < 9; k++) {
        const bk = add(new THREE.BoxGeometry(0.26, 0.25 + ((k * 7 + i * 3) % 5) * 0.04, 0.05 + (k % 3) * 0.02), k % 4 ? mWood : mWhite, { cast: false });
        bk.position.set(hw - WT - 0.2, 0.92 + i * 0.75 + bk.geometry.parameters.height / 2, -11.3 + k * 0.3);
      }
    }
    // luce calda dello studio
    const inLight = new THREE.PointLight(0xffc58a, 14, 12, 1.4); inLight.position.set(-0.6, 3.6, -10.0); group.add(inLight);
    const inLight2 = new THREE.PointLight(0xffd7a8, 6, 9, 1.6); inLight2.position.set(1.5, 2.6, -6.3); group.add(inLight2);

    // cancelería de acero negro y vidrio (le due ante centrali aperte)
    const mSteel = patch(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.6 }), { key: 'steel', reveal: true });
    const mGlass = patch(new THREE.MeshStandardMaterial({ color: 0x0a0d0d, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6, transparent: true, opacity: 0.2, depthWrite: false }), { key: 'glass', reveal: true, grain: false });
    const zf = z1 - T * 0.55;
    const bar = (w, h, x, y, z = zf) => { const b = add(new THREE.BoxGeometry(w, h, 0.05), mSteel, { cast: false }); b.position.set(x, y, z); };
    const HINGE = -1.0, TR = 2.9;
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
    const wg = add(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), mGlass, { cast: false, receive: false });
    wg.renderOrder = 3; wg.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, wz - 0.03);
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
    const a = add(ruin(1.3, 1.05, 2.55, 0.5), mL); a.position.set(-3.1, 1.275, -4.2); a.rotation.y = 0.05;
    const b = add(ruin(4.1, 0.6, 2.45, 0.45), mL); b.position.set(3.05, 1.225, -4.22); b.rotation.y = -0.08;
    const l = lamp(0.05); l.position.set(-2.9, 1.55, -3.95); group.add(l);
  }

  return { group, hotspots, doorPivot };
}
