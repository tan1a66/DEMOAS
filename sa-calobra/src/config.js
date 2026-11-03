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

  // ── Camera: inquadrature quasi ferme (drone in hovering); a muoversi è la linea arancione
  camera: {
    fovPortrait: 60,           // campo visivo verticale su telefono in verticale…
    fovLandscape: 45,          // …e su schermi orizzontali
    near: 2,
    far: 2500000,
    drift: 0.035,              // durante ogni inquadratura la camera avanza appena (frazione della distanza)
    gimbal: 0.25,              // stabilizzatore: tempo di smorzamento delle rotazioni (s)
    riderPx: 26,               // il punto arancione in testa alla linea (diametro in pixel)
    // inquadrature (posizione → punto guardato), coordinate locali in metri
    poses: {
      start: { roadS: 0, back: 60, up: 18, lookS: 280 },             // bassa sopra la strada al Coll
      a: { pos: [900, 1250, 2250], target: [700, 600, 1330] },       // discesa 1: Coll, Nus e tornanti
      b: { pos: [250, 1150, 2350], target: [40, 380, 950] },         // discesa 2: metà strada
      c: { pos: [-450, 700, 1350], target: [-620, 60, -250] },       // discesa 3: verso il mare
      port: { pos: [-560, 110, -1300], target: [-60, 10, -1000] },   // sosta 1 sopra la cala: foce del Torrent de Pareis
      sea: { pos: [-900, 650, -2700], target: [300, 450, 1000] },    // salita: dal mare verso la montagna
      nus: { pos: [780, 820, 980], target: [870, 660, 1260] },       // sosta 2: il Nus de sa Corbata
      top: { pos: [1300, 1420, 2200], target: [-1300, 0, -1900] },   // finale: tutta la salita e il mare al tramonto
    },
    look: {                    // soste a 360°
      dragSpeed: 0.0055,       // radianti per pixel trascinato
      inertia: 0.92,           // 0…1, quanto continua a girare dopo il rilascio
      pitchMin: -50,           // limiti verticali (gradi)
      pitchMax: 22,
    },
  },

  // ── Regia: lunghezza di ogni sezione in "schermate" di scroll (totale ≈ 11)
  story: {
    rise: 0.8,                 // apertura: dalla strada al Coll la camera sale sulla prima inquadratura
    drawA: 0.9,                // discesa: la linea scende tra Coll, Nus e tornanti
    moveAB: 0.45,              // la camera scivola sulla seconda inquadratura
    drawB: 0.9,                // metà strada
    moveBC: 0.45,
    drawC: 0.8,                // verso il mare
    arrive: 0.6,               // la camera scende sulla cala
    stop1: 1.0,                // sosta 1: porto (360°)
    leave: 0.6,                // si allarga sul mare: la salita inizia
    climb: 1.6,                // la salita si accende dal porto verso la montagna, con il contatore
    cut: 0.5,                  // dissolvenza verso il Nus
    stop2: 0.8,                // sosta 2: Nus de sa Corbata (360°)
    lookback: 1.3,             // ci si gira: tutta la salita e il mare al tramonto
    finale: 0.7,               // totale della tappa, frase finale e bottoni
    scrub: 1,                  // morbidezza dello scroll (secondi di inseguimento)
    // dove arriva la linea alla fine di ogni inquadratura della discesa (metri dal Coll)
    introLine: 280,            // i primi metri di linea: quelli su cui si posa la M dell'intro
    lineA: 2800, lineAB: 3300, lineB: 6200, lineBC: 6800,
  },

  // ── Il viaggio (INFO MALLORCA): la linea si raddrizza in una linea del tempo con i giorni.
  //    Completare i giorni dal PDF di Nomads: name (tappa), stats (es. "60 KMS · 3:20 HRS · 1,623 M"), level.
  trip: {
    name: 'Mallorca',
    dates: '19–28 octubre 2026',
    climb: { km: 9.41, m: 660 },  // Coll de Sa Calobra (tabla "Rutas ciclistas" del PDF): valori finali del contatore
    // dal PDF "Nomads Cycling Club x Mallorca" (nomi dei luoghi come nella tabla "Rutas ciclistas")
    days: [
      { day: 1, name: 'Aeropuerto de Palma', text: 'Recepción · Traslado al hotel · Cena de bienvenida' },
      { day: 2, name: 'Alcudia · Sineu', text: 'El primer contacto con el asfalto mallorquín.', stats: '95 KMS · 3:15 HRS · 877 M', level: 'Fácil' },
      { day: 3, name: 'Randa · Felanitx', text: 'El interior de la isla tiene su propia exigencia.', stats: '77 KMS · 2:45 HRS · 1,098 M', level: 'Fácil' },
      { day: 4, name: 'Lluc · Pollença · Formentor', text: 'La Tramuntana entra en escena.', stats: '100 KMS · 4:15 HRS · 1,723 M', level: 'Intermedio' },
      { day: 5, name: 'Lluc · Port de Sóller · Bunyola · Alaró', text: 'El día más duro.', stats: '98 KMS · 4:30 HRS · 2,155 M', level: 'Difícil' },
      { day: 6, name: 'Camí Vell de Muro · Santa María · Alaró', text: 'Recuperar es también una decisión táctica.', stats: '50 KMS · 1:45 HRS · 434 M', level: 'Fácil · opcional' },
      { day: 7, name: 'Calvià · Es Capdellà · Galilea · Puigpunyent · Valldemossa', text: 'Rampas explosivas hacia uno de los pueblos más fotogénicos de Europa.', stats: '82 KMS · 3:45 HRS · 1,414 M', level: 'Difícil' },
      { day: 8, name: 'Esporles · Banyalbufar · Andratx', text: 'La costa oeste de la Tramuntana.', stats: '103 KMS · 4:00 HRS · 1,327 M', level: 'Intermedio' },
      { day: 9, name: 'Ruta Sa Calobra', text: 'El final que se merece esta expedición.', stats: '60 KMS · 3:20 HRS · 1,623 M', level: 'Difícil', current: true },
    ],
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
