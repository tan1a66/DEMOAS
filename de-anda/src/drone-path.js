// =============================================================================
//  drone-path.js — il percorso del drone e le luci, legati allo scroll
// =============================================================================
//
//  Ogni tappa dice DOVE si trova il drone in un certo punto dello scroll.
//  Tra una tappa e l'altra la camera scorre su una curva morbida
//  (CatmullRomCurve3 per la posizione, una seconda curva per il punto guardato).
//  In modalità ?debug il percorso è disegnato nella scena (tasto O: vista dall'alto).
//
//  at:      punto dello scroll, 'capitolo:avanzamento' (0..1 dentro al capitolo)
//           capitoli: hero, valoracion, precision, doctor, procedimientos, final
//  target:  punto guardato [x, y, z]. La statua è alta 2, il pavimento è a y = 0,
//           lei guarda verso +z. Punti utili:
//             viso [0.1, 1.69, -0.45]   busto [0, 1.25, -0.5]   vita [0, 0.95, -0.42]
//             schiena [0, 1.3, -0.85]   centro di tutto [0, 0.9, 0]
//  az:      gradi attorno al punto guardato (0 = davanti a lei, 90 = suo fianco
//           sinistro, 180 = dietro, 270 = fianco destro). Si può superare 360
//           per continuare a girare nello stesso verso.
//  el:      gradi di elevazione (positivo = dall'alto)
//  dist:    distanza dal punto guardato
//  shift:   spostamento dell'inquadratura [x, y] in frazioni di mezzo schermo:
//           [0.25, 0] = statua spostata a destra (testo a sinistra)
//  dof:     profondità di campo 0..1 (solo primi piani: costa)
//  fov:     apertura verticale in gradi (facoltativo)
//  rm:      true = inquadratura fissa del capitolo con prefers-reduced-motion
//           (se manca: la prima tappa per l'apertura, l'ultima per gli altri)
//  mobile:  campi da cambiare su telefono (schermo verticale). Se manca, su
//           telefono la distanza è moltiplicata per MOBILE.distScale e la statua
//           va in alto (MOBILE.shift).
// =============================================================================

export const DESKTOP = { fov: 32 };
export const MOBILE = { fov: 42, distScale: 1.6, shift: [0, 0.2] };

// Oscillazione naturale del drone (micro-drift): ampiezza in frazioni della distanza
export const DRIFT = { position: 0.012, target: 0.006, speed: 0.16 };
// Movimento lento all'apertura anche senza scroll (gradi di oscillazione)
export const IDLE = { az: 4, el: 1.5, speed: 0.07 };
// Smorzamento: più alto = la camera segue lo scroll più da vicino
export const DAMPING = 3.2;

