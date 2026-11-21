// =============================================================================
//  optimize-model.mjs — dalla scansione originale ai modelli del sito
// =============================================================================
//
//  npm run models                 (legge models-src/statue.glb)
//  npm run models -- altro.glb    (oppure un percorso a scelta)
//
//  Sorgente: "statue of a young woman" di lubenko (Sketchfab, CC-BY 4.0),
//  ~1,5 milioni di triangoli in 17 pezzi, con colori e texture della scansione.
//
//  Cosa fa, in ordine:
//   1. unisce i 17 pezzi in una sola mesh nello spazio del mondo (solo POSITION:
//      texture, UV e colori vengono scartati, il marmo è uno shader del sito)
//   2. weld (gltf-transform): fonde i vertici duplicati, così la mesh è connessa
//   3. ruota la statua (lei guarda verso +Z) e la centra sul blocco-sedile
//   4. pulizia: taglio con un piano sotto il sedile, via i blocchi del basamento
//      ai lati e il terreno, poi via i pezzetti scollegati (componenti piccole)
//   5. allunga di poco la base del sedile fino a terra (sotto il piede più basso):
//      sotto il taglio le pareti del sedile erano coperte dai blocchi laterali
//   6. normalizza: pavimento a y = 0, altezza totale = MODEL_HEIGHT, centrata in x/z
//   7. simplify (meshoptimizer) in più passate con densità diverse: il sedile
//      (pietra grezza) è più leggero, viso e mani sono più densi del resto
//   8. separa "figure" e "seat" in due mesh e comprime con Draco
//
//  Uscita in public/models/:
//   statue-desktop.glb (~300k triangoli), statue-mobile.glb (~120k triangoli)
//   I dati utili al sito (box del sedile, piano della seduta, scala) sono negli
//   "extras" del nodo radice: three.js li mette in object.userData.
//
//  Tutte le misure "SRC" sono nelle unità della scansione, nel sistema già ruotato
//  e centrato sul sedile (vedi passo 3). Le ho misurate con sezioni orizzontali
//  e laterali della scansione.
// =============================================================================

import { existsSync, statSync } from 'node:fs';
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { weld, draco, prune, compactPrimitive, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { Matrix4, Vector3 } from 'three';

// ----------------------------------------------------------------------------
//  Configurazione
// ----------------------------------------------------------------------------
const OUT_DIR = 'public/models';
const TARGETS = { desktop: 300_000, mobile: 120_000 }; // triangoli
const MODEL_HEIGHT = 2; // altezza finale (pavimento → testa) in unità della scena

const SRC = {
  // centro del blocco-sedile nel mondo della scansione (x, z), prima della rotazione
  seatCenterWorld: [0.145, 3.54],
  // rotazione attorno a Y: allinea il lato lungo del sedile a Z, lei guarda verso +Z
  yawDeg: 166.2,
  // metà larghezza (x) e metà lunghezza (z) del sedile
  seatHalf: [1.0, 2.05],
  // piano della seduta (in pendenza): y = topA + topB * z
  seatTop: [0.5, -0.148],
  // i blocchi del basamento arrivano a y ≈ -0.45: tagliamo il sedile appena sopra
  cutY: -0.4,
  // il piede più basso arriva a y ≈ -0.55: il pavimento va un po' più giù
  floorY: -0.66,
  // da questa quota in giù le pareti del sedile vengono allungate fino al pavimento
  stretchFromY: -0.1,
};

// Zone a densità maggiore, in coordinate relative al bounding box finale
// (0..1 su x, y, z) e raggio in frazioni dell'altezza. density = quante volte
// più triangoli rispetto al resto del corpo.
const DETAIL_REGIONS = [
  { name: 'viso', center: [0.62, 0.845, 0.4], radius: 0.075, density: 3.2 },
  { name: 'mano destra', center: [0.45, 0.41, 0.05], radius: 0.055, density: 2.6 },
  { name: 'mano sinistra', center: [0.56, 0.44, 0.62], radius: 0.055, density: 2.6 },
];
const SEAT_DENSITY = 0.45; // il sedile è pietra grezza: basta meno geometria

// ----------------------------------------------------------------------------
const log = (...a) => console.log('[models]', ...a);
const argSrc = process.argv[2];
const SOURCE = argSrc || ['models-src/statue.glb', 'public/models/statue.glb'].find((p) => existsSync(p));
if (!SOURCE || !existsSync(SOURCE)) {
  console.error('Modello sorgente non trovato. Mettilo in models-src/statue.glb (vedi README).');
  process.exit(1);
}

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

// ---------------------------------------------------------------------------
// 1. Unione dei pezzi in spazio mondo + 3. rotazione e centratura
// ---------------------------------------------------------------------------
log(`lettura ${SOURCE} (${(statSync(SOURCE).size / 1e6).toFixed(1)} MB)`);
const src = await io.read(SOURCE);

const yaw = (SRC.yawDeg * Math.PI) / 180;
const toLocal = new Matrix4()
  .makeRotationY(yaw)
  .multiply(new Matrix4().makeTranslation(-SRC.seatCenterWorld[0], 0, -SRC.seatCenterWorld[1]));

const chunks = [];
let vertexTotal = 0;
let indexTotal = 0;
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(toLocal);
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices().getArray();
    const out = new Float32Array(pos.length);
    const v = new Vector3();
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m);
      out[i] = v.x;
      out[i + 1] = v.y;
      out[i + 2] = v.z;
    }
    chunks.push({ pos: out, idx, base: vertexTotal });
    vertexTotal += pos.length / 3;
    indexTotal += idx.length;
  }
}
const mergedPos = new Float32Array(vertexTotal * 3);
const mergedIdx = new Uint32Array(indexTotal);
{
  let o = 0;
  for (const c of chunks) {
    mergedPos.set(c.pos, c.base * 3);
    for (let k = 0; k < c.idx.length; k++) mergedIdx[o + k] = c.idx[k] + c.base;
    o += c.idx.length;
  }
}
log(`${chunks.length} pezzi, ${(indexTotal / 3).toLocaleString('it')} triangoli`);

