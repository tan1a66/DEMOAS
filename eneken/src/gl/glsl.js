// Funciones GLSL compartidas: ruido, celdas (marcas de gubia), madera, cáusticas.

export const NOISE = /* glsl */ `
float eHash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float eHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 eHash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float eNoise3(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n000 = eHash12(i.xy + i.z * 17.17);
  float n100 = eHash12(i.xy + vec2(1.,0.) + i.z * 17.17);
  float n010 = eHash12(i.xy + vec2(0.,1.) + i.z * 17.17);
  float n110 = eHash12(i.xy + vec2(1.,1.) + i.z * 17.17);
  float n001 = eHash12(i.xy + (i.z + 1.) * 17.17);
  float n101 = eHash12(i.xy + vec2(1.,0.) + (i.z + 1.) * 17.17);
  float n011 = eHash12(i.xy + vec2(0.,1.) + (i.z + 1.) * 17.17);
  float n111 = eHash12(i.xy + vec2(1.,1.) + (i.z + 1.) * 17.17);
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float eNoise2(vec2 x){
  vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(eHash12(i), eHash12(i + vec2(1,0)), f.x), mix(eHash12(i + vec2(0,1)), eHash12(i + vec2(1,1)), f.x), f.y);
}
float eFbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * eNoise3(p); p *= 2.03; a *= .5; } return s; }
float eFbm2(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * eNoise2(p); p = p * 2.03 + 1.7; a *= .5; } return s; }

// Celdas de Voronoi 3D: devuelve (F1, F2, id) y el centro de la celda más cercana.
vec3 eVoronoi3(vec3 p, out vec3 center){
  vec3 b = floor(p); vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0; float id = 0.0; center = vec3(0.0);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = eHash33(b + g);
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = o.x + o.y * 7.0; center = b + g + o; }
    else if (d < d2){ d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), fract(id));
}
`;

// Madera maciza: anillos alrededor de un eje vertical (el tronco del que se talla), poros alargados
// según la fibra y facetas cóncavas de gubia. p en metros, en el espacio del bloque tallado.
export const WOOD = /* glsl */ `
uniform vec3 uWoodEarly;
uniform vec3 uWoodLate;
uniform vec3 uWoodPore;

vec3 eWoodAlbedo(vec3 p, out float rough){
  // huella del píxel en metros: se apagan los detalles que no caben en un píxel (sin parpadeo)
  float fw = length(fwidth(p)) + 1e-5;
  // eje del tronco ligeramente inclinado: las vetas se abren en "llamas" sobre las curvas
  vec3 q = vec3(p.x + p.y * 0.08, p.y, p.z - p.y * 0.05);
  float w1 = eNoise3(p * vec3(1.4, 0.25, 1.4));
  float w2 = eNoise3(p * vec3(1.4, 0.25, 1.4) + 11.7);
  q.xz += vec2(w1, w2) * 0.11;
  float r = length(q.xz);
  float freq = 22.0;
  // anillos de ancho irregular (años buenos y malos)
  float rings = r * freq + eFbm3(vec3(r * 3.0, p.y * 0.4, 0.0)) * 3.0 + eNoise3(p * vec3(3.0, 0.5, 3.0)) * 0.9;
  float ring = fract(rings);
  float late = smoothstep(0.45, 0.8, ring) * (1.0 - smoothstep(0.82, 1.0, ring));
  late *= 1.0 - smoothstep(0.3, 0.7, fw * freq);
  float fibF = 70.0;
  float fib = (eNoise3(p * vec3(fibF, 2.5, fibF)) - 0.5) * (1.0 - smoothstep(0.2, 0.5, fw * fibF));
  float big = eFbm3(p * vec3(1.1, 0.3, 1.1));
  vec3 col = mix(uWoodEarly, uWoodLate, late * 0.5 + 0.1);
  col *= 0.8 + 0.4 * big;
  col *= 1.0 + 0.14 * fib;
  rough = 0.36 + 0.14 * late + 0.1 * (1.0 - big);
  return col;
}

// Facetas de gubia: cuencos cóncavos alargados según la dirección t (la del trazo).
vec3 eChisel(vec3 p, vec3 n, vec3 t, float scale, float stretch, float amount, out float edge){
  float k = 1.0 / stretch - 1.0;
  vec3 ps = p + t * dot(p, t) * k;
  vec3 c;
  vec3 v = eVoronoi3(ps * scale, c);
  vec3 d = ps * scale - c;
  d += t * dot(d, t) * k;
  d -= n * dot(d, n);
  edge = 1.0 - smoothstep(0.0, 0.22, v.y - v.x);
  return normalize(n + d * amount * (0.6 + 0.8 * v.z));
}
`;

// Cáusticas procedurales (iteración clásica de "tileable water caustic").
export const CAUSTICS = /* glsl */ `
float eCaustic(vec2 uv, float time){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++){
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 7.0);
}
`;
