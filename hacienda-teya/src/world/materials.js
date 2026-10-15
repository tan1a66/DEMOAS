// ─────────────────────────────────────────────────────────────────────────────
//  Materiali procedurali dell'hacienda (PBR, calcolati in coordinate mondo)
//
//  Nessuna texture da scaricare: colore, ruvidità e rilievo nascono da rumore
//  3D nello shader, quindi non servono UV e non si vedono ripetizioni.
//  Il dettaglio fine si attenua con la distanza (niente sfarfallio).
//
//  - plaster: estuco rojo almagre ruvido, con macchie, colature e terra alla base
//  - cal:     bianco calce di archi, cornici e coronamenti
//  - cantera: pietra calcarea yucateca (colonne, gradini, cantonali)
//  - wood:    legno scuro di portoni e travi
//  - iron:    ferro battuto di cancelli e grate
//  - ground:  terra rossa, strada bianca di sascab, lastricato e prato
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PALETTE } from '../config.js';

export const NOISE_GLSL = /* glsl */ `
  float wh13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float wn3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wh13(i), wh13(i + vec3(1, 0, 0)), f.x), mix(wh13(i + vec3(0, 1, 0)), wh13(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(wh13(i + vec3(0, 0, 1)), wh13(i + vec3(1, 0, 1)), f.x), mix(wh13(i + vec3(0, 1, 1)), wh13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // fbm con anti-aliasing: le ottave più fini di un pixel sfumano nella media
  float wfbm(vec3 p, float px) {
    float s = 0.0; float a = 0.5; float f = 1.0;
    for (int i = 0; i < 5; i++) {
      float fade = 1.0 - smoothstep(0.25, 0.6, f * px);
      s += a * mix(0.5, wn3(p * f), fade);
      f *= 2.03; a *= 0.5; p += 7.31;
    }
    return s;
  }
  // celle di Voronoi 2D: (distanza dal bordo, id della cella)
  vec2 wvoronoi(vec2 x) {
    vec2 n = floor(x); vec2 f = fract(x);
    float md = 8.0; float md2 = 8.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(wh13(vec3(n + g, 1.7)), wh13(vec3(n + g, 9.3)));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md2 = md; md = d; id = n + g; } else if (d < md2) { md2 = d; }
    }
    return vec2(sqrt(md2) - sqrt(md), wh13(vec3(id, 4.1)));
  }
`;

// Muro in rovina (anni dell'abbandono): pittura sbiadita e polverosa, intonaco
// caduto a chiazze con la muratura di pietra a vista, muffa e colature scure.
// amount: 0 = muro in ordine, 1 = rovina piena
export const RUIN_GLSL = /* glsl */ `
  void ruin(inout vec3 c, inout float h, vec3 P, vec3 N, float px, float amount, float mid) {
    if (amount < 0.001) return;
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix(c, mix(vec3(lum), c, 0.5) * vec3(1.06, 0.97, 0.88), amount * 0.65);
    // dove cade l'intonaco: più in basso, dove sale l'umidità
    float pn = wfbm(P * 0.62 + 11.0, px * 0.62) + 0.22 * smoothstep(1.8, 0.0, P.y);
    float thr = 1.1 - 0.46 * amount;
    float hole = smoothstep(thr, thr + 0.035, pn);
    // muratura di pietre irregolari (coordinate sul piano del muro)
    vec2 wq = abs(N.y) > 0.7 ? P.xz : (abs(N.z) > abs(N.x) ? P.xy : P.zy);
    vec2 sv = wvoronoi(wq * vec2(3.0, 4.4));
    float joint = (1.0 - smoothstep(0.03, 0.1, sv.x)) * (1.0 - smoothstep(0.2, 0.5, px * 4.4));
    vec3 stoneC = vec3(0.47, 0.42, 0.35) * (0.7 + 0.4 * sv.y) * (0.82 + 0.25 * mid);
    stoneC = mix(stoneC, vec3(0.2, 0.17, 0.14), joint * 0.85);
    // il bordo spezzato dell'intonaco, più chiaro
    float rim = smoothstep(thr - 0.06, thr, pn) * (1.0 - hole);
    c = mix(c, vec3(0.8, 0.75, 0.67), rim * 0.45 * amount);
    c = mix(c, stoneC, hole);
    float mold = smoothstep(0.52, 0.85, wn3(vec3(P.x * 2.1 + P.z * 2.1, P.y * 0.33, 5.0)));
    c *= 1.0 - 0.5 * mold * amount;
    h = mix(h, -0.8 + (1.0 - joint) * 0.45 + mid * 0.2, hole);
  }
`;

