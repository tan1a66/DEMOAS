// Parámetros de la demo. Unidades de la escena: metros "de modelo".
// Las medidas que se muestran al usuario se obtienen con un único factor de escala
// (MEASURE.realLength / BRAID.length), así todo es coherente entre sí.

export const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const QUALITY = IS_TOUCH
  ? { maxPixelRatio: 2, shadowMap: 1024, shadowRadius: 7, shadowSamples: 10, radial: 10 }
  : { maxPixelRatio: 2, shadowMap: 2048, shadowRadius: 9, shadowSamples: 16, radial: 12 };

// Perchas: ganchos de cedro (como los que incluye la pieza real).
export const PEGS = {
  spacing: 0.4, // distancia entre ganchos
  y: 0,
  neckRadius: 0.017, // radio del vástago donde apoya la trenza
  length: 0.13,
};

export const BRAID = {
  length: 2.8, // longitud total (modelo)
  z: 0.05, // distancia del eje de la trenza al muro
  strandRadius: 0.021,
  ovalW: 1.3, // sección ovalada de cada cabo (ancho / profundidad)
  ovalD: 0.7,
  ampLat: 0.032, // amplitud lateral del "8"
  ampDepth: 0.019, // amplitud en profundidad
  period: 0.195, // un ciclo completo del trenzado (6 cruces)
  samples: 700, // muestras a lo largo de la trenza
  taperLen: 0.11, // estrechamiento hacia las borlas
  uvRepeat: 0.05, // repetición de la textura de fibras a lo largo del cabo
};

// Media anchura de la trenza en el plano del muro y radio de apoyo sobre el gancho.
export const HALF_WIDTH = BRAID.ampLat + BRAID.strandRadius * BRAID.ovalW;
export const WRAP_RADIUS = PEGS.neckRadius + HALF_WIDTH * 0.9;

export const WAVES = {
  depthDefault: 0.17, // profundidad del punto más bajo bajo los ganchos
  depthMin: 0.035, // nunca tensa del todo
  depthMax: 0.42,
  tailMin: 0.1, // siempre queda un trozo de trenza sobre la borla
  overshoot: 0.06, // resistencia elástica más allá de los límites
};

export const TASSEL = {
  collarRadius: 0.039,
  collarHeight: 0.066,
  fibers: IS_TOUCH ? 440 : 600,
  fiberLength: 0.215,
  fiberRadius: 0.0021,
};

// Medidas reales de la pieza (ficha de producto Neutro Home: 6 m, 13 cm de grosor).
export const MEASURE = {
  realLength: 6.0,
};
export const MEASURE_SCALE = MEASURE.realLength / BRAID.length;

export const COLORS = [
  { id: 'natural', name: 'Natural', hex: '#D9C6A5' },
  { id: 'oro', name: 'Oro viejo', hex: '#A07A3C' },
  { id: 'rosa', name: 'Rosa', hex: '#C27E6E' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#6E2A2A' },
  { id: 'verde', name: 'Verde', hex: '#1F4A40' },
  { id: 'negro', name: 'Negro', hex: '#2A2522' },
];
export const DEFAULT_COLOR = 'rosa';

export const CONTACT = {
  instagram: 'https://ig.me/m/neutro_home',
  catalog: 'https://neutro.com.mx',
};

export const PALETTE = {
  earth: 0x1e1712, // fondo de la entrada
};
