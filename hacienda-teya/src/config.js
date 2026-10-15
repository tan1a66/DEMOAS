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
      threadRadial: 5, // lati del tubo del filo libero
      stitchRadial: 5, // lati del tubo di ogni punto ricamato
      fabricSegments: [90, 30], // suddivisioni del lino (onde del vento)
      dust: 450, // particelle di polvere nella luce
      bloom: true,
      // mondo (fase 3)
      ao: false, // SSAO (N8AO) disattivato su mobile
      fieldRows: 6, // file di henequén per lato
      fieldZMax: 14,
      fieldLeaves: 10,
      fieldLeafSegments: [5, 1],
      treeCount: 6,
      treeCards: 160,
      nightLights: 4, // PointLight accese la sera
      worldShadowSize: 1024,
    }
  : {
      pixelRatio: Math.min(devicePixelRatio, 2),
      multisampling: 4,
      shadowMapSize: 2048,
      agaveLeaves: 42,
      leafSegments: [40, 6],
      threadRadial: 8,
      stitchRadial: 7,
      fabricSegments: [180, 60],
      dust: 1400,
      bloom: true,
      ao: true,
      fieldRows: 12,
      fieldZMax: 16,
      fieldLeaves: 16,
      fieldLeafSegments: [7, 2],
      treeCount: 10,
      treeCards: 380,
      nightLights: 7,
      worldShadowSize: 2048,
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
  soil: '#7e3923', // terra rossa dello Yucatán (kancab)
};

// Filo di henequén e fascia di lino
export const THREAD = {
  radius: 0.019, // in em
  planeZ: 0.75, // il lino sta davanti alla pianta (metri)
  threadsPerStitch: 8, // fili della trama coperti da un punto: dà la scala del lino
};

// Tempi dell'apertura (secondi). Totale ≈ 5 s
export const INTRO = {
  openPlant: 1.2, // la pianta si apre mentre sale la luce
  needleLift: 0.85, // la spina si stacca dal cogollo e tira fuori la fibra
  needleArrive: 1.5, // la spina arriva al lino e fa il primo foro
  stitchEnd: 4.05, // ultimo punto del nome
  subtitleAt: 3.95, // "Desde 1683"
  ctaAt: 4.25, // "Reservar mesa"
};

// Link reali (verificati su OpenTable); quelli mancanti sono segnaposto da completare
export const LINKS = {
  reservarHacienda: 'https://www.opentable.com.mx/r/hacienda-teya-yucatan',
  reservarSantaLucia: 'https://www.opentable.com.mx/r/teya-santa-lucia-merida',
  reservarViva: '#', // TODO: link OpenTable di Teya Viva (non trovato)
  menu: '#', // TODO: link al menù
};

// WhatsApp per sede: numeri da confermare col cliente (null = pulsante segnaposto)
export const WHATSAPP = {
  hacienda: null, // es. '529990000000'
  viva: null,
  santaLucia: null,
  eventos: null, // "Cotizar mi evento"
};

export const INSTAGRAM = {
  hacienda: 'https://www.instagram.com/haciendateya/',
  viva: 'https://www.instagram.com/teyaviva/',
  santaLucia: 'https://www.instagram.com/teyasantalucia/',
};

// Debug / registrazione: ?t=2.5 ferma l'apertura a 2,5 s · ?capture espone window.__teya
export const DEBUG = {
  freezeAt: params.has('t') ? parseFloat(params.get('t')) : null,
  capture: params.has('capture'),
  noPost: params.has('nopost'),
};
