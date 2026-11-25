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
  WALL_HEIGHT: 7.4, // muri laterali (quello in fondo è più alto)
  BACK_HEIGHT: 8.6,
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
    uSea: { value: new THREE.Color('#4c7f9c') },
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
      uniform vec3 uSunDir, uZenith, uHorizon, uSunColor, uCloud, uSea;
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
        // il mare, sotto l'orizzonte: blu profondo, più chiaro lontano,
        // con il luccichio del sole che danza sulle onde
        float below = smoothstep(0.004, -0.02, d.y);
        float far = smoothstep(-0.25, 0.0, d.y);
        vec2 uv2 = d.xz / (-d.y + 0.02) * 2.2 + vec2(uTime * 0.02, uTime * 0.008);
        float waves = fbm2(uv2 * 3.0);
        vec3 sea = mix(uSea * 0.75, mix(uSea, uHorizon, 0.45), far);
        vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
        float glitterDir = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), sunFlat), 0.0), 40.0);
        float glitter = smoothstep(0.62, 0.8, waves) * glitterDir * (0.4 + uSunDir.y * 2.0);
        sea += uSunColor * glitter * 1.4;
        sea = mix(sea, uHorizon, far * far * 0.55); // foschia sul mare lontano
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

/**
 * Colonna: base, fusto scanalato con leggera rastremazione e capitello
 * "corinzio" stilizzato (campana a foglie + abaco), una geometria a parte.
 */
function columnGeometry(height) {
  const capH = 0.62; // altezza del capitello
  const shaft0 = 0.36, shaft1 = height - capH - 0.06;
  const prof = [
    [0.0, 0], [0.5, 0], [0.5, 0.12], [0.46, 0.15], [0.47, 0.2], [0.41, 0.25], [0.4, 0.29], [0.35, 0.33],
    [0.33, shaft0], [0.29, shaft1], [0.32, shaft1 + 0.02], [0.32, shaft1 + 0.06], [0.0, shaft1 + 0.06],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(prof, 120);
  const p = lathe.attributes.position;
  const FLUTES = 24;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < shaft0 - 0.001 || y > shaft1 + 0.001) continue;
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const k = 1 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos(Math.atan2(z, x) * FLUTES), 2.4);
    p.setXYZ(i, x * k, y, z * k);
  }
  lathe.deleteAttribute('uv');
  lathe.computeVertexNormals();
  const plinth = new THREE.BoxGeometry(1.08, 0.12, 1.08);
  plinth.translate(0, 0.06, 0);
  plinth.deleteAttribute('uv');
  const shaft = mergeGeometries([lathe.toNonIndexed(), plinth.toNonIndexed()]);

  // capitello: campana che si allarga, con due giri di "foglie" (costole)
  const y0 = shaft1 + 0.06;
  const bell = new THREE.LatheGeometry(
    [[0.0, 0], [0.31, 0], [0.33, 0.08], [0.37, 0.2], [0.43, 0.34], [0.5, 0.44], [0.0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)),
    96
  );
  const bp = bell.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const th = Math.atan2(z, x);
    const row = y < 0.22 ? 0 : 1; // due giri di foglie sfalsati
    const leaf = Math.pow(Math.abs(Math.sin(th * 8 + row * 0.39)), 0.6);
    const k = 1 + 0.12 * leaf * Math.sin(Math.min(1, y / 0.44) * Math.PI);
    bp.setXYZ(i, x * k, y, z * k);
  }
  bell.translate(0, y0, 0);
  bell.deleteAttribute('uv');
  bell.computeVertexNormals();
  const abacus = new THREE.BoxGeometry(1.08, 0.14, 1.08);
  abacus.translate(0, y0 + 0.51, 0);
  abacus.deleteAttribute('uv');
  const capital = mergeGeometries([bell.toNonIndexed(), abacus.toNonIndexed()]);
  return { shaft, capital };
}

/** Fascia ad arco (archivolto): corona circolare tra r1 e r2, in rilievo di depth */
function archBand(a, r1, r2, depth, z) {
  const sh = new THREE.Shape();
  sh.moveTo(a.c + r2, a.spring);
  sh.absarc(a.c, a.spring, r2, 0, Math.PI, false);
  sh.lineTo(a.c - r1, a.spring);
  sh.absarc(a.c, a.spring, r1, Math.PI, 0, true);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 56 });
  g.translate(0, 0, z);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/** Chiave di volta: trapezio in rilievo in cima all'arco */
