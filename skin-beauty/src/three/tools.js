import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Herramientas de maderoterapia modeladas por código a partir de las fotos de referencia.
// Cada constructor devuelve { group, spinners } — los "spinners" son los discos/cuentas
// que giran alrededor de su eje (Y local) cuando la herramienta se desplaza.

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Perfil torneado a partir de puntos de control [radio, altura] (de abajo arriba).
const lathe = (ctrl, { segments = 56, samples = 90 } = {}) => {
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0.0008, p.x), p.y));
  return new THREE.LatheGeometry(pts, segments);
};

// Perfil torneado a partir de una función r(t), con remates redondeados en los extremos.
const latheFn = (len, radiusAt, { segments = 48, samples = 70, capA = 0.06, capB = 0.06 } = {}) => {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (1 - Math.cos((Math.PI * i) / samples)) / 2; // más puntos cerca de los extremos
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

// Reescala las UV planas de una geometría extruida para que la veta corra a lo largo de Y.
const fitUV = (geo, su = 0.55, sv = 1, ou = 0, ov = 0) => {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = (pos.getX(i) - min.x) / (max.x - min.x || 1);
    const y = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    uv.setXY(i, ou + x * su, ov + y * sv);
  }
  uv.needsUpdate = true;
  return geo;
};

const handleGeo = (len = 0.9, grooves = true, thick = 1) =>
  latheFn(
    len,
    (t) => {
      let r = (0.092 + 0.03 * Math.sin(t * Math.PI * 0.85)) * thick;
      if (grooves) {
        for (const g of [0.6, 0.66, 0.72, 0.78]) r -= 0.008 * Math.exp(-((t - g) ** 2) / 0.00009);
      }
      return r;
    },
    { capA: 0.02, capB: 0.09 }
  );

// Disco dentado: dientes redondeados (sharp=false) o cuadrados (sharp=true).
const gearGeo = (R, depth, teeth, thickness, sharp) => {
  const s = new THREE.Shape();
  const N = teeth * 26;
  const [t0, t1] = sharp ? [0.32, 0.37] : [0.24, 0.44];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const f = ((a * teeth) / (Math.PI * 2)) % 1;
    const c = Math.abs(f - 0.5);
    const r = R - depth * smoothstep(t0, t1, c);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: sharp ? 0.02 : 0.03,
    bevelSize: sharp ? 0.018 : 0.026,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.center();
  geo.rotateX(Math.PI / 2);
  fitUV(geo, 0.4, 0.4);
  return geo;
};

const orient = (obj, dir) => obj.quaternion.setFromUnitVectors(UP, dir.clone().normalize());

// 1 · Rodillo curvo con discos de engranaje
export const buildCurvedRoller = (M) => {
  const group = new THREE.Group();
  const spinners = [];
  const Rc = 2.8;
  const sag = 0.34;
  const phi = 0.47;
  const at = (th) => new THREE.Vector3(Rc * Math.cos(th) - (Rc - sag), Rc * Math.sin(th), 0);
  const tan = (th) => new THREE.Vector3(-Math.sin(th), Math.cos(th), 0);

  const disc = gearGeo(0.3, 0.075, 10, 0.095, false);
  const count = 12;
  for (let i = 0; i < count; i++) {
    const th = -0.37 + (0.74 * i) / (count - 1);
    const holder = new THREE.Object3D();
    holder.position.copy(at(th));
    orient(holder, tan(th));
    const m = new THREE.Mesh(disc, M.honey);
    m.rotation.y = i * 0.7;
    holder.add(m);
    group.add(holder);
    spinners.push({ obj: m, radius: 0.3 });
  }
  const axlePts = [];
  for (let i = 0; i <= 24; i++) axlePts.push(at(-phi + (2 * phi * i) / 24));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(axlePts), 48, 0.028, 8), M.metal));

  const handle = handleGeo(0.95, true, 1.05);
  for (const sgn of [-1, 1]) {
    const th = sgn * phi;
    const h = new THREE.Mesh(handle, M.honey);
    h.position.copy(at(th));
    orient(h, tan(th).multiplyScalar(sgn));
    group.add(h);
  }
  group.position.x = -sag / 2;
  const root = new THREE.Group();
  root.add(group);
  return { group: root, spinners, length: 4.5, sag };
};

