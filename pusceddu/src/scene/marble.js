import * as THREE from 'three';
import { QUALITY } from '../config.js';

// Marmo statuario procedurale. Le venature sono calcolate in 3D sulla posizione
// dell'oggetto (non su UV): ogni pezzo sembra ricavato da un unico blocco, senza cuciture.

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
`;

const MARBLE = /* glsl */ `
varying vec3 vMarblePos;
uniform vec3 uVein;
uniform float uScale;
uniform float uSeed;
uniform float uVeinStrength;
${NOISE}
vec3 marbleColor(vec3 base, out float roughAdd) {
  vec3 p = vMarblePos * uScale + vec3(uSeed * 13.1, uSeed * 7.3, uSeed * 3.7);
  float cloud = mr_fbm(p * 0.35);
  // Venature principali: bande deformate dalla turbolenza, che compaiono e scompaiono.
  float turb = mr_fbm(p * 0.9 + vec3(0.0, cloud * 1.5, 0.0));
  float band = sin(dot(p, vec3(0.8, 0.5, 0.3)) * 2.2 + turb * 5.5);
  float main = 1.0 - smoothstep(0.0, 0.10, abs(band));
  float mask = smoothstep(-0.2, 0.5, mr_fbm(p * 0.45 + 4.0));
  // Venature capillari, più sottili e chiare.
  float hair = 1.0 - smoothstep(0.0, 0.03, abs(sin(dot(p, vec3(0.2, 0.6, -0.7)) * 3.1 + turb * 6.5)));
  float vein = clamp(main * 0.8 * mask + hair * 0.28 * (1.0 - mask * 0.6), 0.0, 1.0) * uVeinStrength;
  vec3 col = base * (0.955 + 0.045 * cloud);
  col = mix(col, uVein, vein);
  roughAdd = vein * 0.08 + cloud * 0.025;
  return col;
}
`;

export function createMarble({
  color = 0xf6f4f0,
  vein = 0x7a7774,
  scale = 1.6,
  seed = 0,
  veinStrength = 0.78,
  roughness = 0.3,
  clearcoat = 0.4,
  clearcoatRoughness = 0.22,
  restAttribute = false, // usa l'attributo `marbleRest` (geometrie che si deformano)
  ...rest
} = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness, ...rest });
  const uniforms = {
    uVein: { value: new THREE.Color(vein) },
    uScale: { value: scale },
    uSeed: { value: seed },
    uVeinStrength: { value: veinStrength },
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
      );
  };
  mat.customProgramCacheKey = () => `marble-${QUALITY.marbleOctaves}-${restAttribute}`;
  return mat;
}
