import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastaTiles, plaster, wood, softDot } from '../../gl/textures.js';
import { mulberry32 } from '../intro/LogoParticles.js';

// La terraza: piso de pasta, pretil con balaustres, muro del edificio con la
// puerta del bar, mesas, sillas, macetas y guirnaldas de luces.
// Coordenadas en metros; la cámara está en (0, 1.55, 3) mirando al sur (-z).

export const TERRACE = { x0: -7.5, x1: 7.5, z0: -3.6, z1: 4.6 };
export const HUB = new THREE.Vector3(0, 1.62, 1.2); // dónde está el visitante

export const MATS = {};

export function materials() {
  if (MATS.cream) return MATS;
  MATS.cream = new THREE.MeshStandardMaterial({ color: '#e6d9c3', roughness: 0.9 });
  MATS.wall = new THREE.MeshStandardMaterial({ map: plaster({ repeat: [3, 2] }), color: '#e2cfb0', roughness: 0.95 });
  MATS.wood = new THREE.MeshStandardMaterial({ map: wood({ tint: '#6e4a31', seed: 7 }), roughness: 0.75 });
  MATS.woodLight = new THREE.MeshStandardMaterial({ map: wood({ tint: '#a5774c', seed: 8 }), roughness: 0.7 });
  MATS.iron = new THREE.MeshStandardMaterial({ color: '#211d1a', roughness: 0.6, metalness: 0.4 });
  MATS.pot = new THREE.MeshStandardMaterial({ color: '#9c5a3a', roughness: 0.95 });
  MATS.leaf = new THREE.MeshStandardMaterial({ color: '#3e5236', roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
  MATS.cloth = new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: 1 });
  MATS.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(2.2) });
  return MATS;
}

