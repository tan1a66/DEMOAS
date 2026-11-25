// =============================================================================
//  temple.js — il tempio di marmo sospeso sulle nuvole
// =============================================================================
//  Tutto è costruito nel codice (nessun modello esterno):
//  - cielo con sole, nuvole e mare di nuvole sotto la piattaforma
//  - piattaforma di marmo lucido con gradini, vasca d'acqua che riflette
//    (con caustiche sul fondo) e piedistallo al centro
//  - muri con archi, cornicione, colonne scanalate
//  - tende leggere mosse dal vento negli archi in fondo
//  - raggi di luce e nebbia bassa che si dirada con l'alba
//  Misure in "metri": la statua è alta 2 e sta sul piedistallo (PLINTH_TOP).

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE } from './glsl.js';
import { createStoneMaterial, addToneMapping } from './materials.js';

export const LAYOUT = {
  PLINTH_TOP: 0.7, // la base della statua poggia qui
  POOL: { x: 3.2, z: 3.6, bottom: -0.42, water: -0.08 },
  PLATFORM: { x0: -8.4, x1: 8.4, z0: -8.6, z1: 9.4, thickness: 1.4 },
  SIDE_WALL_X: 7.5,
  BACK_WALL_Z: -8.2,
  WALL_HEIGHT: 5.4,
};

// rumore 2D economico per cielo e nuvole
const NOISE2 = /* glsl */ `
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) {
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * n2(p); p = p * 2.03 + 17.3; a *= 0.5; }
  return f;
}`;

// =============================================================================
//  Cielo
// =============================================================================
function createSky() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uZenith: { value: new THREE.Color('#d9e1e8') },
    uHorizon: { value: new THREE.Color('#f4ece2') },
    uSunColor: { value: new THREE.Color('#ffe3bf') },
    uCloud: { value: new THREE.Color('#fbf6ef') },
    uMist: { value: 0.5 },
    uMoon: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // sempre sul fondo
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uZenith, uHorizon, uSunColor, uCloud;
      uniform float uMist, uMoon, uTime;
      varying vec3 vDir;
      ${NOISE2}
      void main() {
        vec3 d = normalize(vDir);
        float sd = max(dot(d, uSunDir), 0.0);
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, d.y));
        col += uSunColor * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.5);
        col += uSunColor * smoothstep(0.9993, 0.9998, sd) * 1.4;
        // nuvole alte, morbide
        vec2 uv = d.xz / (d.y + 0.18) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
        float c = fbm2(uv * 1.3);
        float clouds = smoothstep(0.48, 0.82, c) * smoothstep(-0.01, 0.2, d.y) * (1.0 - smoothstep(0.3, 0.75, d.y));
        vec3 cc = mix(uCloud, uSunColor * 1.15 + 0.08, pow(sd, 2.5) * 0.65);
        col = mix(col, cc, clouds * 0.8);
        // mare di nuvole sotto la piattaforma
        float below = smoothstep(0.015, -0.1, d.y);
        vec2 uv2 = d.xz / (-d.y + 0.06) * 1.1 + vec2(uTime * 0.006, uTime * 0.0025);
        float c2 = fbm2(uv2);
        vec3 sea = mix(uHorizon * 0.9, uCloud, smoothstep(0.32, 0.78, c2));
        sea = mix(sea, uSunColor * 1.1, pow(sd, 6.0) * 0.35 * smoothstep(0.4, 0.8, c2));
        col = mix(col, sea, below);
        // foschia all'orizzonte (all'alba più fitta)
        col = mix(col, uHorizon, (0.25 + uMist * 0.6) * (1.0 - smoothstep(0.0, 0.3 + uMist * 0.3, abs(d.y))));
        // luna (nel finale)
        vec3 moonDir = normalize(vec3(-0.55, 0.42, -0.72));
        float md = dot(d, moonDir);
        float moon = smoothstep(0.99955, 0.9997, md);
        float craters = 0.85 + 0.15 * fbm2(d.xy * 900.0);
        col = mix(col, vec3(1.0, 0.97, 0.9) * craters, moon * uMoon * 0.85);
        col += vec3(1.0, 0.95, 0.85) * pow(max(md, 0.0), 400.0) * uMoon * 0.15;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// =============================================================================
//  Architettura
// =============================================================================

