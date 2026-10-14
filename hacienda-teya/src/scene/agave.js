// ─────────────────────────────────────────────────────────────────────────────
//  Henequén (Agave fourcroydes) procedurale
//
//  - una sola geometria di foglia (lunga 1, base nell'origine, cresce lungo +Y,
//    faccia superiore verso +Z) con sezione a canale, carena sotto, dentini sui
//    margini e spina terminale scura;
//  - un InstancedMesh dispone le foglie a rosetta con l'angolo aureo: esterne
//    quasi orizzontali, interne verticali fino al "cogollo" centrale a punta;
//  - lo shader aggiunge: flessione per gravità, vento, venature, base chiara,
//    margine bruno, traslucenza controluce (luce dorata che filtra).
//
//  setOpen(0→1) apre la pianta come un bocciolo (usato nell'apertura del sito).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PALETTE } from '../config.js';

const GOLDEN = THREE.MathUtils.degToRad(137.508);
const rand = mulberry32(1683); // seme fisso: la pianta è sempre la stessa

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Geometria della foglia ───────────────────────────────────────────────────
const LEAF_W = 0.098; // larghezza massima rispetto alla lunghezza

const leafWidth = (t) => (t < 0.22 ? LEAF_W * (0.72 + 0.28 * Math.sin((t / 0.22) * Math.PI * 0.5)) : LEAF_W * Math.pow((1 - t) / 0.78, 0.82));
const channel = (t) => 0.02 * Math.pow(1 - t, 0.7); // profondità del canale superiore
const thickness = (t) => 0.016 * Math.pow(1 - t, 0.8) + 0.002;
const upperZ = (u, t) => channel(t) * u * u;

