// =============================================================================
//  glsl.js — pezzi di shader condivisi: rumore 3D, marmo, scalpello
// =============================================================================
//  Tutto è calcolato in "object space" (coordinate del modello: la statua è
//  alta 2, il pavimento è a y = 0). Così le venature del blocco grezzo
//  proseguono identiche sulla statua che ne esce.

// Simplex noise 3D (Ian McEwan, Ashima Arts / Stefan Gustavson, licenza MIT)
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
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
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm3(vec3 p) {
  float f = 0.5 * snoise(p);
  f += 0.25 * snoise(p * 2.03 + 17.1);
  #ifndef LOW_QUALITY
  f += 0.125 * snoise(p * 4.01 + 41.7);
  #endif
  return f;
}
`;

// Marmo: bianco caldo, venature grigie sottili, qualche venatura dorata appena accennata
export const MARBLE = /* glsl */ `
uniform vec3 uMarbleA;   // bianco caldo
uniform vec3 uMarbleB;   // bianco appena più grigio/caldo (nuvolosità)
uniform vec3 uVeinGrey;
uniform vec3 uVeinGold;
uniform float uVeinScale;

float veinLine(float v, float width) {
  // v = |sin(...)|: 0 al centro della venatura
  return 1.0 - smoothstep(0.0, width, v);
}

vec3 marbleColor(vec3 p, out float goldOut) {
  vec3 q = p * uVeinScale;
  // nuvolosità leggera del fondo
  float cloud = snoise(q * 0.5 - 7.3) * 0.5 + 0.5;
  vec3 col = mix(uMarbleA, uMarbleB, cloud * 0.75);
  // le venature seguono le linee dove il rumore vale zero: curve sottili e
  // naturali, senza gli anelli concentrici di un seno
  // spazio "stirato" lungo una diagonale: venature lunghe e oblique, non ghirigori
  vec3 s = vec3(dot(q, vec3(0.62, 0.55, 0.56)) * 0.22, dot(q, vec3(-0.66, 0.74, 0.1)), dot(q, vec3(0.42, 0.38, -0.82)));
  vec3 warp = vec3(snoise(q * 0.6 + 3.1), snoise(q * 0.6 - 5.7), snoise(q * 0.6 + 9.4)) * 0.3;
  float n1 = fbm3(s * 0.6 + warp);
  float fade1 = smoothstep(-0.35, 0.45, snoise(q * 0.33 + 1.7)); // le venature vanno e vengono
  col = mix(col, uVeinGrey, (veinLine(abs(n1), 0.022) * 0.34 + veinLine(abs(n1), 0.1) * 0.07) * fade1);
  // venature secondarie, più fini e solo in alcune zone
  float n2 = snoise(s * 1.4 + warp * 2.0 + 11.0);
  float presence = smoothstep(0.15, 0.65, snoise(q * 0.4 - 4.0));
  col = mix(col, uVeinGrey, veinLine(abs(n2), 0.018) * 0.2 * presence);
  // venatura dorata: rara e appena accennata
  float n3 = snoise(s * 0.5 + warp + 47.0);
  float gold = veinLine(abs(n3), 0.016) * smoothstep(0.25, 0.7, snoise(q * 0.3 + 7.0));
  col = mix(col, uVeinGold, gold * 0.45);
  goldOut = gold;
  return col;
}

// Segni di scalpello: solchi irregolari (dove il rumore cambia segno) e grana
float chiselHeight(vec3 p, float scale) {
  vec3 q = p * scale;
  float gouge = 1.0 - abs(snoise(q * vec3(1.0, 0.55, 1.0)));
  gouge *= gouge;
  float grain = snoise(q * 2.7 + 3.0);
  return gouge * 0.7 + grain * 0.3;
}

// Bump dalle derivate dello schermo (come bumpMap di three.js, senza texture)
vec3 bumpNormal(vec3 surfPos, vec3 surfNorm, float h, float strength) {
  vec3 dpx = dFdx(surfPos);
  vec3 dpy = dFdy(surfPos);
  vec3 r1 = cross(dpy, surfNorm);
  vec3 r2 = cross(surfNorm, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * surfNorm - strength * grad);
}
`;
