import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plane, box } from './materials.js';
import { painting } from './salon.js';

// EL RESERVADO: sala privada junto al salón. Muro de mampostería con
// nichos iluminados, una gran mesa redonda de nogal con ocho sillas de piel
// azul acolchada, dos lámparas de cúpula negra con el interior naranja y la
// obra abstracta en el muro de enlucido. Al norte, la puerta de la escalera.

export const RESERVADO = { x0: -8.8, x1: -3.02, z0: -16.8, z1: -23.6, h: 3.4 };
export const TABLE_R = { x: -5.85, z: -20.2, r: 0.82 };
export const STAIR_DOOR = { x0: -7.6, x1: -6.4 };

export function buildReservado(m, assets, q) {
  const g = new THREE.Group();
  g.name = 'reservado';
  const R = RESERVADO;
  const W = R.x1 - R.x0;
  const L = R.z0 - R.z1;
  const xc = (R.x0 + R.x1) / 2;
  const zc = (R.z0 + R.z1) / 2;

  const floor = plane(W, L, m.floorDark, 2.6);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(xc, 0, zc);
  g.add(floor);
  const ceil = plane(W, L, m.ceiling, 3);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(xc, R.h, zc);
  g.add(ceil);

  // Muro de piedra (oeste) con tres nichos de madera encendidos.
  const west = plane(L, R.h, m.stone, 1.4);
  west.rotation.y = Math.PI / 2;
  west.position.set(R.x0, R.h / 2, zc);
  g.add(west);
  const objs = [];
  [-18.3, -20.2, -22.1].forEach((z, i) => {
    const niche = box(0.24, 0.5, 1.25, m.warmWood, 1);
    niche.position.set(R.x0 + 0.1, 1.65, z);
    g.add(niche);
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.38),
      new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.8, emissive: '#ff9a4a', emissiveIntensity: 0.25 }),
    );
    inner.rotation.y = Math.PI / 2;
    inner.position.set(R.x0 + 0.225, 1.65, z);
    g.add(inner);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.012), m.bulb);
    led.rotation.y = Math.PI / 2;
    led.position.set(R.x0 + 0.236, 1.83, z);
    g.add(led);
    // objetos: jarrones de madera clara o candeleros negros
    for (let k = 0; k < 3; k++) {
      const tall = 0.14 + ((i + k) % 3) * 0.05;
      const o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, tall, 14), i === 1 ? m.blackMetal : m.travertine);
      o.position.set(R.x0 + 0.12, 1.43 + tall / 2, z - 0.32 + k * 0.32);
      o.castShadow = true;
      objs.push(o);
      g.add(o);
    }
  });

  // Muro sur: enlucido con la obra abstracta.
  const south = plane(W, R.h, m.plaster, 1.6);
  south.rotation.y = Math.PI;
  south.position.set(xc, R.h / 2, R.z0);
  g.add(south);
  if (assets.cuadroReservado) g.add(painting(assets.cuadroReservado, 1.2, 1.55, m, { x: -6.6, y: 1.85, z: R.z0 - 0.04, ry: Math.PI }));

  // Muro norte: enlucido con el hueco de la escalera.
  for (const [x0, x1] of [
    [R.x0, STAIR_DOOR.x0],
    [STAIR_DOOR.x1, R.x1],
  ]) {
    const p = plane(x1 - x0, R.h, m.plaster, 1.6);
    p.position.set((x0 + x1) / 2, R.h / 2, R.z1);
    g.add(p);
  }
  const lint = plane(STAIR_DOOR.x1 - STAIR_DOOR.x0, R.h - 2.5, m.plaster, 1.6);
  lint.position.set((STAIR_DOOR.x0 + STAIR_DOOR.x1) / 2, (R.h + 2.5) / 2, R.z1);
  g.add(lint);

  // Muro este (hacia el salón): enlucido con la puerta.
  const doorZ = -20.75;
  for (const [z0, z1] of [
    [R.z0, doorZ + 0.6],
    [doorZ - 0.6, R.z1],
  ]) {
    const p = plane(z0 - z1, R.h, m.plaster, 1.6);
    p.rotation.y = -Math.PI / 2;
    p.position.set(R.x1, R.h / 2, (z0 + z1) / 2);
    g.add(p);
  }
  const lintE = plane(1.2, R.h - 2.55, m.plaster, 1.6);
  lintE.rotation.y = -Math.PI / 2;
  lintE.position.set(R.x1, (R.h + 2.55) / 2, doorZ);
  g.add(lintE);

  // Mesa redonda de nogal, ocho sillas, servicio.
  g.add(roundTable(m, q));

  // Lámparas de cúpula: negro brillante por fuera, plisado naranja por dentro.
  const lights = new THREE.Group();
  const domes = [
    [-5.45, 2.45, -19.85, 0.42],
    [-6.55, 2.75, -20.75, 0.32],
  ];
  for (const [x, y, z, r] of domes) {
    const outer = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.domeBlack);
    outer.position.set(x, y, z);
    outer.castShadow = true;
    const inner = new THREE.Mesh(new THREE.SphereGeometry(r * 0.97, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.domeInner);
    inner.position.set(x, y, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 48), m.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, y, z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 32), m.bulb);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, y + r * 0.35, z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, R.h - y - r, 8), m.brass);
    rod.position.set(x, (R.h + y + r) / 2, z);
    g.add(outer, inner, rim, disc, rod);
    const spot = new THREE.SpotLight('#ffb26a', 8, 6, 1.0, 0.8, 1.6);
    spot.position.set(x, y + 0.05, z);
    spot.target.position.set(x, 0, z);
    if (q.tier === 'high' && x === domes[0][0]) {
      spot.castShadow = true;
      spot.shadow.mapSize.setScalar(1024);
      spot.shadow.bias = -0.0006;
    }
    lights.add(spot, spot.target);
  }
  // relleno de los nichos
  const nicheL = new THREE.PointLight('#ffa65a', 2.4, 3.5, 2);
  nicheL.position.set(R.x0 + 0.6, 1.8, -20.2);
  lights.add(nicheL);
  g.add(lights);

  return { group: g, lights, update() {} };
}

