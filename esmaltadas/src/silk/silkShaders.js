// Shader della seta. Vertex: B-spline cubica sulla texture della simulazione (posizione,
// tangenti e normale analitiche). Fragment: raso di seta con speculare anisotropico a due
// lobi (Ashikhmin-Shirley) lungo l'ordito, sheen sui crinali delle pieghe, wrap lighting
// e trasmissione (la luce che passa nel tessuto), rovescio opaco in crêpe, orlo arrotolato
// con un bordino di raso di un altro colore (il bies color vino di ESMALTADAS) e trama
// visibile solo da vicino.

export const silkVertex = /* glsl */ `
uniform sampler2D uPos;   // (nx+2)×(ny+2) RGBA32F: xyz + cavità
uniform vec2 uSim;        // nx, ny
uniform vec2 uClothSize;  // metri
uniform float uTime;
uniform float uRipple;    // ampiezza delle pieghe fini (metri)

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vWarp;       // ordito (lungo la lunghezza)
varying vec3 vWeft;       // trama (lungo la larghezza)
varying vec2 vUv;
varying float vCav;

vec4 bs(float t) {
  float t2 = t * t, t3 = t2 * t, it = 1.0 - t;
  return vec4(it * it * it, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
}
vec4 dbs(float t) {
  float t2 = t * t, it = 1.0 - t;
  return vec4(-it * it, 3.0 * t2 - 4.0 * t, -3.0 * t2 + 2.0 * t + 1.0, t2) * 0.5;
}

// Pieghe fini: onde che scendono lungo l'ordito e scorrono con il vento, più ampie verso
// l'orlo (dove la seta è libera). Restituisce lo spostamento lungo la normale.
float ripple(vec2 m) {
  // onde larghe e lente (70-110 cm) che scorrono nel tessuto, più ampie verso l'orlo libero
  float t = uTime;
  float free = smoothstep(0.1, 1.0, m.y / uClothSize.y);
  float a = sin(m.x * 9.0 + t * 0.8 + sin(m.y * 1.3 + t * 0.3) * 1.5) * 0.6;
  a += sin(m.x * 5.6 - m.y * 2.0 - t * 0.55) * 0.4;
  return a * (0.35 + 0.65 * free);
}

void main() {
  // uv della PlaneGeometry: v = 1 in alto → riga 0 della simulazione
  vec2 s = vec2(uv.x, 1.0 - uv.y) * (uSim - 1.0);
  vec2 c = clamp(floor(s), vec2(0.0), uSim - 2.0);
  vec2 f = s - c;
  vec4 wu = bs(f.x), wv = bs(f.y), du = dbs(f.x), dv = dbs(f.y);
  ivec2 base = ivec2(c); // con il bordo fantasma: particella k → texel k+1, si parte da k
  vec3 P = vec3(0.0), Pu = vec3(0.0), Pv = vec3(0.0);
  float cav = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec4 t = texelFetch(uPos, base + ivec2(i, j), 0);
      float w = wu[i] * wv[j];
      P += w * t.xyz;
      Pu += du[i] * wv[j] * t.xyz;
      Pv += wu[i] * dv[j] * t.xyz;
      cav += w * t.w;
    }
  }
  vec3 N0 = normalize(cross(Pv, Pu));
  // pieghe fini con derivate numeriche → normale corretta
  vec2 m = vec2(uv.x * uClothSize.x, (1.0 - uv.y) * uClothSize.y);
  float e = 0.01;
  float r0 = ripple(m), rx = ripple(m + vec2(e, 0.0)), ry = ripple(m + vec2(0.0, e));
  // Pu, Pv sono per unità di particella: le converto in "per metro"
  vec3 Tu = Pu / (uClothSize.x / (uSim.x - 1.0));
  vec3 Tv = Pv / (uClothSize.y / (uSim.y - 1.0));
  vec3 Tu2 = Tu + N0 * (rx - r0) / e * uRipple;
  vec3 Tv2 = Tv + N0 * (ry - r0) / e * uRipple;
  P += N0 * r0 * uRipple;
  vWorld = P;
  vWeft = normalize(Tu2);
  vWarp = normalize(Tv2);
  vNormal = normalize(cross(Tv2, Tu2));
  vUv = uv;
  vCav = cav;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}
`;