// Inietta in un MeshStandardMaterial una funzione di superficie in GLSL che
// riceve posizione e normale in coordinate mondo e restituisce colore,
// ruvidità e altezza (per il rilievo).
//   body: codice GLSL che scrive  sCol (vec3), sRough (float), sH (float)
//         e può leggere  P (vec3 mondo), N (vec3 normale mondo), px (m per pixel)
//   shared: uniform già esistenti ({ value }) condivisi tra più materiali,
//           per esempio l'epoca (uRuin, uWild, ...): si dichiarano float
function surfaceMaterial({ key, uniforms = {}, shared = {}, body, bump = 0.003, params = {} }) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...params });
  const u = {};
  for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
  Object.assign(u, shared);
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    const decl = Object.entries(uniforms)
      .map(([k, v]) => `uniform ${v.isColor ? 'vec3' : v.isVector3 ? 'vec3' : v.isVector4 ? 'vec4' : v.isVector2 ? 'vec2' : 'float'} ${k};`)
      .concat(Object.keys(shared).map((k) => `uniform float ${k};`))
      .join('\n');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        ${decl}
        ${NOISE_GLSL}
        ${RUIN_GLSL}
        float sH;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float sRough = roughness;
        {
          vec3 P = vWPos;
          vec3 N = normalize(vWNrm);
          float px = length(fwidth(vWPos)) + 1e-5;
          vec3 sCol = diffuseColor.rgb;
          sH = 0.0;
          ${body}
          diffuseColor.rgb = sCol;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = sRough;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition); vec3 dpy = dFdy(-vViewPosition);
          float hx = dFdx(sH); float hy = dFdy(sH);
          vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - ${bump.toFixed(5)} * grad);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `surface-${key}`;
  return mat;
}

// ── Estuco rojo almagre ──────────────────────────────────────────────────────
export function plasterMaterial(color = PALETTE.almagre, era = {}) {
  return surfaceMaterial({
    key: 'plaster',
    bump: 0.006,
    uniforms: { uBase: new THREE.Color(color) },
    shared: { uRuin: era.uRuin || { value: 0 } },
    body: /* glsl */ `
      float large = wn3(P * 0.33) * 0.6 + wn3(P * 0.9) * 0.4;
      float mid = wfbm(P * 2.6, px * 2.6);
      float fine = wfbm(P * 21.0, px * 21.0);
      vec3 c = uBase * (0.82 + 0.34 * large) * (0.92 + 0.14 * mid);
      // dove il sole ha sbiadito l'intonaco: più aranciato
      c = mix(c, c * vec3(1.12, 0.96, 0.84), smoothstep(0.55, 0.85, large) * 0.6);
      // colature verticali sotto cornici e coronamenti
      float streak = smoothstep(0.58, 0.9, wn3(vec3(P.x * 3.3 + P.z * 3.3, P.y * 0.22, 1.7)));
      c *= 1.0 - 0.2 * streak * (0.5 + 0.5 * mid);
      // schizzi di terra alla base dei muri
      float splash = smoothstep(0.8, 0.0, P.y) * (0.55 + 0.45 * mid);
      c = mix(c, c * vec3(0.6, 0.48, 0.42), splash * 0.7);
      float h = fine * 0.75 + mid * 0.25;
      ruin(c, h, P, N, px, uRuin, mid);
      sCol = c;
      sH = h;
      sRough = 0.93;
    `,
  });
}