// ---------------------------------------------------------------------------
// 2. weld
// ---------------------------------------------------------------------------
const doc = new Document();
const buffer = doc.createBuffer();
const prim = doc
  .createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(mergedPos).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(mergedIdx).setBuffer(buffer));
doc.createScene('statue').addChild(doc.createNode('statue').setMesh(doc.createMesh('statue').addPrimitive(prim)));
await doc.transform(weld());
log(`weld: ${prim.getAttribute('POSITION').getCount().toLocaleString('it')} vertici`);

// ---------------------------------------------------------------------------
// 4. Pulizia: piano di taglio, blocchi del basamento, terreno, componenti
// ---------------------------------------------------------------------------
const [hw, hl] = SRC.seatHalf;
const inSeatFootprint = (x, z, m = 0.04) => Math.abs(x) < hw + m && Math.abs(z) < hl + m;
const seatTopY = (z) => SRC.seatTop[0] + SRC.seatTop[1] * z;

{
  const P = prim.getAttribute('POSITION').getArray();
  const I = prim.getIndices().getArray();
  const keep = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const x = (P[a] + P[b] + P[c]) / 3;
    const y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
    const z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if (y < SRC.floorY + 0.02) continue; // terreno e tutto ciò che è sotto al pavimento
    if (inSeatFootprint(x, z) && y < SRC.cutY) continue; // sedile sotto il piano di taglio
    // blocchi del basamento: ai lati del sedile e più in basso della seduta
    if (!inSeatFootprint(x, z) && Math.abs(z) < hl + 0.3 && y < 0.05) continue;
    keep.push(I[t], I[t + 1], I[t + 2]);
  }
  // componenti connesse (union-find sui vertici): via i frammenti sparsi della scansione
  const parent = new Int32Array(P.length / 3).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t < keep.length; t += 3) {
    const r0 = find(keep[t]);
    parent[find(keep[t + 1])] = r0;
    parent[find(keep[t + 2])] = r0;
  }
  const size = new Map();
  for (let t = 0; t < keep.length; t += 3) {
    const r = find(keep[t]);
    size.set(r, (size.get(r) || 0) + 1);
  }
  const minTris = (keep.length / 3) * 0.005;
  const big = new Set([...size].filter(([, n]) => n >= minTris).map(([r]) => r));
  const final = [];
  for (let t = 0; t < keep.length; t += 3) if (big.has(find(keep[t]))) final.push(keep[t], keep[t + 1], keep[t + 2]);
  log(`pulizia: ${(final.length / 3).toLocaleString('it')} triangoli, ${big.size} componenti tenute su ${size.size}`);
  prim.getIndices().setArray(new Uint32Array(final));
  compactPrimitive(prim);
}

