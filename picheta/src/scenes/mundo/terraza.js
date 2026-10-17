import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plane, box } from './materials.js';
import { furniture, signature, SUN_DIR } from './salon.js';

// LA TERRAZA, en la azotea: tarima de madera oscura, el muro antiguo de
// piedra encalada con la firma de Picheta y la guirnalda de bombillas, la
// barra negra bajo la pérgola de acero, mesas de mármol con su lamparita,
// palmeras en jardineras y, detrás del muro, la Catedral de San Ildefonso
// al atardecer.

export const TERRAZA = { x0: -15, x1: 3, z0: -29.6, z1: -44, y: 4.4 };
export const BAR = { x0: -13.7, x1: -12.8, z0: -33, z1: -42 };
export const CATEDRAL = { x: 68, z: -101 };
export const TERRACE_TABLES = [];
for (const x of [-10.2, -7.6, -5.0, -2.4, 0.2]) for (const z of [-34.8, -37.8, -40.8]) if (!(x === -7.6 && z === -34.8)) TERRACE_TABLES.push({ x, z });

export function buildTerraza(m, assets, q) {
  const g = new THREE.Group();
  g.name = 'terraza';
  const T = TERRAZA;
  const Y = T.y;
  const W = T.x1 - T.x0;
  const L = T.z0 - T.z1;
  const xc = (T.x0 + T.x1) / 2;
  const zc = (T.z0 + T.z1) / 2;

  const deck = plane(W, L, m.deck, 2.4);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(xc, Y, zc);
  g.add(deck);

  // Muro antiguo al norte, con la firma y la guirnalda.
  const wallH = 2.9;
  const wall = box(W + 1, wallH, 0.55, m.lime, 2.2);
  wall.position.set(xc, Y + wallH / 2, T.z1 - 0.28);
  g.add(wall);
  const cap = box(W + 1.1, 0.12, 0.62, m.lime, 2);
  cap.position.set(xc, Y + wallH + 0.06, T.z1 - 0.28);
  g.add(cap);
  if (assets.signature) {
    const sig = signature(assets.signature, m);
    sig.scale.setScalar(1.25);
    sig.position.set(-5.2, Y + 1.75, T.z1 + 0.02);
    g.add(sig);
  }
  // muros bajos al oeste y al sur (barandilla de vidrio al este)
  const west = box(0.4, 1.2, L, m.lime, 2);
  west.position.set(T.x0 - 0.2, Y + 0.6, zc);
  g.add(west);

  // Barandilla de vidrio al este: paneles y postes de acero.
  for (let z = T.z0 - 0.2; z > T.z1; z -= 1.6) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.05), m.glassPanel);
    pane.rotation.y = -Math.PI / 2;
    pane.position.set(T.x1 + 0.05, Y + 0.55, z - 0.8);
    g.add(pane);
    const post = box(0.04, 1.1, 0.04, m.steel);
    post.position.set(T.x1 + 0.05, Y + 0.55, z);
    g.add(post);
  }

  // Guirnalda de bombillas: catenarias a lo largo del muro y cruzando la terraza.
  const bulbs = [];
  const cords = [];
  const strand = (a, b, sag, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
    cords.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.006, 4, false));
    for (let i = 1; i < n; i += 1) bulbs.push(pts[i]);
  };
  for (let x = T.x0 + 0.5; x < T.x1 - 1; x += 3.4) strand(new THREE.Vector3(x, Y + wallH - 0.1, T.z1 + 0.05), new THREE.Vector3(x + 3.4, Y + wallH - 0.1, T.z1 + 0.05), 0.55, 9);
  for (const z of [-34, -38.5]) strand(new THREE.Vector3(T.x0 + 1.5, Y + 3.3, z), new THREE.Vector3(T.x1 - 0.2, Y + 3.0, z - 1), 0.7, 26);
  g.add(new THREE.Mesh(mergeGeometries(cords), m.blackMetal));
  const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 12, 8), m.bulbGarland, bulbs.length);
  const M = new THREE.Matrix4();
  bulbs.forEach((p, i) => bulbIM.setMatrixAt(i, M.makeTranslation(p.x, p.y - 0.06, p.z)));
  g.add(bulbIM);

  // La barra: mostrador negro, taburetes, botellas en la contrabarra, pérgola de acero.
  const counter = box(BAR.x1 - BAR.x0, 1.08, BAR.z0 - BAR.z1, m.barBlack, 1);
  counter.position.set((BAR.x0 + BAR.x1) / 2, Y + 0.54, (BAR.z0 + BAR.z1) / 2);
  g.add(counter);
  const top = box(BAR.x1 - BAR.x0 + 0.12, 0.05, BAR.z0 - BAR.z1 + 0.1, m.barTop, 1);
  top.position.set((BAR.x0 + BAR.x1) / 2, Y + 1.1, (BAR.z0 + BAR.z1) / 2);
  g.add(top);
  const backBar = box(0.5, 0.95, BAR.z0 - BAR.z1, m.steel, 1);
  backBar.position.set(T.x0 + 0.3, Y + 0.48, (BAR.z0 + BAR.z1) / 2);
  g.add(backBar);
  const bottleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12).translate(0, 0.12, 0),
    new THREE.CylinderGeometry(0.014, 0.036, 0.08, 10).translate(0, 0.28, 0),
  ]);
  const nB = 46;
  const bottles = new THREE.InstancedMesh(bottleGeo, m.bottle, nB);
  for (let i = 0; i < nB; i++) {
    M.makeTranslation(T.x0 + 0.2 + (i % 2) * 0.16, Y + 0.96, BAR.z0 - 0.3 - (i >> 1) * 0.38);
    bottles.setMatrixAt(i, M);
    bottles.setColorAt(i, new THREE.Color().setHSL(0.08 + Math.random() * 0.25, 0.5, 0.15 + Math.random() * 0.35));
  }
  g.add(bottles);
  const stoolGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.2, 0.18, 0.06, 20).translate(0, 0.76, 0),
    new THREE.CylinderGeometry(0.2, 0.2, 0.3, 20, 1, true, Math.PI * 0.2, Math.PI * 0.9).translate(0, 0.95, 0),
    ...[
      [0.13, 0.13],
      [-0.13, 0.13],
      [0.13, -0.13],
      [-0.13, -0.13],
    ].map(([x, z]) => new THREE.CylinderGeometry(0.012, 0.012, 0.76, 6).translate(x, 0.38, z)),
  ]);
  const nS = 11;
  const stools = new THREE.InstancedMesh(stoolGeo, m.rattan, nS);
  const Q = new THREE.Quaternion();
  for (let i = 0; i < nS; i++) {
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (Math.random() - 0.5) * 0.3);
    M.compose(new THREE.Vector3(BAR.x1 + 0.45, Y, BAR.z0 - 0.4 - i * 0.82), Q, new THREE.Vector3(1, 1, 1));
    stools.setMatrixAt(i, M);
  }
  stools.castShadow = true;
  g.add(stools);
  // pérgola sobre la barra
  for (let z = BAR.z0 + 0.5; z >= BAR.z1 - 0.5; z -= 2.4) {
    const post = box(0.12, 3.1, 0.12, m.steel);
    post.position.set(T.x0 + 0.1, Y + 1.55, z);
    g.add(post);
  }
  const beam = box(0.18, 0.28, BAR.z0 - BAR.z1 + 1.2, m.steel, 1);
  beam.position.set(T.x0 + 0.1, Y + 3.1, (BAR.z0 + BAR.z1) / 2);
  g.add(beam);
  const roof = box(2.9, 0.06, BAR.z0 - BAR.z1 + 1.2, m.barBlack, 1);
  roof.position.set(T.x0 + 1.4, Y + 3.24, (BAR.z0 + BAR.z1) / 2);
  g.add(roof);

  // Mesas de mármol, sillas de ratán oscuro, lamparita en cada mesa.
  const tables = TERRACE_TABLES.map(({ x, z }) => ({ x, z, w: 0.72, d: 0.72, chairs: [[-0.56, 0, Math.PI / 2], [0.56, 0, -Math.PI / 2]] }));
  const furn = furniture(tables, m, q, { top: m.marble, chair: m.rattan, legs: m.blackMetal });
  furn.position.y = Y;
  g.add(furn);
  const lampGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.05, 0.06, 0.012, 16).translate(0, 0.006, 0),
    new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8).translate(0, 0.12, 0),
    new THREE.ConeGeometry(0.075, 0.07, 18, 1, true).translate(0, 0.25, 0),
  ]);
  const lamps = new THREE.InstancedMesh(lampGeo, m.blackMetal, tables.length);
  const lampBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), m.bulb, tables.length);
  tables.forEach((t, i) => {
    lamps.setMatrixAt(i, M.makeTranslation(t.x - 0.18, Y + 0.78, t.z + 0.12));
    lampBulbs.setMatrixAt(i, M.makeTranslation(t.x - 0.18, Y + 1.0, t.z + 0.12));
  });
  g.add(lamps, lampBulbs);

  // Palmeras en jardineras junto al muro oeste y al norte.
  const fronds = frondTexture();
  for (const [x, z, h] of [
    [-14.4, -31.2, 2.6],
    [-14.3, -43.2, 3.2],
    [-9.0, -43.3, 2.2],
    [-1.8, -43.2, 2.8],
    [2.4, -31.0, 2.0],
  ])
    g.add(palm(m, fronds, x, Y, z, h));

  // La Catedral, al otro lado de la plaza (foto real recortada del cielo):
  // por encima del muro desde la terraza y libre tras la barandilla de vidrio.
  if (assets.catedral) {
    const w = 64;
    const h = (w * assets.catedral.image.height) / assets.catedral.image.width;
    const cat = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: assets.catedral, transparent: true, alphaTest: 0.02, depthWrite: true, fog: false, toneMapped: false }),
    );
    cat.material.color = new THREE.Color('#ffffff').multiplyScalar(1.05);
    cat.position.set(CATEDRAL.x, Y - 9 + h / 2, CATEDRAL.z);
    cat.lookAt(new THREE.Vector3(-4, cat.position.y, -36));
    cat.renderOrder = -1;
    g.add(cat);
  }
  // Los laureles de la plaza, entre la casa y la Catedral.
  const canopies = [0, 1, 2].map((k) => canopyTexture(k));
  const rnd = mulberry(7);
  for (let k = 0; k < 34; k++) {
    const x = 16 + rnd() * 50;
    const z = -26 - rnd() * 70;
    // la fachada de la Catedral queda libre
    if (Math.hypot(x - CATEDRAL.x, z - CATEDRAL.z) < 20) continue;
    const size = 6 + rnd() * 3.5;
    const tree = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: canopies[k % 3], alphaTest: 0.35, color: new THREE.Color('#fff1dc').multiplyScalar(0.92 + rnd() * 0.16) }),
    );
    tree.scale.set(size, size, 1);
    tree.position.set(x, size / 2 - 0.4, z);
    g.add(tree);
  }

  // (el sol es el mismo de toda la casa: lo coloca la escena)
  const lights = new THREE.Group();
  const sky = new THREE.HemisphereLight('#9fb2d6', '#6b4a32', 0.9);
  sky.position.set(xc, Y + 10, zc);
  lights.add(sky);
  // la guirnalda ilumina un poco la tarima
  for (const z of [-34.5, -39]) {
    const p = new THREE.PointLight('#ffbf7a', 3, 9, 2);
    p.position.set(-5, Y + 2.8, z);
    lights.add(p);
  }
  g.add(lights);

  return { group: g, lights, update() {} };
}

