// =============================================================================
//  materials.js — il marmo della statua e la pietra del tempio
// =============================================================================
//  Materiali standard di three.js (luci, ombre, riflessi) con pezzi di shader
//  aggiunti in onBeforeCompile.
//  - Statua: marmo procedurale in coordinate del modello (venature grigie e
//    oro), occlusione ambientale per vertice, levigatura (opaca all'alba,
//    lucida con la luce), bagliore dorato delle zone, controluce caldo.
//  - Tempio: stessa famiglia di marmo in coordinate del mondo (pavimento
//    lucido, colonne, piedistallo) e stucco caldo per i muri.
//  Toni: ogni materiale applica da solo il tone mapping "Neutral"
//  (bianchi fedeli, luci forti compresse morbide).

import * as THREE from 'three';
import { NOISE, MARBLE } from './glsl.js';

const lin = (hex) => new THREE.Color(hex); // gli hex sRGB diventano lineari

// Uniform condivise da tutti i marmi
export const marbleUniforms = {
  uMarbleA: { value: lin('#f6f4f0') },
  uMarbleB: { value: lin('#e8e3da') },
  uVeinGrey: { value: lin('#8c8781') },
  uVeinGold: { value: lin('#c49a5c') },
  uVeinScale: { value: 1.6 },
  uTime: { value: 0 },
  uExposure: { value: 1 },
};

// Uniform della statua: levigatura e zone illuminate (fino a 4)
export const figureUniforms = {
  uPolish: { value: 0 }, // 0 = marmo opaco e gessoso, 1 = levigato e lucido
  uZones: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uZoneAmt: { value: new THREE.Vector4(0, 0, 0, 0) },
  uGold: { value: lin('#f0d4a2') },
  uSSS: { value: lin('#ffd9b8').multiplyScalar(0.11) },
};

// Tone mapping "Neutral" (Khronos PBR Neutral)
export const NEUTRAL = /* glsl */ `
uniform float uExposure;
vec3 neutralToneMap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  color *= uExposure;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
`;

/** Aggiunge il tone mapping Neutral a uno shader standard di three. */
export function addToneMapping(shader) {
  shader.uniforms.uExposure = marbleUniforms.uExposure;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + NEUTRAL)
    .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = neutralToneMap(gl_FragColor.rgb);');
}

