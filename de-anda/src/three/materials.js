// =============================================================================
//  materials.js — i materiali di marmo (statua, sedile, frammenti)
// =============================================================================
//  Sono i materiali standard di three.js (luci, ombre, riflessi) con pezzi di
//  shader aggiunti in onBeforeCompile: colore del marmo, scalpello, levigatura,
//  bagliore delle zone e un controluce caldo che imita la traslucenza.
//
//  Toni: tutti i materiali della scena applicano da soli il tone mapping
//  "Neutral" (toneMapped = false + chiamata esplicita). Lo sfondo invece no:
//  così l'avorio resta esattamente #F3EEE6 sia senza sia con la profondità di campo.

import * as THREE from 'three';
import { NOISE, MARBLE } from './glsl.js';

const lin = (hex) => new THREE.Color(hex); // three converte gli hex sRGB in lineare

// Uniform condivise da tutti i marmi (un solo posto per cambiarle)
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
  uPolish: { value: 0 }, // 0 = appena scolpita, 1 = levigata e lucida
  uZones: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uZoneAmt: { value: new THREE.Vector4(0, 0, 0, 0) },
  uGold: { value: lin('#e0b46e') },
  uSSS: { value: lin('#ffd9b8').multiplyScalar(0.11) },
};

// Uniform dei frammenti (vedi fragments.js)
export const chipUniforms = {
  uProgress: { value: 0 }, // avanzamento dello scolpire 0..1
  uFall: { value: 0.045 },
};

// Tone mapping "Neutral" (Khronos PBR Neutral, come NeutralToneMapping di three):
// i bianchi restano bianchi e i colori fedeli, le luci forti si comprimono morbide.
const NEUTRAL = /* glsl */ `
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
const TONEMAP = 'gl_FragColor.rgb = neutralToneMap( gl_FragColor.rgb );';

// ---------------------------------------------------------------------------
//  Trasformazione dei frammenti (vertex shader), usata anche per le ombre
// ---------------------------------------------------------------------------
const CHIP_VERTEX_PARS = /* glsl */ `
attribute vec3 aRest;     // centro del frammento nel blocco intatto
attribute vec4 aQuat;     // rotazione a riposo
attribute vec3 aScale;    // dimensioni
attribute vec4 aMotion;   // xyz = direzione di uscita, w = soglia di distacco
attribute float aSeed;
uniform float uProgress;
uniform float uFall;
uniform float uTime;
varying vec3 vObj;

