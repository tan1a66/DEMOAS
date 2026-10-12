// Ruido de valor 2D compartido por tierra y mar.
export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

// Cielo de atardecer: se usa en la cúpula y en los reflejos del mar.
export const SKY = /* glsl */ `
uniform vec3 uSunDir;
vec3 skyColor(vec3 d) {
  float h = clamp(d.y, -0.2, 1.0);
  vec3 horizon = vec3(0.98, 0.78, 0.60);
  vec3 low = vec3(0.96, 0.86, 0.74);
  vec3 zenith = vec3(0.47, 0.64, 0.78);
  vec3 c = mix(horizon, low, smoothstep(0.0, 0.12, h));
  c = mix(c, zenith, smoothstep(0.1, 0.75, h));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.72, 0.42) * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6);
  return c;
}
`;