export const PATH = [
  // 0 · Apertura: lontano e alto, il blocco piccolo nello spazio avorio
  { at: 'hero:0', target: [0, 0.85, 0], az: 34, el: 22, dist: 14, shift: [0.25, -0.02],
    mobile: { dist: 24, el: 20, shift: [0, 0.18] } },
  { at: 'hero:0.9', target: [0, 0.9, -0.05], az: 40, el: 20, dist: 11.5, shift: [0.24, -0.01],
    mobile: { dist: 20, shift: [0, 0.2] } },

  // 1 · 01 La valoración: scende, si avvicina e gira di ~90° mentre si scolpisce
  { at: 'valoracion:0.35', target: [0, 0.98, -0.15], az: 62, el: 16, dist: 11, shift: [0.34, 0],
    mobile: { dist: 14 } },
  { at: 'valoracion:0.7', target: [0.04, 1.05, -0.28], az: 94, el: 13, dist: 9.2, shift: [0.37, 0], rm: true,
    mobile: { dist: 10.5 } },
  { at: 'valoracion:1', target: [0.08, 1.14, -0.38], az: 122, el: 15, dist: 5.2, shift: [0.2, 0],
    mobile: { dist: 7.2 } },

  // 2 · 02 La precisión: da vicino, dietro la spalla, lungo la schiena, di nuovo davanti
  { at: 'precision:0.13', target: [0.08, 1.08, -0.25], az: 152, el: 30, dist: 2.45, shift: [0.06, 0],
    mobile: { dist: 3.8, shift: [0, 0.12] } },
  { at: 'precision:0.29', target: [0, 1.25, -0.8], az: 196, el: 15, dist: 2.3, shift: [0.04, 0],
    mobile: { dist: 3.6, shift: [0, 0.1] } },
  { at: 'precision:0.44', target: [-0.05, 1.2, -0.6], az: 250, el: 8, dist: 2.7, shift: [0.06, 0],
    mobile: { dist: 4.2, shift: [0, 0.12] } },
  { at: 'precision:0.6', target: [0.05, 1.42, -0.45], az: 316, el: 4, dist: 2.25, shift: [0.12, 0],
    mobile: { dist: 3.4 } },
  { at: 'precision:0.75', target: [0.06, 1.58, -0.5], az: 356, el: 10, dist: 2.5, shift: [0.26, -0.02], dof: 0.5,
    mobile: { dist: 3.4 } },
  // primo piano del viso chino: il momento dello slogan
  { at: 'precision:0.9', target: [0.07, 1.62, -0.5], az: 382, el: 15, dist: 1.95, shift: [0.3, -0.05], dof: 1,
    mobile: { dist: 2.7, shift: [0, 0.2] } },
  { at: 'precision:1', target: [0.07, 1.62, -0.5], az: 386, el: 16, dist: 2.02, shift: [0.3, -0.05], dof: 1,
    mobile: { dist: 2.8, shift: [0, 0.2] } },

  // 3 · 03 El doctor: si allontana, tre quarti a media distanza, statua a destra
  { at: 'doctor:0.3', target: [0, 1.05, -0.3], az: 392, el: 10, dist: 5.4, shift: [0.3, 0],
    mobile: { dist: 7.6, shift: [0, 0.24] } },
  { at: 'doctor:0.85', target: [0, 1.05, -0.3], az: 400, el: 11, dist: 5.6, shift: [0.3, 0],
    mobile: { dist: 7.8, shift: [0, 0.24] } },

  // 4 · 04 Procedimientos: vista frontale (i voli verso le zone sono in config.js)
  { at: 'procedimientos:0.2', target: [0, 1.0, -0.2], az: 376, el: 8, dist: 5.4, shift: [0.27, 0],
    mobile: { dist: 8.2, shift: [0, 0.22] } },
  { at: 'procedimientos:0.9', target: [0, 1.0, -0.2], az: 376, el: 8, dist: 5.4, shift: [0.27, 0],
    mobile: { dist: 8.2, shift: [0, 0.22] } },

  // 5 · 05 Tu valoración: sale e si allontana, la statua al centro, luce calda
  { at: 'final:0.6', target: [0, 0.85, -0.1], az: 386, el: 20, dist: 11.5, shift: [0.04, 0.02],
    mobile: { dist: 14, shift: [0, 0.26] } },
  { at: 'final:1', target: [0, 0.85, -0.1], az: 392, el: 23, dist: 13, shift: [0.04, 0.02],
    mobile: { dist: 15.5, shift: [0, 0.26] } },
];

// =============================================================================
//  Luci: stessi punti dello scroll. Tra una tappa e l'altra i valori sfumano.
//  key:      luce principale laterale (az/el in gradi come sopra, intensità, colore)
//  rim:      controluce che stacca la statua dallo sfondo
//  ambient:  luce diffusa (cielo/terra)
//  backdrop: quanto è scura la sfumatura taupe dietro la statua (0..1)
//  shadow:   intensità dell'ombra a terra (facoltativo, 0.3 se manca)
// =============================================================================
export const LIGHTS = [
  { at: 'hero:0', key: { az: 58, el: 48, intensity: 2.8, color: '#fff7ef' }, rim: { intensity: 0.9 }, ambient: 0.95, backdrop: 0.55 },
  { at: 'valoracion:0.4', key: { az: 18, el: 26, intensity: 3.7, color: '#fff3e6' }, rim: { intensity: 1.5 }, ambient: 0.55, backdrop: 0.78 },
  { at: 'precision:0.35', key: { az: 120, el: 34, intensity: 3.4, color: '#fff4ea' }, rim: { intensity: 1.7 }, ambient: 0.52, backdrop: 0.85 },
  { at: 'precision:0.62', key: { az: 250, el: 32, intensity: 3.2, color: '#fff4ea' }, rim: { intensity: 1.4 }, ambient: 0.6, backdrop: 0.78 },
  { at: 'precision:0.9', key: { az: 330, el: 44, intensity: 3.3, color: '#fff6ee' }, rim: { intensity: 1.6 }, ambient: 0.62, backdrop: 0.8 },
  { at: 'doctor:0.4', key: { az: 52, el: 46, intensity: 2.7, color: '#fff7f0' }, rim: { intensity: 1.0 }, ambient: 0.9, backdrop: 0.58 },
  { at: 'procedimientos:0.3', key: { az: 38, el: 44, intensity: 2.8, color: '#fff7f0' }, rim: { intensity: 1.0 }, ambient: 0.9, backdrop: 0.56 },
  { at: 'final:0.7', key: { az: 64, el: 30, intensity: 3.3, color: '#ffebd4' }, rim: { intensity: 1.5 }, ambient: 0.7, backdrop: 0.66, shadow: 0.2 },
];
