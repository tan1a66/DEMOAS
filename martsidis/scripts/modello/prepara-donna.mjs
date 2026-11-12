// Prepara la figura femminile generata con Meshy (GLB con texture, senza scheletro) per il modello del sito:
// semplificazione → maschera capelli/pelle presa dal colore della texture → allineamento all'apparato (il cavallo
// subito sotto il bacino, fianchi in proporzione) → articolazioni per la camminata. Scrive scripts/modello/donna.json,
// che genera-modello.mjs usa al posto della figura disegnata. Uso: node scripts/modello/prepara-donna.mjs <file.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

await MeshoptSimplifier.ready;
const [, , sorgente, triangoli = '26000'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(sorgente);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const ind = new Uint32Array(prim.getIndices().getArray());
const tex = prim.getMaterial().getBaseColorTexture();
const { data: px, info } = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });

// semplificazione (blocca le cuciture delle UV: i bordi restano chiusi)
const [semplici] = MeshoptSimplifier.simplify(ind, new Float32Array(pos), 3, Number(triangoli) * 3, 0.01, []);
const mappa = new Map();
const P = [], M = [];
const I = new Uint32Array(semplici.length);
for (let i = 0; i < semplici.length; i++) {
  const v = semplici[i];
  if (!mappa.has(v)) {
    mappa.set(v, P.length / 3);
    P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    // colore della texture in quel punto: i capelli sono scuri
    const u = Math.min(Math.max(uv[v * 2], 0), 1), w = Math.min(Math.max(uv[v * 2 + 1], 0), 1);
    const x = Math.round(u * (info.width - 1)), y = Math.round(w * (info.height - 1));
    const k = (y * info.width + x) * info.channels;
    const lum = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
    M.push(lum < 0.36 ? 1 : 0);
  }
  I[i] = mappa.get(v);
}
// la maschera dei capelli si ammorbidisce sui vicini (niente puntini isolati)
const vicini = Array.from({ length: P.length / 3 }, () => new Set());
for (let t = 0; t < I.length; t += 3) for (const [a, b] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) { vicini[a].add(b); vicini[b].add(a); }
let mask = M.slice();
for (let it = 0; it < 2; it++) mask = mask.map((m, v) => { let s = m, n = 1; for (const w of vicini[v]) { s += mask[w]; n++; } return s / n > 0.5 ? 1 : 0; });

// misure della figura (unità del modello)
const N = P.length / 3;
let yMin = Infinity, yMax = -Infinity;
for (let v = 0; v < N; v++) { yMin = Math.min(yMin, P[v * 3 + 1]); yMax = Math.max(yMax, P[v * 3 + 1]); }
const Hm = yMax - yMin;
const fascia = (y0, y1, filtro = () => true) => { const out = []; for (let v = 0; v < N; v++) { const y = P[v * 3 + 1]; if (y >= y0 && y <= y1 && !mask[v] && filtro(v)) out.push(v); } return out; };
// proporzioni anatomiche: donna di 168 cm (1 unità = 10 cm), il cavallo al 47% dell'altezza
const cavallo = yMin + Hm * 0.47;
// larghezza dei fianchi poco sopra il cavallo: il primo blocco continuo dal centro (le braccia sono staccate)
const fianchi = fascia(cavallo + Hm * 0.03, cavallo + Hm * 0.06);
const xs = fianchi.map((v) => Math.abs(P[v * 3])).sort((a, b) => a - b);
let semiFianchi = xs[0];
for (let i = 1; i < xs.length; i++) { if (xs[i] - xs[i - 1] > Hm * 0.01) break; semiFianchi = xs[i]; }
const zFianchi = fianchi.filter((v) => Math.abs(P[v * 3]) <= semiFianchi).reduce((s, v) => s + P[v * 3 + 2], 0) / fianchi.length;
// braccia: vertici più in fuori dei fianchi tra il cavallo e le spalle → asse del braccio (spalla → mano)
const braccio = (s) => {
  const pts = fascia(cavallo - Hm * 0.06, yMin + Hm * 0.8, (v) => s * P[v * 3] > semiFianchi * 1.12);
  pts.sort((a, b) => P[b * 3 + 1] - P[a * 3 + 1]);
  const media = (arr) => arr.reduce((acc, v) => [acc[0] + P[v * 3], acc[1] + P[v * 3 + 1], acc[2] + P[v * 3 + 2]], [0, 0, 0]).map((c) => c / arr.length);
  const alto = media(pts.slice(0, Math.max(5, Math.round(pts.length * 0.05))));
  const basso = media(pts.slice(-Math.max(5, Math.round(pts.length * 0.05))));
  return { alto, basso };
};
const bs = braccio(1);

// allineamento all'apparato: alta 16,8; il cavallo a y = -0,5; centro dei fianchi a z = -0,12
const S = 16.8 / Hm;
console.log('fianchi semilarghi (unità sito):', (semiFianchi * S).toFixed(2), '— il bacino osseo è 1,42');
const T = [0, -0.5 - cavallo * S, -0.12 - zFianchi * S];
const tr = (p) => [p[0] * S + T[0], p[1] * S + T[1], p[2] * S + T[2]];
const Pf = new Float32Array(P.length);
for (let v = 0; v < N; v++) { const q = tr([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]); Pf.set(q, v * 3); }
const piedi = yMin * S + T[1], testa = yMax * S + T[1];
// spalla: dove il braccio si stacca dal corpo, un po' più in alto e più dentro del punto più alto trovato
const spalla = tr(bs.alto);
const mano = tr(bs.basso);
const altezza = testa - piedi;
// la spalla (perno del braccio) è all'81% dell'altezza, appena dentro il punto dove il braccio si stacca
spalla[1] = piedi + altezza * 0.81;
spalla[0] = Math.max(spalla[0] - 0.2, 1.3);
const art = {
  anca: -0.5 + 0.8, // perno delle gambe poco sopra il cavallo
  ginocchio: piedi + altezza * 0.285,
  spalla,
  mano,
  collo: piedi + altezza * 0.845,
  vita: piedi + altezza * 0.62,
  piedi,
  testa,
};
console.log('altezza', altezza.toFixed(2), 'piedi', piedi.toFixed(2), 'testa', testa.toFixed(2), 'scala', S.toFixed(3));
console.log('articolazioni', JSON.stringify(art, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
console.log('vertici', N, 'triangoli', I.length / 3, 'capelli', mask.filter(Boolean).length);
await writeFile('scripts/modello/donna.json', JSON.stringify({ pos: Array.from(Pf, (x) => +x.toFixed(4)), ind: Array.from(I), capelli: mask, art }));