export function buildTerrace(quality) {
  const M = materials();
  const group = new THREE.Group();
  const lights = [];
  const shadows = quality.shadows > 0;
  const W = TERRACE.x1 - TERRACE.x0;
  const D = TERRACE.z1 - TERRACE.z0;

  // ------------------------------------------------------------ piso de pasta
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: pastaTiles({ repeat: [W / 1.4, D / 1.4] }), color: '#e4dccf', roughness: 0.82 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (TERRACE.z0 + TERRACE.z1) / 2);
  floor.receiveShadow = shadows;
  group.add(floor);
  // Canto del piso visto desde arriba (el borde de la azotea).
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.4, D + 0.3), M.cream);
  slab.position.set(0, -0.21, floor.position.z);
  group.add(slab);

  // ------------------------------------------------------------ pretil con balaustres
  const balProfile = [
    [0.0, 0], [0.065, 0], [0.065, 0.06], [0.045, 0.1], [0.05, 0.16], [0.075, 0.32], [0.07, 0.46],
    [0.04, 0.58], [0.05, 0.62], [0.065, 0.66], [0.065, 0.72], [0, 0.72],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const balGeo = new THREE.LatheGeometry(balProfile, 8);
  const runs = [
    { a: new THREE.Vector3(TERRACE.x0, 0, TERRACE.z0), b: new THREE.Vector3(TERRACE.x1, 0, TERRACE.z0) },
    { a: new THREE.Vector3(TERRACE.x0, 0, TERRACE.z0), b: new THREE.Vector3(TERRACE.x0, 0, 2.2) },
    { a: new THREE.Vector3(TERRACE.x1, 0, TERRACE.z0), b: new THREE.Vector3(TERRACE.x1, 0, 1.0) },
  ];
  let nBal = 0;
  const balMatrices = [];
  const m4 = new THREE.Matrix4();
  const railParts = [];
  for (const r of runs) {
    const len = r.a.distanceTo(r.b);
    const dir = r.b.clone().sub(r.a).normalize();
    const n = Math.floor(len / 0.24);
    for (let i = 1; i < n; i++) {
      // Pilastras cada ~2,4 m.
      if (i % 10 === 0) continue;
      const p = r.a.clone().addScaledVector(dir, (i / n) * len);
      balMatrices.push(m4.clone().makeTranslation(p.x, 0.12, p.z));
      nBal++;
    }
    const ang = Math.atan2(dir.x, dir.z);
    for (const [h, t, y] of [
      [0.12, 0.34, 0.06],
      [0.1, 0.38, 0.92],
    ]) {
      const g = new THREE.BoxGeometry(t, h, len + 0.3);
      g.rotateY(ang);
      const mid = r.a.clone().lerp(r.b, 0.5);
      g.translate(mid.x, y, mid.z);
      railParts.push(g);
    }
    for (let i = 0; i <= n; i += 10) {
      const p = r.a.clone().addScaledVector(dir, (i / n) * len);
      const g = new THREE.BoxGeometry(0.3, 1.02, 0.3);
      g.translate(p.x, 0.5, p.z);
      railParts.push(g);
    }
  }
  const balusters = new THREE.InstancedMesh(balGeo, M.cream, nBal);
  balMatrices.forEach((mm, i) => balusters.setMatrixAt(i, mm));
  balusters.castShadow = shadows;
  group.add(balusters);
  const rail = new THREE.Mesh(mergeGeometries(railParts), M.cream);
  rail.castShadow = shadows;
  rail.receiveShadow = shadows;
  group.add(rail);

  // ------------------------------------------------------------ muro del edificio y puerta del bar
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-W / 2, 0);
  wallShape.lineTo(W / 2, 0);
  wallShape.lineTo(W / 2, 4.2);
  wallShape.lineTo(-W / 2, 4.2);
  wallShape.lineTo(-W / 2, 0);
  for (const cx of [-2.2, 1.0]) {
    const hole = new THREE.Path();
    hole.moveTo(cx - 0.9, 0);
    hole.lineTo(cx - 0.9, 2.3);
    hole.absarc(cx, 2.3, 0.9, Math.PI, 0, true);
    hole.lineTo(cx + 0.9, 0);
    hole.lineTo(cx - 0.9, 0);
    wallShape.holes.push(hole);
  }
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 0.5, bevelEnabled: false, curveSegments: 16 }), M.wall);
  wall.position.set(0, 0, TERRACE.z1);
  wall.receiveShadow = shadows;
  group.add(wall);
  // Interior cálido detrás de los arcos.
  for (const cx of [-2.2, 1.0]) {
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a3a22') }));
    inside.position.set(cx, 1.6, TERRACE.z1 + 0.45);
    inside.rotation.y = Math.PI;
    inside.material.map = interiorTexture();
    group.add(inside);
    lights.push({ kind: 'color', m: inside.material, to: new THREE.Color(0.72, 0.5, 0.34), delay: 0.2 });
  }
  // Muro lateral izquierdo bajo, detrás del tunkul.
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 2.4), M.wall);
  sideWall.position.set(TERRACE.x0 + 0.2, 1.3, 3.4);
  group.add(sideWall);

  // ------------------------------------------------------------ mesas y sillas
  const tableSpots = [
    [-4.2, -2.7],
    [4.4, -2.8],
    [5.0, 2.6],
    [-3.0, 2.9],
  ];
  const chairGeo = chairGeometry();
  const tableGeo = tableGeometry();
  const tables = new THREE.InstancedMesh(tableGeo, M.wood, tableSpots.length);
  const chairs = new THREE.InstancedMesh(chairGeo, M.woodLight, tableSpots.length * 2);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  tableSpots.forEach(([x, z], i) => {
    tables.setMatrixAt(i, m4.makeTranslation(x, 0, z));
    for (let k = 0; k < 2; k++) {
      const a = k * Math.PI + 0.4 * i;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI);
      chairs.setMatrixAt(i * 2 + k, m4.compose(new THREE.Vector3(x + Math.sin(a) * 0.62, 0, z + Math.cos(a) * 0.62), q, one));
    }
  });
  tables.castShadow = chairs.castShadow = shadows;
  group.add(tables, chairs);
  // Velas pequeñas en las mesas de ambiente.
  const candleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8);
  tableSpots.forEach(([x, z]) => {
    const c = new THREE.Mesh(candleGeo, M.bulb);
    c.position.set(x, 0.79, z);
    group.add(c);
  });

  // ------------------------------------------------------------ macetas
  const rnd = mulberry32(22);
  const potSpots = [
    [TERRACE.x0 + 0.5, -3.0, 1.3],
    [TERRACE.x1 - 0.5, -3.0, 1.2],
    [TERRACE.x1 - 0.6, 2.2, 1.4],
    [-0.4, TERRACE.z1 - 0.5, 1],
    [2.6, TERRACE.z1 - 0.5, 0.9],
  ];
  for (const [x, z, s] of potSpots) {
    const plant = pottedPlant(rnd, s);
    plant.position.set(x, 0, z);
    plant.traverse((o) => (o.castShadow = shadows));
    group.add(plant);
  }

  // ------------------------------------------------------------ guirnaldas de luces
  const strands = [
    [new THREE.Vector3(TERRACE.x0 + 0.2, 3.4, TERRACE.z1 - 0.1), new THREE.Vector3(TERRACE.x1 - 0.3, 3.0, TERRACE.z0 + 0.2)],
    [new THREE.Vector3(TERRACE.x1 - 0.2, 3.4, TERRACE.z1 - 0.1), new THREE.Vector3(TERRACE.x0 + 0.3, 3.0, TERRACE.z0 + 0.2)],
    [new THREE.Vector3(TERRACE.x0 + 0.2, 3.1, TERRACE.z0 + 0.2), new THREE.Vector3(TERRACE.x1 - 0.2, 3.1, TERRACE.z0 + 0.2)],
    [new THREE.Vector3(TERRACE.x0 + 0.2, 3.3, 0.6), new THREE.Vector3(TERRACE.x1 - 0.2, 3.3, 0.6)],
  ];
  const bulbPts = [];
  const wire = [];
  for (const [a, b] of strands) {
    const pts = [];
    const n = Math.round(a.distanceTo(b) / 0.55);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = a.clone().lerp(b, u);
      p.y -= Math.sin(u * Math.PI) * 0.55; // catenaria
      pts.push(p);
      if (i > 0 && i < n) bulbPts.push(p.clone().setY(p.y - 0.08));
    }
    wire.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.006, 3));
  }
  group.add(new THREE.Mesh(mergeGeometries(wire), M.iron));
  // Postes en las esquinas del pretil.
  for (const [x, z] of [
    [TERRACE.x0 + 0.2, TERRACE.z0 + 0.2],
    [TERRACE.x1 - 0.2, TERRACE.z0 + 0.2],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.2, 6), M.iron);
    pole.position.set(x, 1.6, z);
    group.add(pole);
  }
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), M.bulb.clone(), bulbPts.length);
  bulbPts.forEach((p, i) => bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  group.add(bulbMesh);
  const glow = glowPoints(bulbPts, 0.32, new THREE.Color(1.0, 0.74, 0.46));
  group.add(glow.points);
  lights.push({ kind: 'uniform', u: glow.uniforms.uOn, delay: 0.1 });
  lights.push({ kind: 'color', m: bulbMesh.material, from: new THREE.Color('#3a2c22'), to: M.bulb.color.clone(), delay: 0.1 });
  bulbMesh.material.color.set('#3a2c22');

  // Farol colgante (como los de la casona) junto a la puerta.
  const lantern = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#2a221c', wireframe: true }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.bulb);
  const lanternGlow = glowPoints([new THREE.Vector3()], 1.4, new THREE.Color(1.0, 0.7, 0.4));
  lantern.add(cage, core, lanternGlow.points);
  lantern.position.set(-0.6, 2.9, TERRACE.z1 - 0.35);
  group.add(lantern);
  lights.push({ kind: 'uniform', u: lanternGlow.uniforms.uOn, delay: 0 });

  return { group, lights };
}