function keystone(a, z) {
  const r = a.w / 2;
  const sh = new THREE.Shape();
  sh.moveTo(a.c - 0.17, a.spring + r - 0.06);
  sh.lineTo(a.c + 0.17, a.spring + r - 0.06);
  sh.lineTo(a.c + 0.27, a.spring + r + 0.56);
  sh.lineTo(a.c - 0.27, a.spring + r + 0.56);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  g.translate(0, 0, z);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/**
 * Decorazioni di un muro sulla faccia z = face (verso il cortile): archivolti
 * a due fasce, imposte, stipiti, trabeazione (architrave, fregio, cornice).
 * Restituisce la pietra e le chiavi di volta separate.
 */
function wallOrnaments({ arches, length, height, face }) {
  const stone = [];
  const gold = [];
  for (const a of arches) {
    const r = a.w / 2;
    stone.push(archBand(a, r, r + 0.26, 0.07, face));
    stone.push(archBand(a, r + 0.26, r + 0.36, 0.14, face));
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? a.c - r - 0.42 : a.c + r;
      const x1 = sgn < 0 ? a.c - r : a.c + r + 0.42;
      stone.push(box(x0, x1, a.spring - 0.2, a.spring, face, face + 0.16)); // imposta
      const j0 = sgn < 0 ? a.c - r - 0.26 : a.c + r;
      const j1 = sgn < 0 ? a.c - r : a.c + r + 0.26;
      stone.push(box(j0, j1, 0, a.spring - 0.2, face, face + 0.06)); // stipite
    }
    gold.push(keystone(a, face));
  }
  // trabeazione lungo tutto il muro
  const L2 = length / 2;
  stone.push(box(-L2, L2, height - 1.05, height - 0.7, face, face + 0.22)); // architrave
  stone.push(box(-L2, L2, height - 0.7, height - 0.32, face, face + 0.12)); // fregio
  stone.push(box(-L2, L2, height - 0.32, height - 0.2, face, face + 0.42)); // listello
  stone.push(box(-L2, L2, height - 0.2, height, face, face + 0.58)); // cornice
  return { stone, gold };
}

/** Dentelli sotto la cornice: posizioni lungo il muro */
function dentilPositions(length, y, face, step = 0.26) {
  const out = [];
  for (let x = -length / 2 + 0.2; x < length / 2 - 0.1; x += step) out.push([x, y, face]);
  return out;
}

/** Vaso monumentale (cratere) su piedistallo, al tornio */
function urnGeometry() {
  const prof = [
    [0, 0], [0.42, 0], [0.42, 0.62], [0.36, 0.66], [0.36, 0.7], [0.2, 0.74], [0.14, 0.82], [0.17, 0.9], [0.3, 1.0],
    [0.44, 1.18], [0.5, 1.36], [0.46, 1.52], [0.34, 1.62], [0.3, 1.7], [0.42, 1.78], [0.46, 1.84], [0.4, 1.86], [0, 1.86],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 72);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const ped = new THREE.BoxGeometry(0.9, 0.62, 0.9);
  ped.translate(0, 0.31, 0);
  ped.deleteAttribute('uv');
  return mergeGeometries([g.toNonIndexed(), ped.toNonIndexed()]);
}