/** Muro con aperture ad arco che arrivano a terra (contorno unico, niente buchi). */
function archWall({ length, height, thickness, arches }) {
  const s = new THREE.Shape();
  s.moveTo(-length / 2, 0);
  for (const a of [...arches].sort((u, v) => u.c - v.c)) {
    const r = a.w / 2;
    s.lineTo(a.c - r, 0);
    s.lineTo(a.c - r, a.spring);
    s.absarc(a.c, a.spring, r, Math.PI, 0, true);
    s.lineTo(a.c + r, 0);
  }
  s.lineTo(length / 2, 0);
  s.lineTo(length / 2, height);
  s.lineTo(-length / 2, height);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 40,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/** Colonna scanalata: profilo al tornio + scanalature + abaco quadrato. */
function columnGeometry(height) {
  const pts = [];
  const shaft0 = 0.32, shaft1 = height - 0.42;
  const prof = [
    [0.0, 0], [0.44, 0], [0.44, 0.1], [0.4, 0.13], [0.4, 0.17], [0.35, 0.22], [0.32, 0.26],
    [0.3, shaft0], [0.27, shaft1],
    [0.29, shaft1 + 0.06], [0.33, shaft1 + 0.14], [0.39, shaft1 + 0.24], [0.42, shaft1 + 0.28], [0.0, shaft1 + 0.28],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const segs = 96;
  const lathe = new THREE.LatheGeometry(pts, segs);
  // scanalature: solchi verticali sul fusto
  const p = lathe.attributes.position;
  const FLUTES = 20;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < shaft0 - 0.001 || y > shaft1 + 0.001) continue;
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const th = Math.atan2(z, x);
    const k = 1 - 0.055 * Math.pow(0.5 + 0.5 * Math.cos(th * FLUTES), 2.2);
    p.setXYZ(i, (x / r) * r * k, y, (z / r) * r * k);
  }
  lathe.deleteAttribute('uv');
  lathe.computeVertexNormals();
  const abacus = new THREE.BoxGeometry(0.98, 0.16, 0.98, 1, 1, 1);
  abacus.translate(0, shaft1 + 0.36, 0);
  abacus.deleteAttribute('uv');
  const plinth = new THREE.BoxGeometry(0.98, 0.1, 0.98);
  plinth.translate(0, 0.05, 0);
  plinth.deleteAttribute('uv');
  return mergeGeometries([lathe.toNonIndexed(), abacus.toNonIndexed(), plinth.toNonIndexed()]);
}

function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

