// ─────────────────────────────────────────────────────────────────────────────
//  Fascia di lino rojo almagre su cui l'ago ricama il titolo
//
//  - trama tela procedurale: fili di ordito e trama che passano sopra/sotto,
//    con le irregolarità tipiche del lino (fili più grossi, toni diversi);
//    quando i fili diventano più piccoli di un pixel la trama sfuma nella media
//  - vento: onde lente (la stessa funzione in GLSL e in JS, così i punti, l'ago
//    e il filo seguono il tessuto)
//  - "poke": il tessuto si avvalla dove passa l'ago
//  - controluce: il sole dietro filtra tra i fili e scalda il rosso
//  - frange (rapacejo) alle due estremità, come un rebozo
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { mulberry32 } from './agave.js';

// Onde del vento in unità "em" (indipendenti dalla scala della scritta).
// IMPORTANTE: WAVE_GLSL e fabricWave() devono restare identiche.
export const WAVE_GLSL = /* glsl */ `
  float fabricWave(vec2 p, float t) {
    return 0.075 * sin(0.8 * p.x - 1.05 * t + 0.6 * sin(0.35 * p.y + 0.2 * t))
         + 0.028 * sin(1.9 * p.x + 1.3 * p.y - 1.9 * t)
         + 0.005 * sin(3.6 * p.x - 2.7 * p.y - 2.6 * t);
  }
  // avvallamento attorno al foro dove passa l'ago (xy = centro, z = ampiezza, w = raggio)
  float fabricPoke(vec2 p, vec4 poke) {
    vec2 d = p - poke.xy;
    return poke.z * exp(-dot(d, d) / (poke.w * poke.w));
  }
`;
export function fabricWave(x, y, t) {
  return (
    0.075 * Math.sin(0.8 * x - 1.05 * t + 0.6 * Math.sin(0.35 * y + 0.2 * t)) +
    0.028 * Math.sin(1.9 * x + 1.3 * y - 1.9 * t) +
    0.005 * Math.sin(3.6 * x - 2.7 * y - 2.6 * t)
  );
}

// Luce radente del ricamo: arriva bassa da sinistra e scolpisce trama, punti e
// ago. È calcolata negli shader di lino, filo e spina (e non con una luce della
// scena) così non sbianca la pianta. uRakeDirView = direzione verso la luce.
export const RAKE_GLSL = /* glsl */ `
  uniform vec3 uRakeDirView;
  uniform vec3 uRakeColor;
  vec3 rakeLight(vec3 n, vec3 albedo, float shininess, float specK) {
    vec3 L = normalize(uRakeDirView);
    vec3 V = normalize(vViewPosition);
    float ndl = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + V)), 0.0), shininess) * specK;
    return uRakeColor * (albedo * ndl + spec);
  }
`;
export const RAKE_DIR = new THREE.Vector3(-0.86, 0.26, 0.44).normalize();

const NOISE_GLSL = /* glsl */ `
  float lh(vec2 p) { p = fract(p * vec2(213.17, 371.53)); p += dot(p, p + 31.7); return fract(p.x * p.y); }
  float ln(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lh(i), lh(i + vec2(1, 0)), f.x), mix(lh(i + vec2(0, 1)), lh(i + vec2(1, 1)), f.x), f.y); }
`;

// uniform del lino: un solo oggetto per tutta la vita della pagina (li condividono
// anche i punti ricamati), si aggiornano i valori quando cambia l'impaginazione
export function createFabricUniforms() {
  return {
    uWindTime: { value: 0 },
    uEm: { value: 1 },
    uPoke: { value: new THREE.Vector4(0, 0, 0, 0.05) },
    uPitch: { value: 0.015 }, // distanza tra due fili (metri)
    uSize: { value: new THREE.Vector2(1, 1) },
    uSunDirView: { value: new THREE.Vector3(0, 0, -1) },
    uLight: { value: 1 },
    uRakeDirView: { value: RAKE_DIR.clone() },
    uRakeColor: { value: new THREE.Color('#ffc68a').multiplyScalar(1.5) },
  };
}

