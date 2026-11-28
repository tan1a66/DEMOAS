// Fragmentos GLSL compartidos. Cada material incluye solo lo que necesita.
// Orden de inclusión: NOISE → TIME → (WAVE, CAUSTICS, LIGHT).

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  float a = hash12(i), b = hash12(i + vec2(1., 0.));
  float c = hash12(i + vec2(0., 1.)), d = hash12(i + vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm3(vec2 p) {
  float s = 0., a = .5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
    a *= .5;
  }
  return s / .875;
}
`;

export const TIME = /* glsl */ `
uniform float uTime;
`;

// Ola: un frente que avanza desde el mar (-z) hacia la playa (+z), con borde irregular,
// espuma y una huella húmeda que se seca con el tiempo. Todo es analítico.
export const WAVE = /* glsl */ `
uniform float uWavePeriod;
uniform vec4 uWaveA; // salida, alcance, fin llegada, fin pausa  (z, z, fracción, fracción)
uniform vec4 uWaveB; // fin retirada, tiempo de secado (s), amplitud del borde, -

float waveEdgeOffset(float x, float t) {
  return (vnoise(vec2(x * .8 + 3.7, t * .16)) - .5) * uWaveB.z
       + (vnoise(vec2(x * 2.6 - 1.3, t * .31)) - .5) * uWaveB.z * .4
       + sin(x * 1.7 + t * .3) * .05;
}

float waveFront(float u) {
  float zS = uWaveA.x, zM = uWaveA.y, a = uWaveA.z, b = uWaveA.w, c = uWaveB.x;
  if (u < a) { float x = u / a; return mix(zS, zM, 1. - pow(1. - x, 2.3)); }
  if (u < b) { float x = (u - a) / (b - a); return zM - .03 * sin(x * 3.14159); }
  if (u < c) { float x = (u - b) / (c - b); return mix(zM, zS, .5 - .5 * cos(3.14159 * x)); }
  return zS;
}

// x = cobertura (0–1), y = humedad (0–1), z = distancia por detrás del frente, w = fase de retirada
vec4 waveCore(vec2 xz) {
  float t = uTime;
  float P = uWavePeriod;
  float u = fract(t / P);
  float zS = uWaveA.x, zM = uWaveA.y;
  float z = xz.y - waveEdgeOffset(xz.x, t);
  float behind = waveFront(u) - z;
  float cover = smoothstep(-.012, .03, behind);
  // tiempo desde que el agua dejó este punto (inversa analítica de la retirada)
  float e = clamp((zM - z) / (zM - zS), 0., 1.);
  float uExp = uWaveA.w + (uWaveB.x - uWaveA.w) * acos(1. - 2. * e) / 3.14159;
  float since = u >= uExp ? u - uExp : u + 1. - uExp;
  float wet = exp(-since * P / uWaveB.y) * smoothstep(zM + .04, zM - .08, z);
  wet = max(wet, cover);
  float receding = smoothstep(uWaveA.z, uWaveA.w, u) * (1. - smoothstep(uWaveB.x, uWaveB.x + .06, u));
  return vec4(cover, wet, behind, receding);
}

float waveFoam(vec2 xz, vec4 w) {
  float t = uTime;
  float behind = max(w.z, 0.);
  float edge = exp(-behind * mix(7., 24., w.w)) * w.x;
  float lace = smoothstep(.5, .8, fbm3(vec2(xz.x * 5.2, xz.y * 7.4) + vec2(t * .05, -t * .2)));
  float zone = exp(-behind * mix(2., 4.5, w.w)) * w.x;
  return clamp(edge * mix(.95, .55, w.w) + lace * zone * .8, 0., 1.);
}
`;

// Cáusticas: textura procedural (render target) + ondas de toque que la deforman.
export const CAUSTICS = /* glsl */ `
uniform sampler2D uCaustics;
uniform float uCausticScale;
uniform float uCausticIntensity;
uniform float uCausticWater;
uniform vec4 uRipples[4]; // xy = centro, z = instante, w = fuerza

// xy = desplazamiento, z = brillo del anillo
vec3 rippleField(vec2 p) {
  vec3 acc = vec3(0.);
  for (int i = 0; i < 4; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0. || age < 0. || age > 4.) continue;
    vec2 d = p - r.xy;
    float dist = length(d) + 1e-4;
    float x = dist - age * .6;
    float env = exp(-x * x * 26.) * exp(-age * 1.1) * r.w * smoothstep(0., .12, age);
    float s = sin(x * 30.);
    acc.xy += d / dist * s * env * .05;
    acc.z += env * (.5 + .5 * s);
  }
  return acc;
}

vec3 causticSample(vec2 p, vec2 warp) {
  vec2 q = p + warp;
  // deformación lenta de baja frecuencia: rompe la repetición de la baldosa
  q += .3 * (vec2(vnoise(p * .19 + 3.1), vnoise(p * .19 + 9.7)) - .5);
  return texture2D(uCaustics, q / uCausticScale).rgb;
}
`;

export const LIGHT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform float uFlat;

vec3 skyColor(vec3 d) {
  float h = clamp(d.y, -1., 1.);
  float k = smoothstep(-.04, .92, h);
  vec3 c = mix(uSkyHorizon, uSkyZenith, pow(k, .6));
  float s = max(dot(d, uSunDir), 0.);
  c += uSunColor * (pow(s, 48.) * .1 + pow(s, 2400.) * .9) * (1. - uFlat);
  return c;
}
`;