// Palma: tronco y hojas (planos con una textura de fronda recortada).
function palm(m, tex, x, y, z, h) {
  const grp = new THREE.Group();
  const pot = box(0.9, 0.55, 0.9, m.steel, 1);
  pot.position.set(0, 0.275, 0);
  grp.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 10), m.trunk);
  trunk.position.set(0, h / 2 + 0.4, 0);
  trunk.castShadow = true;
  grp.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, color: '#7d9a62' });
  const leafGeo = new THREE.PlaneGeometry(0.8, 2.1, 1, 8).translate(0, 1.05, 0);
  // que la hoja se arquee y caiga hacia la punta
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 2.1;
    pos.setZ(i, t * t * 1.3);
  }
  leafGeo.computeVertexNormals();
  const n = 14;
  for (let k = 0; k < n; k++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0, h + 0.4, 0);
    // corona: unas hojas suben, la mayoría se abren y caen
    const tilt = k % 3 === 0 ? 0.45 + Math.random() * 0.3 : 0.95 + Math.random() * 0.5;
    leaf.rotation.set(tilt, (k / n) * Math.PI * 2 + Math.random() * 0.35, (Math.random() - 0.5) * 0.3, 'YXZ');
    leaf.castShadow = true;
    grp.add(leaf);
  }
  grp.position.set(x, y, z);
  return grp;
}

