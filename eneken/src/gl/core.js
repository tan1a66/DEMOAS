// Renderer, cámara, uniforms compartidos y "parche" de materiales PBR
// (sombras de palmas, triplanar de chukum, cáusticas, revelado circular y grano de película).
import * as THREE from 'three';
import { NOISE, CAUSTICS } from './glsl.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
export const MOBILE = isTouch && small;

export const QUALITY = MOBILE
  ? { dpr: Math.min(devicePixelRatio, 2), shadow: 1024, sim: 128, refract: 0.5, dust: 260, leaves: 0.7 }
  : { dpr: Math.min(devicePixelRatio, 2), shadow: 2048, sim: 256, refract: 0.6, dust: 520, leaves: 1 };

export const LAYER_UNDERWATER = 1;

// Uniforms globales: el mismo objeto se comparte entre todos los materiales.
export const G = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.52).normalize() }, // sol alto de Mérida, desde el sur-sureste
  uGoboTex: { value: null },
  uGoboRect: { value: new THREE.Vector4(-9, -10, 18, 20) }, // x0, z0, ancho, largo (m)
  uGoboH: { value: 5.5 },
  uGoboAmt: { value: 0.62 },
  uSpotGoboTex: { value: null },
  uSpotGoboMat: { value: new THREE.Matrix4() },
  uSpotGoboAmt: { value: 0.0 },
  uRevealC: { value: new THREE.Vector2(0, 0) },
  uRevealR: { value: 100 },
  uRevealF: { value: 2.5 },
  uVoid: { value: new THREE.Vector3(18 / 255, 13 / 255, 10 / 255) }, // sRGB (se mezcla tras la conversión)
  uGrain: { value: 0.02 },
  uWaterY: { value: -0.07 },
  uAbsorb: { value: new THREE.Vector3(0.95, 0.3, 0.24) },
  uScatter: { value: new THREE.Vector3(0.016, 0.066, 0.058) }, // verde turquesa del video
  uSim: { value: null },
  uSimRect: { value: new THREE.Vector4(-1.3, -1.3, 2.6, 0.03) }, // x0, z0, tamaño, escala de altura
  uPlasterNor: { value: null },
  uPlasterDiff: { value: null },
  uWoodNor: { value: null },
  uPebbleNor: { value: null },
  uPebbleDiff: { value: null },
  uInkMix: { value: 1 },
  uInkCol: { value: new THREE.Vector3(72 / 255, 85 / 255, 49 / 255) },   // sRGB, tinta del logo
  uPaperMix: { value: 1 },
  uRoomDark: { value: 0 },
  uRoomY: { value: 22 },
  uPaperCol: { value: new THREE.Vector3(246 / 255, 240 / 255, 225 / 255) }, // sRGB, papel del logo
};

