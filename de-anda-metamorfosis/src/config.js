// =============================================================================
//  config.js — impostazioni generali del sito
// =============================================================================
//  Il percorso del drone e le atmosfere (luce, cielo, nebbia, tende) sono in
//  drone-path.js, i testi in i18n.js.

// Demo: i pulsanti mostrano "Work in progress · alessia.studio" invece di
// aprire WhatsApp. Con false tornano ad aprire WhatsApp.
export const DEMO_MODE = true;

// Numero WhatsApp del dottore: solo cifre, con prefisso internazionale
// (Messico = 52), es. '5219991234567'. Vuoto = WhatsApp si apre senza destinatario.
export const WHATSAPP_NUMBER = '';

// Palette (anche in styles.css come variabili CSS)
export const COLORS = {
  ivory: '#F3EEE6', // sfondo
  taupe: '#C9BCA9',
  ink: '#1D2E3D', // testi (blu notte)
  accent: '#4A7CA3', // accento azzurro
};

// ----------------------------------------------------------------------------
//  Qualità per dispositivo. ?quality=mobile o ?quality=desktop per forzarla.
// ----------------------------------------------------------------------------
export const QUALITY = {
  desktop: {
    model: '/models/venus-desktop.glb', // ~300k triangoli
    motes: 1100, // pulviscolo: brilla solo dove passa il sole
    maxPixelRatio: 1.5,
    shadowMap: 2048, // ombre del sole (archi, colonne)
    goboShadow: 1024, // ombre delle foglie e della statua su sé stessa
    reflection: 0.5, // risoluzione del riflesso nell'acqua (frazione dello schermo)
    dof: true, // profondità di campo nei primi piani
    volumetric: true, // raggi di luce veri (dalle ombre del sole)
    physical: true, // MeshPhysicalMaterial (sheen, clearcoat) per la statua
  },
  mobile: {
    model: '/models/venus-mobile.glb', // ~120k triangoli
    motes: 220,
    maxPixelRatio: 1.5,
    shadowMap: 1024,
    goboShadow: 512,
    reflection: 0.3,
    dof: true, // si spegne da sola se gli fps scendono
    volumetric: false, // su telefono: raggi leggeri disegnati, senza calcolo
    physical: false,
  },
};

// Qualità adattiva: sotto questi fps per ~2 s si scende di un gradino
// (prima via la profondità di campo, poi i raggi volumetrici, poi meno pixel).
export const ADAPTIVE = { minFps: 48, sampleSeconds: 2, minPixelRatio: 1 };

// ----------------------------------------------------------------------------
//  La trasformazione: la statua è opaca all'alba e diventa marmo levigato e
//  luminoso mentre sale la luce. Punti 'capitolo:avanzamento' dello scroll
//  (capitoli: hero, valoracion, precision, menu, doctor, procedimientos).
// ----------------------------------------------------------------------------
export const POLISH = { start: 'valoracion:0.3', end: 'precision:0.8' };

// La statua ruota piano durante "03 · El doctor" (gradi, andata e ritorno)
export const DOCTOR_SPIN = { degrees: 18 };

// -----------------------------------------------------------------------------
//  Titoli che giocano con la statua (three/titles3d.js): le parole partono
//  dietro di lei, la attraversano con lo scroll e arrivano davanti, al loro
//  posto nella colonna di testo. in = [partenza, arrivo] del volo, out =
//  [inizio, fine] dell'uscita, in punti dello scroll ('capitolo:avanzamento').
//  La chiave è il data-layer del livello in index.html; il titolo HTML resta
//  invisibile. Con prefers-reduced-motion si vedono i titoli HTML normali.
// -----------------------------------------------------------------------------
export const TITLE_FLIGHTS = {
  valoracion: { in: ['hero:0.46', 'valoracion:0.3'], out: ['valoracion:0.88', 'valoracion:0.96'] },
  precision: { in: ['precision:0.05', 'precision:0.66'], out: ['precision:0.95', 'precision:1'] },
  menu: { in: ['precision:0.985', 'menu:0.3'] }, // l'indice è la fine del racconto: resta
  // pagine (si entra dall'indice): il titolo vola mentre la pagina si apre
  doctor: { in: ['doctor:0', 'doctor:0.12'], out: ['doctor:0.32', 'doctor:0.37'] },
  'doctor.formacion': { in: ['doctor:0.35', 'doctor:0.48'], out: ['doctor:0.64', 'doctor:0.69'] },
  'doctor.consulta': { in: ['doctor:0.67', 'doctor:0.8'] },
  procedimientos: { in: ['procedimientos:0', 'procedimientos:0.1'] },
};

// ----------------------------------------------------------------------------
//  Zone della statua (04 · Procedimientos): scorrendo il drone si ferma su
//  ognuna (ordine e soste in drone-path.js) e la zona si illumina d'oro
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
    mobile: { dist: 1.7, shift: [0, 0.36] },
  },
  {
    id: 'corporales',
    center: [0.44, 0.615, 0.62],
    radius: 0.09,
    cam: { az: 30, el: 10, dist: 2.5, shift: [0.27, 0], look: [0, 0.05, 0] },
    mobile: { dist: 3.9, shift: [0, 0.36] },
  },
  {
    id: 'noquirurgicos',
    center: [0.44, 0.83, 0.62],
    radius: 0.06,
    cam: { az: -12, el: 6, dist: 1.4, shift: [0.25, 0], look: [0, 0.04, 0] },
    mobile: { dist: 2.2, shift: [0, 0.36] },
  },
  {
    id: 'reconstructivos',
    center: [0.45, 0.79, 0.6], // parte alta del petto, al centro (elegante, mai insistente)
    radius: 0.06,
    // inquadratura volutamente ampia: elegante, mai insistente
    cam: { az: 20, el: 8, dist: 2.6, shift: [0.27, 0.02], look: [0, 0.24, 0] },
    mobile: { dist: 3.5, shift: [0, 0.36] },
  },
];