// =============================================================================
//  Acqua: riflesso (Reflector) + increspature + trasparenza sul fondo
// =============================================================================
function createWater(width, depth, resolution) {
  const shader = {
    name: 'WaterShader',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color('#e8eef0') },
      uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uTint;
      uniform vec3 uCamPos;
      varying vec4 vUv;
      varying vec3 vWorld;
      ${NOISE2}
      void main() {
        vec2 p = vWorld.xz;
        vec2 rip = vec2(n2(p * 2.2 + uTime * 0.22), n2(p * 2.2 - uTime * 0.19 + 7.0)) - 0.5;
        rip += 0.5 * (vec2(n2(p * 6.0 - uTime * 0.4), n2(p * 6.0 + uTime * 0.37 + 3.0)) - 0.5);
        vec4 uv = vUv;
        uv.xy += rip * 0.035 * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        vec3 V = normalize(uCamPos - vWorld);
        float fres = 0.08 + 0.92 * pow(1.0 - max(V.y, 0.0), 4.0);
        vec3 col = mix(uTint, refl, clamp(fres + 0.35, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(0.5 + fres * 0.7, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
  };
  const water = new Reflector(new THREE.PlaneGeometry(width, depth), {
    shader,
    textureWidth: Math.round(window.innerWidth * resolution),
    textureHeight: Math.round(window.innerHeight * resolution),
    clipBias: 0.003,
  });
  water.material.transparent = true;
  water.material.toneMapped = false;
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 2;
  return water;
}

/** Fondo della vasca con caustiche animate */
function createPoolBottom(width, depth, y) {
  const mat = createStoneMaterial({ tone: '#efe7dc', roughness: 0.6, veins: 0.4 });
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    prev(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE2)
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec2 q = vWorldPos.xz * 1.6;
          float c1 = abs(n2(q + uTime * 0.25) - n2(q * 1.3 - uTime * 0.21 + 4.0));
          float c2 = abs(n2(q * 2.1 - uTime * 0.3) - n2(q * 1.7 + uTime * 0.27 + 9.0));
          float caustic = pow(1.0 - smoothstep(0.0, 0.12, min(c1, c2)), 2.0);
          totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * caustic * 0.32;
        }`
      );
  };
  mat.customProgramCacheKey = () => 'pool-bottom';
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// =============================================================================
//  Tende: piano con pieghe e vento nel vertex shader
// =============================================================================
function createCurtain({ width, height, side, phase }) {
  // side = -1: tenda di sinistra (bordo esterno a sinistra), +1: di destra.
  // In coordinate locali il bordo esterno è in x = 0 e la tenda pende da y = 0.
  const geo = new THREE.PlaneGeometry(width, height, 28, 56);
  geo.translate((-side * width) / 2, -height / 2, 0);
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.4 }, uOpen: { value: 0 }, uGlow: { value: new THREE.Color('#ffe7c9') }, uBack: { value: 0.3 } };
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbf8f3'),
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  mat.toneMapped = false;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime, uWind, uOpen;
        vec3 curtain(vec3 p) {
          float w = ${width.toFixed(3)}, h = ${height.toFixed(3)};
          float u = abs(p.x) / w;         // 0 = bordo verso il centro dell'arco
          float v = clamp(-p.y / h, 0.0, 1.0); // 0 in alto, 1 in basso
          // si raccoglie verso il bordo esterno (tenda aperta), più in basso che in alto
          p.x = mix(p.x, p.x * 0.32, uOpen * (0.3 + 0.7 * v));
          // pieghe verticali
          p.z += sin(p.x * 11.0) * 0.045 + sin(p.x * 23.0 + 1.3) * 0.015;
          // vento: si gonfia verso l'interno, di più in basso
          float t = uTime + ${phase.toFixed(2)};
          float gust = 0.6 + 0.4 * sin(t * 0.37);
          p.z += (sin(t * 0.9 + p.x * 1.6 + v * 2.2) * 0.5 + sin(t * 1.7 + p.x * 3.1 - v * 1.3) * 0.25 + 0.55) * v * v * uWind * gust;
          p.x += sin(t * 0.7 + v * 3.0) * 0.08 * v * uWind;
          return p;
        }`
      )
      .replace('#include <beginnormal_vertex>', `
        vec3 p0 = curtain(position);
        vec3 px = curtain(position + vec3(0.02, 0.0, 0.0));
        vec3 py = curtain(position + vec3(0.0, 0.02, 0.0));
        vec3 objectNormal = normalize(cross(px - p0, py - p0));`)
      .replace('#include <begin_vertex>', 'vec3 transformed = p0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlow;\nuniform float uBack;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * uBack;');
    addToneMapping(shader);
  };
  mat.customProgramCacheKey = () => `curtain-${width}-${height}-${side}-${phase}`;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// =============================================================================
//  Raggi di luce (piani additivi incrociati) e nebbia bassa
// =============================================================================
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#fff0d8') }, uAmount: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmount; uniform float uTime;
      varying vec2 vUv; varying vec3 vWorld;
      ${NOISE2}
      void main() {
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        across = smoothstep(0.0, 0.8, across);
        float along = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float n = 0.65 + 0.35 * n2(vec2(vUv.x * 5.0 + uTime * 0.05, vUv.y * 2.0 - uTime * 0.03));
        float a = across * along * n * uAmount * 0.16;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function mistMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#f6f1ea') }, uAmount: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec4 vView;
      void main() { vWorld = (modelMatrix * vec4(position, 1.0)).xyz; vView = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * vView; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmount; uniform float uTime;
      varying vec3 vWorld; varying vec4 vView;
      ${NOISE2}
      void main() {
        vec2 p = vWorld.xz * 0.22 + vec2(uTime * 0.02, uTime * 0.008);
        float n = fbm2(p) * 0.7 + fbm2(p * 2.7 - uTime * 0.01) * 0.3;
        float a = smoothstep(0.35, 0.8, n) * uAmount * 0.55;
        // si dissolve vicino alla camera e ai bordi della piattaforma
        a *= smoothstep(0.6, 3.0, -vView.z);
        a *= 1.0 - smoothstep(9.0, 16.0, length(vWorld.xz));
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// =============================================================================
//  Montaggio
// =============================================================================
export function createTemple({ quality }) {
  const group = new THREE.Group();
  group.name = 'temple';
  const L = LAYOUT;
  const P = L.POOL;
  const F = L.PLATFORM;

  const sky = createSky();
  group.add(sky.mesh);

  // ---- piattaforma (4 lastre attorno alla vasca) + fondo vasca + gradini ----
  const floorMat = createStoneMaterial({ tone: '#f3eee6', roughness: 0.22, veins: 0.32, polished: true });
  const slabs = [
    box(F.x0, F.x1, -F.thickness, 0, P.z, F.z1),
    box(F.x0, F.x1, -F.thickness, 0, F.z0, -P.z),
    box(F.x0, -P.x, -F.thickness, 0, -P.z, P.z),
    box(P.x, F.x1, -F.thickness, 0, -P.z, P.z),
    box(-P.x, P.x, -F.thickness, P.bottom, -P.z, P.z),
  ];
  // gradini davanti, che scendono verso le nuvole
  for (let i = 1; i <= 5; i++) slabs.push(box(-3.4, 3.4, -F.thickness, -0.24 * i, F.z1, F.z1 + 0.5 * i));
  const floor = new THREE.Mesh(mergeGeometries(slabs), floorMat);
  floor.receiveShadow = true;
  group.add(floor);
  group.add(createPoolBottom(P.x * 2, P.z * 2, P.bottom + 0.002));

  // ---- piedistallo ----
  const plinthMat = createStoneMaterial({ tone: '#efe9df', roughness: 0.45, veins: 0.4 });
  const plinthGeo = mergeGeometries([
    box(-0.5, 0.5, P.bottom, L.PLINTH_TOP - 0.08, -0.5, 0.5),
    box(-0.58, 0.58, L.PLINTH_TOP - 0.08, L.PLINTH_TOP, -0.58, 0.58),
    box(-0.58, 0.58, P.bottom, P.bottom + 0.16, -0.58, 0.58),
  ]);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.castShadow = plinth.receiveShadow = true;
  group.add(plinth);

  // ---- acqua ----
  const water = createWater(P.x * 2, P.z * 2, quality.reflection);
  water.position.y = P.water;
  group.add(water);

  // ---- muri con archi, cornicioni ----
  const wallMat = createStoneMaterial({ tone: '#f1ebe2', roughness: 0.88, veins: 0.15, stucco: true });
  const H = L.WALL_HEIGHT;
  const sideArches = [-4.6, -0.6, 3.4].map((c) => ({ c, w: 2.5, spring: 2.9 }));
  const side = archWall({ length: 16.4, height: H, thickness: 0.7, arches: sideArches });
  const backArches = [{ c: -4.6, w: 2.6, spring: 3.0 }, { c: 0, w: 3.6, spring: 3.4 }, { c: 4.6, w: 2.6, spring: 3.0 }];
  const back = archWall({ length: 2 * L.SIDE_WALL_X + 0.7, height: H + 1.2, thickness: 0.7, arches: backArches });
  const walls = [];
  for (const sgn of [-1, 1]) {
    const g = side.clone();
    g.rotateY(Math.PI / 2);
    g.translate(sgn * L.SIDE_WALL_X, 0, -1.0);
    walls.push(g.toNonIndexed());
  }
  const bg = back.clone();
  bg.translate(0, 0, L.BACK_WALL_Z);
  walls.push(bg.toNonIndexed());
  // cornicioni
  walls.push(box(-L.SIDE_WALL_X - 0.55, -L.SIDE_WALL_X + 0.55, H, H + 0.3, -9.2 + 0.55, 7.2));
  walls.push(box(L.SIDE_WALL_X - 0.55, L.SIDE_WALL_X + 0.55, H, H + 0.3, -9.2 + 0.55, 7.2));
  walls.push(box(-L.SIDE_WALL_X - 0.55, L.SIDE_WALL_X + 0.55, H + 1.2, H + 1.5, L.BACK_WALL_Z - 0.55, L.BACK_WALL_Z + 0.55));
  for (const g of walls) {
    if (g.attributes.uv) g.deleteAttribute('uv');
  }
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), wallMat);
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // ---- colonne scanalate davanti ai pilastri ----
  const colGeo = columnGeometry(H);
  const colPos = [];
  for (const sgn of [-1, 1]) for (const z of [-6.6, -2.6, 1.4, 5.4]) colPos.push([sgn * (L.SIDE_WALL_X - 0.75), z]);
  for (const x of [-6.6, -2.45, 2.45, 6.6]) colPos.push([x, L.BACK_WALL_Z + 0.75]);
  const columns = new THREE.InstancedMesh(colGeo, createStoneMaterial({ tone: '#f4efe7', roughness: 0.6, veins: 0.25 }), colPos.length);
  const m4 = new THREE.Matrix4();
  colPos.forEach(([x, z], i) => columns.setMatrixAt(i, m4.makeTranslation(x, 0, z)));
  columns.castShadow = columns.receiveShadow = true;
  group.add(columns);

  // ---- tende negli archi in fondo ----
  const curtains = [];
  let ph = 0;
  for (const a of backArches) {
    const hgt = a.spring + a.w / 2 - 0.3;
    for (const sgn of [-1, 1]) {
      const c = createCurtain({ width: a.w / 2 + 0.18, height: hgt, side: sgn, phase: (ph += 1.7) });
      // appesa davanti all'arco, dal suo bordo esterno verso il centro
      c.mesh.position.set(a.c + sgn * (a.w / 2 + 0.06), hgt + 0.02, L.BACK_WALL_Z + 0.45);
      curtains.push(c);
      group.add(c.mesh);
    }
  }

  // ---- raggi di luce dagli archi in fondo ----
  const beamMat = beamMaterial();
  const beams = new THREE.Group();
  for (const a of backArches) {
    for (const rot of [0, Math.PI / 2]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(a.w * 0.9, 14), beamMat);
      plane.geometry.translate(0, 7, 0); // parte dall'arco e si allunga
      plane.rotation.order = 'YXZ';
      plane.userData = { x: a.c, rot };
      beams.add(plane);
    }
  }
  group.add(beams);

  // ---- nebbia bassa (all'alba) ----
  const mistMat = mistMaterial();
  const mist = new THREE.Group();
  for (const y of [0.25, 0.75, 1.4]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), mistMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 6;
    mist.add(m);
  }
  group.add(mist);

  const curtainUniforms = curtains.map((c) => c.uniforms);
  const dir = new THREE.Vector3();
  return {
    group,
    sky,
    water,
    floor,
    /** Stato dell'ambiente (vedi LIGHTS in drone-path.js) */
    update({ time, sunDir, sky: s, mist: mistAmount, wind, open, beams: beamAmount, moon, sunColor, cameraPos }) {
      sky.uniforms.uTime.value = time;
      sky.uniforms.uSunDir.value.copy(sunDir);
      sky.uniforms.uZenith.value.copy(s.zenith);
      sky.uniforms.uHorizon.value.copy(s.horizon);
      sky.uniforms.uSunColor.value.copy(sunColor);
      sky.uniforms.uMist.value = mistAmount;
      sky.uniforms.uMoon.value = moon;
      water.material.uniforms.uTime.value = time;
      water.material.uniforms.uCamPos.value.copy(cameraPos);
      for (const u of curtainUniforms) {
        u.uTime.value = time;
        u.uWind.value = wind;
        u.uOpen.value = open;
        u.uBack.value = 0.12 + 0.35 * Math.max(0, -sunDir.z) * beamAmount;
        u.uGlow.value.copy(sunColor);
      }
      // raggi: orientati come la luce del sole che entra dagli archi
      dir.copy(sunDir).negate();
      beams.children.forEach((b) => {
        b.position.set(b.userData.x, 2.6, LAYOUT.BACK_WALL_Z);
        b.lookAt(b.position.clone().add(dir));
        b.rotateX(Math.PI / 2);
        b.rotateY(b.userData.rot);
      });
      beamMat.uniforms.uAmount.value = beamAmount;
      beamMat.uniforms.uTime.value = time;
      beamMat.uniforms.uColor.value.copy(sunColor);
      mistMat.uniforms.uAmount.value = mistAmount;
      mistMat.uniforms.uTime.value = time;
      mist.visible = mistAmount > 0.01;
    },
  };
}
