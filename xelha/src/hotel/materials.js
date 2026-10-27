import * as THREE from 'three';
import { vegetationMaterial } from './foliage.js';

// Plano de corte de sección: todo lo que queda por encima de `constant` se recorta.
// Lejos del edificio no recorta nada.
export const CUT_OFF = 500;
export const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_OFF);
const CUT_Y = { value: CUT_OFF };
export const setCutY = (y) => (cutPlane.constant = CUT_Y.value = y);

// Color de las caras traseras al cortar (muros "rellenos", como en un plano de arquitectura).
export const CAP_COLOR = new THREE.Color(0xc9a160);

// Material sólido del edificio: recortable. Solo el piso que se corta pasa a doble cara
// (setCaps) y pinta de dorado las caras traseras cercanas al corte; el resto se descarta.
function solid({ grain, marble, ...params }) {
  const mat = new THREE.MeshStandardMaterial({
    clippingPlanes: [cutPlane],
    clipShadows: true,
    shadowSide: THREE.BackSide,
    ...params,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCap = { value: CAP_COLOR };
    shader.uniforms.uCut = CUT_Y;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uCap;
        uniform float uCut;
        varying vec3 vWP;
        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        float vn3(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Variación sutil del material (manchas de estuco, vetas de madera) para evitar colores planos.
        #if defined(MARBLE)
          float vein = abs(sin(vWP.x * 2.1 + vWP.z * 1.3 + vWP.y * 0.7 + vn3(vWP * 1.7) * 6.5));
          diffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.0, 0.1, vein)) * (0.97 + vn3(vWP * 9.0) * 0.05);
        #elif defined(GRAIN)
          float gr = vn3(vWP * vec3(14.0, 0.7, 14.0)) * 0.6 + vn3(vWP * vec3(40.0, 2.0, 40.0)) * 0.4;
          diffuseColor.rgb *= 0.82 + gr * 0.32;
        #else
          float mt = vn3(vWP * 0.9) * 0.6 + vn3(vWP * 5.0) * 0.4;
          diffuseColor.rgb *= 0.95 + mt * 0.09;
        #endif`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        #ifdef DOUBLE_SIDED
          if (!gl_FrontFacing) {
            if (vWP.y < uCut - 1.6) discard;
            gl_FragColor = vec4(uCap, 1.0);
          }
        #endif`
      );
  };
  if (grain) mat.defines = { GRAIN: '' };
  if (marble) mat.defines = { MARBLE: '' };
  const key = `solid-cap${grain ? '-grain' : ''}${marble ? '-marble' : ''}`;
  mat.customProgramCacheKey = () => key;
  mat.userData.base = mat.color.clone();
  mat.userData.solid = true;
  return mat;
}

export function setCaps(mats, on) {
  for (const m of Object.values(mats)) {
    if (!m.userData.solid) continue;
    const side = on ? THREE.DoubleSide : THREE.FrontSide;
    if (m.side !== side) {
      m.side = side;
      m.needsUpdate = true;
    }
  }
}

// Cuadro abstracto (paleta de tierra y ocre) para las paredes de los departamentos.
let art = null;
function artTexture() {
  if (art) return art;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dfcf';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#b8643c';
  g.beginPath();
  g.moveTo(40, 230);
  g.lineTo(40, 120);
  g.arc(110, 120, 70, Math.PI, 0);
  g.lineTo(180, 230);
  g.fill();
  g.fillStyle = '#d6a64f';
  g.beginPath();
  g.arc(180, 80, 38, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2f5d50';
  g.fillRect(150, 150, 70, 80);
  g.strokeStyle = '#3a2d22';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(20, 200);
  g.bezierCurveTo(90, 150, 160, 240, 236, 170);
  g.stroke();
  g.strokeStyle = '#1f1a16';
  g.lineWidth = 14;
  g.strokeRect(0, 0, 256, 256);
  art = new THREE.CanvasTexture(c);
  art.colorSpace = THREE.SRGBColorSpace;
  return art;
}

// Juego de materiales de un piso (cada piso tiene los suyos para poder resaltarlo o atenuarlo).
export function floorMaterials(envMap) {
  return {
    stucco: solid({ color: 0xf1e7da, roughness: 0.88 }),
    stone: solid({ color: 0xd9c6a8, roughness: 0.95 }),
    wood: solid({ color: 0x8f6040, roughness: 0.7, grain: true }),
    woodLight: solid({ color: 0xc49a6c, roughness: 0.62, grain: true }),
    interior: solid({ color: 0xf6f1ea, roughness: 0.9 }),
    fabric: solid({ color: 0xf1ece3, roughness: 1 }),
    accent: solid({ color: 0x2f6b5c, roughness: 0.9 }),
    velvet: solid({ color: 0x2b5a4e, roughness: 0.75 }),
    leather: solid({ color: 0x8c5130, roughness: 0.55 }),
    throw: solid({ color: 0xb48d62, roughness: 1 }),
    rug: solid({ color: 0xcdbfa7, roughness: 1, grain: true }),
    marble: solid({ color: 0xf0ede7, roughness: 0.18, marble: true }),
    brass: solid({ color: 0xd2ad6c, roughness: 0.28, metalness: 1 }),
    mirror: solid({ color: 0xe3e8ea, roughness: 0.04, metalness: 1 }),
    porcelain: solid({ color: 0xfbfaf7, roughness: 0.12 }),
    art: solid({ color: 0xffffff, roughness: 0.9, map: artTexture() }),
    terracotta: solid({ color: 0xc9774f, roughness: 0.9 }),
    dark: solid({ color: 0x2a2724, roughness: 0.5, metalness: 0.3 }),
    green: solid({ vertexColors: true, roughness: 0.85, color: 0xffffff }),
    leaf: Object.assign(vegetationMaterial({ clippingPlanes: [cutPlane] }), { userData: { base: new THREE.Color(0xffffff), noAO: true } }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x24413f,
      roughness: 0.05,
      metalness: 0.85,
      envMap,
      envMapIntensity: 1.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      clippingPlanes: [cutPlane],
    }),
    rail: new THREE.MeshStandardMaterial({
      color: 0xcfe3e0,
      roughness: 0.1,
      metalness: 0.2,
      envMap,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
      clippingPlanes: [cutPlane],
    }),
    // Luz de ventanas por la noche: aditiva, por unidad (color de vértice).
    light: new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      clippingPlanes: [cutPlane],
      toneMapped: false,
    }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd9a0, clippingPlanes: [cutPlane] }),
  };
}

// Atenúa (0..1) los colores de un juego de materiales: los pisos no elegidos pasan a segundo plano.
export function setDim(mats, k) {
  for (const m of Object.values(mats)) {
    if (!m.userData.base) continue;
    m.color.copy(m.userData.base).lerp(DIM, k * 0.5);
  }
}
const DIM = new THREE.Color(0x8f9aa0);
