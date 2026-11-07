/**
 * Interruttori tecnici del sito. I dati dello studio (telefono, orari, P.IVA…) sono in src/data/sito.ts.
 */
export const config = {
  /**
   * Modello anatomico 3D (generato con `npm run modello`, vedi README → "Il modello 3D").
   * Si può sostituire con un .glb fatto in Blender che rispetti gli stessi nomi dei nodi.
   */
  modelloPelviGlb: '/models/pelvi.glb' as string | null,

  /**
   * Solo se il .glb è compresso con Draco: cartella in public/ con i decoder
   * (copiati da node_modules/three/examples/jsm/libs/draco/gltf/). Meshopt non richiede file extra.
   */
  dracoDecoderPath: '/draco/',

  /** Limite del devicePixelRatio per i canvas 3D (desktop / mobile). */
  dprMax: { desktop: 2, mobile: 1.5 },
} as const;
