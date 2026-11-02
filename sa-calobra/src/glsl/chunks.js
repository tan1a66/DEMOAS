// Pezzi di GLSL condivisi: livelli del rilievo, texture cotte, rumore, luce e nebbia.
import { BLEND } from '../terrain/heightfield.js';

const f = (v) => v.toFixed(1);

/** rettangoli dei tre livelli (uniform condivisi) */
export const RECTS_GLSL = /* glsl */ `
  uniform vec4 uRectHi, uRectBase, uRectFar;     // xMin, zMin, xMax, zMax
  uniform vec3 uGridHi, uGridBase, uGridFar;     // larghezza, altezza (texel), passo (m)
  #define BLEND_HI ${f(BLEND.hi)}
  #define BLEND_BASE ${f(BLEND.base)}
  float edgeW(vec4 r, vec2 xz, float w) {
    float d = min(min(xz.x - r.x, r.z - xz.x), min(xz.y - r.y, r.w - xz.y));
    return smoothstep(0.0, w, d);
  }
  vec2 levelUv(vec4 r, vec3 g, vec2 xz) { return ((xz - r.xy) / g.z + 0.5) / g.xy; }
`;

/** quote dalle heightmap (solo per la cottura) */
export const LEVELS_GLSL = /* glsl */ `
  ${RECTS_GLSL}
  uniform sampler2D tHHi, tHBase, tHFar;
  float hLevel(sampler2D t, vec4 r, vec3 g, vec2 xz) {
    vec2 fp = clamp((xz - r.xy) / g.z, vec2(0.0), g.xy - 1.001);
    ivec2 i = ivec2(floor(fp));
    vec2 w = fp - vec2(i);
    float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r;
    float c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
  }
  bool inRect(vec4 r, vec2 xz) { return xz.x >= r.x && xz.x <= r.z && xz.y >= r.y && xz.y <= r.w; }
  float H(vec2 xz) {
    if (inRect(uRectHi, xz)) return hLevel(tHHi, uRectHi, uGridHi, xz);
    if (inRect(uRectBase, xz)) return hLevel(tHBase, uRectBase, uGridBase, xz);
    return hLevel(tHFar, uRectFar, uGridFar, xz);
  }
`;

/** texture cotte: normale, sole, occlusione — sfumate tra i livelli come le quote */
export const BAKE_GLSL = /* glsl */ `
  ${RECTS_GLSL}
  uniform sampler2D tBakeHi, tBakeBase, tBakeFar;
  vec4 sampleBake(vec2 xz) {
    vec4 f = texture2D(tBakeFar, levelUv(uRectFar, uGridFar, xz));
    vec4 b = texture2D(tBakeBase, levelUv(uRectBase, uGridBase, xz));
    vec4 h = texture2D(tBakeHi, levelUv(uRectHi, uGridHi, xz));
    return mix(mix(f, b, edgeW(uRectBase, xz, BLEND_BASE)), h, edgeW(uRectHi, xz, BLEND_HI));
  }
  vec3 decodeNormal(vec2 rg) {
    vec2 nxz = rg * 2.0 - 1.0;
    return vec3(nxz.x, sqrt(max(1.0 - dot(nxz, nxz), 0.0)), nxz.y);
  }
`;

export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // rumore a valori con derivate analitiche: vec3(valore, d/dx, d/dy)
  // (interpolazione quintica: derivate continue, niente quadretti nel micro-rilievo)
  vec3 vnoised(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
    float k1 = b - a, k2 = c - a, k3 = a - b - c + d;
    return vec3(a + k1 * u.x + k2 * u.y + k3 * u.x * u.y,
                du * vec2(k1 + k3 * u.y, k2 + k3 * u.x));
  }
  // rumore a gradiente (Perlin) con derivate analitiche: niente "quadretti" della griglia.
  // Restituisce vec3(valore in ~0…1, d/dx, d/dy).
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
  }
  vec3 gnoised(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec2 ga = hash22(i), gb = hash22(i + vec2(1.0, 0.0));
    vec2 gc = hash22(i + vec2(0.0, 1.0)), gd = hash22(i + vec2(1.0, 1.0));
    float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
    float k = va - vb - vc + vd;
    float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
    vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
           + du * (u.yx * k + vec2(vb, vc) - va);
    return vec3(v * 0.75 + 0.5, d * 0.75);
  }
  float gnoise(vec2 p) { return gnoised(p).x; }
  float fbm3(vec2 p) {
    float s = 0.0, a = 0.5;
    mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
    return s / 0.875;
  }
`;

/** luce: sole caldo + cielo freddo nelle ombre + rimbalzo caldo dal suolo */
export const LIGHT_GLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;       // colore × intensità
  uniform vec3 uAmbSky;
  uniform vec3 uAmbGround;
  vec3 shade(vec3 albedo, vec3 n, float sunVis, float ao) {
    float ndl = max(dot(n, uSunDir), 0.0);
    vec3 amb = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5) * ao;
    return albedo * (uSunColor * ndl * sunVis + amb);
  }
`;

/** nebbia esponenziale con decadimento in quota; il colore viene dal cielo nella stessa direzione */
export const FOG_GLSL = /* glsl */ `
  uniform samplerCube uSkyCube;
  uniform float uSkyExposure;
  uniform float uFogDensity;
  uniform float uFogFalloff;
  uniform vec3 uFogSun;
  uniform float uFogSunPow;
  uniform float uFogMax;
  vec3 skyAt(vec3 dir, float lod) {
    return textureLod(uSkyCube, dir, lod).rgb * uSkyExposure; // cubemap da render target: niente flip
  }
  vec3 fogColor(vec3 rd) {
    vec3 c = skyAt(normalize(vec3(rd.x, max(rd.y, 0.0) + 0.006, rd.z)), 1.5);
    float s = pow(max(dot(rd, uSunDir), 0.0), uFogSunPow);
    return mix(c, uFogSun * max(max(c.r, c.g), c.b) * 1.1, s * 0.4);
  }
  float fogAmount(vec3 wpos) {
    vec3 rd = wpos - cameraPosition;
    float dist = length(rd);
    rd /= dist;
    float a = uFogDensity, b = uFogFalloff;
    float base = a * exp(-max(cameraPosition.y, 0.0) * b);
    float k = rd.y * b * dist;
    float amount = abs(k) < 1e-4 ? base * dist : base * dist * (1.0 - exp(-k)) / k;
    return min(1.0 - exp(-amount), uFogMax);
  }
  vec3 applyFog(vec3 col, vec3 wpos) {
    vec3 rd = normalize(wpos - cameraPosition);
    return mix(col, fogColor(rd), fogAmount(wpos));
  }
`;