// ── Bianco calce ─────────────────────────────────────────────────────────────
export function calMaterial(era = {}) {
  return surfaceMaterial({
    key: 'cal',
    bump: 0.003,
    uniforms: { uBase: new THREE.Color(PALETTE.cal) },
    shared: { uRuin: era.uRuin || { value: 0 } },
    body: /* glsl */ `
      float large = wn3(P * 0.5);
      float mid = wfbm(P * 3.1, px * 3.1);
      float fine = wfbm(P * 26.0, px * 26.0);
      vec3 c = uBase * (0.9 + 0.1 * large) * (0.95 + 0.06 * mid);
      // calce sporca: grigio caldo nelle colature e alla base
      float streak = smoothstep(0.6, 0.9, wn3(vec3(P.x * 4.0 + P.z * 4.0, P.y * 0.3, 3.1)));
      float splash = smoothstep(0.7, 0.0, P.y);
      c = mix(c, c * vec3(0.72, 0.68, 0.62), clamp(streak * 0.45 + splash * 0.6, 0.0, 1.0) * (0.5 + 0.5 * mid));
      float h = fine * 0.7 + mid * 0.3;
      ruin(c, h, P, N, px, uRuin * 0.85, mid);
      sCol = c;
      sH = h;
      sRough = 0.86;
    `,
  });
}

// ── Pietra calcarea (cantera) ────────────────────────────────────────────────
export function canteraMaterial() {
  return surfaceMaterial({
    key: 'cantera',
    bump: 0.004,
    uniforms: { uBase: new THREE.Color(PALETTE.cantera) },
    body: /* glsl */ `
      float mid = wfbm(P * 4.0, px * 4.0);
      float fine = wfbm(P * 30.0, px * 30.0);
      // pori del calcare: puntini scuri
      float pores = smoothstep(0.78, 0.86, wn3(P * 55.0)) * (1.0 - smoothstep(0.2, 0.5, px * 55.0));
      vec3 c = uBase * (0.82 + 0.26 * mid);
      c = mix(c, c * vec3(0.95, 0.88, 0.75), smoothstep(0.4, 0.8, wn3(P * 0.8)) * 0.5); // venature ocra
      c *= 1.0 - 0.35 * pores;
      float splash = smoothstep(0.5, 0.0, P.y);
      c = mix(c, c * vec3(0.7, 0.62, 0.55), splash * 0.5);
      sCol = c;
      sH = fine * 0.6 + mid * 0.4 - pores * 0.6;
      sRough = 0.82;
    `,
  });
}

// ── Legno scuro ──────────────────────────────────────────────────────────────
export function woodMaterial() {
  return surfaceMaterial({
    key: 'wood',
    bump: 0.002,
    uniforms: { uBase: new THREE.Color('#4b2c19') },
    body: /* glsl */ `
      // venatura: rumore stirato lungo l'asse verticale del portone
      float grain = wn3(vec3(P.x * 46.0 + P.z * 46.0, P.y * 1.6, 2.0));
      float rings = sin((P.x + P.z) * 160.0 + grain * 9.0) * 0.5 + 0.5;
      float aa = 1.0 - smoothstep(0.1, 0.4, px * 160.0);
      vec3 c = uBase * (0.75 + 0.35 * grain) * (0.9 + 0.15 * mix(0.5, rings, aa));
      sCol = c;
      sH = grain * 0.6 + mix(0.5, rings, aa) * 0.4;
      sRough = 0.62;
    `,
  });
}

// ── Ferro battuto ────────────────────────────────────────────────────────────
export function ironMaterial(era = {}) {
  return surfaceMaterial({
    key: 'iron',
    bump: 0.001,
    params: { metalness: 0.55 },
    uniforms: { uBase: new THREE.Color('#1d1a17') },
    shared: { uRuin: era.uRuin || { value: 0 } },
    body: /* glsl */ `
      float rust = smoothstep(0.6 - 0.45 * uRuin, 0.85 - 0.3 * uRuin, wn3(P * 9.0));
      sCol = mix(uBase, vec3(0.22, 0.09, 0.04), rust * 0.7);
      sH = rust;
      sRough = mix(0.5, 0.85, rust);
    `,
  });
}

