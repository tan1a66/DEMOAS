// ─────────────────────────────────────────────────────────────────────────────
//  Configurazione centrale: qualità per dispositivo, palette, link, tempi.
//  Tutto ciò che si vuole ritoccare senza toccare la scena sta qui.
// ─────────────────────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);

// Schermi piccoli o dispositivi deboli → qualità ridotta (stesso effetto, meno geometria)
const small = matchMedia('(max-width: 820px)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const weak = (navigator.hardwareConcurrency || 8) <= 4;
export const IS_MOBILE = params.has('mobile') || small || (touch && weak);

export const QUALITY = IS_MOBILE
  ? {
      pixelRatio: Math.min(devicePixelRatio, 1.75),
      multisampling: 2,
      shadowMapSize: 1024,
      agaveLeaves: 30, // foglie della pianta principale
      leafSegments: [22, 4], // lungo la foglia, attraverso la foglia
      threadSegments: 2600, // segmenti del tubo lungo tutto il filo
      threadRadial: 6, // lati del tubo
      fuzz: 500, // fibre sfilacciate attorno al filo
      dust: 450, // particelle di polvere nella luce
      bloom: true,
    }
  : {
      pixelRatio: Math.min(devicePixelRatio, 2),
      multisampling: 4,
      shadowMapSize: 2048,
      agaveLeaves: 42,
      leafSegments: [40, 6],
      threadSegments: 6400,
      threadRadial: 10,
      fuzz: 1500,
      dust: 1400,
      bloom: true,
    };

// Palette: dalle foto dell'hacienda (rojo almagre, cal, cantera) + henequén
export const PALETTE = {
  night: '#160c08', // fondo: notte calda
  almagre: '#a8402f', // il rosso delle facciate
  cal: '#f1eadf', // bianco calce di cornici e archi
  cantera: '#d9c9a8', // pietra calcarea
  fiber: '#e9d7a8', // fibra di henequén (crema/paglia)
  agave: '#7f9b98', // foglia: verde-grigio azzurrato
  gold: '#e8a94e', // luce del tramonto
  soil: '#8a3d26', // terra rossa dello Yucatán (kancab)
};

// Filo di henequén
export const THREAD = {
  radius: 0.016, // in em (deve coincidere con THREAD_R in scripts/build-thread.mjs)
  planeZ: 0.75, // la scritta "galleggia" davanti alla pianta (metri)
};

// Tempi dell'apertura (secondi). Totale ≈ 4,8 s
export const INTRO = {
  openPlant: 1.2, // la pianta si apre mentre sale la luce
  threadStart: 0.75, // il filo nasce dal cuore della pianta
  writeDuration: 3.0, // il filo scrive "Hacienda Teya"
  subtitleAt: 3.7, // "Desde 1683"
  ctaAt: 4.0, // "Reservar mesa"
};

// Link reali (verificati su OpenTable); quelli mancanti sono segnaposto da completare
export const LINKS = {
  reservarHacienda: 'https://www.opentable.com.mx/r/hacienda-teya-yucatan',
  reservarSantaLucia: 'https://www.opentable.com.mx/r/teya-santa-lucia-merida',
  reservarViva: '#', // TODO: link OpenTable di Teya Viva (non trovato)
};

// Debug / registrazione: ?t=2.5 ferma l'apertura a 2,5 s · ?capture espone window.__teya
export const DEBUG = {
  freezeAt: params.has('t') ? parseFloat(params.get('t')) : null,
  capture: params.has('capture'),
  noPost: params.has('nopost'),
};
