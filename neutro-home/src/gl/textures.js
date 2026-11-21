// Texturas procedurales "horneadas" una sola vez en la GPU (milisegundos, sin descargas):
//  · fibras: mapa de normales con muchos hilitos paralelos + variación de tono,
//  · enlucido: color y relieve del muro,
//  · cedro: veta de los ganchos.

import * as THREE from 'three';

const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
const float PI = 3.14159265359;
float hash11(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// ruido de valor periódico (período en celdas)
float vnoise(vec2 x, vec2 per) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(mod(i, per));
  float b = hash21(mod(i + vec2(1.0, 0.0), per));
  float c = hash21(mod(i + vec2(0.0, 1.0), per));
  float d = hash21(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, vec2 per, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    s += a * vnoise(p, per);
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s;
}
`;

// ---------------------------------------------------------------- Fibras
// u (x) = a lo largo del cabo, v (y) = alrededor. Los hilos corren a lo largo de u.
const FIBER_HEIGHT = /* glsl */ `
float fiberH(vec2 uv, out float tone) {
  // haces grandes (mechones) alrededor del cabo
  float bundles = 9.0;
  float by = uv.y * bundles + 0.08 * sin(2.0 * PI * uv.x + 1.3);
  float bi = floor(by);
  float bf = fract(by);
  float bundle = smoothstep(0.0, 0.12, bf) * smoothstep(1.0, 0.88, bf);
  float bTone = hash11(mod(bi, bundles) + 3.0);

  // hilos finos
  float lanes = 170.0;
  float wob = 0.22 * sin(2.0 * PI * (uv.x * 2.0) + hash11(bi) * 6.28) + 0.12 * sin(2.0 * PI * uv.x * 5.0 + bi);
  float ly = uv.y * lanes + wob;
  float li = floor(ly);
  float lf = fract(ly);
  float r = hash11(mod(li, lanes) + 11.0);
  float prof = pow(sin(lf * PI), 0.7);
  // interrupciones a lo largo del hilo
  float brk = vnoise(vec2(uv.x * 7.0 + r * 13.0, li), vec2(7.0, lanes));
  float strand = prof * (0.55 + 0.45 * r) * (0.55 + 0.45 * smoothstep(0.15, 0.55, brk));

  // grupos medianos
  float groups = 38.0;
  float gy = uv.y * groups + 0.5 * wob;
  float gf = fract(gy);
  float grp = 0.5 + 0.5 * cos((gf - 0.5) * 2.0 * PI);

  tone = (0.86 + 0.18 * r) * (0.93 + 0.12 * bTone) * (0.94 + 0.06 * brk);
  return 0.55 * strand + 0.3 * grp + 0.6 * bundle;
}
`;

const FIBER_NORMAL_FRAG = `${COMMON}${FIBER_HEIGHT}
uniform float uRes;
void main() {
  float t;
  float e = 1.0 / uRes;
  float hx1 = fiberH(vUv + vec2(e, 0.0), t);
  float hx0 = fiberH(vUv - vec2(e, 0.0), t);
  float hy1 = fiberH(vUv + vec2(0.0, e), t);
  float hy0 = fiberH(vUv - vec2(0.0, e), t);
  float k = 1.15;
  vec3 n = normalize(vec3(-(hx1 - hx0) * k * 0.35, -(hy1 - hy0) * k, 1.0));
  outColor = vec4(n * 0.5 + 0.5, 1.0);
}`;

const FIBER_ALBEDO_FRAG = `${COMMON}${FIBER_HEIGHT}
void main() {
  float tone;
  float h = fiberH(vUv, tone);
  // surcos entre haces y entre hilos algo más marcados (la fibra se lee de cerca)
  float c = tone * (0.72 + 0.28 * clamp(h, 0.0, 1.0));
  outColor = vec4(vec3(c), 1.0);
}`;

// ---------------------------------------------------------------- Enlucido
const PLASTER_H = /* glsl */ `
float plasterH(vec2 uv) {
  // llana: ondulaciones amplias y suaves; grano fino de cal y arena muy discreto
  float trowel = fbm(uv * 4.0, vec2(4.0), 4);
  float swipe = fbm(vec2(uv.x * 12.0, uv.y * 5.0) + 3.1, vec2(12.0, 5.0), 3);
  float grain = fbm(uv * 150.0, vec2(150.0), 2);
  return trowel * 0.55 + swipe * 0.18 + grain * 0.05;
}
`;

const PLASTER_COLOR_FRAG = `${COMMON}${PLASTER_H}
uniform vec3 uBase;
uniform vec3 uDark;
uniform vec3 uLight;
void main() {
  float m = fbm(vUv * 3.0 + 7.0, vec2(3.0), 5);
  float fine = fbm(vUv * 40.0, vec2(40.0), 3);
  float speck = smoothstep(0.86, 0.97, vnoise(vUv * 260.0 + 3.0, vec2(260.0)));
  vec3 c = mix(uDark, uBase, smoothstep(0.2, 0.7, m));
  c = mix(c, uLight, smoothstep(0.5, 0.85, fine) * 0.12);
  c *= 1.0 - 0.025 * speck;
  outColor = vec4(c, 1.0);
}`;

const PLASTER_NORMAL_FRAG = `${COMMON}${PLASTER_H}
uniform float uRes;
void main() {
  float e = 1.0 / uRes;
  float hx = plasterH(vUv + vec2(e, 0.0)) - plasterH(vUv - vec2(e, 0.0));
  float hy = plasterH(vUv + vec2(0.0, e)) - plasterH(vUv - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx * 1.6, -hy * 1.6, 1.0));
  outColor = vec4(n * 0.5 + 0.5, 1.0);
}`;

// ---------------------------------------------------------------- Cedro
const CEDAR_FRAG = `${COMMON}
uniform vec3 uA;
uniform vec3 uB;
void main() {
  // u = alrededor del gancho, v = a lo largo del perfil
  // anillos de crecimiento a lo largo del perfil (en la cabeza se ven concéntricos)
  float w = vUv.y * 11.0 + 0.6 * fbm(vec2(vUv.x * 3.0, vUv.y * 3.0), vec2(3.0), 4);
  float ring = 0.5 + 0.5 * sin(w * PI * 2.0);
  float fine = fbm(vec2(vUv.x * 7.0, vUv.y * 120.0), vec2(7.0, 120.0), 3);
  vec3 c = mix(uA, uB, 0.55 + 0.25 * (ring - 0.5) + 0.35 * (fine - 0.5));
  outColor = vec4(c, 1.0);
}`;

function bake(renderer, size, frag, uniforms = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
  });
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms: { uRes: { value: size }, ...uniforms },
    depthTest: false,
    depthWrite: false,
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera();
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  geo.dispose();
  mat.dispose();
  const tex = rt.texture;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const lin = (hex) => new THREE.Color(hex); // THREE.Color convierte sRGB → lineal

export function bakeTextures(renderer, { mobile }) {
  const fiberSize = 512;
  const wallSize = mobile ? 1024 : 2048;
  return {
    fiberNormal: bake(renderer, fiberSize, FIBER_NORMAL_FRAG),
    fiberAlbedo: bake(renderer, fiberSize, FIBER_ALBEDO_FRAG),
    plasterColor: bake(renderer, wallSize, PLASTER_COLOR_FRAG, {
      uBase: { value: lin('#ddd1c1') },
      uDark: { value: lin('#d2c3af') },
      uLight: { value: lin('#e6ddd1') },
    }),
    plasterNormal: bake(renderer, wallSize, PLASTER_NORMAL_FRAG),
    cedar: bake(renderer, 256, CEDAR_FRAG, {
      uA: { value: lin('#8f5232') },
      uB: { value: lin('#c4804e') },
    }),
  };
}
