// =============================================================================
//  drone-path.js — il percorso del drone e le atmosfere, legati allo scroll
// =============================================================================
//
//  Ogni tappa dice DOVE si trova il drone in un certo punto dello scroll.
//  Tra una tappa e l'altra la camera scorre su una curva morbida
//  (CatmullRomCurve3 per la posizione, una seconda curva per il punto guardato).
//  In modalità ?debug il percorso è disegnato nella scena (tasto O: vista dall'alto).
//
//  at:      punto dello scroll, 'capitolo:avanzamento' (0..1 dentro al capitolo)
//           capitoli: hero, valoracion, precision, menu (indice), doctor (Quién soy), procedimientos
//  target:  punto guardato [x, y, z]. La statua sta sul piedistallo: i piedi a
//           y ≈ 0.8, la testa a y ≈ 2.6; lei guarda verso +z. Punti utili:
//             viso [-0.02, 2.5, 0.12]   busto [0, 2.25, 0.05]   vita [0, 1.95, 0.05]
//             schiena [0, 2.1, -0.08]   centro della statua [0, 1.75, 0]
//  az:      gradi attorno al punto guardato (0 = davanti a lei, 90 = suo fianco
//           sinistro, 180 = dietro, 270 = fianco destro). Si può superare 360.
//  el:      gradi di elevazione (positivo = dall'alto)
//  dist:    distanza dal punto guardato
//  shift:   spostamento dell'inquadratura [x, y] in frazioni di mezzo schermo:
//           [0.25, 0] = statua spostata a destra (testo a sinistra)
//  dof:     profondità di campo 0..1 (solo primi piani: costa)
//  fov:     apertura verticale in gradi (facoltativo)
//  rm:      true = inquadratura fissa del capitolo con prefers-reduced-motion
//  zone:    al posto di target/az/el/dist: inquadratura su una zona di config.js
//  hold:    sosta: la camera resta ferma per questa frazione del capitolo
//  mobile:  campi da cambiare su telefono (schermo verticale). Se manca, su
//           telefono la distanza è moltiplicata per MOBILE.distScale e la statua
//           va in alto (MOBILE.shift).
//
//  Il tempio: piattaforma da z = -8.6 a z = 9.4, muri a x = ±7.5 e z = -8.2.
//  Dentro al cortile la camera deve restare entro |x| < 6.5 e z > -7.5.
// =============================================================================

// obiettivi un po' lunghi: inquadrature strette, mai i confini del set
export const DESKTOP = { fov: 29 };
export const MOBILE = { fov: 38, distScale: 1.55, shift: [0, 0.2] };

// Oscillazione naturale del drone (micro-drift): ampiezza in frazioni della distanza
export const DRIFT = { position: 0.01, target: 0.005, speed: 0.16 };
// Movimento lento all'apertura anche senza scroll (gradi di oscillazione)
export const IDLE = { az: 3, el: 1.2, speed: 0.06 };
// Smorzamento di inquadratura, fuoco e fov: più alto = segue lo scroll più da vicino
export const DAMPING = 3.2;
// Molle di posizione e punto guardato (rad/s): lo sguardo è più rapido del corpo.
// zeta < 1 = piccolo assestamento all'arrivo, come una camera vera con il suo peso
export const SPRING = { pos: 4.6, target: 6.2, zeta: 0.8 };
// Inclinazione nelle curve (gradi): gain = quanto, max = limite, shake = tremito
export const BANK = { gain: 5, max: 1.6, shake: 0.12 };

// "Work in progress" (clic su un pulsante): la camera scende nella vasca e si
// ferma con l'obiettivo a pelo d'acqua, metà sopra e metà sotto (foto "over-under").
// pos: posizione (y 4 mm sotto il pelo, che è a -0.08); la discesa è più lenta del solito.
export const DIVE = {
  pos: [2.9, -0.084, 3.3], target: [0, 0.75, 0], fov: 58, shift: [0.4, 0],
  mobile: { pos: [2.6, -0.084, 3.35], target: [0, 0.9, 0], fov: 64, shift: [0, 0.06] },
  spring: { pos: 2.2, target: 2.6, zeta: 1 },
};

