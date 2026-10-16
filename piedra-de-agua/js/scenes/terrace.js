// BODAS Y EVENTOS: la terraza en 3D. Muro vegetal, alberca, palmeras, arco floral,
// guirnaldas de focos que se encienden una tras otra y, al fondo, la torre de la
// Catedral. El cielo pasa del día al atardecer mientras se lee.
import * as THREE from 'three';
import { QUALITY, motion, IS_MOBILE } from '../config.js';
import { plasterCanvas, vineLeafCanvas, makeCanvas } from '../util/textures.js';
import { toTexture } from '../util/gltex.js';
import { merge, place, box } from './patio/geo.js';
import { damp, clamp, smoothstep, lerp } from '../util/tween.js';

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;
const SKY_FS = /* glsl */`
uniform float uT;          // 0 día → 1 atardecer → 1.4 anochecer
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  // paletas: día, atardecer, anochecer
  vec3 dayTop = vec3(0.16, 0.42, 0.78), dayHor = vec3(0.72, 0.86, 0.95);
  vec3 sunTop = vec3(0.22, 0.24, 0.52), sunHor = vec3(1.0, 0.55, 0.28);
  vec3 nightTop = vec3(0.04, 0.06, 0.16), nightHor = vec3(0.45, 0.22, 0.32);
  float a = smoothstep(0.0, 1.0, uT), b = smoothstep(1.0, 1.4, uT);
  vec3 top = mix(mix(dayTop, sunTop, a), nightTop, b);
  vec3 hor = mix(mix(dayHor, sunHor, a), nightHor, b);
  vec3 col = mix(hor, top, pow(smoothstep(0.0, 0.7, h), 0.8));
  // sol
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.6, 0.3), a);
  col += sunCol * (pow(s, 6.0) * 0.45 * (0.4 + a) + pow(s, 900.0) * 6.0 * (1.0 - b));
  // nubes en franjas
  vec2 cp = d.xz / max(0.08, d.y + 0.15) * 1.4 + vec2(uTime * 0.01, 0.0);
  float n = noise(cp) * 0.6 + noise(cp * 2.3) * 0.3 + noise(cp * 5.1) * 0.1;
  float cl = smoothstep(0.55, 0.85, n) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.5, 0.9, h));
  vec3 cloudCol = mix(vec3(1.0), mix(vec3(1.0, 0.62, 0.48), vec3(0.42, 0.26, 0.38), b), a);
  col = mix(col, cloudCol * (0.8 + 0.4 * pow(s, 3.0)), cl * 0.7);
  // estrellas al anochecer
  float st = step(0.9975, hash(floor(d.xz / max(0.1, d.y + 0.2) * 220.0)));
  col += vec3(st) * b * smoothstep(0.2, 0.5, h) * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const BULB_VS = /* glsl */`
attribute vec3 aCenter;
attribute float aOrder;
uniform float uProgress;
uniform float uDark;
uniform float uTime;
varying vec2 vUv;
varying float vOn;
void main() {
  vUv = uv;
  float on = smoothstep(aOrder, aOrder + 0.015, uProgress);
  vOn = on * (0.93 + 0.07 * sin(uTime * 9.0 + aOrder * 300.0));
  vec4 mv = viewMatrix * vec4(aCenter, 1.0);
  float size = mix(0.07, 0.55, uDark) * (0.4 + 0.6 * on);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}
