/**
 * Interruttori tecnici del sito. I dati dello studio (telefono, orari, P.IVA…) sono in src/data/sito.ts.
 */
export const config = {
  /**
   * Forma 3D dell'hero anche su smartphone e schermi touch.
   * Di default è spenta: su mobile si vede la stessa forma in versione statica (SVG),
   * così Three.js non pesa sul primo caricamento e Lighthouse mobile resta alto.
   */
  hero3dSuMobile: false,

  /**
   * Modello 3D del pavimento pelvico da file .glb (vedi README → "Sostituire il modello 3D").
   * null = si usa il modello procedurale costruito in codice (src/three/pelvi/procedurale.ts).
   * Esempio: '/models/pelvi.glb' (file in public/models/pelvi.glb).
   */
  modelloPelviGlb: null as string | null,

  /**
   * Solo se il .glb è compresso con Draco: cartella in public/ con i decoder
   * (copiati da node_modules/three/examples/jsm/libs/draco/gltf/). Meshopt non richiede file extra.
   */
  dracoDecoderPath: '/draco/',

  /** Limite del devicePixelRatio per i canvas 3D (desktop / mobile). */
  dprMax: { desktop: 2, mobile: 1.5 },
} as const;
