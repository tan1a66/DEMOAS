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
  // tutti i muri alla stessa altezza: le trabeazioni girano l'angolo senza
  // spigoli tagliati contro il cielo
  WALL_HEIGHT: 8.4,
  BACK_HEIGHT: 8.4,
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
 * dorico (echino + abaco), una geometria a parte.
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

  // capitello dorico: echino morbido e abaco, linee pulite
  const y0 = shaft1 + 0.06;
  const bell = new THREE.LatheGeometry(
    [[0.0, 0], [0.31, 0], [0.31, 0.05], [0.34, 0.07], [0.34, 0.1], [0.38, 0.17], [0.45, 0.27], [0.5, 0.38], [0.52, 0.44], [0.0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)),
    96
  );
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
  const carved = [];
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
    carved.push(keystone(a, face));
  }
  // trabeazione lungo tutto il muro
  const L2 = length / 2;
  stone.push(box(-L2, L2, height - 1.05, height - 0.7, face, face + 0.22)); // architrave
  stone.push(box(-L2, L2, height - 0.7, height - 0.32, face, face + 0.12)); // fregio
  stone.push(box(-L2, L2, height - 0.32, height - 0.2, face, face + 0.42)); // listello
  stone.push(box(-L2, L2, height - 0.2, height, face, face + 0.58)); // cornice
  return { stone, carved };
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
        uv.xy += rip * 0.012 * uv.w;
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
const causticAmount = { value: 0.1 }; // più forti quando la camera è sott'acqua
function createPoolBottom(width, depth, y) {
  const mat = createStoneMaterial({ tone: '#e9eeeb', roughness: 0.45, veins: 0.35 });
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    prev(shader);
    shader.uniforms.uCaustic = causticAmount;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCaustic;\n' + NOISE2)
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec2 q = vWorldPos.xz * 1.6;
          float c1 = abs(n2(q + uTime * 0.25) - n2(q * 1.3 - uTime * 0.21 + 4.0));
          float c2 = abs(n2(q * 2.1 - uTime * 0.3) - n2(q * 1.7 + uTime * 0.27 + 9.0));
          float caustic = pow(1.0 - smoothstep(0.0, 0.12, min(c1, c2)), 2.0);
          totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * caustic * uCaustic;
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
function createCurtain({ width, side, arch, worldX, style }) {
  // side = -1: tenda appesa dal lato sinistro dell'arco, +1: dal destro.
  // Coordinate locali: bordo esterno in x = 0, pavimento in y = 0. La geometria
  // ha altezza 1 e nello shader viene "appesa" alla curva dell'arco: il bordo
  // alto segue l'arco invece di essere una linea dritta.
  // style: il carattere della tenda (vedi CURTAINS più sotto).
  const st = { gather: 1, keep: 0.32, tie: 0, wind: 1, folds: 1, pool: 0, seed: 0, ...style };
  const geo = new THREE.PlaneGeometry(width, 1, 30, 72);
  geo.translate((-side * width) / 2, 0.5, 0);
  const cLocal = -side * arch.inner; // centro dell'arco rispetto al bordo esterno
  const f = (x) => Number(x).toFixed(4);
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.4 }, uOpen: { value: 0 }, uGlow: { value: new THREE.Color('#ffe7c9') }, uBack: { value: 0.3 } };
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbf8f3'),
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
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
          float xo = p.x;
          float dx = xo - (${f(cLocal)});
          float r = ${f(arch.r)};
          // bordo alto: la curva dell'arco (un filo più in basso)
          float top = ${f(arch.spring)} + sqrt(max(r * r - dx * dx, 0.0)) - 0.05;
          float y = p.y;       // 0 in basso, 1 in alto
          float v = 1.0 - y;
          // lunghezza: le tende più lunghe si appoggiano a terra e l'orlo si piega in avanti
          float py = mix(${f(-st.pool)}, top, y);
          float pool = max(0.02 - py, 0.0);
          p.y = max(py, 0.02);
          p.z += pool * 0.85;
          float open = uOpen * ${f(st.gather)};
          float free = 1.0 - min(pool * 9.0, 1.0); // l'orlo a terra non si muove
          ${st.tie > 0 ? `
          // legata a metà altezza: sopra il drappo scende in diagonale verso il nodo,
          // sotto la stoffa ricade e si riapre un poco
          float T = ${f(st.tie)};
          float w = y > T ? mix(1.0, 0.28, pow((y - T) / (1.0 - T), 0.75)) : mix(1.0, 0.62, pow((T - y) / T, 1.2));
          p.x = mix(xo, xo * ${f(st.keep)}, open * w);
          p.z += 0.07 * open * exp(-pow((y - T) * 7.0, 2.0)); // la stoffa raccolta nel nodo
          free *= y > T ? 0.22 : mix(0.25, 1.0, (T - y) / T);` : `
          // raccolta verso il lato: più in basso che in alto
          p.x = mix(xo, xo * ${f(st.keep)}, open * (0.25 + 0.75 * v * v));`}
          // pieghe verticali, irregolari e più profonde quando la tenda è raccolta
          float S = ${f(st.seed)};
          float fa = (0.034 + 0.03 * open) * ${f(st.folds)};
          p.z += (sin(xo * ${f(10 * st.folds + 1)} + S) * 0.72 + sin(xo * ${f(23.7 + st.seed * 3.1)} + S * 2.3) * 0.28)
               * fa * (0.7 + 0.3 * sin(xo * 1.7 + S * 0.7));
          // vento: raffiche irregolari che arrivano prima da un lato e poi dall'altro
          float tw = uTime - ${f(worldX)} * 0.22;
          float g = sin(tw * 0.23 + 1.1) + 0.7 * sin(tw * 0.37 + 2.9) + 0.45 * sin(tw * 0.61 + S);
          float wind = uWind * ${f(st.wind)} * (0.3 + 0.7 * smoothstep(-0.7, 1.7, g)) * free;
          float t = uTime + S * 2.7;
          p.z += (sin(t * 0.9 + xo * 1.6 + v * 2.2) * 0.5 + sin(t * 1.7 + xo * 3.1 - v * 1.3) * 0.25 + 0.55) * v * v * wind;
          p.x += sin(t * 0.7 + v * 3.0) * 0.06 * v * wind;
          return p;
        }`
      )
      .replace('#include <beginnormal_vertex>', `
        vec3 p0 = curtain(position);
        vec3 px = curtain(position + vec3(0.02, 0.0, 0.0));
        vec3 py = curtain(position + vec3(0.0, 0.01, 0.0));
        vec3 objectNormal = normalize(cross(px - p0, py - p0));`)
      .replace('#include <begin_vertex>', 'vec3 transformed = p0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlow;\nuniform float uBack;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * uBack;');
    addToneMapping(shader);
  };
  mat.customProgramCacheKey = () => `curtain-${width}-${side}-${worldX}-${arch.spring}-${arch.r}-${JSON.stringify(st)}`;
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
  const leftStone0 = mergeGeometries([noUV(sideWall), ...sideOrn.stone]);
  leftStone0.applyMatrix4(toLeft);
  // testata del muro dove finisce (davanti, verso i gradini): un'anta con zoccolo
  // e la trabeazione che gira attorno alla fine del muro, invece del taglio netto
  const xo = -L.SIDE_WALL_X - T / 2, xi = -L.SIDE_WALL_X + T / 2; // facce esterna e interna
  const zEnd = -1.0 + sideLen / 2;
  const endCap = [
    box(xo, xi + 0.22, 0, H - 1.05, zEnd - 0.9, zEnd + 0.16), // anta
    box(xo - 0.05, xi + 0.3, 0, 0.32, zEnd - 0.98, zEnd + 0.24), // zoccolo
    ...[[H - 1.05, H - 0.7, 0.26], [H - 0.7, H - 0.32, 0.16], [H - 0.32, H - 0.2, 0.42], [H - 0.2, H, 0.58]].map(([y0, y1, pr]) =>
      box(xo, xi + pr, y0, y1, zEnd - 0.02, zEnd + pr)
    ),
  ];
  const leftStone = mergeGeometries([leftStone0, ...endCap]);
  const leftCarved = mergeGeometries(sideOrn.carved);
  leftCarved.applyMatrix4(toLeft);

  const backWall = archWall({ length: backLen, height: HB, thickness: T, arches: backArches });
  const backOrn = wallOrnaments({ arches: backArches, length: backLen, height: HB, face: T / 2 });
  const backStone = mergeGeometries([noUV(backWall), ...backOrn.stone]);
  backStone.translate(0, 0, L.BACK_WALL_Z);
  const backCarved = mergeGeometries(backOrn.carved);
  backCarved.translate(0, 0, L.BACK_WALL_Z);

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
  addMesh(leftCarved, carvedMat);
  addMesh(leftCarved, carvedMat, true);
  addMesh(backCarved, carvedMat);

  const m4 = new THREE.Matrix4();

  // colonne davanti ai pilastri, con capitello dorico
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

  // ---- tende negli archi in fondo ----
  // L'architettura è simmetrica, le stoffe no: ogni tenda ha il suo carattere,
  // come in un luogo vissuto. Per arco (da sinistra): le tende appese a sinistra
  // (L) e a destra (R); null = nessuna tenda da quel lato.
  //   gather: quanto si raccoglie quando si apre   keep: larghezza che resta
  //   tie: legata a questa altezza (0 = libera)     wind: quanto la prende il vento
  //   folds: pieghe                                 pool: lunghezza in più a terra
  const CURTAINS = [
    // arco sinistro: una sola tenda, larga quanto l'arco, legata bassa a sinistra
    { L: { full: true, gather: 1, keep: 0.12, tie: 0.36, wind: 0.55, folds: 0.9, pool: 0.12, seed: 0.4 }, R: null },
    // arco centrale: a sinistra raccolta del tutto, a destra lasciata al vento
    { L: { gather: 0.95, keep: 0.26, wind: 0.6, folds: 1.05, pool: 0.16, seed: 1.9 },
      R: { gather: 0.42, keep: 0.4, wind: 1.3, folds: 1.2, pool: -0.04, seed: 3.3 } },
    // arco destro: a sinistra legata più in alto, a destra quasi chiusa e lunga
    { L: { gather: 1, keep: 0.14, tie: 0.48, wind: 0.45, folds: 1.1, pool: 0.05, seed: 4.6 },
      R: { gather: 0.6, keep: 0.34, wind: 0.95, folds: 0.95, pool: 0.2, seed: 5.8 } },
  ];
  const curtains = [];
  backArches.forEach((a, i) => {
    const r = a.w / 2;
    const inner = r - 0.03; // il bordo esterno della tenda sta appena dentro l'apertura
    for (const [key, sgn] of [['L', -1], ['R', 1]]) {
      const style = CURTAINS[i][key];
      if (!style) continue;
      const width = style.full ? inner * 2 : inner + 0.15;
      const worldX = a.c + sgn * inner;
      const c = createCurtain({ width, side: sgn, arch: { r, inner, spring: a.spring }, worldX, style });
      // appesa dentro lo spessore dell'arco, dal bordo verso il centro
      c.mesh.position.set(worldX, 0, L.BACK_WALL_Z + 0.12 + (key === 'R' ? 0.015 : 0));
      curtains.push(c);
      group.add(c.mesh);
    }
  });

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
    /** 0..1: la camera è sott'acqua (caustiche più vive sul fondo) */
    setUnderwater(amount) {
      causticAmount.value = 0.1 + 0.16 * amount;
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