export function createLinenBand({ width, height, scale, pitch, quality, uniforms, fringe = true }) {
  uniforms.uEm.value = scale;
  uniforms.uPitch.value = pitch;
  uniforms.uSize.value.set(width, height);

  const geo = new THREE.PlaneGeometry(width, height, quality.fabricSegments[0], quality.fabricSegments[1]);
  const mat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.almagre,
    roughness: 0.82,
    metalness: 0,
    sheen: 0.55,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#ffb08c'),
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime; uniform float uEm; uniform vec4 uPoke;
        varying vec2 vLocal;
        ${WAVE_GLSL}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec2 pe = position.xy / uEm;
        float e = 0.04;
        float wx = (fabricWave(pe + vec2(e, 0.0), uWindTime) - fabricWave(pe - vec2(e, 0.0), uWindTime)) / (2.0 * e);
        float wy = (fabricWave(pe + vec2(0.0, e), uWindTime) - fabricWave(pe - vec2(0.0, e), uWindTime)) / (2.0 * e);
        vec3 objectNormal = normalize(vec3(-wx, -wy, 1.0));`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        transformed.z += fabricWave(pe, uWindTime) * uEm + fabricPoke(position.xy, uPoke);
        vLocal = position.xy;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uPitch; uniform vec2 uSize; uniform vec3 uSunDirView; uniform float uLight;
        varying vec2 vLocal;
        ${NOISE_GLSL}
        ${RAKE_GLSL}
        float gWeaveH; float gCover;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          // trama tela: ordito lungo x, trama lungo y, sopra/sotto a scacchiera
          vec2 q = vLocal / uPitch;
          vec2 cell = floor(q);
          vec2 f = fract(q) - 0.5;
          // irregolarità del lino: ogni filo ha spessore variabile lungo il suo percorso
          float wA = 0.34 + 0.12 * (ln(vec2(cell.y * 3.1, q.x * 0.11)) - 0.5);
          float wB = 0.34 + 0.12 * (ln(vec2(q.y * 0.11, cell.x * 2.7)) - 0.5);
          float warp = smoothstep(wA, wA - 0.16, abs(f.y)); // filo di ordito (orizzontale)
          float weft = smoothstep(wB, wB - 0.16, abs(f.x)); // filo di trama (verticale)
          float over = mod(cell.x + cell.y, 2.0);
          float hA = warp * (0.55 + 0.45 * cos(f.x * 3.14159)) * mix(0.62, 1.0, over);
          float hB = weft * (0.55 + 0.45 * cos(f.y * 3.14159)) * mix(1.0, 0.62, over);
          float h = max(hA, hB);
          float cover = max(warp, weft);
          // anti-aliasing: fili più piccoli di un pixel → valore medio
          float fw = max(fwidth(q.x), fwidth(q.y));
          float aa = smoothstep(0.3, 0.75, fw);
          h = mix(h, 0.46, aa);
          cover = mix(cover, 0.86, aa);
          gWeaveH = h;
          gCover = cover;
          // tono di ogni filo (il lino non è mai uniforme) + macchie larghe
          float toneA = lh(vec2(cell.y, 5.0));
          float toneB = lh(vec2(9.0, cell.x));
          float tone = mix(mix(toneB, toneA, step(hB, hA)), 0.5, aa);
          float mottle = ln(vLocal * 2.2) * 0.6 + ln(vLocal * 7.0) * 0.4;
          vec3 c = diffuseColor.rgb;
          c *= (0.7 + 0.42 * h) * (0.9 + 0.2 * tone) * (0.88 + 0.22 * mottle);
          c *= mix(0.55, 1.0, cover); // tra i fili si vede il buio dietro
          // orlo in alto e in basso: piega più scura e leggermente rialzata
          float edgeY = uSize.y * 0.5 - abs(vLocal.y);
          float hem = smoothstep(0.045, 0.03, edgeY);
          c *= 1.0 - 0.18 * hem + 0.12 * smoothstep(0.03, 0.022, edgeY) * smoothstep(0.012, 0.02, edgeY);
          diffuseColor.rgb = c;
          // estremità sfilacciate: il bordo non è dritto
          float edgeX = uSize.x * 0.5 - abs(vLocal.x);
          if (edgeX < 0.012 * (0.3 + ln(vec2(vLocal.y * 60.0, 3.0)))) discard;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // rilievo della trama (bump con derivate di schermo)
          vec3 dpx = dFdx(-vViewPosition); vec3 dpy = dFdy(-vViewPosition);
          float hx = dFdx(gWeaveH); float hy = dFdy(gWeaveH);
          vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          // altezza reale di un filo ≈ 0,35 × passo della trama
          normal = normalize(abs(det) * normal - (uPitch * 0.35) * grad);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // controluce: il sole basso dietro la fascia filtra tra i fili
          float back = max(0.0, dot(-normal, uSunDirView));
          float through = 0.35 + 0.9 * (1.0 - gCover);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.55, 0.32) * pow(back, 1.5) * through * 0.9 * uLight;
          // luce radente: lucentezza morbida solo sulle creste dei fili
          totalEmissiveRadiance += rakeLight(normal, diffuseColor.rgb, 22.0, 0.1 * gWeaveH);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'linen-band';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);

  // ── Frange alle estremità ──────────────────────────────────────────────────
  let fringeMesh = null;
  if (fringe) {
    fringeMesh = createFringe(width, height, pitch, uniforms);
    group.add(fringeMesh);
  }

  return {
    group,
    mesh,
    uniforms,
    width,
    height,
    dispose() {
      geo.dispose();
      mat.dispose();
      if (fringeMesh) {
        fringeMesh.geometry.dispose();
        fringeMesh.material.dispose();
      }
    },
  };
}

// Frange: nastri sottili che escono dalle due estremità, pendono e ondeggiano
function createFringe(width, height, pitch, uniforms) {
  const rnd = mulberry32(7);
  const seg = 7;
  const step = Math.max(pitch * 2.2, 0.009);
  const pos = [];
  const aRoot = [];
  const aT = [];
  const aSide = [];
  const aAcross = [];
  const aLen = [];
  const aSeed = [];
  const idx = [];
  for (const side of [-1, 1]) {
    for (let y = -height / 2 + 0.03; y < height / 2 - 0.03; y += step * (0.8 + rnd() * 0.5)) {
      const len = 0.05 + rnd() * 0.07 + (rnd() < 0.15 ? 0.05 : 0);
      const seed = rnd();
      const base = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        for (const across of [-1, 1]) {
          pos.push(0, 0, 0);
          aRoot.push(side * width * 0.5 - side * 0.006, y);
          aT.push(i / seg);
          aSide.push(side);
          aAcross.push(across);
          aLen.push(len);
          aSeed.push(seed);
        }
      }
      for (let i = 0; i < seg; i++) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(aRoot, 2));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  g.setAttribute('aAcross', new THREE.Float32BufferAttribute(aAcross, 1));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(aLen, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1));
  g.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.almagre, roughness: 0.85, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime; uniform float uEm;
        attribute vec2 aRoot; attribute float aT; attribute float aSide; attribute float aAcross; attribute float aLen; attribute float aSeed;
        varying float vT;
        ${WAVE_GLSL}`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 0.0, 1.0);')
      .replace(
        '#include <begin_vertex>',
        `float t = aT;
        float sway = sin(uWindTime * 2.6 + aSeed * 23.0 + t * 2.5) * 0.35 + sin(uWindTime * 1.4 + aSeed * 9.0) * 0.25;
        vec3 transformed = vec3(aRoot, 0.0);
        transformed.x += aSide * aLen * t * 0.92;
        transformed.y -= aLen * t * t * 0.45 - sway * 0.012 * t;
        transformed.z += fabricWave(aRoot / uEm, uWindTime) * uEm + sway * 0.03 * t;
        transformed.y += aAcross * 0.0022 * (1.0 - 0.6 * t);
        vT = t;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vT;\n${RAKE_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.85, 1.12, vT);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rakeLight(normal, diffuseColor.rgb, 8.0, 0.0);');
  };
  mat.customProgramCacheKey = () => 'linen-fringe';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}
