// =============================================================================
//  model-source.inline.js — modelli dentro all'HTML (anteprima con doppio clic)
// =============================================================================
//  I GLB compressi meshopt vengono incorporati nella pagina come data URL.
//  Generati da `node scripts/inline-models.mjs` (lo fa `npm run build:anteprima`).

import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import desktop from './inline/venus-desktop.meshopt.glb?url';
import mobile from './inline/venus-mobile.meshopt.glb?url';

export function modelUrl(quality, lowQuality) {
  return lowQuality ? mobile : desktop;
}

export function setupDecoder(loader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
  return () => {};
}
