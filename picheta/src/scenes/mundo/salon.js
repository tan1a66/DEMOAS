import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plane, box } from './materials.js';

// EL SALÓN de Picheta: una galería larga bajo una bóveda de cuerdas de
// henequén, con cornisas de madera oscura; a la derecha la banqueta corrida
// de piel verde acolchada y las mesas de travertino; a la izquierda las
// ventanas por las que entra el sol de la tarde; al fondo el muro de piedra
// con la firma de Picheta. Medidas en metros: x a lo ancho, z a lo largo
// (0 = puerta, -22 = muro del fondo).

export const SALON = { x0: -2.6, x1: 2.6, z0: 0.6, z1: -22, cornice: 3.05, apex: 3.85, ceiling: 4.3 };
export const SUN_DIR = new THREE.Vector3(0.82, -0.48, -0.38).normalize(); // sol del poniente: hacia dónde viaja la luz

const WINDOWS = [-3.9, -10.1, -16.3]; // centros (z) de las ventanas de la izquierda
const WIN = { w: 1.35, sill: 0.55, head: 2.8, depth: 0.42 };
export const DOOR_RESERVADO = { z: -20.75, w: 1.2, head: 2.55 }; // puerta al reservado, al fondo a la izquierda

export function buildSalon(m, assets, q) {
  const g = new THREE.Group();
  g.name = 'salon';
  const S = SALON;
  const L = S.z0 - S.z1;
  const zc = (S.z0 + S.z1) / 2;

  // ---------------------------------------------------------------- suelo
  const floor = plane(S.x1 - S.x0, L, m.floor, 2.6);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zc);
  g.add(floor);
  for (const x of [-0.98, 0.98]) {
    // azulejo: u a lo largo de la banda (16 piezas cada 1,2 m), v a lo ancho
    const bg = new THREE.PlaneGeometry(0.3, L);
    const uv = bg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * (L / 1.2), uv.getX(i));
    const band = new THREE.Mesh(bg, m.tiles);
    band.receiveShadow = true;
    band.rotation.x = -Math.PI / 2;
    band.position.set(x, 0.004, zc);
    g.add(band);
  }

  // ---------------------------------------------------------------- techo y bóveda de cuerdas
  const ceil = plane(S.x1 - S.x0, L, m.ceiling, 4);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, S.ceiling, zc);
  g.add(ceil);

  const A = 2.42;
  const B = S.apex - S.cornice;
  class Arc extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      const a = Math.PI * t;
      return out.set(-A * Math.cos(a), S.cornice + B * Math.sin(a), 0);
    }
  }
  const arc = new Arc();
  const arcLen = arc.getLength();
  const ropeGeo = new THREE.TubeGeometry(arc, q.tier === 'low' ? 28 : 48, 0.031, 7, false);
  {
    // la torsión de la cuerda repite cada 16 cm
    const uv = ropeGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (arcLen / 0.16));
  }
  const pitch = 0.084;
  const n = Math.floor((S.z0 - 0.2 - (S.z1 + 0.15)) / pitch);
  const ropes = new THREE.InstancedMesh(ropeGeo, m.rope, n);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const z = S.z1 + 0.15 + i * pitch;
    // leve irregularidad: cuerdas reales, no un patrón perfecto
    Q.setFromAxisAngle(V.set(0, 0, 1), (Math.random() - 0.5) * 0.004);
    M.compose(V.set(0, (Math.random() - 0.5) * 0.008, z), Q, one);
    ropes.setMatrixAt(i, M);
  }
  ropes.castShadow = false;
  ropes.receiveShadow = true;
  g.add(ropes);

  // Costillas de madera oscura que dividen la bóveda en tramos.
  const ribGeo = new THREE.TubeGeometry(arc, 48, 0.055, 8, false);
  for (let z = S.z1 + 3.6; z < S.z0 - 1; z += 3.65) {
    const rib = new THREE.Mesh(ribGeo, m.darkWood);
    rib.position.z = z;
    g.add(rib);
  }

  // Cornisas de madera a lo largo de la bóveda.
  for (const s of [-1, 1]) {
    const c = box(0.34, 0.16, L, m.darkWood, 2);
    c.position.set(s * (A + 0.02), S.cornice - 0.04, zc);
    g.add(c);
  }

  // ---------------------------------------------------------------- muro izquierdo con ventanas
  // Muro grueso (las ventanas tienen derrame) hecho de piezas alrededor de los huecos.
  const wx = S.x0 - WIN.depth / 2;
  const wallPieces = [];
  let z = S.z0;
  const openings = [...WINDOWS.map((c) => ({ c, w: WIN.w, sill: WIN.sill, head: WIN.head })), { c: DOOR_RESERVADO.z, w: DOOR_RESERVADO.w, sill: 0, head: DOOR_RESERVADO.head }];
  for (const o of openings.sort((a, b) => b.c - a.c)) {
    const zA = o.c + o.w / 2;
    const zB = o.c - o.w / 2;
    wallPieces.push([z, zA, 0, S.cornice]); // macizo entre huecos
    if (o.sill > 0) wallPieces.push([zA, zB, 0, o.sill]); // antepecho
    wallPieces.push([zA, zB, o.head, S.cornice]); // dintel
    z = zB;
  }
  wallPieces.push([z, S.z1, 0, S.cornice]);
  for (const [za, zb, y0, y1] of wallPieces) {
    const len = za - zb;
    if (len < 0.01) continue;
    const b = box(WIN.depth, y1 - y0, len, m.plaster, 1.6);
    b.position.set(wx, (y0 + y1) / 2, (za + zb) / 2);
    g.add(b);
  }
  // Por encima de la cornisa el muro sigue hasta el techo (la bóveda es un espacio cerrado).
  for (const sx of [S.x0 - WIN.depth / 2, S.x1 + 0.1]) {
    const top = box(sx < 0 ? WIN.depth : 0.2, S.ceiling - S.cornice + 0.1, L, m.plasterDark, 1.6);
    top.position.set(sx, (S.ceiling + S.cornice) / 2, zc);
    g.add(top);
  }
  // Ventanas: marco de madera, cristal casi invisible y la tarde dorada detrás.
  const outside = [];
  for (const c of WINDOWS) {
    const glowP = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w * 2.2, (WIN.head - WIN.sill) * 1.7), m.window);
    glowP.rotation.y = Math.PI / 2;
    glowP.position.set(S.x0 - WIN.depth - 0.6, (WIN.sill + WIN.head) / 2 + 0.2, c);
    g.add(glowP);
    outside.push(glowP);
    for (const s of [-1, 1]) {
      const jamb = box(0.06, WIN.head - WIN.sill, 0.06, m.darkWood);
      jamb.position.set(S.x0 - WIN.depth + 0.08, (WIN.sill + WIN.head) / 2, c + s * (WIN.w / 2 - 0.03));
      g.add(jamb);
    }
    const mull = box(0.05, 0.05, WIN.w, m.darkWood);
    mull.position.set(S.x0 - WIN.depth + 0.08, WIN.sill + (WIN.head - WIN.sill) * 0.66, c);
    g.add(mull);
  }

  // Haces de sol: prisma entre el hueco de cada ventana y su mancha en el suelo.
  for (const c of WINDOWS) g.add(sunShaft(c, m.shaft));

  // ---------------------------------------------------------------- muro derecho
  const right = plane(L, S.cornice, m.plaster, 1.6);
  right.rotation.y = -Math.PI / 2;
  right.position.set(S.x1, S.cornice / 2, zc);
  g.add(right);
  // Paños de piedra enmarcados en madera oscura, como en el salón real.
  for (let zz = S.z0 - 3.0; zz > S.z1 + 1.5; zz -= 4.4) {
    const p = box(0.06, 1.85, 0.82, m.stone, 1.4);
    p.position.set(S.x1 - 0.03, 2.08, zz);
    g.add(p);
    for (const s of [-1, 1]) {
      const post = box(0.1, 1.95, 0.07, m.darkWood);
      post.position.set(S.x1 - 0.05, 2.08, zz + s * 0.45);
      g.add(post);
    }
  }
  // Banqueta corrida de piel verde.
  const benchLen = S.z0 - 1.4 - (S.z1 + 0.6);
  const benchZ = (S.z0 - 1.4 + S.z1 + 0.6) / 2;
  g.add(bench(benchLen, m, { x: S.x1, z: benchZ, axis: 'z' }));
  // Y la del fondo, en U.
  g.add(bench(S.x1 - S.x0 - 0.6, m, { x: -0.3, z: S.z1, axis: 'x' }));

  // ---------------------------------------------------------------- muro del fondo: piedra y firma
  const end = plane(S.x1 - S.x0, S.ceiling, m.stone, 1.5);
  end.position.set(0, S.ceiling / 2, S.z1);
  g.add(end);
  if (assets.signature) {
    const sig = signature(assets.signature, m);
    sig.position.set(0.05, 2.12, S.z1 + 0.03);
    g.add(sig);
  }
  // Lámpara colgante sobre la firma.
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), m.blackMetal);
  cord.position.set(0, S.apex - 0.55, S.z1 + 0.9);
  g.add(cord);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), m.bulb);
  bulb.position.set(0, S.apex - 1.2, S.z1 + 0.9);
  g.add(bulb);

  // ---------------------------------------------------------------- muro de la entrada (con la puerta)
  for (const [x0, x1] of [
    [S.x0, -0.8],
    [0.8, S.x1],
  ]) {
    const p = plane(x1 - x0, S.cornice, m.plaster, 1.6);
    p.rotation.y = Math.PI;
    p.position.set((x0 + x1) / 2, S.cornice / 2, S.z0);
    g.add(p);
  }
  const lintel = plane(1.6, S.cornice - 2.6, m.plaster, 1.6);
  lintel.rotation.y = Math.PI;
  lintel.position.set(0, (S.cornice + 2.6) / 2, S.z0);
  g.add(lintel);
  const endLow = plane(S.x1 - S.x0, S.ceiling - S.cornice, m.ceiling, 2);
  endLow.rotation.y = Math.PI;
  endLow.position.set(0, (S.ceiling + S.cornice) / 2, S.z0);
  g.add(endLow);

  // ---------------------------------------------------------------- cuadros (obras reales del salón)
  if (assets.cuadroSalon) {
    // entre los paños de piedra (que están cada 4,4 m desde z = -2,4)
    g.add(painting(assets.cuadroSalon, 1.5, 1.07, m, { x: S.x1 - 0.06, y: 2.05, z: -9.0, ry: -Math.PI / 2 }));
    g.add(painting(assets.cuadroSalon, 1.5, 1.07, m, { x: S.x1 - 0.06, y: 2.05, z: -17.8, ry: -Math.PI / 2, flip: true }));
  }
  if (assets.cuadroReservado) {
    g.add(painting(assets.cuadroReservado, 0.95, 1.22, m, { x: S.x0 + 0.03, y: 1.75, z: -7.0, ry: Math.PI / 2 }));
    g.add(painting(assets.cuadroReservado, 0.95, 1.22, m, { x: S.x0 + 0.03, y: 1.75, z: -13.2, ry: Math.PI / 2, flip: true }));
  }

  // ---------------------------------------------------------------- mesas, sillas, copas
  const tables = [];
  for (let i = 0; i < 12; i++) tables.push({ x: 1.62, z: -2.0 - i * 1.62, w: 0.72, d: 1.12, chairs: [[-0.62, -0.28, Math.PI / 2], [-0.62, 0.28, Math.PI / 2]] });
  for (const zz of [-1.7, -7.0, -13.2, -18.6])
    tables.push({ x: -1.72, z: zz, w: 0.7, d: 0.7, chairs: [[0, -0.56, 0], [0, 0.56, Math.PI]] });
  g.add(furniture(tables, m, q));

  // ---------------------------------------------------------------- luces
  const lights = new THREE.Group();
  // Sol de la tarde por las ventanas, con sombras (las ventanas dibujan franjas en el suelo).
  const sun = new THREE.DirectionalLight('#ffc58a', 20);
  sun.position.set(0, 0, zc - 2).addScaledVector(SUN_DIR, -18);
  sun.target.position.set(0, 0, zc - 2);
  if (q.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(q.shadows);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8, near: 2, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
  }
  lights.add(sun, sun.target);
  // Luz cálida escondida sobre las cornisas: ilumina la bóveda desde abajo.
  const cove = [];
  for (let zz = S.z0 - 2; zz > S.z1; zz -= q.tier === 'low' ? 8.8 : 6.6)
    for (const s of [-1, 1]) {
      const p = new THREE.PointLight('#ffad62', 7.5, 7.5, 2);
      p.position.set(s * 2.05, S.cornice + 0.12, zz);
      lights.add(p);
      cove.push(p);
    }
  const pend = new THREE.PointLight('#ffb36e', 10, 9, 2);
  pend.position.copy(bulb.position).add(new THREE.Vector3(0, -0.08, 0));
  lights.add(pend);
  g.add(lights);

  return {
    group: g,
    sun,
    lights,
    update(t) {
      m.shaft.uniforms.uTime.value = t;
    },
  };
}

