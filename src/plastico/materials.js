import {
  CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, MirroredRepeatWrapping, RepeatWrapping,
  SRGBColorSpace, TextureLoader, Vector4,
} from 'three';
import { asset } from '../asset.js';

/*
  Materiali dell'esterno notturno, ispirati al video del drone di Gatti/Piu.
  Pietra, cemento, legno del deck e terreno sono ritagli delle fotografie reali della villa
  (scripts/textures.py → public/textures/). Le UV delle geometrie sono in metri.

  Luci del giardino: decine di punti luce (faretti a terra, segnapasso del deck, luci incassate
  in copertura, LED sotto gli sbalzi, interni accesi) sono calcolati in un unico ciclo nello shader
  dei materiali che li ricevono (MAX_LAMPS). Niente ombre, molto più leggero di altrettante
  PointLight su mobile.
*/

export const MAX_LAMPS = 48;

export function createLampUniforms() {
  return {
    uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new Vector4(0, -999, 0, 0.001)) },
    uLampCol: { value: Array.from({ length: MAX_LAMPS }, () => new Vector4(0, 0, 0, 1)) },
    uLampCount: { value: 0 },
  };
}

/** Aggiunge le luci del giardino a un MeshStandardMaterial. */
function receiveLamps(material, lamps) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lamps);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLampPos;\nvarying vec3 vLampNormal;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vLampPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vLampNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        #define MAX_LAMPS ${MAX_LAMPS}
        uniform vec4 uLampPos[MAX_LAMPS];
        uniform vec4 uLampCol[MAX_LAMPS];
        uniform int uLampCount;
        varying vec3 vLampPos;
        varying vec3 vLampNormal;
        vec3 lampLight(vec3 p, vec3 n) {
          vec3 acc = vec3(0.0);
          for (int i = 0; i < MAX_LAMPS; i++) {
            if (i >= uLampCount) break;
            vec3 d = uLampPos[i].xyz - p;
            vec3 ds = vec3(d.x, d.y / uLampCol[i].w, d.z); // allungamento verticale (faretti che lavano il muro)
            float r = uLampPos[i].w;
            float k = clamp(1.0 - length(ds) / r, 0.0, 1.0);
            float ndl = max(dot(n, normalize(d)), 0.0);
            acc += uLampCol[i].rgb * k * k * (0.25 + 0.75 * ndl);
          }
          return acc;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse += diffuseColor.rgb * lampLight(vLampPos, normalize(vLampNormal));`);
  };
  material.customProgramCacheKey = () => 'lamps';
  return material;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Interni accesi visti dal vetro: luce calda, più forte vicino al soffitto (strisce LED). */
function interiorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#ffd9a6');
  g.addColorStop(0.08, '#f2b878');
  g.addColorStop(0.55, '#9a6a44');
  g.addColorStop(1, '#5e4030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  // ombre morbide di arredi e pareti interne
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(30,18,10,${0.15 + r() * 0.25})`;
    const x = r() * 256;
    const w = 6 + r() * 40;
    const y = 60 + r() * 50;
    ctx.fillRect(x, y, w, 128 - y);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createMaterials(renderer) {
  const an = renderer.capabilities.getMaxAnisotropy();
  const loader = new TextureLoader();
  const tex = (name, metres, mirrored = false) => {
    const t = loader.load(asset(`/textures/${name}.jpg`));
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = mirrored ? MirroredRepeatWrapping : RepeatWrapping;
    t.repeat.set(1 / metres, 1 / metres);
    t.anisotropy = an;
    return t;
  };
  const lamps = createLampUniforms();
  const m = { lamps };

  // Metallo/intonaco nero opaco: sbalzi, fasce, telai (come nelle foto)
  m.anthracite = receiveLamps(new MeshStandardMaterial({ color: '#1d1d1e', roughness: 0.62, metalness: 0.25 }), lamps);
  m.solid = m.anthracite;
  m.frame = new MeshStandardMaterial({ color: '#121212', roughness: 0.45, metalness: 0.5 });
  m.railing = m.frame;
  m.door = m.frame;

  m.stone = receiveLamps(new MeshStandardMaterial({ map: tex('stone', 2.2), roughness: 0.95 }), lamps);
  m.concrete = receiveLamps(new MeshStandardMaterial({ map: tex('concrete', 3.2), roughness: 0.92 }), lamps);
  // Copertura praticabile: cemento chiaro (nel video del drone è la superficie più chiara)
  m.roof = receiveLamps(new MeshStandardMaterial({ map: tex('concrete', 4.5), color: '#d9d6d0', roughness: 0.9 }), lamps);
  m.parapet = m.roof;

  m.glass = new MeshStandardMaterial({
    color: '#0b1014', roughness: 0.03, metalness: 0.9, envMapIntensity: 1.2,
    transparent: true, opacity: 0.55, depthWrite: false,
  });

  m.wood = receiveLamps(new MeshStandardMaterial({ map: tex('deck', 1.4), roughness: 0.7 }), lamps);
  m.slats = receiveLamps(new MeshStandardMaterial({ color: '#4a3020', roughness: 0.7 }), lamps);
  m.slate = receiveLamps(new MeshStandardMaterial({ color: '#3a3b3d', roughness: 0.85 }), lamps);
  m.stepStone = m.slate;
  m.solar = new MeshStandardMaterial({ color: '#10141c', roughness: 0.3, metalness: 0.7 });
  m.furniture = receiveLamps(new MeshStandardMaterial({ color: '#8d8a85', roughness: 0.95 }), lamps);

  m.terrain = receiveLamps(new MeshStandardMaterial({ map: tex('ground', 7, true), color: '#a29a90', roughness: 1 }), lamps);
  m.mulch = receiveLamps(new MeshStandardMaterial({ map: tex('mulch', 3, true), roughness: 1 }), lamps);
  m.shrub = receiveLamps(new MeshStandardMaterial({ color: '#2c3324', roughness: 0.95 }), lamps);
  m.trunk = m.shrub;

  // Pavimenti e soffitti degli interni visti dal vetro: rovere illuminato dalle luci calde
  m.interior = new MeshBasicMaterial({ color: new Color(0.42, 0.27, 0.16) });
  m.glow = new MeshBasicMaterial({ map: interiorTexture(), color: new Color(1.15, 1.05, 1.0), side: DoubleSide, toneMapped: true });
  // LED e teste dei faretti: valori oltre 1 per il bagliore (bloom)
  m.led = new MeshBasicMaterial({ color: new Color('#ffcf94').multiplyScalar(5) });
  m.lampHead = new MeshBasicMaterial({ color: new Color('#ffd7a3').multiplyScalar(7) });

  // Acqua illuminata: turchese che si muove appena, con riflessi.
  m.water = new MeshStandardMaterial({
    color: '#0a3f4a', roughness: 0.04, metalness: 0.15, emissive: '#1fb8cc', emissiveIntensity: 0.42,
    envMapIntensity: 1.3,
  });
  m.water.userData.time = { value: 0 };
  m.water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = m.water.userData.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWorldPos;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWorldPos.xz;
          float t = uTime;
          vec2 g = vec2(
            cos(p.x * 3.1 + t * 1.1) * 0.5 + cos(p.x * 1.7 - p.y * 2.3 + t * 0.8) * 0.5,
            cos(p.y * 2.7 - t * 0.9) * 0.5 + cos(p.y * 1.3 + p.x * 2.1 + t * 0.6) * 0.5
          ) * 0.05;
          normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // più luce al centro della vasca (faro subacqueo) e leggere caustiche
          vec2 p = vWorldPos.xz;
          float c = sin(p.x * 3.7 + p.y * 1.3 + uTime * 0.7) + sin(p.y * 4.1 - p.x * 2.2 - uTime * 0.5) + sin((p.x + p.y) * 6.3 + uTime * 0.9);
          c = pow(abs(c) / 3.0, 3.0);
          // più chiara vicino ai fari subacquei (centro della vasca)
          float spot = exp(-pow(length(p - vec2(-6.6, 5.0)) / 3.2, 2.0));
          totalEmissiveRadiance *= (0.55 + 0.6 * spot) * (0.9 + 0.5 * c);
        }`);
  };

  return m;
}