// 2 · Rodillo recto con discos de dientes cuadrados
export const buildSquareRoller = (M) => {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const disc = gearGeo(0.31, 0.07, 8, 0.12, true);
  const count = 9;
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(disc, M.honeyLight);
    m.position.y = -0.84 + (1.68 * i) / (count - 1);
    m.rotation.y = i * 0.39;
    spin.add(m);
  }
  group.add(spin);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), M.metal);
  group.add(axle);
  const handle = handleGeo(0.92, true, 1.08);
  const collar = new THREE.CylinderGeometry(0.075, 0.085, 0.07, 24);
  for (const sgn of [-1, 1]) {
    const h = new THREE.Mesh(handle, M.honeyLight);
    h.position.y = sgn * 0.98;
    if (sgn < 0) h.rotation.z = Math.PI;
    group.add(h);
    const c = new THREE.Mesh(collar, M.honeyLight);
    c.position.y = sgn * 0.96;
    group.add(c);
  }
  return { group, spinners: [{ obj: spin, radius: 0.31 }], length: 3.8 };
};

// 3 · Rodillo de 5 cuentas facetadas
export const buildBeadRoller = (M) => {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const bead = new RoundedBoxGeometry(0.46, 0.44, 0.46, 3, 0.13);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(bead, M.honey);
    m.position.y = -1.04 + i * 0.52;
    m.rotation.set(0.32 * Math.sin(i * 2.1), i * 0.83, 0.28 * Math.cos(i * 1.7));
    spin.add(m);
  }
  group.add(spin);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.6, 8), M.metal));
  const top = new THREE.Mesh(handleGeo(0.95, false, 1.0), M.honey);
  top.position.y = 1.3;
  group.add(top);
  const bottom = new THREE.Mesh(handleGeo(0.78, false, 1.05), M.honey);
  bottom.position.y = -1.3;
  bottom.rotation.z = Math.PI;
  group.add(bottom);
  const collar = new THREE.CylinderGeometry(0.11, 0.12, 0.06, 24);
  for (const y of [1.3, -1.3]) {
    const c = new THREE.Mesh(collar, M.honey);
    c.position.y = y;
    group.add(c);
  }
  return { group, spinners: [{ obj: spin, radius: 0.28 }], length: 4.2 };
};

