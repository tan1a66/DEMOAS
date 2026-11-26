// Mirtilli e ciliegie: un solo materiale per le istanze (aKind 0 = mirtillo, 1 = ciliegia).
// Mirtillo: la "pruina", la polvere azzurra opaca della foto, con qualche zona strofinata dove
// si vede la buccia scura e lucida; in cima la corona a cinque punte, sotto la cicatrice del
// picciolo. Ciliegia: rosso smaltato, laccato, con il riflesso dello studio.
// uPolish: toglie la polvere (mirtilli lucidi e scuri). Oggi resta a 0: la cliente vuole la stessa
// palette chiara anche nelle sezioni (lì basta il velo azzurro, uVeil). uGloss: il capitolo
// "El acabado" spegne e riaccende il lucido.

const noise = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i), n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0)), n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1)), n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1)), n111 = hash31(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return 0.65 * vnoise(p) + 0.35 * vnoise(p * 2.03 + 7.1);
}
`;

export const berryVertex = /* glsl */ `
attribute float aSeed;
attribute float aKind;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLN;
varying vec3 vLP;
varying float vSeed;
varying float vKind;
varying float vY;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vLN = normal;
  vLP = position;
  vSeed = aSeed;
  vKind = aKind;
  // altezza del centro della bacca: quelle sotto (primo strato) prendono meno luce
  vY = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const berryFragment = /* glsl */ `
uniform vec3 uBloom;      // polvere azzurra
uniform vec3 uBloomDeep;  // polvere in ombra
uniform vec3 uSkin;       // buccia sotto la polvere
uniform vec3 uCrown;      // corona
uniform vec3 uRed;        // ciliegia, rosso smaltato
uniform vec3 uRedDeep;
uniform vec3 uSky;        // luce dall'alto
uniform vec3 uGround;     // rimbalzo dal piano
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform mat3 uStudio;     // lo studio riflesso ruota con la luce
uniform float uPolish;    // 0 = con la polvere; 1 = lucidi (sezioni)
uniform float uGloss;     // 1 = normale; ~0 = opachi; >1 = più lucidi
uniform vec3 uVeilColor;
uniform float uVeil;
uniform vec3 uFogColor;
uniform vec2 uFog;
uniform float uR;         // raggio medio
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLN;
varying vec3 vLP;
varying float vSeed;
varying float vKind;
varying float vY;
${noise}

// lo studio: una grande softbox in alto a sinistra e una striscia a destra; sotto, il piano azzurro
vec3 studio(vec3 r) {
  r = uStudio * r;
  float key = smoothstep(0.55, 0.95, dot(r, normalize(vec3(-0.55, 0.75, 0.35))));
  float strip = smoothstep(0.92, 0.985, dot(r, normalize(vec3(0.75, 0.55, -0.2))));
  float sky = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  return vec3(1.0) * (key * 1.6 + strip * 0.9) + mix(uGround, uSky, sky) * 0.35;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);
  vec3 ln = normalize(vLN);
  float NV = clamp(dot(N, V), 0.0, 1.0);
  float NL = dot(N, L);
  float fres = pow(1.0 - NV, 3.0);

  // corona in cima (asse locale +Y) e cicatrice sotto
  float th = acos(clamp(ln.y, -1.0, 1.0));
  float ph = atan(ln.z, ln.x);
  float s1 = fract(vSeed * 7.31), s2 = fract(vSeed * 13.7), s3 = fract(vSeed * 3.17);

  // occlusione: il lato verso il piano e le bacche del primo strato più in ombra
  float ao = mix(0.42, 1.0, smoothstep(-0.75, 0.55, N.y));
  ao *= mix(0.78, 1.0, smoothstep(uR * 0.9, uR * 2.4, vY));

  vec3 col;
  if (vKind < 0.5) {
    // --- mirtillo ---
    // la corona: una piccola conca rotonda; i cinque sepali sono appena accennati sul bordo
    float rc = 0.24 + 0.022 * cos(5.0 * ph + s1 * 6.283) + 0.03 * (s2 - 0.5);
    float crown = 1.0 - smoothstep(rc - 0.04, rc + 0.015, th);
    float rim = smoothstep(rc - 0.02, rc + 0.02, th) * (1.0 - smoothstep(rc + 0.03, rc + 0.12, th));
    float core = 1.0 - smoothstep(0.05, 0.11, th);
    float lobe = smoothstep(0.55, 1.0, cos(5.0 * ph + s1 * 6.283)) * smoothstep(rc - 0.12, rc - 0.02, th) * crown;
    float scar = 1.0 - smoothstep(0.04, 0.075, 3.14159 - th);

    // la polvere: grana fine + qualche zona strofinata, ampia e morbida (solo in alcune bacche)
    vec3 q = vLP * 1.5 + vSeed * 17.0;
    float rub = smoothstep(0.6, 0.76, fbm(q)) * step(0.68, s3) * 0.75;
    float grain = vnoise(vLP * 38.0 + vSeed * 5.0);
    float streak = vnoise(vec3(vLP.x * 9.0, vLP.y * 60.0, vLP.z * 9.0) + vSeed);
    float bloom = (1.0 - rub) * (1.0 - 0.9 * uPolish);
    bloom *= mix(0.86, 1.0, grain) * mix(0.9, 1.0, streak);
    bloom *= 1.0 - 0.75 * crown; // nella corona la polvere è poca

    vec3 powder = mix(uBloomDeep, uBloom, 0.55 + 0.45 * grain);
    powder = mix(powder, uBloom * 1.12, fres * 0.6); // la polvere schiarisce di taglio
    vec3 base = mix(uSkin, powder, clamp(bloom, 0.0, 1.0));
    // corona: conca scura e bruna, i sepali più chiari, il bordo con la polvere
    base = mix(base, mix(uSkin, uCrown, 0.6) * 0.7, crown * 0.9);
    base = mix(base, uCrown * 1.35, lobe * 0.55);
    base = mix(base, uCrown * 0.55, core * 0.8);
    base = mix(base, powder * 1.08, rim * 0.5 * (1.0 - 0.8 * uPolish));
    base = mix(base, uCrown * 0.9, scar * 0.7);

    float wrap = max(0.0, (NL + 0.45) / 1.45);
    vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
    col = base * (hemi * 0.55 + uLightColor * wrap * 0.8) * ao;
    col *= 1.0 - 0.3 * crown * (1.0 - lobe);

    // buccia: lucida dove non c'è polvere
    float skinVis = 1.0 - clamp(bloom, 0.0, 1.0);
    float spec = pow(max(dot(N, H), 0.0), 90.0) * 1.1 + pow(max(dot(N, H), 0.0), 14.0) * 0.08;
    vec3 env = studio(reflect(-V, N));
    col += (uLightColor * spec + env * (0.05 + 0.5 * fres)) * skinVis * uGloss * mix(0.6, 1.0, ao);
    // la polvere: un velo di luce morbida di taglio
    col += uBloom * fres * 0.18 * clamp(bloom, 0.0, 1.0) * max(wrap, 0.3);
  } else {
    // --- ciliegia: rosso smaltato ---
    float dimple = 1.0 - smoothstep(0.1, 0.32, th);
    vec3 base = mix(uRed, uRedDeep, 0.25 + 0.5 * dimple);
    base *= mix(0.92, 1.05, vnoise(vLP * 6.0 + vSeed * 9.0));
    float wrap = max(0.0, (NL + 0.3) / 1.3);
    vec3 hemi = mix(uGround * 0.6, uSky, N.y * 0.5 + 0.5);
    col = base * (hemi * 0.35 + uLightColor * wrap * 0.95) * ao;
    float spec = pow(max(dot(N, H), 0.0), 160.0) * 2.4 + pow(max(dot(N, H), 0.0), 22.0) * 0.18;
    vec3 env = studio(reflect(-V, N));
    float F = 0.04 + 0.96 * pow(1.0 - NV, 5.0);
    col += (uLightColor * spec + env * (0.12 + 0.9 * F)) * uGloss * mix(0.5, 1.0, ao);
  }

  // lontananza e velo
  float d = length(vWorld - cameraPosition);
  col = mix(col, uFogColor, smoothstep(uFog.x, uFog.y, d) * 0.6);
  // il velo: sulle ciliegie meno (restano rosse, non rosa)
  col = mix(col, uVeilColor, uVeil * (vKind > 0.5 ? 0.6 : 1.0));
  col = col / (1.0 + col * 0.12); // niente bianchi bruciati
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

// Il piano: lo stesso azzurro dello sfondo della pagina, con le ombre di contatto delle bacche
// (una piccola mappa disegnata a ogni fotogramma).
export const floorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const floorFragment = /* glsl */ `
uniform sampler2D uShadow;
uniform vec4 uShadowRect; // x0, z0, larghezza, profondità
uniform vec3 uBg;
uniform vec3 uVeilColor;
uniform float uVeil;
uniform float uShade;
varying vec3 vWorld;
void main() {
  vec2 uv = (vWorld.xz - uShadowRect.xy) / uShadowRect.zw;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float s = texture2D(uShadow, clamp(uv, 0.0, 1.0)).r * inside;
  vec3 col = uBg * (1.0 - uShade * s);
  col = mix(col, uVeilColor, uVeil);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