// ------------------------------------------------------------------ piezas

function sunShaft(zc, mat) {
  const S = SALON;
  const x = S.x0 - WIN.depth + 0.1;
  const corners = [
    [x, WIN.sill, zc - WIN.w / 2],
    [x, WIN.sill, zc + WIN.w / 2],
    [x, WIN.head, zc + WIN.w / 2],
    [x, WIN.head, zc - WIN.w / 2],
  ].map((p) => new THREE.Vector3(...p));
  const floorPts = corners.map((p) => p.clone().addScaledVector(SUN_DIR, -p.y / SUN_DIR.y));
  const pos = [];
  const aT = [];
  const aE = [];
  // 4 caras laterales del prisma (ventana → suelo).
  for (let k = 0; k < 4; k++) {
    const a = corners[k];
    const b = corners[(k + 1) % 4];
    const c = floorPts[(k + 1) % 4];
    const d = floorPts[k];
    const quad = [
      [a, 0, 0],
      [b, 0, 1],
      [c, 1, 1],
      [a, 0, 0],
      [c, 1, 1],
      [d, 1, 0],
    ];
    for (const [p, t, e] of quad) {
      pos.push(p.x, p.y, p.z);
      aT.push(t);
      aE.push(e, t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  geo.setAttribute('aE', new THREE.Float32BufferAttribute(aE, 2));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  return mesh;
}

// Banqueta de piel acolchada: asiento, respaldo en canales y repisa de madera encima.
export function bench(len, m, { x, z, axis }) {
  const grp = new THREE.Group();
  const seat = box(0.56, 0.4, len, m.leatherPlain);
  seat.position.set(-0.28, 0.2, 0);
  const cushion = box(0.56, 0.08, len, m.leatherPlain);
  cushion.position.set(-0.28, 0.44, 0);
  const back = box(0.16, 0.62, len, m.leather, 0.88);
  back.position.set(-0.08, 0.8, 0);
  back.rotation.z = -0.08;
  const ledge = box(0.18, 0.045, len, m.warmWood, 2);
  ledge.position.set(-0.09, 1.14, 0);
  grp.add(seat, cushion, back, ledge);
  if (axis === 'z') grp.position.set(x, 0, z);
  else {
    grp.rotation.y = -Math.PI / 2;
    grp.position.set(x, 0, z);
  }
  return grp;
}

export function painting(texture, w, h, m, { x, y, z, ry, flip = false }) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  if (flip) canvas.scale.x = -1;
  canvas.position.z = 0.032;
  canvas.receiveShadow = true;
  const frame = box(w + 0.03, h + 0.03, 0.06, m.napkin);
  frame.position.z = 0.0;
  grp.add(frame, canvas);
  grp.position.set(x, y, z);
  grp.rotation.y = ry;
  return grp;
}

// "Picheta" en alambre de bronce sobre la piedra (con su sombra suave).
export function signature(texture, m) {
  const grp = new THREE.Group();
  const w = 1.7;
  const h = w * 0.36;
  const metal = new THREE.MeshStandardMaterial({ color: '#2b1d14', metalness: 0.85, roughness: 0.4, map: texture, alphaMap: texture, transparent: true, alphaTest: 0.35 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), metal);
  front.position.z = 0.02;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: '#000', alphaMap: texture, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.position.set(0.02, -0.03, 0.002);
  grp.add(shadow, front);
  return grp;
}

// Mesas de travertino con pie negro, sillas de piel azul acolchada, copas,
// platos, servilletas y una planta: todo instanciado (una llamada por pieza).
export function furniture(tables, m, q, mats = {}) {
  const grp = new THREE.Group();
  const M = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const Sc = new THREE.Vector3(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0);

  // mesas
  const top = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1), mats.top ?? m.travertine, tables.length);
  const legGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.04, 0.04, 0.72, 12).translate(0, 0.37, 0),
    new THREE.CylinderGeometry(0.24, 0.26, 0.025, 28).translate(0, 0.012, 0),
  ]);
  const leg = new THREE.InstancedMesh(legGeo, m.blackMetal, tables.length);
  tables.forEach((t, i) => {
    M.compose(P.set(t.x, 0.76, t.z), Q.identity(), Sc.set(t.w, 1, t.d));
    top.setMatrixAt(i, M);
    M.compose(P.set(t.x, 0, t.z), Q.identity(), Sc.set(1, 1, 1));
    leg.setMatrixAt(i, M);
  });
  for (const im of [top, leg]) {
    im.castShadow = true;
    im.receiveShadow = true;
    grp.add(im);
  }

  // sillas: asiento y respaldo curvo acolchados, patas de madera
  const seats = [];
  tables.forEach((t) => t.chairs.forEach(([dx, dz, ry]) => seats.push({ x: t.x + dx, z: t.z + dz, ry, t })));
  const seatGeo = new THREE.BoxGeometry(0.46, 0.08, 0.44).translate(0, 0.47, 0);
  const backGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 20, 1, true, -1.15, 2.3)
    .rotateY(Math.PI)
    .translate(0, 0.72, 0.06);
  const legsGeo = mergeGeometries(
    [
      [-0.19, -0.18],
      [0.19, -0.18],
      [-0.19, 0.18],
      [0.19, 0.18],
    ].map(([x, z]) => new THREE.CylinderGeometry(0.016, 0.012, 0.44, 8).translate(x, 0.22, z)),
  );
  const seatIM = new THREE.InstancedMesh(seatGeo, mats.chair ?? m.quilt, seats.length);
  const backMat = (mats.chair ?? m.quilt).clone();
  backMat.side = THREE.DoubleSide;
  const backIM = new THREE.InstancedMesh(backGeo, backMat, seats.length);
  const legsIM = new THREE.InstancedMesh(legsGeo, mats.legs ?? m.warmWood, seats.length);
  seats.forEach((s, i) => {
    // ligera variación: sillas colocadas a mano
    Q.setFromAxisAngle(Y, s.ry + (Math.random() - 0.5) * 0.12);
    M.compose(P.set(s.x + (Math.random() - 0.5) * 0.04, 0, s.z), Q, Sc.set(1, 1, 1));
    seatIM.setMatrixAt(i, M);
    backIM.setMatrixAt(i, M);
    legsIM.setMatrixAt(i, M);
  });
  for (const im of [seatIM, backIM, legsIM]) {
    im.castShadow = true;
    im.receiveShadow = true;
    grp.add(im);
  }

  // servicio: plato, servilleta y copa delante de cada silla
  const plateIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.11, 0.014, 32), m.plate, seats.length);
  const napIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.008, 0.21), m.napkin, seats.length);
  const glassGeo = new THREE.LatheGeometry(
    [
      [0.0, 0.0],
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
    q.tier === 'low' ? 12 : 22,
  );
  const glassIM = new THREE.InstancedMesh(glassGeo, m.glass, seats.length);
  seats.forEach((s, i) => {
    // hacia el centro de la mesa desde la silla
    const dx = s.t.x - s.x;
    const dz = s.t.z - s.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const px = s.x + ux * 0.34;
    const pz = s.z + uz * 0.34;
    Q.setFromAxisAngle(Y, Math.atan2(ux, uz));
    M.compose(P.set(px, 0.787, pz), Q, Sc.set(1, 1, 1));
    plateIM.setMatrixAt(i, M);
    M.compose(P.set(px + uz * 0.19, 0.784, pz - ux * 0.19), Q, Sc.set(1, 1, 1));
    napIM.setMatrixAt(i, M);
    M.compose(P.set(px + ux * 0.16 - uz * 0.14, 0.78, pz + uz * 0.16 + ux * 0.14), Q.identity(), Sc.set(1, 1, 1));
    glassIM.setMatrixAt(i, M);
  });
  plateIM.receiveShadow = napIM.receiveShadow = true;
  plateIM.castShadow = glassIM.castShadow = false;
  grp.add(plateIM, napIM, glassIM);

  // una planta pequeña en cada mesa
  const leafGeo = mergeGeometries(
    Array.from({ length: 7 }, (_, k) => {
      const a = (k / 7) * Math.PI * 2;
      return new THREE.SphereGeometry(0.035, 8, 6)
        .scale(0.45, 1.2, 0.18)
        .rotateZ(0.5)
        .rotateY(a)
        .translate(Math.cos(a) * 0.02, 0.11, Math.sin(a) * 0.02);
    }),
  );
  const potGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.07, 16).translate(0, 0.035, 0);
  const leafIM = new THREE.InstancedMesh(leafGeo, m.leaf, tables.length);
  const potIM = new THREE.InstancedMesh(potGeo, m.pot, tables.length);
  tables.forEach((t, i) => {
    M.compose(P.set(t.x + 0.12, 0.78, t.z), Q.setFromAxisAngle(Y, i), Sc.set(1, 1, 1));
    leafIM.setMatrixAt(i, M);
    potIM.setMatrixAt(i, M);
  });
  leafIM.castShadow = potIM.castShadow = true;
  grp.add(leafIM, potIM);
  return grp;
}
