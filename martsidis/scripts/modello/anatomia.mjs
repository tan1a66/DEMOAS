// Anatomia del bacino femminile, semplificata ma realistica nelle proporzioni.
// Ogni parte: { nome, sdf(x,y,z), min, max, passo, triangoli, pivot, rotazione }
// Sistema: Y in alto, +Z verso la pancia (anteriore), X laterale. 1 unità ≈ 10 cm.
import {
  smin, smax, ssub, sfera, ellissoide, cono, toro, scatolaTonda, tubo,
  riferimento, riferimentoAssi, norm, cross, smoothstep,
} from './sdf.mjs';

// ———————————————————————————————— BACINO OSSEO ————————————————————————————————

// Ali iliache: guscio di un grande ellissoide, ritagliato (sopra lo stretto superiore, lontano dal sacro, dietro le spine anteriori).
const C_ALA = [0, 0.95, -0.14];
function alaIliaca(x, y, z) {
  const ax = Math.abs(x);
  const e = ellissoide(ax - C_ALA[0], y - C_ALA[1], z - C_ALA[2], 1.16, 0.74, 0.9);
  const spessore = 0.035 + 0.035 * smoothstep(1.15, 1.42, y); // cresta iliaca più spessa
  let d = Math.abs(e) - spessore;
  d = smax(d, 0.66 - y, 0.06); // sotto: continua nel corpo dell'ileo
  d = smax(d, 0.36 - ax, 0.05); // vicino al sacro: articolazione sacro-iliaca
  d = smax(d, z - 0.4, 0.06); // davanti: spina iliaca anteriore superiore
  d = smax(d, -z - 0.9, 0.06); // dietro
  return d;
}

// Sacro: 5 vertebre fuse lungo una curva, più il coccige che si piega in avanti.
const SEGMENTI_SACRO = [
  // [y, z, mezzaLarghezza, mezzoSpessore, inclinazione]
  [1.04, -0.6, 0.4, 0.11, 0.55],
  [0.9, -0.69, 0.34, 0.1, 0.45],
  [0.76, -0.76, 0.27, 0.09, 0.3],
  [0.63, -0.8, 0.2, 0.075, 0.12],
  [0.51, -0.81, 0.14, 0.065, -0.05],
].map(([y, z, w, t, a]) => ({ y, z, w, t, rif: riferimento(0, y, z, a, 0, 0) }));
const COCCIGE = [
  [0, 0.42, -0.8, 0.045],
  [0, 0.34, -0.77, 0.04],
  [0, 0.27, -0.73, 0.033],
  [0, 0.21, -0.68, 0.026],
];
function sacro(x, y, z) {
  let d = 1e9;
  for (const s of SEGMENTI_SACRO) {
    const [lx, ly, lz] = s.rif.locale(x, y, z);
    d = smin(d, scatolaTonda(lx, ly, lz, s.w, 0.075, s.t, 0.05), 0.035);
  }
  // fori sacrali anteriori (piccole fossette)
  for (let i = 0; i < 4; i++) {
    const s = SEGMENTI_SACRO[i];
    for (const lato of [-1, 1]) d = ssub(d, sfera(x - lato * s.w * 0.42, y - s.y + 0.05, z - (s.z + s.t + 0.03), 0.04), 0.02);
  }
  d = smin(d, tubo(x, y, z, COCCIGE, 0.02), 0.03);
  return d;
}

// Anello dello stretto superiore (linea arcuata), leggermente ovale e inclinato in avanti.
const RIF_STRETTO = riferimento(0, 0.62, -0.05, 0.42, 0, 0);
function strettoSuperiore(x, y, z) {
  const [lx, ly, lz] = RIF_STRETTO.locale(x, y, z);
  return toro(lx / 1.08, ly, lz, 0.6, 0.04);
}

