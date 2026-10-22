// Configurazione generale. I campi vuoti vanno compilati con i dati confermati
// dall'Avvocato; finché sono vuoti non compaiono (vedi `mostraSegnaposto`).

export const CONFIG = {
  // false = i dati mancanti semplicemente non compaiono (per le presentazioni);
  // true = compaiono come "da inserire" (per controllare cosa manca).
  mostraSegnaposto: false,

  contatti: {
    whatsapp: '', // numero per le prenotazioni, con prefisso: es. '+39 333 123 4567'
    email: '', // es. 'studio@dominio.it'
    telefono: '', // es. '+39 070 000 0000'
    pec: '',
    partitaIva: '',
  },

  // Sedi: la foto si carica da sola se esiste src/assets/sedi/<id>.jpg
  sedi: [
    {
      id: 'maracalagonis',
      nome: 'Maracalagonis',
      indirizzo: 'Via Garibaldi n. 16 – 09069 Maracalagonis (CA)',
      mappa: 'https://www.google.com/maps/search/?api=1&query=Via+Garibaldi+16+09069+Maracalagonis',
    },
    {
      id: 'sede-2',
      nome: 'Roberto Pusceddu & Partners',
      indirizzo: '', // da inserire
      mappa: '',
    },
  ],

  // Link "Scopri di più" delle pubblicazioni (vuoto = link da inserire).
  pubblicazioni: {
    'diritto-musica': '',
    costituzione: '',
    'avvocato-comunita': '',
  },

  // Qualità: si abbassa da sola su mobile / schermi touch.
  quality: {
    desktop: { maxPixelRatio: 1.75, shadowMap: 2048, softShadows: true, marbleOctaves: 5 },
    mobile: { maxPixelRatio: 1.5, shadowMap: 1024, softShadows: true, marbleOctaves: 4 },
  },
};

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);

export const QUALITY = IS_MOBILE ? CONFIG.quality.mobile : CONFIG.quality.desktop;

export const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rosso pompeiano scelto con il cliente.
export const COLORS = {
  red: 0x9e1b22,
  redDeep: 0x6e1218,
  cream: 0xf2ebdd,
};