export const silkFragment = /* glsl */ `
uniform vec3 uLightDir;      // verso la luce (softbox)
uniform vec3 uLightColor;
uniform vec3 uSilk;          // cipria
uniform vec3 uHigh;          // riflessi
uniform vec3 uShadow;        // ombre rosate
uniform vec3 uBack;          // rovescio in crêpe
uniform vec3 uIvory;         // fondo / nebbia
uniform vec2 uClothSize;     // metri
uniform vec2 uFog;           // inizio, fine
uniform float uDetail;       // 0..1 quanto mostrare la micro-trama (inquadrature macro)
uniform float uVeil;         // 0..1 la seta si ritira verso l'avorio (dentro le sezioni)
uniform float uGloss;        // brillo: 1 = raso; vicino a 0 = opaca, spenta; sopra 1 = più lucida
uniform float uRound;        // 1 = fazzoletto tondo (disco ritagliato nella griglia)
uniform vec3 uTrim;          // il bordino lungo l'orlo (vino)
uniform float uTrimW;        // larghezza del bordino (mm); 0 = niente bordino
uniform float uTrimLine;     // 1 = un filetto dello stesso colore poco dentro il bordo (cornice da foulard)

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vWarp;
varying vec3 vWeft;
varying vec2 vUv;
varying float vCav;

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

// Ashikhmin-Shirley anisotropico: nu lungo T (ordito), nv lungo B (trama)
float aniso(vec3 N, vec3 T, vec3 B, vec3 V, vec3 L, float nu, float nv) {
  vec3 H = normalize(L + V);
  float NH = max(dot(N, H), 1e-4);
  float HT = dot(H, T), HB = dot(H, B);
  float e = (nu * HT * HT + nv * HB * HB) / max(1.0 - NH * NH, 1e-4);
  float NL = max(dot(N, L), 0.0), NV = max(dot(N, V), 1e-3), HV = max(dot(H, V), 1e-3);
  float norm = sqrt((nu + 1.0) * (nv + 1.0)) / 25.13;
  float F = 0.3 + 0.7 * pow(1.0 - HV, 5.0); // le fibre allineate riflettono molto più di un dielettrico liscio
  return norm * pow(NH, e) / (HV * max(NL, NV)) * F * NL;
}

// Lo studio riflesso nella seta: un grande softbox caldo nella direzione della luce,
// un pannello di riempimento più debole dall'altra parte, l'avorio intorno.
float panel(vec3 R, vec3 D, vec2 halfSize, vec2 soft) {
  float d = dot(R, D);
  if (d <= 0.0) return 0.0;
  vec3 sx = normalize(cross(vec3(0.0, 1.0, 0.0), D));
  vec3 sy = cross(D, sx);
  vec2 q = vec2(dot(R, sx), dot(R, sy)) / d;
  return (1.0 - smoothstep(halfSize.x - soft.x, halfSize.x + soft.x, abs(q.x)))
       * (1.0 - smoothstep(halfSize.y - soft.y, halfSize.y + soft.y, abs(q.y)));
}
uniform mat3 uStudio; // rotazione dello studio (segue il dito / il mouse / il giroscopio)
vec3 studio(vec3 R) {
  vec3 Rs = uStudio * R;
  // grande softbox frontale a sinistra, striscia alta e stretta a destra, luce dall'alto
  float key = panel(Rs, normalize(vec3(-0.42, 0.22, 0.88)), vec2(0.5, 0.85), vec2(0.22, 0.35));
  float strip = panel(Rs, normalize(vec3(0.62, 0.05, 0.78)), vec2(0.07, 1.4), vec2(0.06, 0.4));
  float top = panel(Rs, normalize(vec3(0.0, 0.92, 0.38)), vec2(0.9, 0.3), vec2(0.4, 0.2));
  float sky = smoothstep(-0.5, 1.0, Rs.y);
  return uHigh * (key * 2.2 + strip * 3.0 + top * 0.9) + mix(vec3(0.3, 0.24, 0.21), vec3(0.85, 0.82, 0.78), sky) * 0.3;
}

void main() {
  vec2 cuv = vUv - 0.5;
  float rr = length(cuv);
  if (uRound > 0.5 && rr > 0.5) discard;
  bool front = gl_FrontFacing;
  vec3 N = normalize(vNormal) * (front ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 T = normalize(vWarp - N * dot(vWarp, N));
  vec3 B = normalize(cross(N, T));

  // coordinate sul tessuto in millimetri: x lungo la trama, y lungo l'ordito
  vec2 mm = vec2(vUv.x * uClothSize.x, (1.0 - vUv.y) * uClothSize.y) * 1000.0;
  vec2 fw = fwidth(mm);
  float pxmm = max(max(fw.x, fw.y), 1e-4); // millimetri per pixel

  // --- texture a più scale, ognuna visibile solo quando il pixel la può risolvere ---
  // (A) fiammature lente della seta grezza, lunghe lungo la trama: visibili anche da lontano
  float slubA = vnoise(vec2(mm.x * 0.0035 + vnoise(mm * 0.004) * 2.0, mm.y * 0.05)) * 0.7
              + vnoise(vec2(mm.x * 0.009, mm.y * 0.17)) * 0.3;
  slubA = smoothstep(0.35, 0.85, slubA) - 0.5;
  slubA *= 1.0 - smoothstep(2.5, 6.0, pxmm);
  // (B) fili più spessi della trama (millimetrici)
  float slubB = vnoise(vec2(mm.x * 0.035, mm.y * 1.6));
  // (periodo ~0,6 mm: si vede solo se il pixel è ben più piccolo, altrimenti diventa graffi)
  slubB = smoothstep(0.62, 0.95, slubB) * (1.0 - smoothstep(0.1, 0.22, pxmm));
  // (C) micro-trama del raso: fili d'ordito flottanti, punti di legatura sfalsati (raso da 5)
  float pitchW = 0.24, pitchP = 0.2;
  float warpIdx = floor(mm.x / pitchW);
  float tx = fract(mm.x / pitchW) - 0.5;
  float pick = mm.y / pitchP;
  float tie = fract((pick + mod(warpIdx * 2.0, 5.0)) / 5.0);
  float dip = smoothstep(0.0, 0.07, tie) * smoothstep(0.2, 0.08, tie);
  float microVis = (1.0 - smoothstep(0.035, 0.09, pxmm)) * uDetail;
  // inclinazione della normale: cilindro del filo + avvallamento nella legatura
  float tiltB = tx * 1.1 * microVis;
  float tiltT = (dip - 0.5 * smoothstep(0.08, 0.2, tie) * smoothstep(0.32, 0.2, tie)) * 0.5 * microVis;
  float threadVar = (hash12(vec2(warpIdx, 3.0)) - 0.5) * microVis;

  // --- orlo arrotolato (roulotté): lo spessore della seta sul bordo ---
  float dl = mm.x, dr = uClothSize.x * 1000.0 - mm.x, dt = mm.y, db = uClothSize.y * 1000.0 - mm.y;
  float dEdge = min(min(dl, dr), min(dt, db));
  vec3 Eout = dl < dr ? -normalize(vWeft) : normalize(vWeft);
  float dlr = min(dl, dr), dtb = min(dt, db);
  if (dtb < dlr) Eout = dt < db ? -normalize(vWarp) : normalize(vWarp);
  if (uRound > 0.5) {
    // orlo lungo il cerchio: distanza dal bordo e direzione verso l'esterno
    dEdge = (0.5 - rr) * uClothSize.x * 1000.0;
    Eout = normalize(normalize(vWeft) * cuv.x - normalize(vWarp) * cuv.y);
  }
  float hemW = 5.0;
  float hemFar = smoothstep(1.2, 3.0, pxmm); // da lontano l'orlo è sotto il pixel: solo un filo più denso
  float roll = (1.0 - smoothstep(0.0, hemW, dEdge)) * (1.0 - hemFar);
  float hemLine = (1.0 - smoothstep(0.0, max(hemW, pxmm * 1.5), dEdge)) * hemFar;
  float rollA = roll * roll * 1.35;

  // il bordino: una fascia di raso di un altro colore lungo tutto l'orlo, da entrambi i lati.
  // Il bordo è sfumato sul pixel: da lontano resta una linea netta, mai seghettata.
  float aaT = max(pxmm * 0.8, 0.35);
  float trim = uTrimW > 0.0 ? 1.0 - smoothstep(uTrimW - aaT, uTrimW + aaT, dEdge) : 0.0;
  // da lontano il bordino non sparisce: almeno un pixel e mezzo
  trim = max(trim, uTrimW > 0.0 ? (1.0 - smoothstep(pxmm * 1.1, pxmm * 1.9, dEdge)) * step(uTrimW, pxmm * 1.6) : 0.0);
  // il filetto interno: sottile, un quarto della fascia più in dentro (almeno un pixel)
  float lw = max(uTrimW * 0.09, pxmm * 1.1) * 0.5;
  float lc = uTrimW * 1.3 + lw;
  float tline = uTrimLine * (1.0 - smoothstep(lw - aaT * 0.5, lw + aaT * 0.5, abs(dEdge - lc)));
  trim = max(trim, tline * 0.95);

  vec3 Np = normalize(N + B * tiltB + T * tiltT);
  Np = normalize(Np * cos(rollA) + Eout * sin(rollA));
  // le fiammature piegano appena la normale (il tessuto non è perfetto)
  Np = normalize(Np + B * slubB * 0.06);

  vec3 L = normalize(uLightDir);
  float NL = dot(Np, L);

  // --- diffusa con wrap: la luce gira nel tessuto, le ombre restano rosate ---
  float wrap = 0.5;
  float diff = clamp((NL + wrap) / (1.0 + wrap), 0.0, 1.0);
  diff = mix(diff, diff * diff * (3.0 - 2.0 * diff), 0.5);
  vec3 base = front ? uSilk : uBack;
  base = mix(base, uTrim * (front ? 1.0 : 0.92), trim);
  base *= 1.0 + slubB * 0.05 + threadVar * 0.08;
  base *= mix(1.0, 0.94, roll) * (1.0 - hemLine * 0.08 * (1.0 - trim));
  vec3 shade = mix(uShadow, uTrim * 0.62, trim); // il bordeaux resta rosso anche in ombra
  vec3 col = mix(shade, base, diff) * (0.5 + 0.4 * diff) * uLightColor;

  // trasmissione: luce dall'altra parte, la seta si accende in controluce
  float trans = pow(clamp(-dot(N, L), 0.0, 1.0), 1.4);
  col += base * vec3(1.0, 0.82, 0.7) * trans * 0.32;

  // luce ambiente: cielo avorio sopra, rimbalzo caldo sotto
  float hemi = Np.y * 0.5 + 0.5;
  col += base * mix(vec3(0.13, 0.09, 0.08), vec3(0.18, 0.165, 0.155), hemi);

  // occlusione: il fondo delle pieghe
  float cav = vCav * (front ? 1.0 : -1.0);
  float ao = 1.0 - clamp(cav * 2.4, 0.0, 0.5);
  ao *= 1.0 - clamp(-cav * 0.6, 0.0, 0.08) * 0.0;
  col *= ao;

  // --- speculare: il raso sul diritto, opaco sul rovescio ---
  // Strisce lunghe lungo l'ordito (tolleranti in T), nette di traverso (strette in B):
  // il riflesso corre lungo le pieghe come sulle tende di raso.
  float specMask = 1.0 + slubB * 0.4 + threadVar * 0.6;
  float NV0 = clamp(dot(Np, V), 0.0, 1.0);
  vec3 spec;
  if (front) {
    float s1 = aniso(Np, T, B, V, L, 10.0, 420.0);   // striscia lucida lungo la piega
    float s2 = aniso(Np, T, B, V, L, 3.0, 36.0);     // alone morbido
    float s3 = aniso(Np, B, T, V, L, 10.0, 160.0);   // trama: riflesso cangiante più caldo
    vec3 tint = mix(uSilk, uTrim, trim);
    spec = uHigh * s1 * 0.32 + mix(uHigh, tint, 0.3) * s2 * 0.5 + vec3(1.0, 0.85, 0.7) * s3 * 0.08;
    // riflesso dello studio, sfumato lungo l'ordito (anisotropia "vera")
    vec3 env = vec3(0.0);
    // tre campioni lungo l'ordito (prima cinque): stesso riflesso allungato, meno calcoli
    for (int k = -1; k <= 1; k++) {
      vec3 Nk = normalize(Np + T * float(k) * 0.24);
      env += studio(reflect(-V, Nk));
    }
    env /= 3.0;
    float refl = 0.34 + 0.56 * pow(1.0 - NV0, 3.0);
    spec += env * mix(uHigh, tint, 0.22) * refl;
  } else {
    float s2 = aniso(Np, T, B, V, L, 4.0, 10.0);
    spec = uBack * s2 * 0.15;
    vec3 Nb = Np;
    spec += studio(reflect(-V, Nb)) * uBack * (0.04 + 0.2 * pow(1.0 - NV0, 3.0));
  }
  spec *= specMask * uLightColor * mix(1.0, ao, 0.5) * uGloss;

  // sheen sui crinali (incidenza radente)
  float NV = clamp(dot(Np, V), 0.0, 1.0);
  vec3 sheen = mix(uHigh, mix(uSilk, uTrim, trim), 0.3) * pow(1.0 - NV, 3.5) * (0.18 + 0.5 * diff) * (front ? 1.0 : 0.5);

  float gl = clamp(uGloss, 0.0, 1.0);
  sheen *= mix(0.35, 1.0, gl);
  col *= mix(0.9, 1.0, gl); // spenta è anche un filo più grigia
  col += spec + sheen;

  // nebbia leggera verso l'avorio
  float d = length(cameraPosition - vWorld);
  col = mix(col, uIvory, smoothstep(uFog.x, uFog.y, d) * 0.65);
  col = mix(col, uIvory, uVeil);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