// ---------------------------------------------------------------------------
//  La statua
// ---------------------------------------------------------------------------
export function createFigureMaterial({ physical = false, lowQuality = false }) {
  const Mat = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const params = { color: 0xffffff, roughness: 0.8, metalness: 0, dithering: true };
  if (physical) {
    Object.assign(params, {
      sheen: 1,
      sheenColor: new THREE.Color('#fff1e2'),
      sheenRoughness: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    });
  }
  const mat = new Mat(params);
  mat.toneMapped = false;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, marbleUniforms, figureUniforms);
    if (lowQuality) shader.defines = { ...(shader.defines || {}), LOW_QUALITY: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nattribute float _ao;\nvarying float vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvAO = _ao;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj;
        varying float vAO;
        uniform float uTime;
        ${NEUTRAL}${NOISE}${MARBLE}
        uniform float uPolish;
        uniform vec4 uZones[4];
        uniform vec4 uZoneAmt;
        uniform vec3 uGold;
        uniform vec3 uSSS;
        float zoneGlow(vec3 p) {
          float g = 0.0;
          float pulse = 0.78 + 0.22 * sin(uTime * 2.4);
          float ripple = fract(uTime * 0.42);
          for (int i = 0; i < 4; i++) {
            float amt = uZoneAmt[i];
            if (amt <= 0.001) continue;
            float r = uZones[i].w;
            float d = distance(p, uZones[i].xyz);
            float core = 1.0 - smoothstep(0.0, r, d);
            core *= core;
            float ring = exp(-pow((d - r * ripple) / (r * 0.08), 2.0)) * (1.0 - ripple) * (1.0 - smoothstep(r * 0.5, r, d));
            g = max(g, amt * (core * pulse + ring * 0.55));
          }
          return g;
        }`
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // la levigatura avanza a chiazze, non tutta insieme
        float polishL = clamp(uPolish * 1.45 - (snoise(vObj * 1.3 + 5.0) * 0.5 + 0.5) * 0.45, 0.0, 1.0);
        float goldVein;
        vec3 marble = marbleColor(vObj * 0.9, goldVein);
        marble = mix(uMarbleA, marble, 0.65); // venature più leggere sulla statua
        // opaco: più gessoso e chiaro; levigato: più caldo e profondo
        marble = mix(marble * 1.02 + vec3(0.018, 0.016, 0.014), marble, polishL);
        // occlusione: pieghe e incavi più scuri
        float ao = mix(1.0, vAO, 0.75);
        diffuseColor.rgb = marble * mix(0.82, 1.0, ao);
        float glow = zoneGlow(vObj);
        diffuseColor.rgb = mix(diffuseColor.rgb, uGold, glow * 0.22);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.78, 0.28, polishL) - goldVein * 0.12;`
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          // grana leggera del marmo non ancora levigato
          float footprint = length(fwidth(vObj)) * 70.0;
          float strength = 0.0011 * (1.0 - polishL) * (1.0 - smoothstep(0.08, 0.35, footprint));
          if (strength > 0.00001) normal = bumpNormal(-vViewPosition, normal, chiselHeight(vObj, 70.0), strength);
        }`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= ao;
        reflectedLight.indirectSpecular *= mix(1.0, ao, 0.8);
        reflectedLight.directDiffuse *= mix(1.0, ao, 0.3);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGold * glow * (0.34 + 0.7 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 1.5));'
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        // controluce caldo sui bordi: la luce che entra nel marmo
        float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);
        outgoingLight += uSSS * rim * (0.35 + 0.65 * polishL) * ao;
        #include <opaque_fragment>`
      )
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = neutralToneMap(gl_FragColor.rgb);');
    if (physical) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.sheenColor *= 0.15 + 0.5 * polishL;
        material.clearcoat *= 0.45 * smoothstep(0.35, 1.0, polishL);`
      );
    }
  };
  mat.customProgramCacheKey = () => `figure-${lowQuality ? 'lq' : 'hq'}-${physical ? 'phys' : 'std'}`;
  return mat;
}

// Pavimento: grandi lastre di marmo (con fughe sottili, ognuna di un tono
// appena diverso) e una cornice di marmo grigio (bardiglio) attorno alla vasca
const INLAY = /* glsl */ `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
vec3 floorInlay(vec3 base, vec3 wp) {
  if (wp.y < -0.02) return base; // solo la superficie del pavimento
  vec2 q = abs(wp.xz) - vec2(3.2, 3.6);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); // distanza dal bordo della vasca
  float aa = fwidth(d) * 1.5;
  vec3 col = base;
  // lastre 1.2 × 0.8 m a giunti sfalsati
  vec2 g = wp.xz / vec2(1.2, 0.8);
  g.x += 0.5 * mod(floor(g.y), 2.0);
  vec2 cell = floor(g), f = fract(g);
  col *= 0.965 + 0.06 * hash21(cell);
  float e = min(min(f.x, 1.0 - f.x) * 1.2, min(f.y, 1.0 - f.y) * 0.8);
  col *= mix(0.9, 1.0, smoothstep(0.0, 0.012 + fwidth(e), e));
  // cornice grigia attorno alla vasca
  float band = smoothstep(0.32 - aa, 0.32 + aa, d) * (1.0 - smoothstep(0.62 - aa, 0.62 + aa, d));
  vec3 bardiglio = vec3(0.56, 0.58, 0.6) * (0.9 + 0.2 * snoise(wp * 1.7));
  col = mix(col, bardiglio, band * 0.85);
  return col;
}
`;

// ---------------------------------------------------------------------------
//  La pietra del tempio (coordinate del mondo, anche per InstancedMesh)
//  tone: colore di base; veins: quanto si vedono le venature (0..1);
//  polished: pavimento lucido; stucco: muri intonacati, grana morbida
// ---------------------------------------------------------------------------
let stoneCount = 0;
export function createStoneMaterial({ tone = '#f1ebe2', roughness = 0.6, veins = 0.6, polished = false, stucco = false, inlay = false, lowQuality = false }) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(tone), roughness, metalness: 0, dithering: true });
  mat.toneMapped = false;
  const id = stoneCount++;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, marbleUniforms);
    if (lowQuality) shader.defines = { ...(shader.defines || {}), LOW_QUALITY: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWorldPos = (modelMatrix * wp).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;\nuniform float uTime;\n${NEUTRAL}${NOISE}${MARBLE}${inlay ? INLAY : ''}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float goldVein;
        vec3 m = marbleColor(vWorldPos * ${polished ? '0.32' : '0.6'}, goldVein);
        vec3 base = diffuseColor.rgb;
        diffuseColor.rgb = mix(base, base * (m / uMarbleA), ${veins.toFixed(2)});
        ${stucco ? 'diffuseColor.rgb *= 0.97 + 0.05 * snoise(vWorldPos * 1.7) + 0.02 * snoise(vWorldPos * 9.0);' : ''}
        ${inlay ? 'diffuseColor.rgb = floorInlay(diffuseColor.rgb, vWorldPos);' : ''}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        stucco
          ? /* glsl */ `#include <normal_fragment_maps>
          {
            float footprint = length(fwidth(vWorldPos)) * 9.0;
            float s = 0.004 * (1.0 - smoothstep(0.1, 0.5, footprint));
            if (s > 0.0) normal = bumpNormal(-vViewPosition, normal, snoise(vWorldPos * 9.0) * 0.6 + snoise(vWorldPos * 23.0) * 0.4, s);
          }`
          : '#include <normal_fragment_maps>'
      )
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = neutralToneMap(gl_FragColor.rgb);');
  };
  mat.customProgramCacheKey = () => `stone-${id}-${lowQuality}`;
  return mat;
}