/** Cipresso: colonna verde scura che si stringe in punta, chioma a ciuffi */
function cypressGeometry(height = 5.4) {
  const pts = [];
  const N = 44;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let r;
    if (t < 0.05) r = 0.11; // tronco
    else r = 0.62 * Math.pow(1 - t, 0.78) * (0.55 + 0.45 * Math.min(1, (t - 0.05) / 0.22));
    pts.push(new THREE.Vector2(Math.max(r, 0.001), t * height));
  }
  const g = new THREE.LatheGeometry(pts, 40);
  // chioma: ciuffi irregolari (rumore semplice in angolo e altezza)
  const p = g.attributes.position;
  const n2 = (a, b) => Math.sin(a * 1.7 + Math.sin(b * 2.3)) * Math.cos(b * 1.3 + a * 0.6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < height * 0.05) continue;
    const th = Math.atan2(z, x);
    const k = 1 + 0.16 * n2(th * 3, y * 2.4) + 0.08 * n2(th * 7 + 2, y * 6.1);
    p.setXYZ(i, x * k, y, z * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
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
      uTint: { value: new THREE.Color('#c4dfdb') },
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
  const mat = createStoneMaterial({ tone: '#e9eeeb', roughness: 0.45, veins: 0.35 });
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
  const floorMat = createStoneMaterial({ tone: '#f3eee6', roughness: 0.22, veins: 0.32, polished: true, inlay: true });
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

  // ---- muri con archi, decorazioni e colonne ----
  const wallMat = createStoneMaterial({ tone: '#f1ebe2', roughness: 0.88, veins: 0.15, stucco: true });
  const ornMat = createStoneMaterial({ tone: '#f5f0e8', roughness: 0.55, veins: 0.3 });
  // capitelli e chiavi di volta: marmo bianco un po' più lucido dei muri
  const carvedMat = createStoneMaterial({ tone: '#f7f3ec', roughness: 0.42, veins: 0.25 });
  const H = L.WALL_HEIGHT, HB = L.BACK_HEIGHT, T = 0.7;
  const sideLen = 16.4;
  const sideArches = [-4.6, -0.6, 3.4].map((c) => ({ c, w: 2.8, spring: 4.0 }));
  const backArches = [{ c: -5.0, w: 2.8, spring: 4.0 }, { c: 0, w: 4.2, spring: 4.6 }, { c: 5.0, w: 2.8, spring: 4.0 }];
  const backLen = 2 * L.SIDE_WALL_X + T;
  const noUV = (g) => {
    if (g.attributes.uv) g.deleteAttribute('uv');
    return g;
  };

  // muro sinistro costruito "di fronte" e poi ruotato; il destro è lo specchio
  const sideWall = archWall({ length: sideLen, height: H, thickness: T, arches: sideArches });
  const sideOrn = wallOrnaments({ arches: sideArches, length: sideLen, height: H, face: T / 2 });
  const toLeft = new THREE.Matrix4().makeTranslation(-L.SIDE_WALL_X, 0, -1.0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const leftStone = mergeGeometries([noUV(sideWall), ...sideOrn.stone]);
  leftStone.applyMatrix4(toLeft);
  const leftGold = mergeGeometries(sideOrn.gold);
  leftGold.applyMatrix4(toLeft);

  const backWall = archWall({ length: backLen, height: HB, thickness: T, arches: backArches });
  const backOrn = wallOrnaments({ arches: backArches, length: backLen, height: HB, face: T / 2 });
  const backStone = mergeGeometries([noUV(backWall), ...backOrn.stone]);
  backStone.translate(0, 0, L.BACK_WALL_Z);
  const backGold = mergeGeometries(backOrn.gold);
  backGold.translate(0, 0, L.BACK_WALL_Z);

  const addMesh = (geo, mat, mirror = false) => {
    const m = new THREE.Mesh(geo, mat);
    if (mirror) m.scale.x = -1; // specchio: il muro destro
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  addMesh(leftStone, wallMat);
  addMesh(leftStone, wallMat, true);
  addMesh(backStone, wallMat);
  addMesh(leftGold, carvedMat);
  addMesh(leftGold, carvedMat, true);
  addMesh(backGold, carvedMat);

  // dentelli sotto le cornici (lato cortile)
  const dentGeo = new THREE.BoxGeometry(0.13, 0.15, 0.12);
  dentGeo.deleteAttribute('uv');
  const dent = [];
  for (const [x, y, f] of dentilPositions(sideLen, H - 0.4, T / 2 + 0.17)) {
    const v = new THREE.Vector3(x, y, f).applyMatrix4(toLeft);
    dent.push(v, new THREE.Vector3(-v.x, v.y, v.z));
  }
  for (const [x, y, f] of dentilPositions(backLen, HB - 0.4, T / 2 + 0.17)) dent.push(new THREE.Vector3(x, y, L.BACK_WALL_Z + f));
  const dentils = new THREE.InstancedMesh(dentGeo, ornMat, dent.length);
  const m4 = new THREE.Matrix4();
  dent.forEach((v, i) => dentils.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
  dentils.castShadow = true;
  group.add(dentils);

  // colonne davanti ai pilastri, con capitello corinzio stilizzato
  const col = columnGeometry(H - 1.05);
  const colPos = [];
  for (const sgn of [-1, 1]) for (const z of [-6.4, -2.4, 1.6, 5.6]) colPos.push([sgn * (L.SIDE_WALL_X - T / 2 - 0.55), z]);
  for (const x of [-6.9, -2.85, 2.85, 6.9]) colPos.push([x, L.BACK_WALL_Z + T / 2 + 0.55]);
  const shafts = new THREE.InstancedMesh(col.shaft, createStoneMaterial({ tone: '#f4efe7', roughness: 0.5, veins: 0.3 }), colPos.length);
  const capitals = new THREE.InstancedMesh(col.capital, carvedMat, colPos.length);
  colPos.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0, z);
    shafts.setMatrixAt(i, m4);
    capitals.setMatrixAt(i, m4);
  });
  shafts.castShadow = shafts.receiveShadow = true;
  capitals.castShadow = true;
  group.add(shafts, capitals);

  // vasi monumentali agli angoli della vasca
  const urns = new THREE.InstancedMesh(urnGeometry(), ornMat, 4);
  [[-P.x - 1.1, P.z + 1.1], [P.x + 1.1, P.z + 1.1], [-P.x - 1.1, -P.z - 1.1], [P.x + 1.1, -P.z - 1.1]].forEach(([x, z], i) => urns.setMatrixAt(i, m4.makeTranslation(x, 0, z)));
  urns.castShadow = urns.receiveShadow = true;
  group.add(urns);

  // cipressi in fioriere di marmo negli angoli in fondo, davanti agli archi
  // laterali (come in un giardino all'italiana): il verde mediterraneo
  const cypressMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e4630'), roughness: 0.95 });
  cypressMat.toneMapped = false;
  cypressMat.onBeforeCompile = (shader) => addToneMapping(shader);
  const cyPos = [[-5.0, -6.3], [5.0, -6.3]];
  const cypresses = new THREE.InstancedMesh(cypressGeometry(), cypressMat, cyPos.length);
  const planters = new THREE.InstancedMesh(box(-0.5, 0.5, 0, 0.55, -0.5, 0.5), ornMat, cyPos.length);
  cyPos.forEach(([x, z], i) => {
    const sc = 0.9 + ((i * 37) % 10) / 40;
    cypresses.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.4, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3), new THREE.Vector3(1, sc, 1)));
    planters.setMatrixAt(i, m4.makeTranslation(x, 0, z));
  });
  cypresses.castShadow = cypresses.receiveShadow = true;
  planters.castShadow = planters.receiveShadow = true;
  group.add(cypresses, planters);

  // ---- tende negli archi in fondo ----
  const curtains = [];
  let ph = 0;
  for (const a of backArches) {
    const hgt = a.spring + a.w / 2 - 0.4;
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
      plane.userData = { x: a.c, y: a.spring * 0.75, rot };
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
    /** raggi disegnati (piani): servono dove non c'è la luce volumetrica */
    setBeamPlanes(on) {
      beams.visible = on;
    },
    /** Stato dell'ambiente (vedi LIGHTS in drone-path.js) */
    update({ time, sunDir, sky: s, mist: mistAmount, wind, open, beams: beamAmount, moon, sunColor, cameraPos }) {
      sky.uniforms.uTime.value = time;
      sky.uniforms.uSunDir.value.copy(sunDir);
      sky.uniforms.uZenith.value.copy(s.zenith);
      sky.uniforms.uHorizon.value.copy(s.horizon);
      sky.uniforms.uSunColor.value.copy(sunColor);
      sky.uniforms.uMist.value = mistAmount;
      sky.uniforms.uMoon.value = moon;
      if (s.sea) sky.uniforms.uSea.value.copy(s.sea);
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
        b.position.set(b.userData.x, b.userData.y, LAYOUT.BACK_WALL_Z);
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