// ---------------------------------------------------------------------------
// 5. Base del sedile fino al pavimento + 6. normalizzazione
// ---------------------------------------------------------------------------
let meta;
{
  const P = prim.getAttribute('POSITION').getArray();
  const k = (SRC.floorY - SRC.stretchFromY) / (SRC.cutY - SRC.stretchFromY);
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1];
    if (y < SRC.stretchFromY && inSeatFootprint(P[i], P[i + 2], 0.08)) {
      P[i + 1] = Math.max(SRC.floorY, SRC.stretchFromY + (y - SRC.stretchFromY) * k);
    }
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3)
    for (let j = 0; j < 3; j++) {
      min[j] = Math.min(min[j], P[i + j]);
      max[j] = Math.max(max[j], P[i + j]);
    }
  const s = MODEL_HEIGHT / (max[1] - SRC.floorY);
  const off = [-(min[0] + max[0]) / 2, -SRC.floorY, -(min[2] + max[2]) / 2];
  for (let i = 0; i < P.length; i += 3) for (let j = 0; j < 3; j++) P[i + j] = (P[i + j] + off[j]) * s;
  const nx = (x) => (x + off[0]) * s;
  const nz = (z) => (z + off[2]) * s;
  const I = prim.getIndices().getArray();

  // --- Il sedile misurato sui dati (le misure SRC sono solo il punto di partenza) ---
  // Pareti: estensione dei vertici nella metà bassa del sedile, dove non c'è la figura
  // (i piedi stanno davanti al sedile, fuori dalla sua lunghezza).
  const prior = { x0: nx(-hw) - 0.08, x1: nx(hw) + 0.08, z0: nz(-hl) - 0.08, z1: nz(hl) + 0.08 };
  const xs = [], zs = [];
  for (let i = 0; i < P.length; i += 3) {
    const [x, y, z] = [P[i], P[i + 1], P[i + 2]];
    if (y > 0.02 && y < 0.2 && x > prior.x0 && x < prior.x1 && z > prior.z0 && z < prior.z1) {
      xs.push(x);
      zs.push(z);
    }
  }
  const pct = (arr, q) => arr.sort((a, b) => a - b)[Math.floor(q * (arr.length - 1))];
  const wall = { x0: pct(xs, 0.001), x1: pct(xs, 0.999), z0: pct(zs, 0.001), z1: pct(zs, 0.999) };
  // Seduta: piano y = a + b·x + c·z sui triangoli rivolti verso l'alto dentro al sedile,
  // stimato più volte scartando ciò che sta sopra (la figura) o molto sotto.
  const up = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const len = Math.hypot(...n);
    const x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    const inside = x > wall.x0 + 0.02 && x < wall.x1 - 0.02 && z > wall.z0 + 0.02 && z < wall.z1 - 0.02;
    if (len > 0 && n[1] / len > 0.9 && inside && y > 0.15) up.push([x, y, z]);
  }
  let plane = [0.5, 0, -0.15];
  let pts = up;
  for (let it = 0; it < 8; it++) {
    // minimi quadrati 3×3 (normal equations) per y = a + b x + c z
    const S = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
    for (const [x, y, z] of pts) {
      const r = [1, x, z];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j];
        S[i][3] += r[i] * y;
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = S[i][i];
      for (let j = i; j < 4; j++) S[i][j] /= p;
      for (let k2 = 0; k2 < 3; k2++) if (k2 !== i) {
        const f = S[k2][i];
        for (let j = i; j < 4; j++) S[k2][j] -= f * S[i][j];
      }
    }
    plane = [S[0][3], S[1][3], S[2][3]];
    const tol = it < 3 ? 0.06 : 0.012;
    pts = up.filter(([x, y, z]) => Math.abs(y - (plane[0] + plane[1] * x + plane[2] * z)) < tol);
  }
  log(`sedile: x ${wall.x0.toFixed(3)}…${wall.x1.toFixed(3)}  z ${wall.z0.toFixed(3)}…${wall.z1.toFixed(3)}  seduta y = ${plane.map((v) => v.toFixed(4)).join(' / ')} (${pts.length} punti)`);

  // dati per il sito, nelle unità finali
  const topAt = (x, z) => plane[0] + plane[1] * x + plane[2] * z;
  meta = {
    source: '"statue of a young woman" by lubenko (Sketchfab), CC-BY 4.0',
    height: MODEL_HEIGHT,
    bboxMin: [(min[0] + off[0]) * s, 0, (min[2] + off[2]) * s],
    bboxMax: [(max[0] + off[0]) * s, MODEL_HEIGHT, (max[2] + off[2]) * s],
    // box del sedile (pietra grezza) e piano della seduta: y = a + b·x + c·z
    seatMin: [wall.x0, 0, wall.z0],
    seatMax: [wall.x1, Math.max(topAt(wall.x0, wall.z0), topAt(wall.x1, wall.z0)), wall.z1],
    seatTop: plane,
  };
  log('bbox', meta.bboxMin.map((v) => v.toFixed(3)), meta.bboxMax.map((v) => v.toFixed(3)));
}
// Un punto appartiene al sedile se è dentro le sue pareti e sotto la seduta
const seatTopN = (x, z) => meta.seatTop[0] + meta.seatTop[1] * x + meta.seatTop[2] * z;
const isSeat = (x, y, z, m = 0.012) =>
  x > meta.seatMin[0] - 0.03 && x < meta.seatMax[0] + 0.03 && z > meta.seatMin[2] - 0.03 && z < meta.seatMax[2] + 0.03 && y < seatTopN(x, z) + m;

