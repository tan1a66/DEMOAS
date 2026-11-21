// =============================================================================
//  config.js — impostazioni generali del sito
// =============================================================================
//  Il percorso del drone e le luci sono in drone-path.js, i testi in i18n.js.

// Numero WhatsApp del dottore: solo cifre, con prefisso internazionale
// (Messico = 52), es. '5219991234567'. Vuoto = WhatsApp si apre senza destinatario.
export const WHATSAPP_NUMBER = '';

// Palette (anche in styles.css come variabili CSS)
export const COLORS = {
  ivory: '#F3EEE6', // sfondo
  taupe: '#C9BCA9', // sfumatura dietro la statua
  ink: '#2B2722', // testi
  gold: '#B8915A', // accento
};

// ----------------------------------------------------------------------------
//  Qualità per dispositivo. ?quality=mobile o ?quality=desktop per forzarla.
// ----------------------------------------------------------------------------
export const QUALITY = {
  desktop: {
    model: '/models/statue-desktop.glb', // ~300k triangoli
    fragments: 4200, // frammenti del blocco da scolpire
    fragmentDetail: 1, // poliedri più ricchi
    dustPerFragment: 2,
    motes: 260, // polvere sospesa nella luce
    maxPixelRatio: 1.5,
    shadowMap: 2048,
    dof: true, // profondità di campo nei primi piani
    physical: true, // MeshPhysicalMaterial (sheen) per la statua
  },
  mobile: {
    model: '/models/statue-mobile.glb', // ~120k triangoli
    fragments: 1700,
    fragmentDetail: 0,
    dustPerFragment: 1,
    motes: 140,
    maxPixelRatio: 1.5,
    shadowMap: 1024,
    dof: true, // si spegne da sola se gli fps scendono
    physical: false,
  },
};

// Qualità adattiva: sotto questi fps per ~2 s si scende di un gradino
// (prima via la profondità di campo, poi risoluzione più bassa).
export const ADAPTIVE = { minFps: 48, sampleSeconds: 2, minPixelRatio: 1 };

// ----------------------------------------------------------------------------
//  Scolpire. I punti "capitolo:avanzamento" sono posizioni dello scroll:
//  'valoracion:0.5' = metà del capitolo 01. Capitoli: hero, valoracion,
//  precision, doctor, procedimientos, final.
// ----------------------------------------------------------------------------
export const SCULPT = {
  start: 'valoracion:0.06', // cade il primo frammento
  end: 'precision:0.68', // non resta più nulla del blocco
  polishStart: 'precision:0.36', // la superficie inizia a levigarsi
  polishEnd: 'precision:0.84', // statua lucida
  fallDuration: 0.045, // quanto dura la caduta di un frammento (in frazioni dello scolpire)
  margin: 0.04, // il blocco grezzo sporge di tanto oltre la figura
};

// La statua finita ruota piano durante "03 · El doctor" (gradi, andata e ritorno)
export const DOCTOR_SPIN = { degrees: 22 };

// ----------------------------------------------------------------------------
//  Zone interattive (04 · Procedimientos)
//  center: coordinate relative al bounding box del modello (0..1 su x, y, z;
//          x = destra della statua, y = alto, z = avanti, lei guarda verso +z)
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
    center: [0.6, 0.85, 0.375],
    radius: 0.07,
    cam: { az: 20, el: 8, dist: 1.75, shift: [0.25, 0.02] },
    mobile: { dist: 2.3, shift: [0, 0.2] },
  },
  {
    id: 'corporales',
    center: [0.47, 0.47, 0.37],
    radius: 0.09,
    cam: { az: -38, el: 14, dist: 3.7, shift: [0.31, 0], look: [0, 0.06, 0] },
    mobile: { dist: 4.0, shift: [0, 0.2] },
  },
  {
    id: 'noquirurgicos',
    center: [0.5, 0.75, 0.35],
    radius: 0.075,
    cam: { az: 14, el: 8, dist: 1.7, shift: [0.24, 0], look: [0, 0.04, 0] },
    mobile: { dist: 2.2, shift: [0, 0.2] },
  },
  {
    id: 'reconstructivos',
    center: [0.47, 0.635, 0.36],
    radius: 0.085,
    // inquadratura volutamente ampia e laterale: elegante, mai insistente
    cam: { az: 36, el: 12, dist: 2.6, shift: [0.24, 0.02], look: [0, 0.14, 0] },
    mobile: { dist: 3.4, shift: [0, 0.2] },
  },
];

// Durata del volo verso una zona (secondi)
export const ZONE_FLIGHT = { duration: 1.9 };