export const PATH = [
  // 0 · Apertura: già dentro il cortile, al tramonto. Non serve vedere tutto il
  //     tempio: lei, un pezzo di arco, la luce radente (la camera sta dal lato
  //     del sole: si vede il lato illuminato). Si avvicina piano.
  { at: 'hero:0', target: [0, 2.05, 0], az: 338, el: 2, dist: 7.4, shift: [0.26, -0.02],
    mobile: { dist: 10.5, el: 3, shift: [0, 0.17] } },
  { at: 'hero:0.9', target: [0, 2.0, 0], az: 352, el: 4, dist: 6.5, shift: [0.27, 0],
    mobile: { dist: 9.4 } },

  // 1 · 01 La valoración: gira verso il suo fianco sinistro, controluce
  { at: 'valoracion:0.35', target: [0, 1.85, 0], az: 50, el: 6, dist: 5.9, shift: [0.27, 0],
    mobile: { dist: 8.2 } },
  { at: 'valoracion:0.7', target: [0, 1.85, 0], az: 76, el: 8, dist: 5.2, shift: [0.29, 0], rm: true,
    mobile: { dist: 6.6, el: 10 } },
  { at: 'valoracion:1', target: [0.02, 1.95, 0], az: 100, el: 10, dist: 4.5, shift: [0.2, 0],
    mobile: { dist: 5.8 } },

  // 2 · 02 La precisión: da vicino, dietro la spalla, lungo la schiena, di nuovo davanti
  { at: 'precision:0.13', target: [0.08, 2.15, 0.12], az: 138, el: 9, dist: 2.3, shift: [0.08, 0],
    mobile: { dist: 3.2, shift: [0, 0.12] } },
  { at: 'precision:0.3', target: [0, 2.1, -0.05], az: 190, el: 8, dist: 2.4, shift: [0.05, 0],
    mobile: { dist: 3.4, shift: [0, 0.1] } },
  { at: 'precision:0.45', target: [0, 2.0, 0], az: 255, el: 4, dist: 2.6, shift: [0.08, 0],
    mobile: { dist: 3.8, shift: [0, 0.12] } },
  { at: 'precision:0.6', target: [-0.02, 2.28, 0.05], az: 300, el: 4, dist: 2.2, shift: [0.16, 0],
    mobile: { dist: 3.2 } },
  { at: 'precision:0.76', target: [-0.02, 2.45, 0.1], az: 325, el: 2, dist: 1.6, shift: [0.22, 0], dof: 0.5,
    mobile: { dist: 2.3 } },
  // primo piano del viso: il momento dello slogan
  { at: 'precision:0.9', target: [-0.02, 2.5, 0.12], az: 338, el: 1, dist: 1.05, shift: [0.24, -0.02], dof: 1,
    mobile: { dist: 1.5, shift: [0, 0.2] } },
  { at: 'precision:1', target: [-0.02, 2.5, 0.12], az: 342, el: 2, dist: 1.1, shift: [0.24, -0.02], dof: 1,
    mobile: { dist: 1.55, shift: [0, 0.2] } },

  // 3 · Indice (qui finisce il racconto): si allontana, il tempio al tramonto
  //     ma non tutto; a sinistra Quién soy · Procedimientos · Contacto
  { at: 'menu:0.35', target: [0, 1.75, 0], az: 12, el: 7, dist: 10.5, shift: [0.26, 0.02],
    mobile: { dist: 15, shift: [0, 0.26] } },
  { at: 'menu:0.9', target: [0, 1.75, 0], az: 16, el: 8, dist: 11.5, shift: [0.26, 0.02],
    mobile: { dist: 16, shift: [0, 0.26] } },

  // 4 · Quién soy (pagina: si entra dall'indice), in tre momenti: presentazione
  //     (tre quarti), formazione (più vicino, il lato illuminato), consulta (più largo).
  //     All'ingresso la camera arriva da lontano mentre il titolo vola.
  { at: 'doctor:0', target: [0, 1.75, 0], az: 346, el: 7, dist: 9.5, shift: [0.27, 0.02],
    mobile: { dist: 13, shift: [0, 0.26] } },
  { at: 'doctor:0.14', target: [0, 1.8, 0], az: 330, el: 8, dist: 5.6, shift: [0.3, 0],
    mobile: { dist: 7.4, shift: [0, 0.24] } },
  { at: 'doctor:0.3', target: [0, 1.85, 0], az: 322, el: 8, dist: 5.4, shift: [0.3, 0],
    mobile: { dist: 7.2, shift: [0, 0.24] } },
  { at: 'doctor:0.52', target: [-0.02, 2.25, 0.04], az: 292, el: 5, dist: 2.9, shift: [0.27, 0], dof: 0.4, rm: true,
    mobile: { dist: 5.2, shift: [0, 0.36] } },
  { at: 'doctor:0.64', target: [-0.02, 2.3, 0.04], az: 284, el: 4, dist: 2.7, shift: [0.27, 0], dof: 0.4,
    mobile: { dist: 5, shift: [0, 0.36] } },
  { at: 'doctor:0.86', target: [0, 1.7, 0], az: 344, el: 6, dist: 7.6, shift: [0.27, 0],
    mobile: { dist: 10.5, shift: [0, 0.24] } },

  // 5 · Procedimientos (pagina): arriva da lontano, vista frontale, poi il drone si ferma su ogni zona
  //     scorrendo (dall'alto in basso). Le inquadrature delle zone sono in config.js
  //     (ZONES → cam); hold = quanto dura la sosta, in frazioni del capitolo.
  //     Soste e distanze volutamente diverse: un ritmo regolare sembra una macchina.
  { at: 'procedimientos:0', target: [0, 1.75, 0], az: 6, el: 7, dist: 9.5, shift: [0.27, 0.02],
    mobile: { dist: 13, shift: [0, 0.3] } },
  { at: 'procedimientos:0.1', target: [0, 1.85, 0], az: 352, el: 6, dist: 4.6, shift: [0.27, 0],
    mobile: { dist: 7.4, shift: [0, 0.34] } },
  { at: 'procedimientos:0.265', zone: 'faciales', hold: 0.1 },
  { at: 'procedimientos:0.45', zone: 'noquirurgicos', hold: 0.06 },
  { at: 'procedimientos:0.63', zone: 'reconstructivos', hold: 0.075, rm: true },
  { at: 'procedimientos:0.84', zone: 'corporales', hold: 0.09 },
  { at: 'procedimientos:0.98', target: [0, 1.85, 0], az: 356, el: 7, dist: 5.2, shift: [0.27, 0],
    mobile: { dist: 8, shift: [0, 0.34] } },
];

