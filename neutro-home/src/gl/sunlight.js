// La luz de Mérida: el sol de la tarde entra por el portal de la hacienda, filtrado por hojas de
// palma, y deja sobre los muros y el suelo un dibujo de luz y sombra que se mueve, muy despacio,
// con la brisa; los pilares del portal dejan bandas de sombra que barren la galería cuando el sol
// baja. Todo se proyecta en la dirección del sol y sólo afecta a la luz del sol (no a las lámparas).

import * as THREE from 'three';

export const sunlight = {
  uTime: { value: 0 },
  uLeaf: { value: 1 }, // intensidad del follaje (0 = sol limpio)
  uSunDir: { value: new THREE.Vector3(-1.55, 1.75, 1.45).normalize() },
  // portal: (paso entre pilares, posición de un pilar, media anchura, plano del portal en z)
  uArcade: { value: new THREE.Vector4(2.85, 1.48, 0.28, 7.94) },
  uArcadeK: { value: 1 }, // intensidad de las sombras de los pilares
};

const LEAF_GLSL = /* glsl */ `
uniform float uTime;
uniform float uLeaf;
uniform vec3 uSunDir;
uniform vec4 uArcade;
uniform float uArcadeK;
// sombra de los pilares del portal (se proyecta desde el plano del portal en la dirección del sol)
float arcadeLight(vec3 wp) {
  float dist = uArcade.w - wp.z;
  if (dist <= 0.0 || uArcadeK <= 0.0) return 1.0;
  vec3 d = normalize(uSunDir);
  float t = dist / max(d.z, 0.08);
  float m = wp.x + d.x * t - uArcade.y;
  float c = abs(m - uArcade.x * floor(m / uArcade.x + 0.5));
  float pen = 0.05 + 0.012 * t;
  float lit = smoothstep(uArcade.z - pen, uArcade.z + pen, c);
  return mix(1.0, mix(0.14, 1.0, lit), uArcadeK);
}
float lfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lfNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lfHash(i), lfHash(i + vec2(1.0, 0.0)), u.x), mix(lfHash(i + vec2(0.0, 1.0)), lfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lfFbm(vec2 p) { return 0.55 * lfNoise(p) + 0.3 * lfNoise(p * 2.07 + 1.7) + 0.15 * lfNoise(p * 4.13 + 3.1); }
// Copas de palmera enteras (no hojas sueltas): en cada celda grande, a veces, una copa con
// sus fronds saliendo de un centro; cada fronda es un raquis que se arquea (cae con su peso)
// y foliolos en espiga. Las palmeras están lejos del muro: penumbra ancha, foliolos difusos.
const float CELL = 3.4;
const float NFR = 11.0;
float frondShape(vec2 q, float L) {
  float a = q.x;
  if (a < 0.0 || a > L) return 0.0;
  float t = a / L;
  float w = 0.42 * pow(sin(3.14159 * min(1.0, t * 1.04)), 0.75) * (0.55 + 0.45 * t);
  float b = abs(q.y);
  // foliolos en espiga, orientados hacia la punta
  float fish = 0.5 + 0.5 * sin((a - b * 1.1) * 23.0);
  float leaflets = smoothstep(0.2, 0.75, fish) * (1.0 - smoothstep(w * 0.55, w * 1.05, b));
  float rib = 1.0 - smoothstep(0.008, 0.04, b);
  return max(leaflets * 0.9, rib * 0.85) * smoothstep(0.05, 0.3, a);
}
float crown(vec2 p, vec2 cell) {
  float h = lfHash(cell);
  if (h < 0.42) return 0.0;
  vec2 c = (cell + 0.5 + (vec2(lfHash(cell + 3.1), lfHash(cell + 7.7)) - 0.5) * 0.6) * CELL;
  vec2 d = p - c;
  float L = 1.75 + 0.5 * h;
  if (dot(d, d) > (L + 0.5) * (L + 0.5)) return 0.0;
  // la copa se mece entera, muy poco
  float rot = lfHash(cell + 11.3) * 6.2831 + 0.035 * sin(uTime * (0.35 + h * 0.3) + h * 20.0);
  float step = 6.2831 / NFR;
  float k = floor((atan(d.y, d.x) - rot) / step + 0.5);
  float s = 0.0;
  for (int j = -1; j <= 1; j++) {
    float kk = k + float(j);
    float jit = lfHash(cell + vec2(kk, 2.3));
    float fa = rot + kk * step + (jit - 0.5) * 0.3 + 0.03 * sin(uTime * (0.9 + jit) + kk);
    vec2 dir = vec2(cos(fa), sin(fa));
    vec2 q = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x)));
    // el raquis cae con su peso (hacia abajo en el muro)
    q.y += (0.1 + 0.08 * jit) * q.x * q.x * dir.x;
    s = max(s, frondShape(q, L * (0.82 + 0.3 * jit)));
  }
  return s;
}
// 1 = luz, 0 = sombra de copa (con penumbra suave: las palmeras están lejos del muro)
float leafLight(vec3 wp) {
  vec3 d = normalize(uSunDir);
  vec3 u = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 v = cross(u, d);
  vec2 q = vec2(dot(wp, u), dot(wp, v));
  q += vec2(sin(uTime * 0.31), cos(uTime * 0.27)) * 0.02;
  vec2 g = floor(q / CELL);
  float shade = 0.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) shade = max(shade, crown(q, g + vec2(float(i), float(j))));
  }
  return 1.0 - 0.92 * shade;
}
`;

// Inyecta el follaje y los pilares en un material estándar (sólo en la luz del sol).
export function patchSunlight(shader) {
  Object.assign(shader.uniforms, sunlight);
  if (!shader.vertexShader.includes('varying vec3 vWPos;')) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  }
  if (!shader.fragmentShader.includes('varying vec3 vWPos;')) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;');
  }
  // sólo la luz del sol (direccionales): las lámparas y la luz cenital no pasan por las hojas
  const lights = THREE.ShaderChunk.lights_fragment_begin.replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunMask;'
  );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${LEAF_GLSL}`)
    .replace(
      '#include <lights_fragment_begin>',
      `float sunMask = mix(1.0, mix(0.5, 1.06, leafLight(vWPos)), uLeaf) * arcadeLight(vWPos);\n${lights}`
    );
}