`;
const BULB_FS = /* glsl */`
varying vec2 vUv;
varying float vOn;
uniform float uDark;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.32, 0.0, d);
  float halo = exp(-d * d * 4.0) * (0.25 + 0.75 * uDark);
  vec3 off = vec3(0.35, 0.3, 0.24) * smoothstep(0.35, 0.1, d);
  vec3 c = mix(off, vec3(1.0, 0.82, 0.52) * (core * 2.2 + halo), vOn);
  float a = max(smoothstep(0.35, 0.15, d) * 0.9, vOn * halo);
  gl_FragColor = vec4(c * a, a);
}
`;

function frondCanvas(size = 256) {
  const c = makeCanvas(size, size * 2);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#3d6b2c'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(size / 2, size * 2); ctx.lineTo(size / 2, 0); ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const y = size * 2 - (i / 26) * size * 2;
    const len = Math.sin((i / 26) * Math.PI) * size * 0.46 + 10;
    for (const s of [-1, 1]) {
      const g = ctx.createLinearGradient(size / 2, y, size / 2 + s * len, y - 30);
      g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#6faa48');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(size / 2, y);
      ctx.quadraticCurveTo(size / 2 + s * len * 0.6, y - 26, size / 2 + s * len, y - 44);
      ctx.quadraticCurveTo(size / 2 + s * len * 0.5, y - 14, size / 2, y + 6);
      ctx.fill();
    }
  }
  return c;
}

function tileFloorCanvas(size = 512) {
  const c = plasterCanvas(size, [214, 200, 176], 77, 1.4);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.lineWidth = 2;
  for (let k = 0; k <= 4; k++) {
    ctx.beginPath(); ctx.moveTo(k * size / 4, 0); ctx.lineTo(k * size / 4, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * size / 4); ctx.lineTo(size, k * size / 4); ctx.stroke();
  }
  return c;
}

// Torre de la Catedral (silueta estilizada: cuerpos de campanario con arcos y cupulín).
function cathedralTower(mat, dark) {
  const parts = [], holes = [];
  parts.push(box(4.2, 16, 4.2, 0, 0, 0));
  parts.push(box(4.6, 0.5, 4.6, 0, 16, 0));
  parts.push(box(3.6, 4.2, 3.6, 0, 16.5, 0));          // primer cuerpo del campanario
  parts.push(box(4.0, 0.4, 4.0, 0, 20.7, 0));
  parts.push(box(2.8, 3.2, 2.8, 0, 21.1, 0));          // segundo cuerpo
  parts.push(box(3.1, 0.35, 3.1, 0, 24.3, 0));
  const dome = new THREE.SphereGeometry(1.35, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  parts.push(place(dome, 0, 24.65, 0));
  parts.push(place(new THREE.CylinderGeometry(0.35, 0.4, 1.1, 10), 0, 26.5, 0));
  parts.push(place(new THREE.SphereGeometry(0.42, 12, 8), 0, 27.2, 0));
  parts.push(box(0.12, 1.4, 0.12, 0, 27.5, 0), box(0.7, 0.12, 0.12, 0, 28.3, 0));
  // pináculos en las esquinas
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
    parts.push(place(new THREE.ConeGeometry(0.22, 1.2, 6), x, 21.3, z));
  }
  // vanos en arco del campanario (oscuros)
  for (const [w, h, y, d] of [[1.3, 2.6, 17.2, 1.81], [1.0, 2.0, 21.6, 1.41]]) {
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
      const g = new THREE.ShapeGeometry(s, 10);
      holes.push(place(g, Math.sin((k / 4) * Math.PI * 2) * d, y, Math.cos((k / 4) * Math.PI * 2) * d, 0, (k / 4) * Math.PI * 2, 0));
    }
  }
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(merge(parts), mat), new THREE.Mesh(merge(holes), dark));
  return grp;
}

export function createTerrace(engine) {
  const renderer = engine.renderer;
  const hq = QUALITY.tier === 'high';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const aniso = QUALITY.aniso;

  // cielo
  const sunDir = new THREE.Vector3(0.4, 0.5, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSunDir: { value: sunDir }, uTime: { value: 0 } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat));

  // luces
  const hemi = new THREE.HemisphereLight('#cfe4f2', '#8a6f52', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dd', 3.2);
  scene.add(sun, sun.target);

  // materiales
  const floorTex = toTexture(tileFloorCanvas(512), { aniso });
  floorTex.repeat.set(7, 6);
  const stoneTex = toTexture(plasterCanvas(256, [226, 214, 194], 5, 1.2), { aniso });
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, color: '#efe6d6', roughness: 0.85 }),
    wall: new THREE.MeshStandardMaterial({ map: stoneTex, color: '#e9dcc6', roughness: 0.9 }),
    tower: new THREE.MeshStandardMaterial({ color: '#cdbfa8', roughness: 0.92 }),
    towerDark: new THREE.MeshBasicMaterial({ color: '#2a2420' }),
    city: new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.95 }),
    pot: new THREE.MeshStandardMaterial({ color: '#b5653c', roughness: 0.8 }),
    iron: new THREE.MeshStandardMaterial({ color: '#1a1917', roughness: 0.5, metalness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8a6446', roughness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.9 }),
    wire: new THREE.LineBasicMaterial({ color: '#2a2622' }),
  };

  // suelo de la terraza y pretiles
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const parapet = merge([
    box(16, 1.05, 0.3, 0, 0, 6.35), box(0.3, 1.05, 13, 7.85, 0, 0), box(0.3, 1.05, 13, -7.85, 0, 0),
    box(16.2, 0.08, 0.42, 0, 1.05, 6.35), box(0.42, 0.08, 13, 7.85, 1.05, 0), box(0.42, 0.08, 13, -7.85, 1.05, 0),
  ]);
  scene.add(new THREE.Mesh(parapet, mats.stone));

  // alberca
  const pool = new THREE.Group();
  const coping = merge([box(6.6, 0.12, 0.3, 0, 0, -1.45), box(6.6, 0.12, 0.3, 0, 0, 1.45), box(0.3, 0.12, 3.2, -3.15, 0, 0), box(0.3, 0.12, 3.2, 3.15, 0, 0)]);
  pool.add(new THREE.Mesh(coping, mats.stone));
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color('#0d6e72') }, uShallow: { value: new THREE.Color('#3fc2c0') } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 p = vUv * vec2(6.0, 2.6) * 2.4;
        float w = sin(p.x * 1.7 + uTime * 1.1) * 0.5 + sin(p.y * 2.3 - uTime * 0.9 + p.x * 0.6) * 0.5 + sin((p.x + p.y) * 3.1 + uTime * 1.7) * 0.25;
        float c = pow(abs(sin(p.x * 2.1 + w + uTime * 0.6) * sin(p.y * 2.6 - w * 1.3 - uTime * 0.5)), 6.0);
        vec3 col = mix(uDeep, uShallow, 0.55 + 0.25 * w) + c * 0.35;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        col = mix(col, uSky, fres * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.6), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  pool.add(water);
  pool.position.set(-3.2, 0, 1.6);
  scene.add(pool);

  // muro vegetal al fondo
  const wallZ = -5.2;
  scene.add(new THREE.Mesh(box(16, 3.4, 0.4, 0, 0, wallZ - 0.2), mats.wall));
  scene.add(new THREE.Mesh(box(16.3, 0.12, 0.6, 0, 3.4, wallZ - 0.2), mats.stone));
  {
    const tex = new THREE.CanvasTexture(vineLeafCanvas(hq ? 128 : 96));
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(0.3, 0.38);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
    const n = hq ? 2600 : 1300;
    const im = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * 7.8, y = 0.1 + Math.random() * 3.25;
      e.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.4, Math.random() * Math.PI * 2);
      q.setFromEuler(e);
      const sc = 0.7 + Math.random() * 0.8;
      m.compose(p.set(x, y, wallZ + 0.05 + Math.random() * 0.25), q, s.set(sc, sc, sc));
      im.setMatrixAt(i, m);
      c.setHSL(0.24 + Math.random() * 0.1, 0.35 + Math.random() * 0.25, 0.28 + Math.random() * 0.2);
      im.setColorAt(i, c);
    }
    scene.add(im);
  }

  // arco floral para la ceremonia
  {
    const arch = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(-1.1, 2.0, 0), new THREE.Vector3(-0.7, 2.75, 0), new THREE.Vector3(0, 2.95, 0), new THREE.Vector3(0.7, 2.75, 0), new THREE.Vector3(1.1, 2.0, 0), new THREE.Vector3(1.1, 0, 0)]);
    arch.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.035, 6, false), mats.iron));
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 140);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < 140; i++) {
      const t = 0.12 + Math.random() * 0.76;
      const pt = curve.getPoint(t);
      m.makeTranslation(pt.x + (Math.random() - 0.5) * 0.16, pt.y + (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.18);
      const sc = 0.6 + Math.random() * 0.9;
      m.scale(new THREE.Vector3(sc, sc, sc));
      flowers.setMatrixAt(i, m);
      c.set(['#fbf7ef', '#f4d9e0', '#ffffff', '#e8a0b8', '#f6e7c8'][i % 5]);
      flowers.setColorAt(i, c);
    }
    arch.add(flowers);
    arch.position.set(2.6, 0, wallZ + 1.1);
    scene.add(arch);
    // sillas blancas en dos filas
    const chair = merge([box(0.42, 0.04, 0.42, 0, 0.44, 0), box(0.42, 0.5, 0.04, 0, 0.46, -0.2), box(0.03, 0.44, 0.03, -0.19, 0, 0.19), box(0.03, 0.44, 0.03, 0.19, 0, 0.19), box(0.03, 0.44, 0.03, -0.19, 0, -0.19), box(0.03, 0.44, 0.03, 0.19, 0, -0.19)]);
    const chairs = new THREE.InstancedMesh(chair, mats.cloth, 16);
    let k = 0;
    for (const side of [-1, 1]) for (let r = 0; r < 4; r++) for (let j = 0; j < 2; j++) {
      const mm = new THREE.Matrix4().makeRotationY(Math.PI);
      mm.setPosition(2.6 + side * (0.85 + j * 0.55), 0, wallZ + 2.6 + r * 0.75);
      chairs.setMatrixAt(k++, mm);
    }
    scene.add(chairs);
  }

  // palmeras en macetas
  const frondTex = new THREE.CanvasTexture(frondCanvas(hq ? 256 : 128));
  frondTex.colorSpace = THREE.SRGBColorSpace;
  const frondMat = new THREE.MeshLambertMaterial({ map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide });
  const frondGeo = new THREE.PlaneGeometry(0.9, 1.9, 1, 8);
  {
    const p = frondGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.95; // 0..1.9
      p.setY(i, y);
      p.setZ(i, -Math.pow(y / 1.9, 2) * 0.9); // se arquea hacia abajo
    }
    frondGeo.computeVertexNormals();
  }
  const palms = [];
  for (const [x, z, h] of [[-6.6, 4.6, 2.6], [7.0, 3.6, 2.8], [-6.8, -3.8, 2.2], [6.8, -4.2, 1.8]]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.28, 0), new THREE.Vector2(0.4, 0.62), new THREE.Vector2(0.44, 0.7), new THREE.Vector2(0.4, 0.72)], 18), mats.pot));
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, h, 8), new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 0.9 }));
    trunk.position.y = 0.7 + h / 2;
    g.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = 0.7 + h;
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.rotation.order = 'YXZ';
      f.rotation.y = (i / 9) * Math.PI * 2;
      f.rotation.x = -0.9 + Math.random() * 0.5;
      crown.add(f);
    }
    g.add(crown);
    g.position.set(x, 0, z);
    scene.add(g);
    palms.push(crown);
  }

  // ciudad baja y torre de la Catedral al fondo
  {
    const city = [];
    for (let i = 0; i < 26; i++) {
      const w = 3 + Math.random() * 6, h = 3 + Math.random() * 5;
      city.push(box(w, h, 4 + Math.random() * 6, -60 + i * 5 + Math.random() * 3, -6, -36 - Math.random() * 30));
    }
    scene.add(new THREE.Mesh(merge(city), mats.city));
    const tower = cathedralTower(mats.tower, mats.towerDark);
    tower.position.set(-1, -8, -46);
    scene.add(tower);
    const tower2 = cathedralTower(mats.tower, mats.towerDark);
    tower2.position.set(17, -8, -50);
    tower2.scale.setScalar(0.98);
    scene.add(tower2);
    scene.add(new THREE.Mesh(box(15, 10, 6, 8, -8, -49), mats.city));
  }

  // guirnaldas de focos: catenarias del muro vegetal a los postes delanteros
  const bulbs = [];
  const wires = [];
  const posts = [[-7.4, 5.8], [-2.5, 6.0], [2.5, 6.0], [7.4, 5.8]];
  const anchors = [[-6.5, wallZ + 0.3], [-2.2, wallZ + 0.3], [2.2, wallZ + 0.3], [6.5, wallZ + 0.3]];
  const postGeo = [];
  posts.forEach(([x, z]) => { postGeo.push(box(0.08, 3.1, 0.08, x, 0, z)); });
  scene.add(new THREE.Mesh(merge(postGeo), mats.iron));
  const strands = [];
  for (let i = 0; i < 4; i++) strands.push([new THREE.Vector3(anchors[i][0], 3.3, anchors[i][1]), new THREE.Vector3(posts[i][0], 3.05, posts[i][1])]);
  for (let i = 0; i < 3; i++) strands.push([new THREE.Vector3(anchors[i][0], 3.3, anchors[i][1]), new THREE.Vector3(posts[i + 1][0], 3.05, posts[i + 1][1])]);
  strands.push([new THREE.Vector3(posts[0][0], 3.05, posts[0][1]), new THREE.Vector3(posts[3][0], 3.05, posts[3][1])]);
  let order = 0;
  const total = strands.reduce((acc, [a, b]) => acc + Math.floor(a.distanceTo(b) / 0.5), 0);
  strands.forEach(([a, b]) => {
    const n = Math.floor(a.distanceTo(b) / 0.5);
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.7;
      pts.push(p);
    }
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    wires.push(new THREE.Line(lg, mats.wire));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.7 + 0.08;
      bulbs.push({ p, order: (order++) / total });
    }
  });
  wires.forEach((w) => scene.add(w));
  const bulbGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  bulbGeo.index = quad.index;
  bulbGeo.setAttribute('position', quad.attributes.position);
  bulbGeo.setAttribute('uv', quad.attributes.uv);
  bulbGeo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(bulbs.flatMap((b) => [b.p.x, b.p.y, b.p.z])), 3));
  bulbGeo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(new Float32Array(bulbs.map((b) => b.order)), 1));
  bulbGeo.instanceCount = bulbs.length;
  const bulbUniforms = { uProgress: { value: 0 }, uDark: { value: 0 }, uTime: { value: 0 } };
  const bulbMesh = new THREE.Mesh(bulbGeo, new THREE.ShaderMaterial({
    uniforms: bulbUniforms, vertexShader: BULB_VS, fragmentShader: BULB_FS,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  bulbMesh.frustumCulled = false;
  bulbMesh.renderOrder = 5;
  scene.add(bulbMesh);
  // luz cálida de las guirnaldas sobre el suelo
  const garland = new THREE.PointLight('#ffc27a', 0, 14, 1.4);
  garland.position.set(0, 2.6, 1.2);
  scene.add(garland);

  // ── ciclo del cielo ──
  const state = { t: 0, start: 0, running: false };
  const pointer = { x: 0, y: 0 };
  const canvas = engine.canvas;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  const cDay = { sun: new THREE.Color('#fff3dd'), hemiS: new THREE.Color('#cfe4f2'), hemiG: new THREE.Color('#8a6f52') };
  const cSet = { sun: new THREE.Color('#ff9a52'), hemiS: new THREE.Color('#f2a27e'), hemiG: new THREE.Color('#5a3b33') };
  const cNight = { sun: new THREE.Color('#6a4a7a'), hemiS: new THREE.Color('#3a3f66'), hemiG: new THREE.Color('#2a1d22') };
  const tmpC = new THREE.Color();
  const skyAt = (t) => {
    const a = smoothstep(0, 1, t), b = smoothstep(1, 1.4, t);
    return [a, b];
  };

  const DURATION = 24;
  const view = {
    scene, camera,
    resize(w, h) {
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 64 : 50;
      // en escritorio la escena se desplaza a la derecha (el texto queda a la izquierda)
      camera.setViewOffset(w, h, w / h < 0.9 ? 0 : -w * 0.12, w / h < 0.9 ? -h * 0.12 : 0, w, h);
      camera.updateProjectionMatrix();
    },
    onEnter() { state.start = performance.now(); state.running = true; state.t = 0; },
    onExit() { state.running = false; },
    update(dt, time) {
      const el = (performance.now() - state.start) / 1000;
      const t = motion.reduced ? Math.min(1.05, el / 3) : clamp(el / DURATION, 0, 1) * 1.32;
      state.t = t;
      const [a, b] = skyAt(t);
      skyMat.uniforms.uT.value = t;
      skyMat.uniforms.uTime.value = time;
      // el sol baja detrás de la torre
      const sunH = lerp(0.62, -0.05, smoothstep(0, 1.25, t));
      sunDir.set(0.38, sunH, -1).normalize();
      sun.position.copy(sunDir).multiplyScalar(30);
      sun.target.position.set(0, 0, 0);
      tmpC.copy(cDay.sun).lerp(cSet.sun, a).lerp(cNight.sun, b);
      sun.color.copy(tmpC);
      sun.intensity = lerp(3.2, 2.2, a) * (1 - b * 0.85);
      hemi.color.copy(cDay.hemiS).lerp(cSet.hemiS, a).lerp(cNight.hemiS, b);
      hemi.groundColor.copy(cDay.hemiG).lerp(cSet.hemiG, a).lerp(cNight.hemiG, b);
      hemi.intensity = lerp(1.1, 0.75, a) * (1 - b * 0.55);
      waterMat.uniforms.uSky.value.copy(hemi.color);
      waterMat.uniforms.uTime.value = time;
      // los focos se encienden uno tras otro cuando empieza a caer la tarde
      const dark = smoothstep(0.45, 1.25, t);
      bulbUniforms.uDark.value = dark;
      bulbUniforms.uProgress.value = motion.reduced ? (t > 0.5 ? 1.02 : 0) : clamp((t - 0.42) / 0.5, 0, 1.02);
      bulbUniforms.uTime.value = time;
      garland.intensity = dark * 26 * Math.min(1, bulbUniforms.uProgress.value);
      // cámara: travelling lateral muy lento + paralaje
      const k = motion.reduced ? 0 : 1;
      const drift = Math.sin(el * 0.05) * 1.2 * k;
      const portrait = engine.size.w / engine.size.h < 0.9;
      camera.position.set(portrait ? 2.2 + drift * 0.5 : 4.2 + drift + pointer.x * 0.5 * k, 1.72 - pointer.y * 0.15 * k, portrait ? 6.9 : 6.2);
      camera.lookAt(portrait ? 1.2 : -0.2, 2.5, -6);
      palms.forEach((p, i) => { p.rotation.z = Math.sin(time * 0.7 + i) * 0.03 * k; });
    },
  };
  return view;
}
