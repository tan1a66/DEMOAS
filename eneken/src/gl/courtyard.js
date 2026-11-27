// Casa Skoura: el conversation pit, la piscina redonda, la grava blanca y el lote largo de Mérida.
// Medidas tomadas de skoura_fosa_cenital.jpg: la piscina (Ø 2,4 m) da la escala
// (1 px de la foto ≈ 1,07 cm). Norte (arriba en la foto) = -z. Centro de la piscina = origen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { patch, LAYER_UNDERWATER } from './core.js';

export const POOL_R = 1.2;
export const POOL_DEPTH = 1.35;
export const LOT = { x0: -2.5, x1: 2.5, z0: -14, z1: 14 };
export const SOFA = { cx: 0.03, cz: -1.55, rOut: 1.6, rWall: 1.43, rSeat: 0.83 };
export const STOOL = { x: 0.03, z: -1.58, r: 0.2, h: 0.4 };
const PLATFORM_Y = 0.03;

// Paleta (muestreada de las fotos, corregida a albedo)
const C = {
  // chukum al sol (video de Casa Skoura): terracota saturada, monolítica en piso, muros y casa
  terracotta: '#ad5f3b',   // piso del pit
  ring: '#a95d3e',         // respaldo de chukum
  wall: '#a2573d',         // muros del lote
  house: '#a65b3f',
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

function chukum(color, key, { tri = 0.4, normal = 0.7, mottle = 0.16, rough = 0.86 } = {}) {
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
  const mWall = chukum(C.wall, 'wall', { tri: 0.25, normal: 0.55, mottle: 0.22 });
  const mHouse = chukum(C.house, 'house', { tri: 0.25, normal: 0.5, mottle: 0.2 });
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
    const c = add(new RoundedBoxGeometry(0.86, 0.04, 1.16, 2, 0.008), mStone, { cast: false });
    c.position.set(0.03, PLATFORM_Y + 0.012, -1.72);
    // mesa larga de chukum en el eje, frente a la puerta de la casa (video y skoura_fosa_lateral.jpg)
    const n = add(new RoundedBoxGeometry(0.82, 0.92, 2.1, 3, 0.03), chukum(C.table, 'table', { tri: 0.5, normal: 0.6, mottle: 0.2, rough: 0.75 }));
    n.position.set(0.18, 0.46, -3.75);
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
    addS(extrudeUp(annularSector(SOFA.rWall, SOFA.rOut, 0, Math.PI), 0.74, 0.018), mRing);
    addS(extrudeUp(annularSector(SOFA.rSeat, SOFA.rWall, 0, Math.PI), 0.3, 0.014), mTerra);
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
      t.position.y = 0.43 + 0.11;
      // extremos redondeados
      for (const a of [a0, a1]) {
        const cap = addS(new THREE.SphereGeometry(0.12, 20, 14), mCushion);
        cap.scale.set(1, 0.92, 1);
        cap.position.set(Math.cos(a) * (SOFA.rWall - 0.13), 0.54, -Math.sin(a) * (SOFA.rWall - 0.13));
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
    // casa: volumen con cubierta a dos aguas, cumbrera norte-sur (como skoura_capanna.jpg)
    const z0 = -14, z1 = -4.65, eave = 6.0, ridge = 7.9, hw = 2.65;
    const body = add(new THREE.BoxGeometry(hw * 2, eave, z1 - z0), mHouse);
    body.position.set(0, eave / 2, (z0 + z1) / 2);
    const prof = new THREE.Shape();
    prof.moveTo(-hw - 0.05, 0); prof.lineTo(0, ridge - eave); prof.lineTo(hw + 0.05, 0); prof.lineTo(-hw - 0.05, 0);
    const roof = new THREE.ExtrudeGeometry(prof, { depth: z1 - z0, bevelEnabled: false });
    const r = add(roof, mHouse);
    r.position.set(0, eave, z0);
    // vano de la puerta y ventana hacia el patio (sombras profundas)
    const mDark = patch(new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.4, envMapIntensity: 0.6 }), { key: 'dark', reveal: true });
    const door = add(new THREE.PlaneGeometry(1.5, 2.5), mDark, { cast: false });
    door.position.set(0.05, 1.25, z1 + 0.005);
    const win = add(new THREE.PlaneGeometry(0.8, 0.9), mDark, { cast: false });
    win.position.set(0.05, 4.6, z1 + 0.005);
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
  // --- fragmentos de muro antiguo a los lados de la puerta (piedra caliza conservada)
  {
    const mL = chukum(C.limestone, 'limestone', { tri: 1.3, normal: 2.2, mottle: 0.45, rough: 0.95 });
    const rock = (seed, w, h, d) => {
      const g = new THREE.IcosahedronGeometry(1, 4);
      const pos = g.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2.1) * Math.sin(v.z * 6.7 + seed * 0.7);
        const n2 = Math.sin(v.x * 13.0 + seed * 3.0) * Math.sin(v.y * 11.0) * 0.4;
        v.multiplyScalar(1 + 0.16 * n + 0.07 * n2);
        v.y = Math.max(v.y, -0.92);
        pos.setXYZ(i, v.x * w, v.y * h, v.z * d);
      }
      g.computeVertexNormals();
      return g;
    };
    const a = add(rock(1.3, 0.62, 1.35, 0.38), mL); a.position.set(-1.72, 1.25, -4.42); a.rotation.y = 0.12;
    const b = add(rock(4.1, 0.34, 1.25, 0.32), mL); b.position.set(1.85, 1.15, -4.45); b.rotation.y = -0.2;
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