// ── Terreno: terra rossa, sascab, lastricato, prato ──────────────────────────
//  regioni descritte da uniform (in metri, mondo):
//   uRoad   = (centro x, mezza larghezza, z iniziale, z finale)
//   uCourt  = (x min, x max, z min, z max)   cortile lastricato
//   uLawnA/B= (x min, x max, z min, z max)   prati del giardino
//   uGardenC= (x, z) da dove si allarga il prato di oggi
//  epoche (uniform condivisi): uField = solchi del henequén, uWild = lettiera
//  del monte negli anni dell'abbandono, uGarden = prato che cresce dalla casa
export function groundMaterial(regions, era = {}) {
  return surfaceMaterial({
    key: 'ground',
    bump: 0.012,
    shared: {
      uField: era.uField || { value: 1 },
      uWild: era.uWild || { value: 0 },
      uGarden: era.uGarden || { value: 0 },
    },
    uniforms: {
      uSoil: new THREE.Color(PALETTE.soil),
      uSascab: new THREE.Color('#b9a988'),
      uStone: new THREE.Color('#b9ab93'),
      uGrass: new THREE.Color('#566b31'),
      uRoad: regions.road,
      uCourt: regions.court,
      uLawnA: regions.lawnA,
      uLawnB: regions.lawnB,
      uRowStep: regions.rowStep,
      uGardenC: regions.gardenCenter || new THREE.Vector2(0, 0),
    },
    body: /* glsl */ `
      vec2 q = P.xz;
      float n1 = wn3(vec3(q * 0.35, 0.0));
      float mid = wfbm(vec3(q * 2.2, 1.0), px * 2.2);
      float fine = wfbm(vec3(q * 14.0, 2.0), px * 14.0);

      // terra rossa con solchi lungo le file di henequén, erbe secche a chiazze
      vec3 soil = uSoil * (0.7 + 0.45 * n1) * (0.86 + 0.24 * mid);
      float furrow = 0.5 + 0.5 * cos(6.2831 * q.x / uRowStep);
      float fk = 0.3 + 0.7 * uField; // senza henequén i solchi si spianano
      soil *= 1.0 - 0.16 * fk * (1.0 - furrow);
      float weeds = smoothstep(0.45, 0.8, wfbm(vec3(q * 0.9, 7.0), px * 0.9)) * (0.6 + 0.4 * furrow);
      soil = mix(soil, vec3(0.2, 0.17, 0.08) * (0.8 + 0.4 * fine), weeds * 0.55);
      float hSoil = fine * 0.6 + mid * 0.3 + furrow * 0.4 * fk;
      // abbandono: il monte si riprende la terra (foglie secche, erba grigia)
      float wildM = clamp(uWild * (0.75 + 0.6 * wn3(vec3(q * 0.3, 9.0))), 0.0, 1.0);
      vec3 litter = mix(vec3(0.2, 0.16, 0.09), vec3(0.15, 0.16, 0.07), wn3(vec3(q * 1.7, 4.0))) * (0.75 + 0.5 * fine);
      soil = mix(soil, litter, wildM * 0.85);
      hSoil = mix(hSoil, fine * 0.8 + mid * 0.2, wildM);

      // strada bianca di sascab (bordi irregolari)
      float edge = uRoad.y + (wn3(vec3(q * 0.9, 5.0)) - 0.5) * 0.7;
      float road = smoothstep(edge + 0.25, edge - 0.15, abs(q.x - uRoad.x)) * step(uRoad.z, q.y) * step(q.y, uRoad.w);
      vec3 sascab = uSascab * (0.78 + 0.28 * mid) * (0.9 + 0.14 * fine);
      // due solchi di ruote più scuri e bordi sporchi di terra rossa
      float rx = abs(q.x - uRoad.x);
      float tracks = smoothstep(0.22, 0.05, abs(rx - 0.62)) * (0.7 + 0.3 * mid);
      sascab *= 1.0 - 0.18 * tracks;
      sascab = mix(sascab, uSoil * 1.1, smoothstep(0.55, 1.0, rx / max(uRoad.y, 0.1)) * 0.55);

      // cortile: lastre irregolari di pietra con fughe
      vec2 vor = wvoronoi(q * 1.6);
      float joint = 1.0 - smoothstep(0.02, 0.07, vor.x);
      joint *= 1.0 - smoothstep(0.25, 0.6, px * 1.6);
      vec3 stone = uStone * (0.78 + 0.3 * vor.y) * (0.9 + 0.18 * mid);
      stone = mix(stone, stone * 0.45, joint);
      float hStone = (1.0 - joint) * 0.7 + fine * 0.3;
      float court = step(uCourt.x, q.x) * step(q.x, uCourt.y) * step(uCourt.z, q.y) * step(q.y, uCourt.w);

      // prato del giardino
      float lawnA = step(uLawnA.x, q.x) * step(q.x, uLawnA.y) * step(uLawnA.z, q.y) * step(q.y, uLawnA.w);
      float lawnB = step(uLawnB.x, q.x) * step(q.x, uLawnB.y) * step(uLawnB.z, q.y) * step(q.y, uLawnB.w);
      float lawn = max(lawnA, lawnB);
      vec3 grass = uGrass * (0.7 + 0.45 * wfbm(vec3(q * 5.0, 3.0), px * 5.0)) * (0.9 + 0.2 * n1);

      vec3 c = soil; float h = hSoil;
      c = mix(c, sascab, road); h = mix(h, fine * 0.8, road);
      c = mix(c, stone, court); h = mix(h, hStone, court);
      c = mix(c, grass, lawn); h = mix(h, fine, lawn);
      // oggi: il prato si allarga dalla casa verso la carretera
      float gd = length(q - uGardenC) + (n1 - 0.5) * 14.0;
      float gr = uGarden * 82.0;
      float garden = smoothstep(gr, gr - 10.0, gd) * step(0.001, uGarden) * (1.0 - road) * (1.0 - court);
      c = mix(c, grass * (0.95 + 0.1 * furrow), garden); h = mix(h, fine, garden);
      sCol = c;
      sH = h;
      sRough = mix(0.95, 0.88, court);
    `,
  });
}

