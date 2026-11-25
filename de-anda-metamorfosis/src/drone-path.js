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
//           capitoli: hero, valoracion, precision, doctor, procedimientos, final
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
//  mobile:  campi da cambiare su telefono (schermo verticale). Se manca, su
//           telefono la distanza è moltiplicata per MOBILE.distScale e la statua
//           va in alto (MOBILE.shift).
//
//  Il tempio: piattaforma da z = -8.6 a z = 9.4, muri a x = ±7.5 e z = -8.2.
//  Dentro al cortile la camera deve restare entro |x| < 6.5 e z > -7.5.
// =============================================================================

export const DESKTOP = { fov: 32 };
export const MOBILE = { fov: 42, distScale: 1.55, shift: [0, 0.2] };

// Oscillazione naturale del drone (micro-drift): ampiezza in frazioni della distanza
export const DRIFT = { position: 0.01, target: 0.005, speed: 0.16 };
// Movimento lento all'apertura anche senza scroll (gradi di oscillazione)
export const IDLE = { az: 3, el: 1.2, speed: 0.06 };
// Smorzamento: più alto = la camera segue lo scroll più da vicino
export const DAMPING = 3.2;

export const PATH = [
  // 0 · Apertura, all'alba: lontano e alto, il tempio nella nebbia sopra le nuvole
  { at: 'hero:0', target: [0, 1.6, 0], az: 12, el: 11, dist: 25, shift: [0.2, -0.04],
    mobile: { dist: 38, el: 10, shift: [0, 0.14] } },
  { at: 'hero:0.9', target: [0, 1.65, 0], az: 15, el: 10, dist: 18, shift: [0.24, -0.02],
    mobile: { dist: 27 } },

  // 1 · 01 La valoración: entra nel cortile, scende e gira di ~90°, sale il sole
  { at: 'valoracion:0.35', target: [0, 1.7, 0], az: 18, el: 9, dist: 10.5, shift: [0.27, 0],
    mobile: { dist: 15 } },
  { at: 'valoracion:0.7', target: [0, 1.8, 0], az: 50, el: 8, dist: 6.3, shift: [0.29, 0], rm: true,
    mobile: { dist: 6.4, el: 10 } },
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

  // 3 · 03 El doctor: si allontana, tre quarti a media distanza, statua a destra
  { at: 'doctor:0.3', target: [0, 1.75, 0], az: 330, el: 8, dist: 5.6, shift: [0.3, 0],
    mobile: { dist: 7.4, shift: [0, 0.24] } },
  { at: 'doctor:0.85', target: [0, 1.75, 0], az: 324, el: 9, dist: 5.8, shift: [0.3, 0],
    mobile: { dist: 7.6, shift: [0, 0.24] } },

  // 4 · 04 Procedimientos: vista frontale (i voli verso le zone sono in config.js)
  { at: 'procedimientos:0.2', target: [0, 1.85, 0], az: 352, el: 6, dist: 4.6, shift: [0.27, 0],
    mobile: { dist: 6.6, shift: [0, 0.22] } },
  { at: 'procedimientos:0.9', target: [0, 1.85, 0], az: 352, el: 6, dist: 4.6, shift: [0.27, 0],
    mobile: { dist: 6.6, shift: [0, 0.22] } },

  // 5 · 05 Tu valoración: sale e si allontana, il tempio al tramonto, la luna
  { at: 'final:0.6', target: [0, 1.5, 0], az: 362, el: 15, dist: 16, shift: [0.06, 0.02],
    mobile: { dist: 24, shift: [0, 0.24] } },
  { at: 'final:1', target: [0, 1.5, 0], az: 366, el: 18, dist: 19, shift: [0.06, 0.02],
    mobile: { dist: 28, shift: [0, 0.24] } },
];

// =============================================================================
//  Atmosfere: stessi punti dello scroll; tra una tappa e l'altra i valori sfumano.
//  sun:      sole (az/el in gradi come sopra: 180 = dietro al tempio), intensità, colore
//  sky:      colore dello zenit e dell'orizzonte
//  ambient:  luce diffusa; fill: luce morbida dal lato della camera
//  fog:      densità della foschia; mist: nebbia bassa sul pavimento (0..1)
//  gobo:     ombre di foglie d'ulivo sulla statua (0..1); goboAz/goboEl: da dove
//  curtains: open = quanto sono raccolte (0..1), wind = vento
//  beams:    raggi di luce dagli archi (0..1); moon: luna (0..1)
// =============================================================================
const G = { goboAz: -40, goboEl: 42 };
export const ATMOSPHERES = [
  // alba velata: luce fredda e bassa, nebbia, tende chiuse, la luna che tramonta
  { at: 'hero:0', sun: { az: 200, el: 3, intensity: 0.7, color: '#ffd6c4' }, sky: { zenith: '#cdd6e2', horizon: '#efe4de' },
    ambient: 0.8, fill: 0.35, fog: 0.028, mist: 1, gobo: 0, ...G, curtains: { open: 0, wind: 0.22 }, beams: 0.15, moon: 0.55 },
  { at: 'valoracion:0.5', sun: { az: 196, el: 13, intensity: 2.0, color: '#ffe1c4' }, sky: { zenith: '#d5dee8', horizon: '#f3eae1' },
    ambient: 0.72, fill: 0.5, fog: 0.024, mist: 0.5, gobo: 0.35, ...G, curtains: { open: 0.4, wind: 0.4 }, beams: 0.8, moon: 0.15 },
  { at: 'precision:0.5', sun: { az: 192, el: 22, intensity: 2.6, color: '#ffeedb' }, sky: { zenith: '#d7e2ec', horizon: '#f5efe7' },
    ambient: 0.66, fill: 0.55, fog: 0.014, mist: 0.12, gobo: 0.75, ...G, curtains: { open: 0.85, wind: 0.45 }, beams: 1, moon: 0 },
  { at: 'precision:0.92', sun: { az: 200, el: 26, intensity: 2.6, color: '#fff0de' }, sky: { zenith: '#d7e2ec', horizon: '#f5efe7' },
    ambient: 0.7, fill: 0.7, fog: 0.012, mist: 0.08, gobo: 0.85, goboAz: -45, goboEl: 40, curtains: { open: 0.9, wind: 0.45 }, beams: 1, moon: 0 },
  { at: 'doctor:0.4', sun: { az: 195, el: 32, intensity: 2.5, color: '#fff2e3' }, sky: { zenith: '#d6e2ec', horizon: '#f5efe7' },
    ambient: 0.75, fill: 0.62, fog: 0.012, mist: 0.05, gobo: 0.5, ...G, curtains: { open: 0.85, wind: 0.4 }, beams: 0.8, moon: 0 },
  { at: 'procedimientos:0.3', sun: { az: 190, el: 34, intensity: 2.4, color: '#fff2e3' }, sky: { zenith: '#d6e2ec', horizon: '#f5efe7' },
    ambient: 0.8, fill: 0.78, fog: 0.012, mist: 0.04, gobo: 0.3, ...G, curtains: { open: 0.85, wind: 0.35 }, beams: 0.7, moon: 0 },
  // finale al tramonto: luce d'oro bassa, raggi lunghi, sorge la luna
  { at: 'final:0.7', sun: { az: 165, el: 6, intensity: 2.4, color: '#ffcb93' }, sky: { zenith: '#d4d2dc', horizon: '#f6dcc2' },
    ambient: 0.62, fill: 0.5, fog: 0.018, mist: 0.3, gobo: 0, ...G, curtains: { open: 0.9, wind: 0.32 }, beams: 1, moon: 0.7 },
];
