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
    elevation: 9,              // gradi sopra l'orizzonte (ora dorata: luce radente, ombre lunghe)
    color: '#ffc690',          // luce diretta, oro caldo
    intensity: 3.4,
    shadowSoftness: 1.6,       // penombra delle ombre del rilievo (gradi)
  },
  sky: {
    turbidity: 2.0,            // aria tersa, come dopo il maestrale
    rayleigh: 3.8,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.82,
    clouds: 0.22,              // copertura nuvole 0–1
    exposure: 0.95,            // luminosità del cielo rispetto alla scena
    zenithTint: '#8fb0e6',     // moltiplica il colore allo zenit (più blu)
    horizonTint: '#ffd6a8',    // moltiplica il colore all'orizzonte (più dorato)
  },
  ambient: {
    sky: '#7d92b6',            // luce del cielo nelle ombre (fredda, blu)
    ground: '#6e5640',         // rimbalzo dal suolo (caldo, scuro)
    intensity: 0.95,           // ombre più profonde: più contrasto tra sole e ombra
  },

  // ── Nebbia atmosferica (esponenziale, più densa in basso)
  fog: {
    density: 0.00012,          // densità al livello del mare (aria tersa: si vede lontano)
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
    photo: {                   // foto aerea PNOA (IGN) come colore del suolo
      strength: 1.0,           // 0 = terreno solo procedurale
      gain: 1.15,              // luminosità della foto
      saturation: 1.15,
      contrast: 0.6,           // 1 = contrasto della foto; meno = macchie (ombre di mezzogiorno) più leggere
      detail: 0.35,            // quanto dettaglio fine della foto resta sopra i colori larghi
      blur: 1.6,               // quanto si ammorbidisce la foto per i colori larghi (livelli di mipmap)
    },
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
    deep: '#082f5c',           // blu profondo del Mediterraneo al largo
    shallow: '#1f8a8f',        // l'acqua turchese delle cale
    foam: '#e8f0f0',
    shallowDepth: 9,           // sotto questa profondità l'acqua diventa turchese (m)
    waveSpeed: 0.6,
    sunGlint: 1.6,
    photoGain: 2.2,            // l'acqua della foto aerea sotto costa (è più scura del colore percepito)
    photoDepth: 40,            // fino a questa profondità (m) si usa il colore vero della foto
  },

  // ── Pini (InstancedMesh)
  trees: {
    count: 14000,              // solo se manca trees.bin (i pini veri riconosciuti nella foto aerea)
    color: '#3f4f2b',
    colorVar: 0.2,
    slope: [0.02, 0.24],       // solo pendenze medie (1 − n.y: 0,02 ≈ 11°, 0,24 ≈ 40°)
    height: [8, 980],
    minRoadDistance: 10,
    size: [4.5, 9.5],          // altezza (m)
  },

  // ── Ciclisti sulla strada: gruppi che salgono e scendono, e il gruppo Nomads in testa alla linea
  cyclists: {
    groups: [                  // s0: dove parte il gruppo (m), speed: m/s, dir: +1 scende, -1 sale
      { s0: 600, speed: 4.2, dir: -1, n: 5, nomads: true },
      { s0: 3200, speed: 4.6, dir: -1, n: 3 },
      { s0: 6100, speed: 3.9, dir: -1, n: 4 },
      { s0: 8300, speed: 4.4, dir: -1, n: 2 },
      { s0: 1500, speed: 9.5, dir: 1, n: 3 },
      { s0: 5200, speed: 10.5, dir: 1, n: 4 },
    ],
    lead: 4,                   // il gruppo Nomads in testa alla linea arancione
    gap: 2.6,                  // distanza tra le ruote in gruppo (m)
    scaleFrom: 60,             // oltre questa distanza (m) i ciclisti si ingrandiscono…
    scaleMax: 4.5,             // …fino a tanto, per restare visibili dalle inquadrature da drone
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
    grain: 0.06,               // opacità della grana
    saturation: 0.2,           // -1…1
    contrast: 0.16,            // -1…1
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
    // inquadrature (posizione → punto guardato), coordinate locali in metri. Una per tappa,
    // sempre alte e larghe (da vicino il rilievo perde dettaglio)
    poses: {
      start: { pos: [900, 1250, 2250], target: [700, 600, 1330] },   // 0 · dove si posa la M: il Coll, il Nus e i tornanti
      b: { pos: [1600, 1500, 1900], target: [0, 350, 1100] },        // 1 · la linea scende tra i tornanti, vista da est
      c: { pos: [-400, 890, 1830], target: [-620, 60, -250] },        // 2 · la linea arriva al mare
      port: { pos: [-560, 110, -1300], target: [-60, 10, -1000] },   // 3 · sopra la cala: foce del Torrent de Pareis (360°)
      sea: { pos: [-900, 650, -2700], target: [300, 450, 1000] },    // passaggio porto → Nus: dal mare si vede accendersi la salita
      nus: { pos: [780, 820, 980], target: [870, 660, 1260] },       // 5 · il Nus de sa Corbata (360°)
      top: { pos: [1300, 1420, 2200], target: [-1300, 0, -1900] },   // 6 · tutta la salita e il mare al tramonto
      next: { pos: [1250, 1520, 2300], target: [-3640, 520, 3340] }, // 7 · lo sguardo va al tramonto: il prossimo capitolo
    },
    look: {                    // soste a 360°
      dragSpeed: 0.0055,       // radianti per pixel trascinato
      inertia: 0.92,           // 0…1, quanto continua a girare dopo il rilascio
      pitchMin: -50,           // limiti verticali (gradi)
      pitchMax: 22,
    },
  },

  // ── Regia a tappe: ogni gesto (swipe, rotella, tasti) porta alla tappa successiva.
  //    Durate in secondi dell'animazione tra una tappa e l'altra.
  story: {
    steps: {
      b: 4.2,      // 0 → 1  la linea scende dal Coll tra i tornanti
      c: 4.0,      // 1 → 2  la linea arriva al mare
      port: 3.0,   // 2 → 3  luce calda e si apre sulla cala del porto: the crew (vista a 360°)
      nus: 5.4,    // 3 → 4  ci si allarga sul mare mentre la salita si accende, poi il Nus: il coach
      top: 4.2,    // 4 → 5  ci si gira: il ciclista arriva al Coll
      next: 3.2,   // 5 → 6  la linea prosegue verso l'orizzonte: Capítulo 02
    },
    hurry: 3,      // uno swipe durante l'animazione la accelera di tanto
    backSpeed: 2.2, // all'indietro si torna più in fretta
    introLine: 1500,     // i metri di strada su cui si posa la M dell'intro
    lineB: 4300,         // fin dove scende la linea alla tappa 1 (m dal Coll)
    counter: true,       // in salita: profilo, km e metri saliti (valori ufficiali della salita, dal PDF)
  },

  // ── Testi delle tappe (frasi dal PDF di Nomads). size: 'headline' (grande), 'lead' (frase
  //    lunga), 'big' (enorme); sub: riga piccola sotto; photo: 'crew' | 'coach' (foto dal PDF).
  //    Il viaggio a Mallorca è nel pannello del Capítulo 01.
  copy: {
    start: { kicker: 'Nomads Cycling Club', text: 'El mundo no se visita, se conquista pedaleando.' },
    b: { kicker: 'Quiénes somos', text: 'Nacimos de la pasión. Crecimos para conquistar el asfalto.' },
    c: { kicker: 'Qué hacemos', text: 'Experiencias únicas para quienes ven en la bicicleta una forma de libertad.', size: 'lead' },
    port: { kicker: 'The crew', text: 'Tu única responsabilidad es pedalear.', sub: 'Nosotros nos encargamos de todo.', photo: 'crew' },
    nus: { kicker: 'Head coach · Alfredo “Freddy” Cruz', text: 'Rodar exige más que fuerza; requiere estrategia.', sub: 'UCI Coach Nivel 3 · Estratega detrás de la victoria de Isaac del Toro en el Tour de l’Avenir.', photo: 'coach' },
    top: { text: 'Queremos que cada ruta sea una historia que valga la pena contar.', size: 'lead' },
    next: { text: 'No es un viaje, es tu próxima historia.' },
    share: 'Comparte tu cima',
    nextChapter: 'Capítulo 02 · Próximamente',
    introMeta: 'Viajes en bicicleta · Desde México', // sotto il logo nell'intro
    // l'immagine da condividere (formato storia 1080 × 1920)
    card: { kicker: 'Capítulo 01 · Mallorca', title: 'Conquisté\nSa Calobra.', stats: '9.41 KM · 660 M' }, // \n = a capo
  },

  // ── Il globo (home): la Terra vera (NASA Blue Marble) nello spazio; dalla Ciudad de México
  //    ai capitoli. lat/lon in gradi. status: 'done' = batteria piena, 'loading' = in carica.
  //    Le mete senza luogo (ancora da decidere) non hanno pin.
  globe: {
    origin: { name: 'Ciudad de México', lat: 19.4326, lon: -99.1332 },
    chapters: [
      { n: '01', name: 'Mallorca', when: '19–28 octubre 2026', lat: 39.62, lon: 2.98, status: 'done', open: true },
      { n: '02', name: null, title: 'Destino por anunciar', when: 'Marzo 2027', status: 'loading',
        lead: 'La próxima ruta ya está en preparación.',
        facts: [['Fechas', 'Marzo 2027'], ['Destino', 'Por anunciar'], ['Itinerario', 'En preparación']] },
      { n: '03', name: 'Dolomitas', title: 'Dolomitas', when: 'Verano 2027', lat: 46.5, lon: 11.85, status: 'loading',
        lead: 'Los puertos de montaña del norte de Italia, Patrimonio de la Humanidad por la UNESCO.',
        facts: [['Fechas', 'Verano 2027'], ['Itinerario', 'En preparación'], ['Precio', 'Próximamente']] },
    ],
    // inquadratura per tappa del racconto: punto guardato (lat, lon) e distanza dal centro (raggio = 1)
    views: [
      { lat: 24, lon: -96, dist: 3.2 },       // 0 · la Ciudad de México
      { lat: 43, lon: -3, dist: 2.7 },        // 1 · arrivati in Europa: quiénes somos
      { lat: 42.2, lon: -1.5, dist: 2.58 },   // 2 · qué hacemos (a ogni frase un poco più vicino a Mallorca)
      { lat: 41.4, lon: 0, dist: 2.46 },      // 3 · the crew
      { lat: 40.6, lon: 1.5, dist: 2.34 },    // 4 · head coach
    ],
    // il volo unico Messico → Europa: parte da solo dopo `delay` secondi, dura `duration`,
    // a metà la camera si allontana fino a `peak` per vedere l'Atlantico
    flight: { delay: 1.6, duration: 4.2, peak: 3.9 },
    // arrivati in Europa il racconto finisce: il mondo diventa esplorabile da qui
    explore: { lat: 42, lon: 6, dist: 2.25 },
    zoom: [1.15, 4.6],         // quanto ci si può avvicinare e allontanare esplorando
    progress: [0.1, 1, 1, 1, 1, 1], // quanto è disegnata la rotta di Mallorca a ogni tappa
    arcHeight: 0.16,           // quanto si alza la rotta sopra il globo (raggio = 1)
    // l'alba dorata: il sole sorge dietro la Terra
    atmosphere: '#9cc8ff',     // l'aria azzurra sulla faccia della Terra
    halo: '#ffc58a',           // il bordo della Terra acceso dal sole
    glow: ['#ffd9a3', '#ff9d5f', '#c86f8f'], // il bagliore intorno: oro, arancio, rosa
    sunlight: '#fff0da',       // la luce calda del mattino sulla Terra
    ambient: 0.52,             // quanto è chiara anche la parte meno illuminata
    // nomi sulla cartina, per orientarsi
    labels: [
      { t: 'México', lat: 23.6, lon: -102.5 }, { t: 'Estados Unidos', lat: 39, lon: -98 },
      { t: 'España', lat: 40.2, lon: -3.7 }, { t: 'Francia', lat: 46.6, lon: 2.4 }, { t: 'Italia', lat: 42.6, lon: 12.6 },
      { t: 'Portugal', lat: 39.7, lon: -8.1 }, { t: 'Marruecos', lat: 31.6, lon: -6.6 }, { t: 'Reino Unido', lat: 53, lon: -1.8 },
      { t: 'Alemania', lat: 51, lon: 10.3 },
      { t: 'Océano Atlántico', lat: 31, lon: -42, sea: true }, { t: 'Mar Mediterráneo', lat: 37.6, lon: 17, sea: true },
      { t: 'Golfo de México', lat: 25, lon: -90, sea: true },
    ],
    copy: {
      exploreKicker: 'Explora los capítulos',
      exploreHint: 'Gira el mundo y toca un destino.',
      done: 'Completado',
      loading: 'Loading',
      promise: 'Tu única responsabilidad es pedalear. Nosotros nos encargamos de todo.',
      notify: 'Quiero saberlo primero',
    },
  },

  // ── Il viaggio: Capítulo 01 · Mallorca (bottone in alto e alla fine). La linea si raddrizza
  //    in una linea del tempo con i giorni. status: 'past' = viaggio già fatto (si racconta
  //    com'è stato e si chiede il prossimo capitolo); 'open' = in vendita (prezzo e apartado).
  trip: {
    chapter: 'Capítulo 01',
    button: 'Cap. 01 · Mallorca',
    status: 'past',
    name: 'Mallorca',
    dates: '19–28 octubre 2026',
    price: { total: '€2,750', deposit: '€350', note: 'Cupos limitados para mantener una experiencia personalizada.' },
    includes: ['Staff especializado acompañando cada ruta', 'Kit del ciclista', 'Vehículo de apoyo permanente', 'Hidratación y nutrición estratégica', 'Gestión de renta de bicicletas', 'Traslados aeropuerto–hotel–aeropuerto', 'Alojamiento con desayuno incluido', 'Cena de bienvenida y cena de despedida', 'Día de descanso activo'],
    levels: ['Fácil', 'Intermedio', 'Difícil'],
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
