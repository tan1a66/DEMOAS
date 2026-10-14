import * as THREE from 'three';

/**
 * Luz aditiva sobre un canvas transparente: suma color pero NO toca el alfa del destino. Con el
 * AdditiveBlending normal el alfa sube a 1 y el haz tapa el fondo de la página (se ve oscuro).
 */
export const LUZ_ADITIVA = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;
