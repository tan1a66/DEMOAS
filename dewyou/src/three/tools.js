import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Herramientas y objetos DEWYOU modelados por código a partir de las fotos de la marca
// (Starter Pack, servicios del sitio y el Collagen Bar). Cada constructor devuelve
// { group, spinners, length } — los "spinners" giran sobre su eje Y local cuando el objeto
// se desplaza (las bolas del rodillo de microcorriente, la pelota).

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Perfil torneado a partir de puntos de control [radio, altura] (de abajo arriba)
const lathe = (ctrl, { segments = 56, samples = 90 } = {}) => {
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0.0008, p.x), p.y));
  return new THREE.LatheGeometry(pts, segments);
};

// Perfil torneado a partir de r(t), con remates redondeados en los extremos
const latheFn = (len, radiusAt, { segments = 48, samples = 70, capA = 0.06, capB = 0.06 } = {}) => {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (1 - Math.cos((Math.PI * i) / samples)) / 2;
    const y = t * len;
    let r = radiusAt(t);
    const dA = y;
    const dB = len - y;
    if (dA < capA) r *= Math.sqrt(Math.max(0, 1 - (1 - dA / capA) ** 2));
    if (dB < capB) r *= Math.sqrt(Math.max(0, 1 - (1 - dB / capB) ** 2));
    pts.push(new THREE.Vector2(Math.max(0.0008, r), y));
  }
  return new THREE.LatheGeometry(pts, segments);
};

const orient = (obj, dir) => obj.quaternion.setFromUnitVectors(UP, dir.clone().normalize());

// 1 · Gua sha de acero DEWYOU: placa alargada en ala, borde exterior convexo, interior
// cóncavo y un peine de dientes en el extremo inferior (foto "Glow on the Go").
export const buildGuaSha = (M) => {
  const outline = [
    [0.12, 1.56],
    [0.46, 1.36],
    [0.56, 0.9],
    [0.47, 0.25],
    [0.42, -0.35],
    [0.5, -0.95],
    [0.42, -1.4],
    [0.08, -1.6],
    [-0.34, -1.5],
    [-0.54, -1.12],
    [-0.36, -0.5],
    [-0.24, 0.15],
    [-0.31, 0.78],
    [-0.44, 1.24],
    [-0.22, 1.52],
  ];
  const curve = new THREE.CatmullRomCurve3(outline.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  const N = 420;
  const pts = curve.getSpacedPoints(N).map((p) => new THREE.Vector2(p.x, p.y));
  // Peine: muescas en el borde inferior izquierdo
  const teeth = 9;
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i];
    const k = smoothstep(-0.98, -1.12, v.y) * smoothstep(-0.05, -0.32, v.x);
    if (k <= 0) continue;
    const a = pts[(i + 1) % pts.length];
    const b = pts[(i - 1 + pts.length) % pts.length];
    const n = new THREE.Vector2(-(a.y - b.y), a.x - b.x).normalize();
    const phase = (Math.atan2(v.y + 1.05, v.x + 0.02) * teeth) / Math.PI;
    const notch = smoothstep(0.35, 0.6, Math.abs(Math.sin(phase * Math.PI)));
    v.addScaledVector(n, -0.05 * notch * k);
  }
  const shape = new THREE.Shape(pts);
  const depth = 0.07;
  const bevel = 0.035;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.032,
    bevelSegments: 5,
    steps: 1,
    curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  // UV planas a lo largo de la placa (para el cepillado)
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getY(i) * 0.6, pos.getX(i) * 0.6);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, M.steel));
  // Logo blanco impreso a lo largo de la placa (como en la foto), por las dos caras
  const lw = 1.62;
  const label = new THREE.PlaneGeometry(lw, lw / 6.26);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(label, M.print);
    m.position.set(0.11, 0.05, side * (depth / 2 + bevel + 0.004));
    m.rotation.set(0, side > 0 ? 0 : Math.PI, Math.PI / 2 + 0.1 * side);
    group.add(m);
  }
  return { group, spinners: [], length: 3.2, sag: 0.1 };
};

