// Misure della scena (metri), condivise tra la pipeline degli asset (Node) e il runtime.
// Asse: x a destra, y in alto, z verso la telecamera iniziale. La telecamera avanza verso -z.
// Livello del mare: y = 0.

export const FLOOR_Y = 3.0; // pavimento interno e terrazza
export const CEIL_Y = 9.0; // intradosso del soffitto
export const ROOF_Y = 9.9; // estradosso della copertura

// Stanza interna (filo interno dei muri)
export const ROOM = { x0: -7.5, x1: 7.5, z0: -7.0, z1: 8.4 };
// Involucro esterno (muri laterali e muro di fondo)
export const SHELL = { x0: -8.1, x1: 8.1, z0: -7.8, z1: 8.4 };

// Muro frontale: lastra più larga e più alta del volume, spessore 0.6 m
export const FRONT_WALL = { x0: -10, x1: 10, y0: 0, y1: 11.5, zIn: 8.4, zOut: 9.0 };
export const WINDOW = { cx: 0, cy: 5.8, r: 2.4, segments: 128 };

// Grande apertura rettangolare nel muro di fondo
export const BACK_OPENING = { x0: -3.5, x1: 3.5, y0: FLOOR_Y, y1: 7.6 };

// Conversation pit: quadrato con angoli arrotondati, due gradoni + fondo
export const PIT = {
  cx: 0,
  cz: 0.4,
  half: 3.6, // semi-lato al filo del pavimento
  r: 1.5, // raggio d'angolo al filo del pavimento
  ring1: { inset: 0.45, y: 2.62 }, // primo gradino
  ring2: { inset: 1.2, y: 2.18 }, // seduta (cuscini)
  floorY: 1.9,
  cornerSegments: 20,
};

// Lucernario circolare sopra il pit
export const SKYLIGHT = { cx: 0, cz: 0.4, r: 1.3, y0: CEIL_Y, y1: ROOF_Y, segments: 96 };

// Terrazza a sbalzo sul mare
export const TERRACE = { x0: -24, x1: 8.1, z0: -19.8, z1: -7.8, y: FLOOR_Y, bottom: 1.8 };

function dirFromAzEl(azDeg, elDeg) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  // azimut 0 = verso -z (avanti), negativo = verso sinistra (-x)
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Sole esterno: basso sul mare, da sinistra (luce radente sulla facciata, riflessi sul mare)
export const SUN_EXT = { dir: dirFromAzEl(-100, 12), color: '#FFE6CC', intensity: 1.0, angularRadius: 0.0047 };
// Sole che entra dal lucernario: alto, arriva dal lato della finestra e cade sul lato opposto del pit
export const SUN_INT = { dir: normalize([-0.1, 1, 0.34]), color: '#FFF1E0', intensity: 0.82, angularRadius: 0.0047 };

// Codifica della lightmap: rgb = irradianza indiretta / LM_EMAX (curva sRGB), a = visibilità del sole
export const LM_EMAX = 1.2;

// Palette
export const PALETTE = {
  concreteLight: '#D4A39C',
  concreteShadow: '#B98580',
  concreteHigh: '#E8C4BE',
  cushion: '#B8F03A',
  seaNear: '#7FA9B8',
  seaFar: '#4E7F92',
  skyLow: '#F2D3CC',
  skyHigh: '#BFD3DC',
  loader: '#D9A5A0',
};