// Interior del bar visto por los arcos: penumbra cálida que se aclara abajo.
function interiorTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#1c120c');
  grd.addColorStop(0.55, '#6b4429');
  grd.addColorStop(1, '#d9a070');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Puntos de luz con halo (sprites aditivos), apagados hasta uOn = 1.
export function glowPoints(points, size, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const uniforms = {
    uOn: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: size },
    uPixelRatio: { value: 1 },
    uMap: { value: softDot() },
    uColor: { value: color },
  };
  const pts = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uSize, uPixelRatio, uTime, uOn;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * 90.0 * uPixelRatio / -mv.z;
          float flick = 0.88 + 0.12 * sin(uTime * 7.0 + position.x * 13.0 + position.z * 7.0);
          vA = uOn * flick;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vA;
        void main() { gl_FragColor = vec4(uColor * 1.3, texture2D(uMap, gl_PointCoord).r * vA * 0.55); }
      `,
    }),
  );
  pts.frustumCulled = false;
  return { points: pts, uniforms };
}

function chairGeometry() {
  const parts = [];
  const seat = new THREE.BoxGeometry(0.42, 0.04, 0.42);
  seat.translate(0, 0.46, 0);
  parts.push(seat);
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ]) {
    const leg = new THREE.BoxGeometry(0.035, 0.46, 0.035);
    leg.translate(x, 0.23, z);
    parts.push(leg);
  }
  for (const x of [-0.18, 0.18]) {
    const post = new THREE.BoxGeometry(0.035, 0.46, 0.035);
    post.translate(x, 0.69, -0.19);
    parts.push(post);
  }
  for (const y of [0.72, 0.86]) {
    const slat = new THREE.BoxGeometry(0.4, 0.06, 0.025);
    slat.translate(0, y, -0.19);
    parts.push(slat);
  }
  return mergeGeometries(parts);
}

function tableGeometry() {
  const top = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28);
  top.translate(0, 0.74, 0);
  const stem = new THREE.CylinderGeometry(0.04, 0.05, 0.72, 8);
  stem.translate(0, 0.36, 0);
  const foot = new THREE.CylinderGeometry(0.22, 0.25, 0.03, 16);
  foot.translate(0, 0.015, 0);
  return mergeGeometries([top, stem, foot]);
}

function pottedPlant(rnd, s) {
  const M = materials();
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.5, 14), M.pot);
  pot.position.y = 0.25;
  g.add(pot);
  // Hojas de palma: láminas alargadas que se abren en abanico.
  const leafGeo = new THREE.PlaneGeometry(0.16, 1.1, 1, 4);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 0.55;
    pos.setX(i, pos.getX(i) * (1 - y / 1.3));
    pos.setZ(i, y * y * 0.35);
    pos.setY(i, y);
  }
  leafGeo.computeVertexNormals();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(leafGeo, M.leaf);
    leaf.position.y = 0.45;
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.4;
    leaf.rotation.x = 0.35 + rnd() * 0.5;
    leaf.scale.setScalar(s * (0.8 + rnd() * 0.4));
    g.add(leaf);
  }
  return g;
}