export const COMMON_FRAG = /* glsl */ `
varying vec3 vWPos;
uniform float uTime;
uniform vec3 uSunDir;
uniform sampler2D uGoboTex;
uniform vec4 uGoboRect;
uniform float uGoboH;
uniform float uGoboAmt;
uniform sampler2D uSpotGoboTex;
uniform mat4 uSpotGoboMat;
uniform float uSpotGoboAmt;
uniform vec2 uRevealC;
uniform float uRevealR;
uniform float uRevealF;
uniform vec3 uVoid;
uniform float uGrain;
uniform float uWaterY;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform sampler2D uSim;
uniform vec4 uSimRect;
uniform sampler2D uPlasterNor;
uniform sampler2D uPlasterDiff;
uniform sampler2D uPebbleNor;
uniform sampler2D uPebbleDiff;
${NOISE}
${CAUSTICS}

// Sombra de las hojas de palma: se proyecta según la dirección del sol desde un "dosel" a uGoboH metros.
float eGobo(vec3 wp){
  vec2 q = wp.xz + uSunDir.xz * (uGoboH - wp.y) / max(uSunDir.y, 0.2);
  vec2 uv = (q - uGoboRect.xy) / uGoboRect.zw;
  float t = uTime;
  vec2 sway = vec2(sin(t * 0.37 + q.y * 0.35) + 0.5 * sin(t * 0.83 + q.x * 0.9),
                   cos(t * 0.29 + q.x * 0.31) + 0.5 * cos(t * 0.71 + q.y * 0.7)) * 0.0022;
  float a = texture2D(uGoboTex, uv + sway).r;
  float b = texture2D(uGoboTex, uv - sway * 0.7 + vec2(0.0012, -0.0009)).r;
  float g = min(a, mix(1.0, b, 0.65));
  return mix(1.0, g, uGoboAmt);
}

// Sombra de ventana y hojas sobre la luz rasante de la sala (proyector del foco).
float eSpotGobo(vec3 wp){
  vec4 c = uSpotGoboMat * vec4(wp, 1.0);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  float t = uTime;
  vec2 sway = vec2(sin(t * 0.41) + 0.4 * sin(t * 1.13), cos(t * 0.33) + 0.4 * sin(t * 0.91)) * 0.004;
  float g = texture2D(uSpotGoboTex, uv + sway).r;
  return mix(1.0, g, uSpotGoboAmt);
}

// Altura de la simulación de agua en un punto del mundo (para deformar las cáusticas).
vec2 eSimGrad(vec2 xz){
  vec2 uv = (xz - uSimRect.xy) / uSimRect.z;
  float e = 1.0 / 128.0;
  float hx = texture2D(uSim, uv + vec2(e, 0.)).r - texture2D(uSim, uv - vec2(e, 0.)).r;
  float hz = texture2D(uSim, uv + vec2(0., e)).r - texture2D(uSim, uv - vec2(0., e)).r;
  return vec2(hx, hz);
}

float eCausticShade(vec3 wp){
  float depth = max(0.0, uWaterY - wp.y);
  vec2 q = wp.xz + uSunDir.xz * depth / max(uSunDir.y, 0.3) * 0.75;
  vec2 g = eSimGrad(q) * 6.0;
  float c = eCaustic(q * 1.3 + g, uTime * 0.45);
  float c2 = eCaustic(q * 1.3 + g + vec2(0.011, 0.006), uTime * 0.45);
  float k = smoothstep(0.0, 0.25, depth);
  return mix(1.0, 0.45 + 2.8 * mix(c, c2, 0.5), k);
}

vec3 eUnderwater(vec3 col, vec3 wp){
  float depth = max(0.0, uWaterY - wp.y);
  vec3 v = normalize(cameraPosition - wp);
  float path = depth / max(abs(v.y), 0.35) + depth;
  vec3 tr = exp(-uAbsorb * path);
  return col * tr + uScatter * (1.0 - tr);
}

vec3 eFinish(vec3 c, float grain){
  #ifdef E_REVEAL
    float d = length(vWPos.xz - uRevealC);
    float m = smoothstep(uRevealR, uRevealR - uRevealF, d);
    c = mix(uVoid, c, m);
  #endif
  c += (eHash12(gl_FragCoord.xy + fract(uTime * 7.31) * 913.0) - 0.5) * grain;
  return c;
}

// Triplanar: variación de color y normal del enlucido (Poly Haven "clay_plaster").
vec3 eTriNormal(sampler2D nor, vec3 wp, vec3 n, float s, float k, out float lum, sampler2D dif){
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 acc = vec3(0.0); lum = 0.0;
  if (w.x > 0.02){
    vec2 uv = wp.zy * s;
    vec3 t = texture2D(nor, uv).xyz * 2.0 - 1.0; t.xy *= k;
    t = vec3(t.xy + n.zy, abs(t.z) * n.x);
    acc += t.zyx * w.x; lum += dot(texture2D(dif, uv).rgb, vec3(.3,.59,.11)) * w.x;
  }
  if (w.y > 0.02){
    vec2 uv = wp.xz * s;
    vec3 t = texture2D(nor, uv).xyz * 2.0 - 1.0; t.xy *= k;
    t = vec3(t.xy + n.xz, abs(t.z) * n.y);
    acc += t.xzy * w.y; lum += dot(texture2D(dif, uv).rgb, vec3(.3,.59,.11)) * w.y;
  }
  if (w.z > 0.02){
    vec2 uv = wp.xy * s;
    vec3 t = texture2D(nor, uv).xyz * 2.0 - 1.0; t.xy *= k;
    t = vec3(t.xy + n.xy, abs(t.z) * n.z);
    acc += t.xyz * w.z; lum += dot(texture2D(dif, uv).rgb, vec3(.3,.59,.11)) * w.z;
  }
  return normalize(acc);
}
`;