vec3 rotq(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec4 qAxisAngle(vec3 axis, float a) { return vec4(axis * sin(a * 0.5), cos(a * 0.5)); }

// t = 0 al momento del distacco, 1 a fine caduta. Dipende solo dallo scroll.
float chipT() { return clamp((uProgress - aMotion.w) / uFall, 0.0, 1.0); }
vec4 chipSpin(float t) {
  vec3 axis = normalize(vec3(sin(aSeed * 12.9), cos(aSeed * 7.3), sin(aSeed * 3.1 + 1.0)));
  return qAxisAngle(axis, t * (2.2 + 4.5 * fract(aSeed * 13.7)));
}
vec3 chipPosition(vec3 p) {
  float t = chipT();
  vec3 local = rotq(aQuat, p * aScale);
  vObj = aRest + local; // il disegno del marmo resta quello del blocco intatto
  // si rimpicciolisce fino a sparire (i frammenti "eroi", seed > 1, più tardi)
  float shrinkFrom = aSeed > 1.0 ? 0.78 : 0.5;
  vec3 spun = rotq(chipSpin(t), local) * (1.0 - smoothstep(shrinkFrom, 1.0, t));
  // traiettoria: piccolo salto verso l'esterno, poi giù fino a terra
  vec3 off = aMotion.xyz * t;
  off.y += 0.14 * t - (aRest.y + 0.16) * t * t;
  // un attimo prima di staccarsi il frammento vibra appena
  float pre = smoothstep(-0.012, 0.0, uProgress - aMotion.w) * step(t, 0.0);
  off += pre * 0.004 * vec3(sin(uTime * 61.0 + aSeed * 40.0), 0.0, cos(uTime * 53.0 + aSeed * 31.0));
  return aRest + off + spun;
}
`;

function injectChipVertex(shader, withNormal) {
  shader.uniforms.uProgress = chipUniforms.uProgress;
  shader.uniforms.uFall = chipUniforms.uFall;
  shader.uniforms.uTime = marbleUniforms.uTime;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + CHIP_VERTEX_PARS)
    .replace('#include <begin_vertex>', 'vec3 transformed = chipPosition(position);');
  if (withNormal) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      'vec3 objectNormal = rotq(chipSpin(chipT()), rotq(aQuat, normalize(normal / aScale)));'
    );
  }
}

// ---------------------------------------------------------------------------
//  Materiale di marmo
//  kind: 'figure' (si leviga), 'seat' (sempre grezzo), 'chip' (frammenti)
// ---------------------------------------------------------------------------
export function createMarbleMaterial({ kind, physical = false, lowQuality = false }) {
  const isFigure = kind === 'figure';
  const Mat = physical && isFigure ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const params = { color: 0xffffff, roughness: 0.8, metalness: 0, dithering: true, flatShading: kind === 'chip' };
  if (Mat === THREE.MeshPhysicalMaterial) {
    Object.assign(params, {
      sheen: 1,
      sheenColor: new THREE.Color('#fff1e2'),
      sheenRoughness: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
    });
  }
  const mat = new Mat(params);
  mat.toneMapped = false;

  // parametri per tipo
  const P = {
    figure: { chiselScale: 34, chiselStrength: 0.0016, roughA: 0.82, roughB: 0.32, tint: 1.0 },
    seat: { chiselScale: 18, chiselStrength: 0.004, roughA: 0.93, roughB: 0.93, tint: 0.92 },
    chip: { chiselScale: 16, chiselStrength: 0.0018, roughA: 0.88, roughB: 0.88, tint: 1.0 },
  }[kind];

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, marbleUniforms);
    if (isFigure) Object.assign(shader.uniforms, figureUniforms);
    if (lowQuality) shader.defines = { ...(shader.defines || {}), LOW_QUALITY: '' };

    // --- vertex ---
    if (kind === 'chip') {
      injectChipVertex(shader, true);
    } else {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    }

    // --- fragment ---
    let pars = 'varying vec3 vObj;\nuniform float uTime;\n' + NEUTRAL + NOISE + MARBLE;
    if (isFigure) {
      pars += /* glsl */ `
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
        }`;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + pars);

    // colore del marmo + levigatura locale
    const polishExpr = isFigure
      ? 'clamp(uPolish * 1.45 - (snoise(vObj * 1.3 + 5.0) * 0.5 + 0.5) * 0.45, 0.0, 1.0)'
      : '0.0';
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
      float polishL = ${polishExpr};
      float goldVein;
      vec3 marble = marbleColor(vObj, goldVein) * ${P.tint.toFixed(3)};
      // appena scolpito il marmo è più gessoso e chiaro, levigato è più caldo
      marble = mix(marble * 1.02 + vec3(0.015, 0.014, 0.012), marble, polishL);
      diffuseColor.rgb = marble;
      ${isFigure ? 'float glow = zoneGlow(vObj); diffuseColor.rgb = mix(diffuseColor.rgb, uGold, glow * 0.32);' : ''}`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor = mix(${P.roughA.toFixed(3)}, ${P.roughB.toFixed(3)}, polishL) - goldVein * 0.15;`
    );
    // scalpello: rilievo che sparisce con la levigatura (e da lontano, per non sfarfallare)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `#include <normal_fragment_maps>
      {
        float footprint = length(fwidth(vObj)) * ${P.chiselScale.toFixed(1)};
        float strength = ${P.chiselStrength.toFixed(5)} * (1.0 - polishL * 0.97) * (1.0 - smoothstep(0.07, 0.32, footprint));
        if (strength > 0.00001) {
          float h = chiselHeight(vObj, ${P.chiselScale.toFixed(1)});
          normal = bumpNormal(-vViewPosition, normal, h, strength);
        }
      }`
    );
    if (isFigure) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGold * glow * (0.5 + 0.8 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 1.5));'
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          // controluce caldo sui bordi: dà l'idea della luce che entra nel marmo
          float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);
          outgoingLight += uSSS * rim * (0.45 + 0.55 * polishL);
          #include <opaque_fragment>`
        );
      if (Mat === THREE.MeshPhysicalMaterial) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_physical_fragment>',
          /* glsl */ `#include <lights_physical_fragment>
          material.sheenColor *= 0.15 + 0.5 * polishL;
          material.clearcoat *= 0.42 * smoothstep(0.35, 1.0, polishL);`
        );
      }
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', TONEMAP);
  };
  // chiave diversa per tipo, così three non riusa il programma sbagliato
  mat.customProgramCacheKey = () => `marble-${kind}-${lowQuality ? 'lq' : 'hq'}-${Mat.name}`;
  return mat;
}

/** Materiale per l'ombra dei frammenti: stessa caduta, così l'ombra li segue. */
export function createChipDepthMaterial() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => injectChipVertex(shader, false);
  mat.customProgramCacheKey = () => 'chip-depth';
  return mat;
}

/** Ombra a terra: solo l'ombra della luce principale, in un taupe caldo. */
export function createShadowFloorMaterial() {
  const mat = new THREE.ShadowMaterial({ color: new THREE.Color('#4a3c30'), opacity: 0.3, transparent: true });
  mat.toneMapped = false;
  return mat;
}