// Osso dell'anca, parte bassa: anello del forame otturatorio, tuberosità ischiatica, acetabolo, pube.
function assiOtturatorio(lato) {
  const n = norm([lato * 0.78, -0.12, 0.62]);
  const ux = norm(cross([0, 1, 0], n));
  const uz = cross(ux, n);
  return riferimentoAssi(lato * 0.5, 0.17, 0.33, ux, n, uz);
}
const OTTURATORI = { [-1]: assiOtturatorio(-1), [1]: assiOtturatorio(1) };
function ossoAnca(x, y, z) {
  const lato = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const [lx, ly, lz] = OTTURATORI[lato].locale(x, y, z);
  let d = toro(lx / 1.15, ly, lz / 0.85, 0.18, 0.055); // anello attorno al forame otturatorio
  d = smin(d, ellissoide(ax - 0.5, y + 0.01, z - 0.12, 0.1, 0.14, 0.13), 0.07); // tuberosità ischiatica
  d = smin(d, cono(ax, y, z, 0.47, 0.06, 0.12, 0.4, 0.3, -0.14, 0.07, 0.035), 0.05); // spina ischiatica
  // acetabolo: massa ossea con la cavità rivolta in fuori
  let acetabolo = ellissoide(ax - 0.84, y - 0.42, z - 0.2, 0.19, 0.2, 0.2);
  acetabolo = ssub(acetabolo, sfera(ax - 1.02, y - 0.43, z - 0.24, 0.16), 0.02);
  d = smin(d, acetabolo, 0.08);
  d = smin(d, cono(ax, y, z, 0.6, 0.3, 0.32, 0.8, 0.43, 0.24, 0.06, 0.09), 0.05); // ramo pubico superiore
  d = smin(d, cono(ax, y, z, 0.93, 0.86, 0.08, 0.85, 0.5, 0.18, 0.11, 0.13), 0.06); // corpo dell'ileo
  return d;
}
// Sinfisi pubica e corpi del pube
function pube(x, y, z) {
  return scatolaTonda(x, y - 0.21, z - 0.53, 0.28, 0.1, 0.055, 0.05);
}

export function bacino(x, y, z) {
  let d = alaIliaca(x, y, z);
  d = smin(d, ossoAnca(x, y, z), 0.06);
  d = smin(d, pube(x, y, z), 0.06);
  d = smin(d, strettoSuperiore(x, y, z), 0.05);
  d = smin(d, sacro(x, y, z), 0.05);
  return d;
}

// ———————————————————————————————— ORGANI ————————————————————————————————

export function vescica(x, y, z) {
  let d = ellissoide(x, y - 0.46, z - 0.37, 0.27, 0.22, 0.24);
  d = smin(d, cono(x, y, z, 0, 0.3, 0.42, 0, 0.2, 0.44, 0.09, 0.045), 0.06); // collo
  d = smin(d, cono(x, y, z, 0, 0.21, 0.44, 0, -0.17, 0.5, 0.034, 0.03), 0.02); // uretra
  // ureteri: dalla parete posteriore verso i reni
  for (const l of [-1, 1]) {
    d = smin(d, tubo(x, y, z, [
      [l * 0.12, 0.42, 0.2, 0.019],
      [l * 0.3, 0.58, -0.05, 0.018],
      [l * 0.42, 0.92, -0.3, 0.018],
      [l * 0.43, 1.32, -0.36, 0.017],
    ], 0.02), 0.03);
  }
  return d;
}

// Utero (coordinate locali: asse lungo Y, fondo in alto), con tube e ovaie. Il nodo lo ruota in antiversione.
export const UTERO_PIVOT = [0, 0.6, 0.0];
export const UTERO_ROT_X = 0.85;
export function uteroLocale(x, y, z) {
  let d = ellissoide(x, y - 0.17, z, 0.2, 0.15, 0.125); // fondo
  d = smin(d, ellissoide(x, y - 0.01, z, 0.155, 0.17, 0.105), 0.08); // corpo
  d = smin(d, cono(x, y, z, 0, -0.12, 0, 0, -0.31, 0, 0.075, 0.062), 0.06); // collo dell'utero
  for (const l of [-1, 1]) {
    d = smin(d, tubo(x, y, z, [
      [l * 0.16, 0.2, 0, 0.022],
      [l * 0.32, 0.25, 0.02, 0.02],
      [l * 0.46, 0.21, -0.02, 0.024],
      [l * 0.54, 0.11, -0.06, 0.03],
    ], 0.02), 0.03);
    d = smin(d, ellissoide(x - l * 0.56, y - 0.05, z + 0.07, 0.05, 0.045, 0.04), 0.02); // fimbrie
    d = smin(d, ellissoide(x - l * 0.41, y - 0.03, z + 0.11, 0.075, 0.045, 0.04), 0.015); // ovaio
    d = smin(d, cono(x, y, z, l * 0.15, 0.12, -0.03, l * 0.35, 0.05, -0.09, 0.012, 0.012), 0.015); // legamento ovarico
  }
  return d;
}