const LIGHTS = THREE.ShaderChunk.lights_fragment_begin
  .replace('getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= eSunShade;')
  .replace('getSpotLightInfo( spotLight, geometryPosition, directLight );',
    'getSpotLightInfo( spotLight, geometryPosition, directLight );\n\t\tdirectLight.color *= eSpotShade;');

/**
 * Parchea un MeshStandardMaterial.
 * opt: { key, tri: {scale, normal, amount, mean, tex:'plaster'|'pebble'}, gobo, spotGobo, reveal, underwater,
 *        grain, mottle, uniforms, fragHead, fragNormal, fragColor, vertHead, vertMain }
 */
export function patch(mat, opt = {}) {
  const key = opt.key || 'p' + Math.random().toString(36).slice(2);
  mat.customProgramCacheKey = () => key;
  mat.defines = Object.assign(mat.defines || {}, opt.reveal ? { E_REVEAL: '' } : {});
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, G, opt.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\n' + (opt.vertHead || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (opt.vertBegin || ''))
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 eWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          eWp = instanceMatrix * eWp;
        #endif
        vWPos = (modelMatrix * eWp).xyz;
        ${opt.vertMain || ''}`);

    const tri = opt.tri;
    let normalCode = '';
    if (tri) {
      const nor = tri.tex === 'pebble' ? 'uPebbleNor' : 'uPlasterNor';
      const dif = tri.tex === 'pebble' ? 'uPebbleDiff' : 'uPlasterDiff';
      normalCode = `
        {
          vec3 eNW = inverseTransformDirection(normal, viewMatrix);
          float eLum;
          vec3 eN2 = eTriNormal(${nor}, vWPos, eNW, ${tri.scale.toFixed(3)}, ${(tri.normal ?? 1).toFixed(3)}, eLum, ${dif});
          normal = normalize((viewMatrix * vec4(eN2, 0.0)).xyz);
          diffuseColor.rgb *= mix(1.0, eLum / ${(tri.mean ?? 0.5).toFixed(3)}, ${(tri.amount ?? 0.5).toFixed(3)});
        }`;
    }
    if (opt.mottle) {
      normalCode += `
        diffuseColor.rgb *= 1.0 - ${opt.mottle.toFixed(3)} * 0.5 + ${opt.mottle.toFixed(3)} * (0.65 * eFbm2(vWPos.xz * 0.9 + vec2(vWPos.y * 0.7, -vWPos.y * 0.5)) + 0.35 * eFbm2(vWPos.zy * 2.3 + vWPos.x * 1.7));`;
    }

    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON_FRAG + (opt.fragHead || ''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normalCode + (opt.fragNormal || ''))
      .replace('#include <lights_fragment_begin>', `
        float eSunShade = ${opt.gobo ? 'eGobo(vWPos)' : '1.0'};
        ${opt.underwater ? 'eSunShade *= eCausticShade(vWPos);' : ''}
        float eSpotShade = ${opt.spotGobo ? 'eSpotGobo(vWPos)' : '1.0'};
        ${opt.fragLights || ''}
        ${LIGHTS}`)
      .replace('#include <tonemapping_fragment>', (opt.underwater ? 'gl_FragColor.rgb = eUnderwater(gl_FragColor.rgb, vWPos);\n' : '') + '#include <tonemapping_fragment>')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        ${opt.fragColor || ''}
        gl_FragColor.rgb = eFinish(gl_FragColor.rgb, ${opt.grain === false ? '0.0' : 'uGrain'});`);
    if (opt.onShader) opt.onShader(sh);
  };
  return mat;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(QUALITY.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export function canFloatRT(renderer) {
  const gl = renderer.getContext();
  return !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
}