// ---------------------------------------------------------------------------
// 7. Semplificazione per zone
// ---------------------------------------------------------------------------
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true; // serve per simplifyWithAttributes (blocco dei vertici)

function classifyVertices(P) {
  // 0 = sedile, 1 = corpo, 2.. = zone di dettaglio
  const size = meta.bboxMax.map((v, i) => v - meta.bboxMin[i]);
  const regions = DETAIL_REGIONS.map((r) => ({
    c: r.center.map((u, i) => meta.bboxMin[i] + u * size[i]),
    r: r.radius * MODEL_HEIGHT,
  }));
  const cls = new Uint8Array(P.length / 3).fill(1);
  for (let v = 0; v < cls.length; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    if (isSeat(x, y, z)) {
      cls[v] = 0;
      continue;
    }
    regions.forEach((r, i) => {
      if (Math.hypot(x - r.c[0], y - r.c[1], z - r.c[2]) < r.r) cls[v] = 2 + i;
    });
  }
  return cls;
}

function simplifyByRegions(document, target) {
  const pr = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = pr.getAttribute('POSITION').getArray();
  let I = new Uint32Array(pr.getIndices().getArray());
  const cls = classifyVertices(P);
  const density = [SEAT_DENSITY, 1, ...DETAIL_REGIONS.map((r) => r.density)];
  // triangoli per classe (classe del primo vertice)
  const triCount = density.map(() => 0);
  for (let t = 0; t < I.length; t += 3) triCount[cls[I[t]]]++;
  const total = I.length / 3;
  // trova alpha tale che somma(min(n, n * densità * alpha)) = target
  let lo = 0, hi = 1;
  const sum = (a) => triCount.reduce((s, n, c) => s + Math.min(n, n * density[c] * a), 0);
  for (let it = 0; it < 50; it++) (sum((lo + hi) / 2) > target ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2));
  const want = triCount.map((n, c) => Math.min(n, Math.round(n * density[c] * lo)));
  // una passata per classe: si semplifica solo quella, gli altri vertici restano bloccati
  for (let c = 0; c < density.length; c++) {
    if (!triCount[c] || want[c] >= triCount[c]) continue;
    const lock = new Uint8Array(cls.length);
    for (let v = 0; v < cls.length; v++) lock[v] = cls[v] === c ? 0 : 1;
    const targetIndex = Math.max(0, I.length - (triCount[c] - want[c]) * 3);
    const [out] = MeshoptSimplifier.simplifyWithAttributes(I, P, 3, new Float32Array(cls.length), 1, [], lock, targetIndex - (targetIndex % 3), 1, []);
    I = out;
  }
  pr.getIndices().setArray(I);
  compactPrimitive(pr);
  const names = ['sedile', 'corpo', ...DETAIL_REGIONS.map((r) => r.name)];
  log(`  ${(I.length / 3).toLocaleString('it')} triangoli  (` + names.map((n, c) => `${n} ${want[c]}`).join(', ') + ')');
}

// ---------------------------------------------------------------------------
// 8. Figura e sedile separati + Draco
// ---------------------------------------------------------------------------
function splitFigureSeat(document) {
  const root = document.getRoot();
  const pr = root.listMeshes()[0].listPrimitives()[0];
  const P = pr.getAttribute('POSITION').getArray();
  const I = pr.getIndices().getArray();
  const fig = [], seat = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    (isSeat(x, y, z, 0.006) ? seat : fig).push(I[t], I[t + 1], I[t + 2]);
  }
  const buf = root.listBuffers()[0];
  const node = root.listNodes()[0];
  node.setMesh(null).setName('statue').setExtras(meta);
  for (const [name, idx] of [['figure', fig], ['seat', seat]]) {
    const p = document
      .createPrimitive()
      .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
      .setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf));
    compactPrimitive(p);
    node.addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(p)));
  }
  root.listMeshes()[0].dispose();
  log(`  figura ${(fig.length / 3).toLocaleString('it')} · sedile ${(seat.length / 3).toLocaleString('it')} triangoli`);
}

for (const [name, target] of Object.entries(TARGETS)) {
  log(`${name}: obiettivo ${target.toLocaleString('it')} triangoli`);
  const d = cloneDocument(doc);
  simplifyByRegions(d, target);
  splitFigureSeat(d);
  await d.transform(
    prune(),
    draco({ method: 'edgebreaker', quantizePosition: 14, encodeSpeed: 3, decodeSpeed: 5 })
  );
  const file = `${OUT_DIR}/statue-${name}.glb`;
  await io.write(file, d);
  log(`  → ${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)`);
}
log('meta', JSON.stringify(meta));