function roundTable(m, q) {
  const grp = new THREE.Group();
  const T = TABLE_R;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, 0.045, 64), m.walnut);
  top.position.set(T.x, 0.76, T.z);
  top.castShadow = top.receiveShadow = true;
  const base = new THREE.Mesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.12, 0.2, 0.7, 24).translate(0, 0.38, 0),
      new THREE.CylinderGeometry(0.42, 0.45, 0.04, 32).translate(0, 0.02, 0),
    ]),
    m.walnut,
  );
  base.position.set(T.x, 0, T.z);
  base.castShadow = true;
  grp.add(top, base);

  const n = 8;
  const seatGeo = new THREE.BoxGeometry(0.46, 0.08, 0.44).translate(0, 0.47, 0);
  const backGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.42, 20, 1, true, -1.2, 2.4).rotateY(Math.PI).translate(0, 0.73, 0.06);
  const legsGeo = mergeGeometries(
    [
      [-0.19, -0.18],
      [0.19, -0.18],
      [-0.19, 0.18],
      [0.19, 0.18],
    ].map(([x, z]) => new THREE.CylinderGeometry(0.016, 0.012, 0.44, 8).translate(x, 0.22, z)),
  );
  const back = m.quilt.clone();
  back.side = THREE.DoubleSide;
  const seats = new THREE.InstancedMesh(seatGeo, m.quilt, n);
  const backs = new THREE.InstancedMesh(backGeo, back, n);
  const legs = new THREE.InstancedMesh(legsGeo, m.warmWood, n);
  const plates = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.1, 0.014, 32), m.plate, n);
  const glassGeo = new THREE.LatheGeometry(
    [
      [0.036, 0.0],
      [0.036, 0.004],
      [0.006, 0.01],
      [0.004, 0.1],
      [0.012, 0.11],
      [0.034, 0.135],
      [0.043, 0.17],
      [0.038, 0.21],
      [0.031, 0.235],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    20,
  );
  const glasses = new THREE.InstancedMesh(glassGeo, m.glass, n * 2);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    Q.setFromAxisAngle(Y, Math.atan2(-cx, -cz) + (Math.random() - 0.5) * 0.15);
    M.compose(P.set(T.x + cx * (T.r + 0.32), 0, T.z + cz * (T.r + 0.32)), Q, S);
    seats.setMatrixAt(i, M);
    backs.setMatrixAt(i, M);
    legs.setMatrixAt(i, M);
    M.compose(P.set(T.x + cx * (T.r - 0.2), 0.788, T.z + cz * (T.r - 0.2)), Q.identity(), S);
    plates.setMatrixAt(i, M);
    for (let k = 0; k < 2; k++) {
      const b = a + 0.22 + k * 0.1;
      M.compose(P.set(T.x + Math.cos(b) * (T.r - 0.38 + k * 0.06), 0.782, T.z + Math.sin(b) * (T.r - 0.38 + k * 0.06)), Q, S);
      glasses.setMatrixAt(i * 2 + k, M);
    }
  }
  for (const im of [seats, backs, legs]) {
    im.castShadow = true;
    im.receiveShadow = true;
  }
  grp.add(seats, backs, legs, plates, glasses);
  // centro de mesa: planta
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.12, 24), m.pot);
  pot.position.set(T.x, 0.84, T.z);
  const leaves = new THREE.Mesh(
    mergeGeometries(
      Array.from({ length: 11 }, (_, k) => {
        const a = (k / 11) * Math.PI * 2;
        return new THREE.SphereGeometry(0.06, 8, 6)
          .scale(0.5, 1, 0.16)
          .rotateZ(0.7)
          .rotateY(a)
          .translate(Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05);
      }),
    ),
    m.leaf,
  );
  leaves.position.set(T.x, 0.86, T.z);
  leaves.castShadow = true;
  grp.add(pot, leaves);
  return grp;
}