function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = '#4a5e30';
  g.lineCap = 'round';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 512);
  g.lineTo(64, 0);
  g.stroke();
  // foliolos: hojitas largas y llenas que salen del nervio y caen hacia fuera
  for (let y = 505; y > 8; y -= 7) {
    const t = 1 - y / 512;
    const len = 60 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92) + 4;
    g.lineWidth = 4 - t * 1.6;
    for (const s of [-1, 1]) {
      g.strokeStyle = `rgb(${58 + Math.random() * 26}, ${88 + Math.random() * 34}, ${36 + Math.random() * 16})`;
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + s * len * 0.55, y - 2, 64 + s * len, y + 16 + Math.random() * 6);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Copa de laurel vista de lado: cientos de hojitas en varios lóbulos, con
// la luz del poniente arriba y la sombra abajo; tronco oscuro.
function canopyTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry(31 + seed * 17);
  g.fillStyle = '#2e241c';
  g.beginPath();
  g.moveTo(121, 256);
  g.lineTo(125, 150);
  g.lineTo(131, 150);
  g.lineTo(135, 256);
  g.fill();
  const lobes = Array.from({ length: 8 }, () => [64 + rnd() * 128, 58 + rnd() * 96, 30 + rnd() * 30]);
  const leaves = [];
  for (let k = 0; k < 3200; k++) {
    const [lx, ly, lr] = lobes[k % lobes.length];
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * lr;
    const x = lx + Math.cos(a) * r;
    const y = ly + Math.sin(a) * r;
    // luz desde arriba y un poco de lado; el borde exterior de cada lóbulo, más claro
    const light = THREE.MathUtils.clamp(0.62 - (y - 90) / 150 + (r / lr) * 0.18 - Math.sin(a) * 0.12 + (rnd() - 0.5) * 0.3, 0, 1);
    leaves.push([x, y, light]);
  }
  leaves.sort((p, q) => p[2] - q[2]);
  const dark = [22, 36, 20];
  const lit = [128, 138, 70];
  for (const [x, y, l] of leaves) {
    const k = l * l;
    g.fillStyle = `rgb(${dark.map((d, i) => Math.round(d + (lit[i] - d) * k)).join(',')})`;
    g.beginPath();
    g.ellipse(x, y, 1.6 + rnd() * 2.4, 1.1 + rnd() * 1.4, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cielo de atardecer: cenit azul violáceo, malva, horizonte melocotón y el
// resplandor del sol poniente.
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR.clone().negate() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 zen = vec3(0.12, 0.2, 0.44);
        vec3 mid = vec3(0.5, 0.5, 0.68);
        vec3 hor = vec3(1.0, 0.68, 0.45);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, zen, smoothstep(0.2, 0.75, h));
        float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
        c += vec3(1.0, 0.62, 0.32) * (pow(s, 6.0) * 0.6 + pow(s, 60.0) * 1.5);
        // del lado opuesto al sol: la franja rosada sobre el horizonte
        float a = max(dot(normalize(vDir.xz), -normalize(uSun.xz)), 0.0);
        c = mix(c, vec3(0.93, 0.62, 0.62), a * a * 0.55 * smoothstep(0.32, 0.04, h) * smoothstep(-0.02, 0.05, h));
        c = mix(c, vec3(0.42, 0.33, 0.3), smoothstep(0.0, -0.15, h));
        gl_FragColor = vec4(c * 1.15, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