export function vagina(x, y, z) {
  return tubo(x, y, z, [
    [0, 0.45, -0.2, 0.085],
    [0, 0.2, -0.05, 0.068],
    [0, -0.16, 0.15, 0.058],
  ], 0.04, 1.55);
}

export function retto(x, y, z) {
  return tubo(x, y, z, [
    [0.4, 1.34, -0.18, 0.085], // sigma (continua verso sinistra)
    [0.3, 1.16, -0.3, 0.095],
    [0.1, 0.98, -0.4, 0.105],
    [0, 0.8, -0.46, 0.12],
    [0, 0.6, -0.5, 0.145], // ampolla rettale
    [0, 0.4, -0.47, 0.14],
    [0, 0.22, -0.39, 0.1],
    [0, 0.09, -0.34, 0.065], // giunzione ano-rettale (avvolta dal muscolo pubo-rettale)
    [0, -0.15, -0.45, 0.055], // canale anale
  ], 0.05);
}

// ———————————————————————————— PAVIMENTO PELVICO (parametrico) ————————————————————————————
// Imbuto muscolare (elevatore dell'ano) tra pube, pareti laterali e coccige, con lo iato centrale.
// Topologia fissa → morph target: cedimento, iato (allargamento), tensione.

function puntoPavimento(theta, v, p) {
  const s = Math.sin(theta), c = Math.cos(theta);
  // bordo esterno (inserzioni)
  const rz = s > 0 ? 0.5 : 0.66;
  const R = [0.6 * c, 0.37 - 0.17 * Math.max(s, 0) - 0.08 * Math.max(-s, 0), rz * s - 0.02];
  // bordo dello iato
  const hx = 0.11 * p.iato;
  const hz = (s > 0 ? 0.47 : 0.4) * (1 + (p.iato - 1) * 0.25);
  const H = [hx * c, 0.07 - 0.03 * Math.max(-s, 0) + p.alza, hz * s + 0.04];
  const t = Math.pow(v, 0.85);
  const y = H[1] + (R[1] - H[1]) * Math.pow(v, 0.7) - p.cedimento * Math.pow(1 - v, 1.3);
  return [H[0] + (R[0] - H[0]) * t, y, H[2] + (R[2] - H[2]) * t];
}