export function createLeafGeometry(segL, segW) {
  const pos = [];
  const uv = [];
  const kind = []; // 0 = lamina, 1 = dentini e spina
  const idx = [];

  // lamina: superficie superiore e inferiore (unite sui margini)
  for (const side of [1, -1]) {
    const start = pos.length / 3;
    for (let i = 0; i <= segL; i++) {
      const t = Math.pow(i / segL, 0.92);
      const w = leafWidth(t);
      for (let j = 0; j <= segW; j++) {
        const u = -1 + (2 * j) / segW;
        const zu = upperZ(u, t);
        const z = side > 0 ? zu : zu - thickness(t) * (1 - u * u) - thickness(t) * 0.35 * (1 - Math.abs(u));
        pos.push((u * w) / 2, t, z);
        uv.push(u * 0.5 + 0.5, t);
        kind.push(0);
      }
    }
    for (let i = 0; i < segL; i++) {
      for (let j = 0; j < segW; j++) {
        const a = start + i * (segW + 1) + j;
        const b = a + segW + 1;
        if (side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b);
        else idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  // dentini uncinati lungo i margini (henequén: piccoli, bruni, ogni 2–3 cm)
  const addTri = (p0, p1, p2) => {
    const s = pos.length / 3;
    pos.push(...p0, ...p1, ...p2);
    uv.push(0.5, p0[1], 0.5, p1[1], 0.5, p2[1]);
    kind.push(1, 1, 1);
    idx.push(s, s + 1, s + 2);
  };
  for (const edge of [-1, 1]) {
    for (let t = 0.07; t < 0.93; t += 0.016 + rand() * 0.006) {
      const w = leafWidth(t) / 2;
      const z = upperZ(edge, t);
      const h = 0.0045 + 0.003 * (1 - t);
      addTri([edge * w, t - 0.004, z], [edge * w, t + 0.004, z], [edge * (w + h), t + 0.006, z + 0.002]);
    }
  }

  // spina terminale: cono scuro che prosegue la punta
  const tipT = 0.975;
  const base = [0, tipT, upperZ(0, tipT) - 0.002];
  const r = 0.0042;
  const tip = [0, 1.05, -0.004];
  const sides = 6;
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2;
    const a1 = ((k + 1) / sides) * Math.PI * 2;
    addTri([base[0] + Math.cos(a0) * r, base[1], base[2] + Math.sin(a0) * r], [base[0] + Math.cos(a1) * r, base[1], base[2] + Math.sin(a1) * r], tip);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Shader comune (materiale e ombre) ────────────────────────────────────────
const VERT_PARS = /* glsl */ `
  attribute float aBend;   // flessione per gravità
  attribute float aPhase;  // fase del vento
  attribute float aKind;
  attribute vec3 aTint;
  attribute float aDry;    // 1 = foglia secca a terra
  uniform float uTime;
  uniform float uWind;
  varying vec2 vLeafUv;
  varying vec3 vTint;
  varying float vDry;
  varying float vKind;
`;

// flessione: la punta scende verso il lato inferiore (−Z locale) ∝ y²; il vento oscilla
const VERT_BEGIN = /* glsl */ `
  vec3 transformed = vec3(position);
  float y2 = transformed.y * transformed.y;
  float gust = sin(uTime * 1.07 + aPhase) * 0.6 + sin(uTime * 2.31 + aPhase * 1.7) * 0.25;
  transformed.x += y2 * uWind * gust;
  transformed.z += -y2 * aBend + y2 * uWind * 0.6 * sin(uTime * 0.83 + aPhase * 2.1);
`;

const VERT_NORMAL = /* glsl */ `
  vec3 objectNormal = normalize(vec3(normal.x, normal.y + 2.0 * aBend * position.y * normal.z, normal.z));
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif
`;

export function createAgaveMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.012 },
    uSunDirView: { value: new THREE.Vector3(0, 0, -1) },
    uTransColor: { value: new THREE.Color('#ffb15e').multiplyScalar(0.55) },
    uLight: { value: 1 }, // 0→1 durante l'apertura
    uUpView: { value: new THREE.Vector3(0, 1, 0) }, // "su" nello spazio vista
    uSkyFill: { value: new THREE.Color('#6f8fa3').multiplyScalar(0.55) }, // luce fredda del cielo
    uGroundFill: { value: new THREE.Color('#8a4a2c').multiplyScalar(0.25) }, // rimbalzo della terra rossa
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.55,
    metalness: 0,
    sheen: 0.45,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#d6e6e6'),
    side: THREE.DoubleSide,
    envMapIntensity: 1.8, // il cielo azzurro alto colora le foglie di blu-grigio
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace(
        '#include <begin_vertex>',
        `${VERT_BEGIN}\n vLeafUv = uv; vTint = aTint; vDry = aDry; vKind = aKind;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uSunDirView;
        uniform vec3 uTransColor;
        uniform float uLight;
        uniform vec3 uUpView;
        uniform vec3 uSkyFill;
        uniform vec3 uGroundFill;
        varying vec2 vLeafUv;
        varying vec3 vTint;
        varying float vDry;
        varying float vKind;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          float t = vLeafUv.y;
          float u = vLeafUv.x * 2.0 - 1.0;
          vec3 agave = vec3(${new THREE.Color(PALETTE.agave).toArray().map((v) => v.toFixed(4))});
          vec3 c = agave;
          // venature longitudinali e leggere macchie
          float stria = 0.5 + 0.5 * sin(u * 64.0 + sin(t * 7.0) * 1.2);
          float n = vnoise(vec2(u * 6.0, t * 38.0));
          c *= 0.9 + 0.08 * stria + 0.08 * n;
          // base pallida (protetta dalle altre foglie) e punta più scura
          c = mix(c, vec3(0.80, 0.80, 0.58), smoothstep(0.16, 0.0, t) * 0.8);
          c = mix(c, c * vec3(0.78, 0.8, 0.74), smoothstep(0.55, 1.0, t));
          // sottile margine bruno-rossiccio
          c = mix(c, vec3(0.36, 0.2, 0.12), smoothstep(0.88, 0.99, abs(u)) * 0.55);
          // foglie secche a terra
          c = mix(c, vec3(0.42, 0.31, 0.22) * (0.75 + 0.35 * n), vDry);
          c *= vTint;
          // dentini e spina: bruno scuro
          c = mix(c, vec3(0.16, 0.08, 0.045), vKind);
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.5, 0.88, vDry), 0.32, vKind);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          // traslucenza: la luce del sole basso passa attraverso la foglia sottile
          float back = max(0.0, dot(-normal, uSunDirView));
          float thin = mix(1.0, 0.35, smoothstep(0.0, 0.25, 1.0 - vLeafUv.y)); // più sottile verso la punta
          totalEmissiveRadiance += uTransColor * pow(back, 1.6) * thin * (1.0 - vKind) * (1.0 - vDry * 0.7) * uLight * diffuseColor.rgb * 2.2;
          // luce emisferica solo per la pianta: cielo freddo sopra, terra rossa sotto
          float up = dot(normal, uUpView) * 0.5 + 0.5;
          totalEmissiveRadiance += diffuseColor.rgb * mix(uGroundFill, uSkyFill, up) * uLight;
        }`,
      );
  };
  mat.userData.uniforms = uniforms;

  // materiale per le ombre con la stessa deformazione (flessione + vento)
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', VERT_BEGIN);
  };
  return { material: mat, depthMaterial: depth, uniforms };
}