export function bronzeMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#7b5a2e', metalness: 0.85, roughness: 0.38 });
}

export function terracottaMaterial() {
  return surfaceMaterial({
    key: 'terracotta',
    bump: 0.002,
    uniforms: { uBase: new THREE.Color('#a24e2c') },
    body: /* glsl */ `
      float mid = wfbm(P * 6.0, px * 6.0);
      sCol = uBase * (0.8 + 0.3 * mid);
      float salt = smoothstep(0.65, 0.9, wn3(P * 3.0 + 4.0)); // efflorescenze bianche
      sCol = mix(sCol, vec3(0.7, 0.62, 0.55), salt * 0.35);
      sH = mid;
      sRough = 0.88;
    `,
  });
}

// Vetro/luce calda delle finestre e delle lanterne: intensità guidata dalla sera
export function glowMaterial(color = '#ffb35c', uniforms) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.08, 3.2, uNight);');
  };
  mat.customProgramCacheKey = () => 'glow';
  return mat;
}

// Set di materiali condivisi (si creano una volta sola)
export function createMaterials(sharedUniforms) {
  return {
    plaster: plasterMaterial(PALETTE.almagre, sharedUniforms),
    cal: calMaterial(sharedUniforms),
    cantera: canteraMaterial(),
    wood: woodMaterial(),
    iron: ironMaterial(sharedUniforms),
    bronze: bronzeMaterial(),
    terracotta: terracottaMaterial(),
    glow: glowMaterial('#ffb35c', sharedUniforms),
    glass: new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.15, metalness: 0.3 }),
    leafDark: new THREE.MeshStandardMaterial({ color: '#2f4220', roughness: 0.8 }),
    soilPot: new THREE.MeshStandardMaterial({ color: '#2b1a12', roughness: 1 }),
  };
}
