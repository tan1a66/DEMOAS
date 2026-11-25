// =============================================================================
//  model-source.js — da dove arriva il modello (sito pubblicato)
// =============================================================================
//  Sito normale: GLB compressi con Draco in public/models, decoder in public/draco.
//  L'anteprima in un solo file HTML usa invece model-source.inline.js
//  (sostituito da vite.preview.config.js).

import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function modelUrl(quality, lowQuality) {
  return quality.model;
}

/** Prepara il GLTFLoader per la compressione usata; restituisce una funzione di pulizia. */
export function setupDecoder(loader) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);
  return () => draco.dispose();
}