// 2 · Rodillo de microcorriente: cuerpo blanco, panel coral con botones y horquilla en Y
// con dos bolas de cromo facetadas que giran.
export const buildMicro = (M) => {
  const group = new THREE.Group();
  const spinners = [];
  const body = latheFn(
    2.05,
    (t) => 0.2 + 0.035 * Math.sin(t * Math.PI) - 0.07 * smoothstep(0.72, 1, t),
    { capA: 0.12, capB: 0.05, segments: 48 }
  );
  body.translate(0, -1.25, 0);
  group.add(new THREE.Mesh(body, M.white));

  // Panel coral ovalado con tres botones y los puntitos de nivel
  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.66, 0.1, 4, 0.08), M.coral);
  panel.position.set(0, -0.35, 0.185);
  group.add(panel);
  const btn = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24);
  btn.rotateX(Math.PI / 2);
  for (const y of [-0.55, -0.35, -0.15]) {
    const b = new THREE.Mesh(btn, M.white);
    b.position.set(0, y, 0.235);
    group.add(b);
  }
  const dot = new THREE.SphereGeometry(0.014, 10, 8);
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(dot, M.coral);
    d.position.set(0, 0.06 + i * 0.07, 0.205);
    group.add(d);
  }

  // Horquilla: dos brazos que salen del cuello
  const neckY = 0.78;
  const arm = latheFn(0.5, (t) => 0.075 - 0.02 * t, { capA: 0.02, capB: 0.04, segments: 24 });
  const ballGeo = new THREE.IcosahedronGeometry(0.2, 2);
  const axleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 10);
  for (const sgn of [-1, 1]) {
    const dir = new THREE.Vector3(sgn * 0.62, 1, 0).normalize();
    const a = new THREE.Mesh(arm, M.white);
    a.position.set(0, neckY, 0);
    orient(a, dir);
    group.add(a);
    const end = dir.clone().multiplyScalar(0.52).add(new THREE.Vector3(0, neckY, 0));
    // eje perpendicular al brazo, en el plano de la horquilla
    const axleDir = new THREE.Vector3(1, -sgn * 0.62, 0).normalize().multiplyScalar(sgn);
    const holder = new THREE.Object3D();
    holder.position.copy(end).addScaledVector(dir, 0.13);
    orient(holder, axleDir);
    const ball = new THREE.Mesh(ballGeo, M.chrome);
    holder.add(ball);
    const axle = new THREE.Mesh(axleGeo, M.alu);
    holder.add(axle);
    group.add(holder);
    spinners.push({ obj: ball, radius: 0.2 });
  }
  return { group, spinners, length: 2.6 };
};

// 3 · Pelota de masaje índigo DEWYOU
export const buildBall = (M) => {
  const group = new THREE.Group();
  const spin = new THREE.Mesh(new THREE.SphereGeometry(0.6, 64, 40), M.ball);
  spin.rotation.z = 0.25;
  group.add(spin);
  return { group, spinners: [{ obj: spin, radius: 0.6 }], length: 1.2 };
};

// 4 · Lata de vidrio con collagen matcha, tapa de aluminio y la etiqueta lila
export const buildCan = (M) => {
  const group = new THREE.Group();
  const R = 0.46;
  const H = 1.7;
  const liquid = lathe(
    [
      [0.001, 0.0],
      [R - 0.08, 0.0],
      [R - 0.01, 0.06],
      [R, 0.2],
      [R, H * 0.55],
      [R, H * 0.82],
      [R - 0.01, H * 0.86],
      [0.001, H * 0.86],
    ],
    { segments: 64, samples: 80 }
  );
  group.add(new THREE.Mesh(liquid, M.matcha));
  // Vidrio vacío por encima del líquido
  const glass = new THREE.CylinderGeometry(R + 0.004, R + 0.004, H * 0.12, 48, 1, true);
  glass.translate(0, H * 0.92, 0);
  group.add(new THREE.Mesh(glass, M.glass));
  // Cuello y tapa de aluminio
  const lid = lathe(
    [
      [R + 0.004, H * 0.97],
      [R - 0.02, H * 1.0],
      [R - 0.05, H * 1.02],
      [R - 0.04, H * 1.045],
      [R - 0.07, H * 1.05],
      [0.001, H * 1.04],
    ],
    { segments: 64, samples: 40 }
  );
  group.add(new THREE.Mesh(lid, M.alu));
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.025, 0.26, 2, 0.01), M.alu);
  tab.position.set(0, H * 1.055, 0.08);
  group.add(tab);
  // Etiqueta redonda
  const sticker = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.62, 48, 1, true, -0.62, 1.24), M.sticker);
  sticker.position.y = H * 0.45;
  group.add(sticker);
  group.children.forEach((c) => (c.position.y -= H * 0.52));
  return { group, spinners: [], length: 1.9 };
};

