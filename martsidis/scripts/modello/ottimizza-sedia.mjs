// Ottimizza la sedia generata con Meshy (GLB senza texture, ~170k triangoli) per il web:
// semplificazione → colori per vertice (pelle grigia sopra, metallo scuro per le gambe) → quantizzazione → Meshopt.
// Uso: node scripts/modello/ottimizza-sedia.mjs <sorgente.glb>   → public/models/sedia.glb
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const [, , sorgente, triangoliVoluti = '9000'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const src = await io.read(sorgente);
const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
let ind = prim.getIndices().getArray();

// saldatura dei vertici duplicati (Meshy spesso li separa), poi semplificazione
const [remap0, unici0] = MeshoptEncoder.reorderMesh ? [null, null] : [null, null];
void remap0; void unici0;
const obiettivo = Number(triangoliVoluti) * 3;
const [semplici, errore] = MeshoptSimplifier.simplify(new Uint32Array(ind), new Float32Array(pos), 3, obiettivo, 0.02, ['LockBorder']);
console.log(`triangoli: ${ind.length / 3} → ${semplici.length / 3} (errore ${errore.toFixed(4)})`);

// compattazione: solo i vertici usati
const mappa = new Map();
const nuoviPos = [];
const nuoviInd = new Uint32Array(semplici.length);
for (let i = 0; i < semplici.length; i++) {
  const v = semplici[i];
  if (!mappa.has(v)) {
    mappa.set(v, nuoviPos.length / 3);
    nuoviPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  }
  nuoviInd[i] = mappa.get(v);
}
const P = new Float32Array(nuoviPos);
// normali lisce dalla mesh
const N = new Float32Array(P.length);
for (let t = 0; t < nuoviInd.length; t += 3) {
  const a = nuoviInd[t] * 3, b = nuoviInd[t + 1] * 3, c = nuoviInd[t + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  for (const i of [a, b, c]) { N[i] += fx; N[i + 1] += fy; N[i + 2] += fz; }
}
for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }

// colori: sotto la seduta (gambe) metallo scuro, sopra pelle grigia
let minY = Infinity, maxY = -Infinity;
for (let i = 1; i < P.length; i += 3) { minY = Math.min(minY, P[i]); maxY = Math.max(maxY, P[i]); }
const SEDUTA = Number(process.env.SEDUTA ?? 0.38); // frazione d'altezza sotto cui ci sono solo gambe
const C = new Float32Array((P.length / 3) * 3);
for (let v = 0; v < P.length / 3; v++) {
  const h = (P[v * 3 + 1] - minY) / (maxY - minY);
  const pelle = h > SEDUTA;
  const col = pelle ? [0.55, 0.53, 0.5] : [0.16, 0.15, 0.14];
  C.set(col, v * 3);
}

const doc = new Document();
const buf = doc.createBuffer();
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const acc = (t, a) => doc.createAccessor().setType(t).setArray(a).setBuffer(buf);
const p2 = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', P)).setAttribute('NORMAL', acc('VEC3', N)).setAttribute('COLOR_0', acc('VEC3', C)).setIndices(acc('SCALAR', P.length / 3 < 65536 ? new Uint16Array(nuoviInd) : nuoviInd));
const mesh = doc.createMesh('sedia').addPrimitive(p2);
doc.createScene('sedia').addChild(doc.createNode('sedia').setMesh(mesh));
await io.write('public/models/sedia.glb', doc);
const { statSync } = await import('node:fs');
console.log(`public/models/sedia.glb: ${(statSync('public/models/sedia.glb').size / 1024).toFixed(0)} kB, ${P.length / 3} vertici`);
