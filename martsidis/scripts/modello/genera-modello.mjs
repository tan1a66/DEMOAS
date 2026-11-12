// Genera public/models/pelvi.glb: modello anatomico del bacino femminile (stilizzato ma realistico).
// Uso:  npm run modello          (richiede le dipendenze di sviluppo: @gltf-transform/*, meshoptimizer)
//
// Pipeline: SDF (anatomia.mjs) → surface nets (mesher.mjs) → semplificazione e riordino (meshoptimizer)
// → quantizzazione (int16 posizioni, int8 normali) → GLB con EXT_meshopt_compression.
// Nodi: bacino, pavimento (morph target: cedimento, iato, tensione), vescica, utero, vagina, retto, più le ancore.
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import { mkdir } from 'node:fs/promises';
import { surfaceNets } from './mesher.mjs';
import { PARTI, ANCORE, pavimento, bacino } from './anatomia.mjs';
import { PARTE_CORPO, PARTE_CAPELLI, corpo } from './corpo.mjs';

await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const USCITA = 'public/models/pelvi.glb';

/** Orienta i triangoli in modo coerente con le normali (verso l'esterno). */
function correggiAvvolgimento(pos, nor, ind) {
  let concordi = 0;
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * nor[a] + fy * nor[a + 1] + fz * nor[a + 2] > 0) concordi++;
  }
  if (concordi < ind.length / 6) for (let t = 0; t < ind.length; t += 3) [ind[t + 1], ind[t + 2]] = [ind[t + 2], ind[t + 1]];
}

/** Semplifica, poi riordina vertici/indici (cache GPU e compressione). */
function ottimizza(pos, attributi, ind, triangoli) {
  let indici = ind;
  if (triangoli && ind.length / 3 > triangoli) {
    [indici] = MeshoptSimplifier.simplify(ind, pos, 3, triangoli * 3, 0.01, []);
  }
  indici = new Uint32Array(indici);
  const [remap, unici] = MeshoptEncoder.reorderMesh(indici, true, true);
  const riordina = (arr, n) => {
    const out = new Float32Array(unici * n);
    for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) for (let k = 0; k < n; k++) out[remap[i] * n + k] = arr[i * n + k];
    return out;
  };
  return {
    posizioni: riordina(pos, 3),
    attributi: Object.fromEntries(Object.entries(attributi).map(([k, [arr, n]]) => [k, riordina(arr, n)])),
    indici,
  };
}

function normaliDaMesh(pos, ind) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += fx; n[i + 1] += fy; n[i + 2] += fz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

// —————————————————————— documento glTF ——————————————————————
const doc = new Document();
const buffer = doc.createBuffer();
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const scena = doc.createScene('pelvi');
const radice = doc.createNode('pelvi');
scena.addChild(radice);

const accessore = (tipo, arr, normalizzato = false) =>
  doc.createAccessor().setType(tipo).setArray(arr).setNormalized(normalizzato).setBuffer(buffer);

/**
 * Crea nodo parte (trasformabile a runtime) + figlio "<nome>_mesh" con la scala di de-quantizzazione.
 * Le ancore sono figlie del nodo parte, quindi non risentono della scala della mesh.
 */
