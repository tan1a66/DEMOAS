// Fragmentos GLSL compartidos.

export const HASH = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
`;

export const NOISE = /* glsl */ `
${HASH}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

// Deriva suave sin texturas (suma de senos desfasados), para polvo y temblor.
export const DRIFT = /* glsl */ `
vec3 drift(vec3 p, float t) {
  return vec3(
    sin(p.y * 3.1 + t * 0.7) + sin(p.z * 2.3 + t * 1.13),
    sin(p.z * 2.7 + t * 0.9) + sin(p.x * 3.7 - t * 0.61),
    sin(p.x * 2.9 + t * 0.53) + sin(p.y * 1.9 - t * 0.83)
  ) * 0.5;
}
`;

// Sprite redondo: núcleo nítido de tiza cuando es pequeño, bokeh suave cuando crece.
export const SPRITE = /* glsl */ `
float sprite(vec2 pc, float soft) {
  vec2 c = pc - 0.5;
  float d = length(c);
  float hard = 1.0 - smoothstep(0.28, 0.5, d);
  float blur = exp(-d * d * 14.0) * (1.0 - smoothstep(0.42, 0.5, d));
  return mix(hard, blur, soft);
}
`;