// ── Disposizione a rosetta ───────────────────────────────────────────────────
export function rosetteLayout(count, { dried = 4, scale = 1 } = {}) {
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const k = i / (count - 1); // 0 = esterna (vecchia), 1 = interna (giovane)
    // distribuzione uniforme sull'emisfero: rosetta piena, a "porcospino" come l'henequén
    const tiltDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.lerp(0.06, 1, Math.pow(k, 0.85)))) + (rand() - 0.5) * 7 * (1 - k * 0.8);
    const length = (1.18 + 0.42 * Math.sin(Math.PI * Math.min(1, k * 1.1)) - 0.12 * k) * (0.94 + rand() * 0.12);
    leaves.push({
      azimuth: i * GOLDEN + (rand() - 0.5) * 0.12,
      tilt: THREE.MathUtils.degToRad(tiltDeg),
      length: length * scale,
      width: 0.9 + rand() * 0.22,
      roll: (rand() - 0.5) * 0.3 * (1 - k),
      baseR: (0.13 * Math.pow(1 - k, 0.8) + 0.015) * scale,
      baseY: (0.06 + 0.4 * Math.pow(k, 1.25)) * scale,
      bend: 0.14 * Math.pow(1 - k, 1.6) + 0.012,
      delay: 0.32 * k, // le esterne si aprono per prime
      tint: [0.95 + rand() * 0.1, 0.95 + rand() * 0.1, 0.95 + rand() * 0.1],
      dry: 0,
    });
  }
  // qualche foglia secca adagiata a terra: dà verità alla scena
  for (let d = 0; d < dried; d++) {
    leaves.push({
      azimuth: rand() * Math.PI * 2,
      tilt: THREE.MathUtils.degToRad(92 + rand() * 6),
      length: (0.9 + rand() * 0.4) * scale,
      width: 0.85 + rand() * 0.2,
      roll: (rand() - 0.5) * 1.2,
      baseR: 0.16 * scale,
      baseY: 0.03 * scale,
      bend: 0.03,
      delay: 0,
      tint: [1, 1, 1],
      dry: 1,
    });
  }
  return leaves;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const AX_Y = new THREE.Vector3(0, 1, 0);
const AX_X = new THREE.Vector3(1, 0, 0);

// matrice della foglia: T(base) · Ry(azimut) · Rx(−inclinazione) · Ry(rollio) · S
function leafMatrix(L, open, target) {
  const o = THREE.MathUtils.clamp((open - L.delay) / (1 - L.delay * 0.9), 0, 1);
  const eased = 1 - Math.pow(1 - o, 3);
  const tilt = L.dry ? L.tilt : L.tilt * (0.18 + 0.82 * eased);
  _qa.setFromAxisAngle(AX_Y, L.azimuth);
  _qt.setFromAxisAngle(AX_X, -tilt);
  _qr.setFromAxisAngle(AX_Y, L.roll);
  _q.copy(_qa).multiply(_qt).multiply(_qr);
  const r = L.baseR * (L.dry ? 1 : 0.5 + 0.5 * eased);
  _p.set(-Math.sin(L.azimuth) * r, L.baseY, -Math.cos(L.azimuth) * r);
  const grow = L.dry ? 1 : 0.86 + 0.14 * eased;
  _s.set(L.length * L.width * grow, L.length * grow, L.length * L.width * grow);
  return target.compose(_p, _q, _s);
}

export function createAgave(quality, opts = {}) {
  const leaves = rosetteLayout(quality.agaveLeaves, opts);
  const geo = createLeafGeometry(quality.leafSegments[0], quality.leafSegments[1]);
  const n = leaves.length;
  const aBend = new Float32Array(n);
  const aPhase = new Float32Array(n);
  const aTint = new Float32Array(n * 3);
  const aDry = new Float32Array(n);
  leaves.forEach((L, i) => {
    aBend[i] = L.bend;
    aPhase[i] = rand() * Math.PI * 2;
    aTint.set(L.tint, i * 3);
    aDry[i] = L.dry;
  });
  geo.setAttribute('aBend', new THREE.InstancedBufferAttribute(aBend, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));
  geo.setAttribute('aDry', new THREE.InstancedBufferAttribute(aDry, 1));

  const { material, depthMaterial, uniforms } = createAgaveMaterial();
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);

  // punta del cogollo: da qui nasce il filo
  const heart = new THREE.Vector3();
  const tipOf = new THREE.Vector3();
  const setOpen = (open) => {
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, leafMatrix(leaves[i], open, _m));
    mesh.instanceMatrix.needsUpdate = true;
  };
  // il cuore = punta media delle foglie più interne a pianta aperta
  {
    const inner = leaves.filter((L) => !L.dry).slice(-5);
    heart.set(0, 0, 0);
    for (const L of inner) {
      leafMatrix(L, 1, _m);
      tipOf.set(0, 0.92, 0).applyMatrix4(_m);
      heart.add(tipOf);
    }
    heart.divideScalar(inner.length);
    heart.x = 0;
    heart.z = 0;
  }
  setOpen(1);

  return {
    group,
    mesh,
    uniforms,
    heart, // in coordinate locali del gruppo
    setOpen,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}

export { mulberry32 };
