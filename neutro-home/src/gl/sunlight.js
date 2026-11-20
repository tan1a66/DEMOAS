// La luz de Mérida: el sol de la tarde entra filtrado por hojas de palma y deja sobre los muros
// y el suelo un dibujo de luz y sombra que se mueve, muy despacio, con la brisa.
// El dibujo se proyecta en la dirección del sol (coherente con las sombras de las piezas) y sólo
// afecta a la luz directa.

import * as THREE from 'three';

export const sunlight = {
  uTime: { value: 0 },
  uLeaf: { value: 1 }, // intensidad del follaje (0 = sol limpio)
  uSunDir: { value: new THREE.Vector3(-1.55, 1.75, 1.45).normalize() },
};

const LEAF_GLSL = /* glsl */ `
uniform float uTime;
uniform float uLeaf;
uniform vec3 uSunDir;
float lfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lfNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lfHash(i), lfHash(i + vec2(1.0, 0.0)), u.x), mix(lfHash(i + vec2(0.0, 1.0)), lfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lfFbm(vec2 p) { return 0.55 * lfNoise(p) + 0.3 * lfNoise(p * 2.07 + 1.7) + 0.15 * lfNoise(p * 4.13 + 3.1); }
const float CELL = 1.35;
// Una hoja de palma por celda (no en todas): nervio central y foliolos en espiga.
float frond(vec2 p, vec2 cell) {
  float h = lfHash(cell);
  if (h < 0.38) return 0.0;
  vec2 c = (cell + 0.5 + (vec2(lfHash(cell + 3.1), lfHash(cell + 7.7)) - 0.5) * 0.7) * CELL;
  float ang = lfHash(cell + 11.3) * 6.2831;
  // cada hoja se mece a su ritmo
  ang += 0.05 * sin(uTime * (0.5 + h * 0.4) + h * 20.0);
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 q = p - c;
  float a = dot(q, d);
  float cc = dot(q, vec2(-d.y, d.x));
  float L = 0.55 + 0.3 * h;
  float t = clamp(a / L, -1.0, 1.0);
  float w = 0.3 * (1.0 - t * t) * (0.6 + 0.4 * (t * 0.5 + 0.5));
  float along = 1.0 - smoothstep(L * 0.92, L, abs(a));
  float inside = (1.0 - smoothstep(w * 0.6, w, abs(cc))) * along;
  float fish = 0.5 + 0.5 * sin((a + abs(cc) * 1.15) * 30.0 + h * 6.0);
  float leaflets = smoothstep(0.18, 0.62, fish);
  float rib = (1.0 - smoothstep(0.004, 0.02, abs(cc))) * along;
  return max(inside * leaflets, rib * 0.8);
}
// 1 = luz, 0 = sombra de hoja (con penumbra suave: las hojas están lejos del muro)
float leafLight(vec3 wp) {
  vec3 d = normalize(uSunDir);
  vec3 u = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 v = cross(u, d);
  vec2 q = vec2(dot(wp, u), dot(wp, v));
  q += vec2(sin(uTime * 0.31), cos(uTime * 0.27)) * 0.02;
  vec2 g = floor(q / CELL);
  float shade = 0.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) shade = max(shade, frond(q, g + vec2(float(i), float(j))));
  }
  return 1.0 - shade;
}
`;

// Inyecta el follaje en un material estándar (después del aomap: sólo luz directa).
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
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${LEAF_GLSL}`)
    .replace(
      '#include <aomap_fragment>',
      `#include <aomap_fragment>
reflectedLight.directDiffuse *= mix(1.0, mix(0.5, 1.06, leafLight(vWPos)), uLeaf);`
    );
}