export function pavimento() {
  const NT = 112, NV = 16, SP = 0.022;
  const base = { iato: 1, cedimento: 0, alza: 0 };
  const varianti = {
    cedimento: { iato: 1.35, cedimento: 0.26, alza: 0 },
    iato: { iato: 2.1, cedimento: 0.06, alza: 0 },
    tensione: { iato: 0.72, cedimento: -0.07, alza: 0.05 },
  };
  // griglia di superficie media + normali approssimate → due strati (sopra/sotto) + bordi
  const superficie = (p) => {
    const pts = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NT; i++) pts.push(puntoPavimento((i / NT) * Math.PI * 2, j / NV, p));
    return pts;
  };
  const normali = (pts) => {
    const n = [];
    for (let j = 0; j <= NV; j++)
      for (let i = 0; i < NT; i++) {
        const a = pts[j * NT + ((i + 1) % NT)], b = pts[j * NT + ((i - 1 + NT) % NT)];
        const c = pts[Math.min(j + 1, NV) * NT + i], d = pts[Math.max(j - 1, 0) * NT + i];
        const tu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const tv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
        n.push(norm(cross(tv, tu)));
      }
    return n;
  };
  const costruisci = (p) => {
    const pts = superficie(p);
    const nn = normali(pts);
    const pos = [];
    for (const lato of [1, -1])
      for (let k = 0; k < pts.length; k++) {
        const q = pts[k], n = nn[k];
        // più spesso verso il centro (fasci muscolari), più sottile alle inserzioni
        const v = Math.floor(k / NT) / NV;
        const sp = SP * (1.25 - 0.5 * v);
        pos.push(q[0] + n[0] * sp * lato, q[1] + n[1] * sp * lato, q[2] + n[2] * sp * lato);
      }
    return pos;
  };
  const posBase = costruisci(base);
  const indici = [];
  const off = (NV + 1) * NT;
  for (let j = 0; j < NV; j++)
    for (let i = 0; i < NT; i++) {
      const a = j * NT + i, b = j * NT + ((i + 1) % NT), c = (j + 1) * NT + ((i + 1) % NT), d = (j + 1) * NT + i;
      indici.push(a, b, c, a, c, d); // sopra
      indici.push(off + a, off + c, off + b, off + a, off + d, off + c); // sotto
    }
  for (const j of [0, NV]) // bordi (iato e inserzioni)
    for (let i = 0; i < NT; i++) {
      const a = j * NT + i, b = j * NT + ((i + 1) % NT);
      if (j === 0) indici.push(a, off + b, b, a, off + a, off + b);
      else indici.push(a, b, off + b, a, off + b, off + a);
    }
  // UV: u = distanza dallo iato (fibre concentriche), v = giro
  const uv = [];
  for (let l = 0; l < 2; l++) for (let j = 0; j <= NV; j++) for (let i = 0; i < NT; i++) uv.push(j / NV, i / NT);
  const targets = Object.entries(varianti).map(([nome, p]) => {
    const pos = costruisci(p);
    return { nome, delta: Float32Array.from(pos, (v, i) => v - posBase[i]) };
  });
  return { posizioni: new Float32Array(posBase), indici: new Uint32Array(indici), uv: new Float32Array(uv), targets };
}

// ———————————————————————————————— ELENCO PARTI ————————————————————————————————

const RIF_UTERO = riferimento(...UTERO_PIVOT, UTERO_ROT_X, 0, 0);

export const PARTI = [
  { nome: 'bacino', sdf: bacino, min: [-1.42, -0.2, -1.0], max: [1.42, 1.62, 0.72], passo: 0.017, triangoli: 26000 },
  { nome: 'vescica', sdf: vescica, min: [-0.5, -0.24, -0.45], max: [0.5, 1.4, 0.68], passo: 0.012, triangoli: 5200 },
  {
    nome: 'utero',
    // generato in coordinate locali: il nodo applica posizione e antiversione
    sdf: uteroLocale,
    min: [-0.66, -0.42, -0.24],
    max: [0.66, 0.38, 0.22],
    passo: 0.01,
    triangoli: 6000,
    pivot: UTERO_PIVOT,
    rotazioneX: UTERO_ROT_X,
  },
  { nome: 'vagina', sdf: vagina, min: [-0.2, -0.25, -0.32], max: [0.2, 0.58, 0.26], passo: 0.012, triangoli: 1800 },
  { nome: 'retto', sdf: retto, min: [-0.22, -0.25, -0.72], max: [0.55, 1.46, -0.05], passo: 0.012, triangoli: 4200 },
];

/** Ancore per etichette e frecce (coordinate di mondo; il generatore le converte nei nodi). */
export const ANCORE = {
  vescica: { etichetta_vescica: [0, 0.74, 0.4], rif_pressione: [0, 1.05, 0.38], rif_uretra: [0, -0.22, 0.51] },
  utero: { etichetta_utero: [0, 0.36, 0.0] }, // locali al nodo utero
  retto: { etichetta_retto: [0.4, 1.46, -0.18] },
  vagina: { etichetta_vagina: [0, -0.1, 0.13] },
  pavimento: { etichetta_pavimento: [0.42, 0.16, -0.26], rif_amaca: [0, 0.06, 0.04] },
  bacino: { etichetta_bacino: [1.08, 1.32, 0.12] },
};
export { RIF_UTERO };
