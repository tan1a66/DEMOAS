import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { MATCH_CUT } from '../story/matchcut.js';

// Uniforms compartidos por TODOS los materiales (mismo objeto = se actualizan a la vez).
const W = CONFIG.wave;
const C = CONFIG.caustics;

const col = (hex) => new THREE.Color(hex);

export const MAX_RIPPLES = 4;

export const U = {
  uTime: { value: 0 },

  // Ola
  uWavePeriod: { value: W.period },
  uWaveA: { value: new THREE.Vector4(W.start, W.reach, W.rushEnd, W.holdEnd) },
  uWaveB: { value: new THREE.Vector4(W.recedeEnd, W.dryTime, W.edgeAmp, 0) },

  // Cáusticas
  uCaustics: { value: null },
  uCausticScale: { value: C.scale },
  uCausticIntensity: { value: C.intensity },
  uCausticWater: { value: C.underwater },
  uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },

  // Luz y cielo (sol alto, ligeramente hacia el mar y a la izquierda)
  uSunDir: { value: new THREE.Vector3(-0.38, 0.84, -0.39).normalize() },
  uSunColor: { value: col('#FFF8EE') },
  uSkyZenith: { value: col(MATCH_CUT.sky.zenith) },
  uSkyHorizon: { value: col(MATCH_CUT.sky.horizon) },

  // Paleta
  uCalce: { value: col(PALETTE.calce) },
  uSand: { value: col(PALETTE.sand) },
  uWater: { value: col(PALETTE.water) },
  uPink: { value: col(PALETTE.pink) },

  // Huella de la concha sobre la arena (para sombra, espuma alrededor y humedad)
  uShellFoot: { value: new THREE.Vector4(0, 0, 0.42, 1.0) }, // x, z, radio, altura
  // 1 = render "plano" (se usa para generar el segmento de reemplazo de la foto)
  uFlat: { value: 0 },
};

export const setSkyColors = (zenith, horizon) => {
  U.uSkyZenith.value.set(zenith);
  U.uSkyHorizon.value.set(horizon);
};