function aggiungiParte(nome, { posizioni, normali, indici, uv, targets }, nodoInfo = {}) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posizioni.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], posizioni[i + k]);
      max[k] = Math.max(max[k], posizioni[i + k]);
    }
  const centro = min.map((v, k) => (v + max[k]) / 2);
  const scala = Math.max(...max.map((v, k) => (v - min[k]) / 2)) * 1.0001;
  const q3 = new Int16Array(posizioni.length);
  const n3 = new Int8Array(normali.length);
  for (let i = 0; i < posizioni.length; i++) {
    q3[i] = Math.round(((posizioni[i] - centro[i % 3]) / scala) * 32767);
    n3[i] = Math.round(normali[i] * 127);
  }
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', accessore('VEC3', q3, true))
    .setAttribute('NORMAL', accessore('VEC3', n3, true))
    .setIndices(accessore('SCALAR', posizioni.length / 3 < 65536 ? new Uint16Array(indici) : new Uint32Array(indici)));
  if (uv) prim.setAttribute('TEXCOORD_0', accessore('VEC2', Uint16Array.from(uv, (x) => Math.round(Math.min(Math.max(x, 0), 1) * 65535)), true));
  const mesh = doc.createMesh(nome).addPrimitive(prim);
  if (targets?.length) {
    for (const t of targets) {
      const d = Int16Array.from(t.delta, (x) => Math.round((x / scala) * 32767));
      prim.addTarget(doc.createPrimitiveTarget(t.nome).setAttribute('POSITION', accessore('VEC3', d, true)));
    }
    mesh.setWeights(targets.map(() => 0)).setExtras({ targetNames: targets.map((t) => t.nome) });
  }
  const nodo = doc.createNode(nome);
  if (nodoInfo.translation) nodo.setTranslation(nodoInfo.translation);
  if (nodoInfo.rotation) nodo.setRotation(nodoInfo.rotation);
  const nodoMesh = doc.createNode(`${nome}_mesh`).setMesh(mesh).setTranslation(centro).setScale([scala, scala, scala]);
  nodo.addChild(nodoMesh);
  for (const [nomeAncora, p] of Object.entries(ANCORE[nome] ?? {})) {
    const pLocale = nodoInfo.versoLocale ? nodoInfo.versoLocale(p) : p;
    nodo.addChild(doc.createNode(nomeAncora).setTranslation(pLocale));
  }
  radice.addChild(nodo);
  return { vertici: posizioni.length / 3, triangoli: indici.length / 3 };
}

const t0 = Date.now();
// controllo: il bacino deve stare tutto dentro la figura
{
  let fuori = 0, tot = 0;
  for (let x = -1.42; x <= 1.42; x += 0.04) for (let y = -0.2; y <= 1.62; y += 0.04) for (let z = -1; z <= 0.72; z += 0.04) {
    if (bacino(x, y, z) < 0) { tot++; if (corpo(x, y, z) > -0.05) fuori++; }
  }
  console.log(`bacino fuori dalla figura: ${((fuori / tot) * 100).toFixed(2)}%`);
}

for (const parte of [...PARTI, PARTE_CORPO, PARTE_CAPELLI]) {
  const t = Date.now();
  const grezza = surfaceNets(parte.sdf, parte.min, parte.max, parte.passo);
  correggiAvvolgimento(grezza.posizioni, grezza.normali, grezza.indici);
  const o = ottimizza(grezza.posizioni, { normali: [grezza.normali, 3] }, grezza.indici, parte.triangoli);
  const info = {};
  if (parte.pivot) {
    const a = parte.rotazioneX / 2;
    info.translation = parte.pivot;
    info.rotation = [Math.sin(a), 0, 0, Math.cos(a)];
    info.versoLocale = (p) => p; // le ancore dell'utero sono già in coordinate locali
  }
  const r = aggiungiParte(parte.nome, { posizioni: o.posizioni, normali: o.attributi.normali, indici: o.indici }, info);
  console.log(`${parte.nome.padEnd(9)} ${String(grezza.indici.length / 3).padStart(7)} → ${String(r.triangoli).padStart(6)} triangoli, ${r.vertici} vertici (${Date.now() - t} ms)`);
}

// Pavimento pelvico: già a bassa risoluzione, con morph target
{
  const p = pavimento();
  const normali = normaliDaMesh(p.posizioni, p.indici);
  const r = aggiungiParte('pavimento', { posizioni: p.posizioni, normali, indici: p.indici, uv: p.uv, targets: p.targets });
  console.log(`pavimento ${String(r.triangoli).padStart(6)} triangoli, morph target: ${p.targets.map((t) => t.nome).join(', ')}`);
}

await mkdir('public/models', { recursive: true });
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
await io.write(USCITA, doc);
const { size } = await import('node:fs').then((fs) => fs.statSync(USCITA));
console.log(`\nScritto ${USCITA}: ${(size / 1024).toFixed(0)} kB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