// =============================================================================
//  Atmosfere: stessi punti dello scroll; tra una tappa e l'altra i valori sfumano.
//  sun:      sole (az/el in gradi come sopra: 180 = dietro al tempio), intensità, colore
//  sky:      colore dello zenit, dell'orizzonte e del mare
//  ambient:  luce diffusa; fill: luce morbida dal lato della camera
//  fog:      densità della foschia; mist: nebbia bassa sul pavimento (0..1)
//  gobo:     ombre di foglie d'ulivo sulla statua (0..1); goboAz/goboEl: da dove
//  curtains: open = quanto sono raccolte (0..1), wind = vento
//  beams:    raggi di luce dagli archi (0..1); moon: luna (0..1)
// =============================================================================
// Sempre al tramonto: il sole è basso alla destra di lei (az ~262) ed entra
// radente dagli archi del muro laterale. Cambiano solo di poco altezza, colore
// e direzione tra un capitolo e l'altro (e tende, raggi, ombre d'ulivo).
// Attenzione: con il sole così basso i muri fanno ombra; tra az 258 e 268 la
// luce passa dall'arco centrale del lato destro e prende tutta la statua.
const G = { goboAz: 262, goboEl: 16 };
export const ATMOSPHERES = [
  { at: 'hero:0', sun: { az: 264, el: 10, intensity: 3.2, color: '#ffc896' }, sky: { zenith: '#8494c0', horizon: '#f6c9a2', sea: '#4f6a95' },
    ambient: 0.42, fill: 0.26, fog: 0.008, mist: 0.08, gobo: 0.45, ...G, curtains: { open: 0.55, wind: 0.34 }, beams: 0.75, moon: 0 },
  { at: 'valoracion:0.5', sun: { az: 262, el: 9, intensity: 3.3, color: '#ffc491' }, sky: { zenith: '#8291bd', horizon: '#f6c59d', sea: '#4c6590' },
    ambient: 0.4, fill: 0.28, fog: 0.008, mist: 0.06, gobo: 0.55, ...G, curtains: { open: 0.7, wind: 0.4 }, beams: 0.8, moon: 0 },
  { at: 'precision:0.5', sun: { az: 260, el: 8.5, intensity: 3.3, color: '#ffc18d' }, sky: { zenith: '#7f8eba', horizon: '#f6c299', sea: '#4a628c' },
    ambient: 0.4, fill: 0.32, fog: 0.007, mist: 0.04, gobo: 0.75, ...G, curtains: { open: 0.85, wind: 0.45 }, beams: 0.8, moon: 0 },
  { at: 'precision:0.92', sun: { az: 264, el: 8, intensity: 3.2, color: '#ffc391' }, sky: { zenith: '#7f8eba', horizon: '#f6c299', sea: '#4a628c' },
    ambient: 0.44, fill: 0.4, fog: 0.007, mist: 0.03, gobo: 0.8, goboAz: 268, goboEl: 18, curtains: { open: 0.9, wind: 0.45 }, beams: 0.8, moon: 0 },
  // indice: il sole tocca il mare, luce più rosata, sorge la luna
  { at: 'menu:0.6', sun: { az: 258, el: 5, intensity: 3.0, color: '#ffb381' }, sky: { zenith: '#6f7dab', horizon: '#f5b68c', sea: '#435781' },
    ambient: 0.4, fill: 0.3, fog: 0.01, mist: 0.12, gobo: 0.2, ...G, curtains: { open: 0.9, wind: 0.32 }, beams: 0.9, moon: 0.55 },
  { at: 'doctor:0.45', sun: { az: 262, el: 6, intensity: 3.1, color: '#ffbb88' }, sky: { zenith: '#727fad', horizon: '#f5b98e', sea: '#455984' },
    ambient: 0.44, fill: 0.36, fog: 0.008, mist: 0.04, gobo: 0.6, ...G, curtains: { open: 0.85, wind: 0.4 }, beams: 0.8, moon: 0.45 },
  { at: 'procedimientos:0.3', sun: { az: 264, el: 6, intensity: 3.0, color: '#ffbb88' }, sky: { zenith: '#727fad', horizon: '#f5b98e', sea: '#455984' },
    ambient: 0.52, fill: 0.5, fog: 0.008, mist: 0.03, gobo: 0.35, ...G, curtains: { open: 0.85, wind: 0.35 }, beams: 0.75, moon: 0.4 },
];