// 4 · Cuerda de cuentas con dos asas
export const buildBeadRope = (M) => {
  const group = new THREE.Group();
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.45, 0),
    new THREE.Vector3(0.12, -0.72, 0.05),
    new THREE.Vector3(-0.06, 0, 0),
    new THREE.Vector3(0.1, 0.72, -0.05),
    new THREE.Vector3(0, 1.45, 0),
  ]);
  const rows = 17;
  const perRow = 3;
  const beadGeo = new THREE.SphereGeometry(0.068, 18, 12);
  const beads = new THREE.InstancedMesh(beadGeo, M.honey, rows * perRow);
  const crossGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
  const cross = new THREE.InstancedMesh(crossGeo, M.cord, rows);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0);
  const edgeA = [];
  const edgeB = [];
  for (let r = 0; r < rows; r++) {
    const t = 0.05 + (0.9 * r) / (rows - 1);
    const p = path.getPointAt(t);
    const tg = path.getTangentAt(t);
    const n = new THREE.Vector3(-tg.y, tg.x, 0).normalize();
    q.setFromUnitVectors(X, n);
    for (let k = 0; k < perRow; k++) {
      const o = (k - 1) * 0.13;
      sc.set(1.15, 0.86, 0.86);
      m4.compose(p.clone().addScaledVector(n, o), q, sc);
      beads.setMatrixAt(r * perRow + k, m4);
    }
    const qc = new THREE.Quaternion().setFromUnitVectors(UP, n);
    m4.compose(p, qc, sc.set(1, 0.42, 1));
    cross.setMatrixAt(r, m4);
    edgeA.push(p.clone().addScaledVector(n, 0.21));
    edgeB.push(p.clone().addScaledVector(n, -0.21));
  }
  group.add(beads, cross);
  // Cordones laterales que se juntan en cada extremo
  const ends = [path.getPointAt(0), path.getPointAt(1)];
  for (const edge of [edgeA, edgeB]) {
    const pts = [ends[0], ...edge, ends[1]];
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.011, 6), M.cord));
  }
  // Lazo y asa en cada extremo
  const loop = new THREE.TorusGeometry(0.09, 0.012, 8, 24);
  const handle = latheFn(0.36, () => 0.058, { capA: 0.03, capB: 0.03, segments: 24 });
  for (const [i, sgn] of [
    [0, -1],
    [1, 1],
  ]) {
    const p = ends[i];
    const l = new THREE.Mesh(loop, M.cord);
    l.position.copy(p).add(new THREE.Vector3(0, sgn * 0.08, 0));
    l.rotation.y = Math.PI / 2;
    group.add(l);
    const h = new THREE.Mesh(handle, M.walnut);
    h.position.copy(p).add(new THREE.Vector3(0, sgn * 0.17, 0));
    if (sgn < 0) h.rotation.z = Math.PI;
    group.add(h);
  }
  return { group, spinners: [], length: 3.7 };
};

const shapeFromCurve = (points, samples, perturb) => {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal'
  );
  const pts = curve.getSpacedPoints(samples).map((p) => {
    const v = new THREE.Vector2(p.x, p.y);
    if (perturb) perturb(v);
    return v;
  });
  return new THREE.Shape(pts);
};

// 5 · Tabla en cola de ballena con borde ondulado
export const buildWhaleBoard = (M) => {
  const outline = [
    [0.02, 1.55],
    [-0.24, 1.5],
    [-0.3, 1.3],
    [-0.21, 0.7],
    [-0.17, 0.3],
    [-0.34, 0.02],
    [-0.78, -0.12],
    [-1.18, -0.02],
    [-1.42, 0.16],
    [-1.36, -0.12],
    [-1.05, -0.4],
    [-0.5, -0.56],
    [0.08, -0.6],
    [0.62, -0.5],
    [1.12, -0.32],
    [1.4, -0.02],
    [1.46, 0.24],
    [1.2, 0.06],
    [0.8, -0.08],
    [0.36, 0.0],
    [0.17, 0.3],
    [0.21, 0.7],
    [0.3, 1.3],
    [0.26, 1.5],
  ];
  const shape = shapeFromCurve(outline, 260, (v) => {
    if (v.y < -0.2 && Math.abs(v.x) < 1.3 && v.y < -0.12 - 0.3 * (1 - Math.abs(v.x) / 1.3)) v.y += 0.03 * Math.sin((v.x + 1.3) * Math.PI * 5);
  });
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 4,
    steps: 1,
  });
  geo.center();
  fitUV(geo, 0.75, 1.0, 0.1);
  const mesh = new THREE.Mesh(geo, M.honey);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, spinners: [], length: 2.4 };
};

// 6 · Gua sha en media luna con ranura ovalada
export const buildCrescent = (M) => {
  const outline = [
    [-0.2, 0.86],
    [0.14, 0.62],
    [0.38, 0.28],
    [0.44, -0.05],
    [0.36, -0.4],
    [0.12, -0.7],
    [-0.2, -0.86],
    [-0.12, -0.52],
    [-0.04, -0.12],
    [-0.04, 0.16],
    [-0.1, 0.52],
  ];
  const shape = shapeFromCurve(outline, 200);
  const hole = new THREE.Path();
  const cx = 0.19;
  const hw = 0.065;
  const hh = 0.3;
  hole.moveTo(cx - hw, -hh + hw);
  hole.lineTo(cx - hw, hh - hw);
  hole.absarc(cx, hh - hw, hw, Math.PI, 0, true);
  hole.lineTo(cx + hw, -hh + hw);
  hole.absarc(cx, -hh + hw, hw, 0, Math.PI, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geo.center();
  fitUV(geo, 0.35, 1, 0.3);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, M.walnut));
  return { group, spinners: [], length: 1.8 };
};

