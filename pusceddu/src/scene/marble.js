import * as THREE from 'three';
import { QUALITY } from '../config.js';

// Marmo statuario procedurale. Le venature sono calcolate in 3D sulla posizione
// dell'oggetto (non su UV): ogni pezzo sembra ricavato da un unico blocco, senza cuciture.
// Per togliere l'effetto "plastica":
//   - venature su due livelli (grigio-azzurre), macchie nuvolose e grana del cristallo
//   - lucidatura a specchio (clearcoat) che riflette lucernari e finestre dell'ambiente
//   - traslucenza simulata: il marmo non diventa mai "nero", si illumina dall'interno ai bordi
//   - micro-sfaccettature del calcare che scintillano quando la luce scorre

// Rumore simplex 3D (Ashima Arts / Ian McEwan, licenza MIT).
const NOISE = /* glsl */ `
vec3 mr_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mr_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mr_permute(vec4 x) { return mr_mod289(((x * 34.0) + 10.0) * x); }
vec4 mr_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float mr_snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mr_mod289(i);
  vec4 p = mr_permute(mr_permute(mr_permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = mr_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float mr_fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < MARBLE_OCTAVES; i++) { s += a * mr_snoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float mr_fbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * mr_snoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
vec3 mr_hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
`;

const MARBLE = /* glsl */ `
varying vec3 vMarblePos;
uniform vec3 uVein;
uniform vec3 uVein2;
uniform float uScale;
uniform float uSeed;
uniform float uVeinStrength;
uniform float uSSS;
uniform float uGrain;
${NOISE}
vec3 marbleColor(vec3 base, out float roughAdd) {
  vec3 p = vMarblePos * uScale + vec3(uSeed * 13.1, uSeed * 7.3, uSeed * 3.7);
  float cloud = mr_fbm3(p * 0.3);
  float turb = mr_fbm(p * 0.8 + vec3(0.0, cloud * 1.6, 0.0));
  // Venature principali: bande deformate, spessore variabile, compaiono e scompaiono.
  float band = sin(dot(p, vec3(0.8, 0.5, 0.3)) * 1.9 + turb * 6.0);
  float width = 0.09 + 0.12 * (0.5 + 0.5 * cloud);
  float main = (1.0 - smoothstep(0.0, width, abs(band))) * (0.55 + 0.45 * (1.0 - smoothstep(0.0, width * 0.35, abs(band))));
  float mask = smoothstep(-0.25, 0.45, mr_fbm3(p * 0.4 + 4.0));
  // Venature secondarie, più chiare, con un'altra direzione.
  float band2 = sin(dot(p, vec3(-0.3, 0.7, 0.6)) * 3.3 + turb * 7.5 + 1.7);
  float sec = 1.0 - smoothstep(0.0, 0.07, abs(band2));
  float mask2 = smoothstep(0.0, 0.6, mr_fbm3(p * 0.6 - 3.0));
  // Capillari e macchie nuvolose grigie
  float hair = 1.0 - smoothstep(0.0, 0.022, abs(sin(dot(p, vec3(0.2, 0.6, -0.7)) * 3.1 + turb * 6.5)));
  float stain = smoothstep(0.15, 0.85, mr_fbm3(p * 0.7 + 9.0)) * 0.13;
  vec3 col = base * (0.965 + 0.035 * cloud);
  col = mix(col, uVein2, stain);
  col = mix(col, uVein2, hair * 0.16);
  col = mix(col, uVein2, sec * 0.32 * mask2 * uVeinStrength);
  col = mix(col, uVein, main * 0.6 * mask * uVeinStrength);
  // Grana del cristallo di calcite
  col *= 0.988 + 0.024 * mr_hash3(floor(vMarblePos * 600.0)).x;
  roughAdd = (main * mask + sec * mask2) * 0.07 + stain * 0.2;
  return col;
}
`;

export function createMarble({
  color = 0xf5f3ef,
  vein = 0x7a828c,
  vein2 = 0xaeb2b8,
  scale = 1.6,
  seed = 0,
  veinStrength = 0.85,
  sss = 0.05,
  grain = 0.035,
  roughness = 0.2,
  clearcoat = 1,
  clearcoatRoughness = 0.06,
  restAttribute = false, // usa l'attributo `marbleRest` (geometrie che si deformano)
  ...rest
} = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    clearcoat,
    clearcoatRoughness,
    ior: 1.55,
    specularIntensity: 0.45,
    ...rest,
  });
  const uniforms = {
    uVein: { value: new THREE.Color(vein) },
    uVein2: { value: new THREE.Color(vein2) },
    uScale: { value: scale },
    uSeed: { value: seed },
    uVeinStrength: { value: veinStrength },
    uSSS: { value: sss },
    uGrain: { value: grain },
  };
  mat.userData.marble = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = { ...(shader.defines || {}), MARBLE_OCTAVES: QUALITY.marbleOctaves };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMarblePos;${restAttribute ? '\nattribute vec3 marbleRest;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvMarblePos = ${restAttribute ? 'marbleRest' : 'position'};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MARBLE}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat marbleRough = 0.0;\ndiffuseColor.rgb = marbleColor(diffuseColor.rgb, marbleRough);'
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + marbleRough, 0.04, 1.0);'
      )
      // Micro-sfaccettature: piccole variazioni di normale che fanno scintillare la luce.
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = normalize(normal + (mr_hash3(floor(vMarblePos * 420.0)) - 0.5) * uGrain);'
      )
      // Traslucenza: luce che "esce" dal marmo, più intensa ai bordi visti di taglio.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float mr_ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSSS * (0.55 + 0.9 * pow(1.0 - mr_ndv, 2.0));`
      );
  };
  mat.customProgramCacheKey = () => `marble-${QUALITY.marbleOctaves}-${restAttribute}`;
  return mat;
}
