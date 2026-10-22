import * as THREE from 'three';
import { PALETTE } from './layout.js';

// Colori e nebbia dell'acqua, condivisi da mare, bolle, bollicine e squali.

const lin = (hex) => new THREE.Color(hex);

export const WATER = {
  deep: lin('#1C4A5A'),
  mid: lin(PALETTE.seaFar),
  shallow: lin('#9CC8D3'),
};

export const FOG_GLSL = /* glsl */ `
  uniform vec3 uDeep, uMid, uShallow;
  uniform float uCamY;
  // colore dell'acqua nella direzione d (più chiaro verso la superficie)
  vec3 waterColor(vec3 d) {
    return mix(uDeep, mix(uMid, uShallow, smoothstep(0.2, 0.9, d.y)), smoothstep(-0.7, 0.2, d.y));
  }
  // nebbia sott'acqua; se la telecamera è sopra il pelo dell'acqua, gli oggetti si vedono appena
  float waterFog(float dist, float depth) {
    float f = exp(-dist * 0.055);
    if (uCamY > 0.0) f *= exp(-max(depth, 0.0) * 0.9) * 0.6;
    return f;
  }
`;

