// =============================================================================
//  config.js — impostazioni generali del sito
// =============================================================================
//  Il percorso del drone e le atmosfere (luce, cielo, nebbia, tende) sono in
//  drone-path.js, i testi in i18n.js.

// Numero WhatsApp del dottore: solo cifre, con prefisso internazionale
// (Messico = 52), es. '5219991234567'. Vuoto = WhatsApp si apre senza destinatario.
export const WHATSAPP_NUMBER = '';

// Palette (anche in styles.css come variabili CSS)
export const COLORS = {
  ivory: '#F3EEE6', // sfondo
  taupe: '#C9BCA9',
  ink: '#2B2722', // testi
  gold: '#B8915A', // accento
};

// ----------------------------------------------------------------------------
//  Qualità per dispositivo. ?quality=mobile o ?quality=desktop per forzarla.
// ----------------------------------------------------------------------------
export const QUALITY = {
  desktop: {
    model: '/models/venus-desktop.glb', // ~300k triangoli
    motes: 420, // polvere sospesa nella luce
    maxPixelRatio: 1.5,
    shadowMap: 2048, // ombre del sole (archi, colonne)
    goboShadow: 1024, // ombre delle foglie e della statua su sé stessa
    reflection: 0.5, // risoluzione del riflesso nell'acqua (frazione dello schermo)
    dof: true, // profondità di campo nei primi piani
    physical: true, // MeshPhysicalMaterial (sheen, clearcoat) per la statua
  },
  mobile: {
    model: '/models/venus-mobile.glb', // ~120k triangoli
    motes: 200,
    maxPixelRatio: 1.5,
    shadowMap: 1024,
    goboShadow: 512,
    reflection: 0.3,
    dof: true, // si spegne da sola se gli fps scendono
    physical: false,
  },
};

// Qualità adattiva: sotto questi fps per ~2 s si scende di un gradino
// (prima via la profondità di campo, poi risoluzione più bassa).
export const ADAPTIVE = { minFps: 48, sampleSeconds: 2, minPixelRatio: 1 };

// ----------------------------------------------------------------------------
//  La trasformazione: la statua è opaca all'alba e diventa marmo levigato e
//  luminoso mentre sale la luce. Punti 'capitolo:avanzamento' dello scroll
//  (capitoli: hero, valoracion, precision, doctor, procedimientos, final).
// ----------------------------------------------------------------------------
export const POLISH = { start: 'valoracion:0.3', end: 'precision:0.8' };

// La statua ruota piano durante "03 · El doctor" (gradi, andata e ritorno)
export const DOCTOR_SPIN = { degrees: 18 };

// ----------------------------------------------------------------------------
//  Zone interattive (04 · Procedimientos)
//  center: coordinate relative al bounding box del modello (0..1 su x, y, z;
//          lei guarda verso +z, il viso è girato un po' verso la sua destra)
//  radius: raggio del bagliore in frazioni dell'altezza della statua
//  cam:    inquadratura del drone sulla zona, attorno al centro della zona
//          az = gradi attorno alla statua (0 = davanti, 90 = suo fianco sinistro)
//          el = gradi di elevazione, dist = distanza (la statua è alta 2)
//          look = spostamento del punto guardato rispetto al centro [x, y, z]
//  mobile: stessi campi, solo quelli da cambiare su telefono
// ----------------------------------------------------------------------------
export const ZONES = [
  {
    id: 'faciales',
    center: [0.41, 0.902, 0.68],
    radius: 0.055,
    cam: { az: -24, el: 4, dist: 1.05, shift: [0.24, 0.02] },
    mobile: { dist: 1.45, shift: [0, 0.2] },
  },
  {
    id: 'corporales',
    center: [0.44, 0.615, 0.62],
    radius: 0.09,
    cam: { az: 30, el: 10, dist: 2.5, shift: [0.27, 0], look: [0, 0.05, 0] },
    mobile: { dist: 3.4, shift: [0, 0.2] },
  },
  {
    id: 'noquirurgicos',
    center: [0.44, 0.83, 0.62],
    radius: 0.06,
    cam: { az: -12, el: 6, dist: 1.4, shift: [0.25, 0], look: [0, 0.04, 0] },
    mobile: { dist: 1.9, shift: [0, 0.2] },
  },
  {
    id: 'reconstructivos',
    center: [0.44, 0.755, 0.66],
    radius: 0.07,
    // inquadratura volutamente ampia: elegante, mai insistente
    cam: { az: 22, el: 10, dist: 2.2, shift: [0.26, 0.02], look: [0, 0.14, 0] },
    mobile: { dist: 3.0, shift: [0, 0.2] },
  },
];

// Durata del volo verso una zona (secondi)
export const ZONE_FLIGHT = { duration: 1.9 };