// 5 · Sérum en frasco de vidrio verde con gotero blanco
export const buildSerum = (M) => {
  const group = new THREE.Group();
  const bottle = lathe(
    [
      [0.001, 0.0],
      [0.3, 0.0],
      [0.36, 0.05],
      [0.37, 0.25],
      [0.37, 0.7],
      [0.33, 0.86],
      [0.2, 0.96],
      [0.14, 1.0],
      [0.14, 1.08],
      [0.001, 1.08],
    ],
    { segments: 64, samples: 90 }
  );
  group.add(new THREE.Mesh(bottle, M.green));
  const collar = lathe(
    [
      [0.17, 1.04],
      [0.18, 1.08],
      [0.18, 1.24],
      [0.15, 1.28],
      [0.001, 1.28],
    ],
    { segments: 40, samples: 30 }
  );
  group.add(new THREE.Mesh(collar, M.white));
  const bulb = latheFn(0.5, (t) => 0.115 + 0.035 * Math.sin(t * Math.PI * 0.85) + 0.0012 * Math.sin(t * 22), { capA: 0.02, capB: 0.12, segments: 32 });
  bulb.translate(0, 1.26, 0);
  group.add(new THREE.Mesh(bulb, M.rubber));
  group.children.forEach((c) => (c.position.y -= 0.85));
  return { group, spinners: [], length: 1.76 };
};

// 6 · Esmalte de uñas lila con tapa ciruela ("Nails on point")
export const buildPolish = (M) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.68, 0.56, 6, 0.2), M.lilac);
  body.position.y = -0.3;
  group.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 32), M.lilac);
  neck.position.y = 0.08;
  group.add(neck);
  const cap = latheFn(0.86, (t) => 0.16 - 0.025 * t, { capA: 0.02, capB: 0.05, segments: 40 });
  cap.translate(0, 0.1, 0);
  group.add(new THREE.Mesh(cap, M.plum));
  return { group, spinners: [], length: 1.4 };
};

// 7 · Bálsamo de labios en tubo (extremo aplastado) con tapa morada
export const buildTube = (M) => {
  const group = new THREE.Group();
  const geo = latheFn(1.5, (t) => 0.2 + 0.025 * Math.sin(t * Math.PI), { capA: 0.03, capB: 0.02, segments: 48, samples: 80 });
  // Aplasta el tubo hacia el extremo superior (el sellado)
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = smoothstep(0.55, 1.5, p.getY(i));
    p.setX(i, p.getX(i) * (1 + 0.32 * k));
    p.setZ(i, p.getZ(i) * (1 - 0.86 * k));
  }
  geo.computeVertexNormals();
  geo.translate(0, -0.55, 0);
  group.add(new THREE.Mesh(geo, M.purple));
  const crimp = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.12, 0.06, 2, 0.02), M.purple);
  crimp.position.y = 0.97;
  group.add(crimp);
  const cap = latheFn(0.42, () => 0.215, { capA: 0.08, capB: 0.01, segments: 48 });
  cap.translate(0, -0.97, 0);
  group.add(new THREE.Mesh(cap, M.purpleDeep));
  return { group, spinners: [], length: 2.1 };
};

// 8 · Gota "dew": la gota de rocío iridiscente del nombre
export const buildDrop = (M) => {
  // Lágrima clásica: r = sen θ · sen(θ/2)^m, y = cos θ (de la base redonda a la punta)
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI * (1 - i / N);
    const r = 0.56 * Math.sin(th) * Math.sin(th / 2) ** 1.25;
    pts.push(new THREE.Vector2(Math.max(0.0008, r), Math.cos(th) * 0.68));
  }
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.translate(0, -0.08, 0);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, M.drop));
  return { group, spinners: [], length: 1.3 };
};

export const TOOL_BUILDERS = {
  guasha: buildGuaSha,
  micro: buildMicro,
  ball: buildBall,
  can: buildCan,
  serum: buildSerum,
  polish: buildPolish,
  tube: buildTube,
  drop: buildDrop,
};
