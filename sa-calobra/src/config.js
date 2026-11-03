// ─────────────────────────────────────────────────────────────────────────────
//  Sa Calobra — tutti i parametri estetici in un unico posto.
//  Colori in esadecimale (sRGB, come in Figma). Distanze in metri, angoli in gradi.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // ── Brand
  brand: {
    anthracite: '#2B2B2B',
    cream: '#EDE8DF',
    blueGrey: '#7E93A6',
    orange: '#E8622C',
  },

  // ── Prestazioni
  perf: {
    maxPixelRatio: 2,          // obbligatorio: Math.min(devicePixelRatio, 2)
    msaaSamples: 0,            // 0 su mobile: a DPR 2 l'aliasing è già minimo
    msaaSamplesDesktop: 4,
    adaptive: true,            // se gli FPS scendono a lungo, abbassa la risoluzione (fino a minPixelRatio)
    minPixelRatio: 1.25,
  },

  // ── Sole e cielo (tramonto di fine ottobre: il sole tramonta a WSW)
  sun: {
    azimuth: 252,              // gradi da nord, in senso orario
    elevation: 7.5,            // gradi sopra l'orizzonte
    color: '#ffbe85',          // luce diretta, oro caldo
    intensity: 3.0,
    shadowSoftness: 1.6,       // penombra delle ombre del rilievo (gradi)
  },
  sky: {
    turbidity: 2.4,
    rayleigh: 3.8,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.82,
    clouds: 0.22,              // copertura nuvole 0–1
    exposure: 0.95,            // luminosità del cielo rispetto alla scena
    zenithTint: '#8fb0e6',     // moltiplica il colore allo zenit (più blu)
    horizonTint: '#ffd6a8',    // moltiplica il colore all'orizzonte (più dorato)
  },
  ambient: {
    sky: '#8796ae',            // luce del cielo nelle ombre (fredda)
    ground: '#6e5640',         // rimbalzo dal suolo (caldo, scuro)
    intensity: 1.15,
  },

  // ── Nebbia atmosferica (esponenziale, più densa in basso)
  fog: {
    density: 0.0002,           // densità al livello del mare
    heightFalloff: 0.0018,     // quanto rapidamente si dirada salendo
    sunGlow: '#ffb27a',        // la nebbia verso il sole si scalda
    sunGlowPower: 6.0,
    maxOpacity: 0.97,
  },

  // ── Terreno
  terrain: {
    rock: '#ada79c',           // calcare chiaro, grigio caldo
    rockDark: '#6b665f',       // striature verticali
    scrub: '#3b4724',          // macchia mediterranea, verde oliva scuro
    scrubDry: '#646240',       // macchia secca/assolata
    valley: '#26311a',         // fondovalle, verde più scuro
    shore: '#9a8c79',          // rocce della costa
    shoulder: '#9b8f7b',       // banchina polverosa ai lati della strada
    rockSlope: [0.25, 0.42],   // pendenza (1 − n.y; 0,25 ≈ 41°, 0,42 ≈ 54°) in cui la macchia lascia il posto alla roccia
    valleyHeight: [40, 260],   // quote in cui il fondovalle sfuma nella macchia
    aoStrength: 1.0,           // occlusione da curvatura
    noiseScale: 1.0,
  },

  // ── Mesh del terreno: passo della griglia in funzione della distanza dalla strada
  mesh: {
    bands: [                   // [fino a questa distanza dalla strada (m), passo (m)]
      [70, 6],
      [320, 10],
      [900, 18],
      [Infinity, 40],
    ],
    roadOffsets: [3.4, 4.6, 7, 11, 17], // file di vertici parallele alla strada (m dal centro)
    roadStation: 4,            // passo lungo la strada di queste file (m)
    farRadius: 12500,          // raggio dell'orizzonte lontano (m)
    focus: [                   // zone delle soste: passo massimo più fitto [punto chiave, raggio (m), passo (m)]
      ['PORT', 1100, 12],
      ['CORBATA', 600, 10],
    ],
    seaStep: 40,               // sott'acqua (oltre 4 m di fondale) basta un passo largo
  },

  // ── Strada
  road: {
    halfWidth: 3.0,            // nastro largo 6 m
    lift: 0.06,                // sopra la quota della strada (m)
    asphalt: '#3b3a38',
    centerLine: '#e9e3d6',
    dash: [3.5, 6.5],          // tratteggio mezzeria: pieno, vuoto (m)
    wall: '#b7a891',           // muretti in pietra
    wallHeight: 0.55,
    wallMinCurvature: 0.018,   // muretti a valle nei tornanti (curvatura 1/m) …
    wallMinDrop: 4.0,          // … e dove il pendio a valle scende di più di questi metri
  },

  // ── Linea arancione del percorso
  line: {
    width: 2.6,                // spessore in pixel CSS
    glow: 1.15,                // intensità del tratto
    haloWidth: 5,              // alone morbido: larghezza in multipli del tratto…
    haloOpacity: 0.2,          // …e intensità
    lift: 0.45,                // sopra l'asfalto (m)
  },

  // ── Mare
  sea: {
    deep: '#0b3550',
    shallow: '#1f8a8f',        // l'acqua turchese delle cale
    foam: '#e8f0f0',
    shallowDepth: 9,           // sotto questa profondità l'acqua diventa turchese (m)
    waveSpeed: 0.6,
    sunGlint: 1.6,
  },

  // ── Pini (InstancedMesh)
  trees: {
    count: 14000,
    color: '#3f4f2b',
    colorVar: 0.2,
    slope: [0.02, 0.24],       // solo pendenze medie (1 − n.y: 0,02 ≈ 11°, 0,24 ≈ 40°)
    height: [8, 980],
    minRoadDistance: 10,
    size: [4.5, 9.5],          // altezza (m)
  },

  // ── Post-processing
  post: {
    toneMapping: 'ACES_FILMIC', // 'AGX' (più morbido, desatura le luci) o 'ACES_FILMIC' (più contrasto e colore)
    bloomIntensity: 0.6,
    bloomThreshold: 1.6,       // solo sole, scintillio del mare e alone della linea
    bloomSmoothing: 0.25,
    bloomRadius: 0.6,
    vignetteDarkness: 0.55,
    vignetteOffset: 0.32,
    grain: 0.09,               // opacità della grana
    saturation: 0.14,          // -1…1
    contrast: 0.08,            // -1…1
    exposure: 1.0,
  },

  // ── Camera
  camera: {
    fovPortrait: 60,           // campo visivo verticale su telefono in verticale…
    fovLandscape: 45,          // …e su schermi orizzontali
    near: 2,
    far: 2500000,
    height: 62,                // quota sopra la strada durante discesa e salita (m)
    minClearance: 30,          // mai meno di così sopra il terreno (m)
    trackSmoothing: 75,        // lisciatura del tracciato (m): la camera "taglia" i tornanti
    lookSmoothing: 30,         // lisciatura del punto di mira (m)
    lookAhead: 330,            // guarda qualche centinaio di metri avanti (m)
    riderAhead: 140,           // il punto arancione "ciclista" davanti alla camera (m)
    // inquadrature fisse (posizione → punto guardato), coordinate locali in metri
    poses: {
      start: { roadS: 0, back: 60, up: 18, lookS: 280 },          // bassa sopra la strada al Coll
      overview: { pos: [1250, 1180, 2350], target: [250, 250, -400] }, // drone: serpentina, gola, mare
      port: { pos: [-520, 100, -1290], target: [-60, 10, -1000] },  // sopra la cala: foce del Torrent de Pareis (girandosi: porto e strada)
      nus: { pos: [930, 745, 1300], target: [845, 668, 1195] },    // il Nus de sa Corbata dall'alto
      top: { pos: [1300, 1420, 2200], target: [-1300, 0, -1900] }, // cima: tutta la salita e il mare al tramonto
    },
    look: {                    // soste a 360°
      dragSpeed: 0.0055,       // radianti per pixel trascinato
      inertia: 0.92,           // 0…1, quanto continua a girare dopo il rilascio
      pitchMin: -50,           // limiti verticali (gradi)
      pitchMax: 22,
    },
  },

  // ── Regia: lunghezza di ogni sezione in "schermate" di scroll (totale ≈ 10)
  story: {
    rise: 1.0,                 // apertura: la camera sale e rivela la serpentina
    swoop: 0.7,                // scende sulla strada
    descent: 2.1,              // discesa verso il mare
    arrive: 0.45,              // arrivo al porto
    stop1: 1.0,                // sosta 1: porto (360°)
    leave: 0.45,               // si riparte, in salita
    ascent: 1.6,               // salita
    arrive2: 0.4,              // arrivo al Nus de sa Corbata
    stop2: 0.75,               // sosta 2: Nus (360°)
    top: 0.65,                 // ultimi metri fino al Coll dels Reis
    finale: 0.8,               // totale della tappa, frase finale e bottone
    scrub: 1,                  // morbidezza dello scroll (secondi di inseguimento)
  },
};

// Sviluppo: ?set=sky.exposure:1.2,fog.density:0.0002 sovrascrive i valori senza toccare questo file.
const set = new URLSearchParams(location.search).get('set');
if (set) {
  for (const pair of set.split(',')) {
    const [path, raw] = pair.split(':');
    const keys = path.split('.');
    let o = CONFIG;
    while (keys.length > 1) o = o[keys.shift()];
    o[keys[0]] = raw.startsWith('#') ? raw : JSON.parse(raw);
  }
}