// 7 · Copa sueca (campana con mango largo)
export const buildSwedishCup = (M) => {
  const geo = lathe(
    [
      [0.001, 0.7],
      [0.32, 0.66],
      [0.52, 0.5],
      [0.6, 0.22],
      [0.63, 0.03],
      [0.67, -0.005],
      [0.72, 0.04],
      [0.71, 0.32],
      [0.63, 0.62],
      [0.46, 0.84],
      [0.24, 0.96],
      [0.15, 1.06],
      [0.125, 1.35],
      [0.13, 1.62],
      [0.19, 1.82],
      [0.17, 1.98],
      [0.001, 2.04],
    ],
    { segments: 72, samples: 140 }
  );
  geo.translate(0, -0.95, 0);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, M.walnut));
  return { group, spinners: [], length: 2.1 };
};

// 8 · Seta de madera con bolitas en la base
export const buildMushroom = (M) => {
  const body = lathe(
    [
      [0.001, 0.02],
      [0.45, 0.02],
      [0.7, 0.06],
      [0.76, 0.13],
      [0.66, 0.3],
      [0.4, 0.44],
      [0.21, 0.55],
      [0.165, 0.72],
      [0.17, 0.98],
      [0.22, 1.07],
      [0.34, 1.18],
      [0.3, 1.33],
      [0.001, 1.4],
    ],
    { segments: 64, samples: 120 }
  );
  const balls = [];
  const ball = new THREE.SphereGeometry(0.1, 20, 14);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    balls.push(ball.clone().translate(Math.cos(a) * 0.56, -0.03, Math.sin(a) * 0.56));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    balls.push(ball.clone().translate(Math.cos(a) * 0.27, -0.02, Math.sin(a) * 0.27));
  }
  balls.push(ball.clone().translate(0, -0.02, 0));
  const ballsGeo = mergeGeometries(balls);
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(body, M.walnut), new THREE.Mesh(ballsGeo, M.walnut));
  inner.position.y = -0.6;
  group.add(inner);
  return { group, spinners: [], length: 1.6 };
};

// 9 · Herramienta en T (puntos gatillo)
export const buildTrigger = (M) => {
  const vertical = lathe(
    [
      [0.001, -0.86],
      [0.045, -0.78],
      [0.1, -0.46],
      [0.135, -0.14],
      [0.12, 0.12],
      [0.085, 0.36],
      [0.08, 0.6],
      [0.135, 0.73],
      [0.125, 0.87],
      [0.001, 0.93],
    ],
    { segments: 48, samples: 100 }
  );
  const bar = lathe(
    [
      [0.001, -1.02],
      [0.15, -0.97],
      [0.205, -0.82],
      [0.16, -0.63],
      [0.105, -0.52],
      [0.15, -0.15],
      [0.165, 0.3],
      [0.135, 0.72],
      [0.09, 0.88],
      [0.001, 0.93],
    ],
    { segments: 48, samples: 100 }
  );
  bar.rotateZ(-Math.PI / 2);
  bar.translate(0, 0.05, 0);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(vertical, M.honey), new THREE.Mesh(bar, M.honey));
  return { group, spinners: [], length: 2.0 };
};

export const TOOL_BUILDERS = {
  curved: buildCurvedRoller,
  square: buildSquareRoller,
  beads: buildBeadRoller,
  rope: buildBeadRope,
  whale: buildWhaleBoard,
  crescent: buildCrescent,
  cup: buildSwedishCup,
  mushroom: buildMushroom,
  trigger: buildTrigger,
};
