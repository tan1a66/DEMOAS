// =============================================================================
//  optimize-model.mjs — dal modello originale della Venere ai modelli del sito
// =============================================================================
//
//  npm run models                 (legge models-src/venus.glb)
//  npm run models -- altro.glb    (oppure un percorso a scelta)
//
//  Sorgente: Venere stante con panneggio (Meshy), ~900k triangoli, con texture.
//  Cosa fa:
//   1. tiene solo la geometria: texture, UV e materiali vengono scartati
//      (il marmo è uno shader del sito, non serve nessuna UV)
//   2. weld (gltf-transform): vertici duplicati fusi, mesh connessa
//   3. via i pezzetti scollegati; normalizza: base a y = 0, altezza MODEL_HEIGHT,
//      centrata sulla base rotonda, lei guarda verso +Z
//   4. simplify (meshoptimizer) in più passate: viso e mani più densi del resto
//   5. occlusione ambientale per vertice (three-mesh-bvh, raggi sulla mesh
//      originale): le pieghe del panneggio hanno profondità anche in ombra
//   6. compressione Draco
//
//  Uscita: public/models/venus-desktop.glb (~300k), venus-mobile.glb (~120k).
//  I dati utili al sito (bounding box, quota della base) sono negli "extras"
//  del nodo radice: three.js li mette in object.userData.
// =============================================================================

import { existsSync, statSync } from 'node:fs';
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { weld, draco, prune, compactPrimitive, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// ----------------------------------------------------------------------------
const OUT_DIR = 'public/models';
const TARGETS = { desktop: 300_000, mobile: 120_000 }; // triangoli
const MODEL_HEIGHT = 2; // dalla base alla testa, in unità della scena

// Zone a densità maggiore: coordinate relative al bounding box finale (0..1)
// e raggio in frazioni dell'altezza; density = quante volte più triangoli.
const DETAIL_REGIONS = [
  { name: 'viso', center: [0.47, 0.905, 0.62], radius: 0.06, density: 3 },
  { name: 'mano sinistra', center: [0.73, 0.79, 0.66], radius: 0.05, density: 2.2 },
  { name: 'mano destra', center: [0.3, 0.535, 0.62], radius: 0.05, density: 2.2 },
];

// Occlusione ambientale: raggi per vertice e distanza massima (unità della scena)
const AO = { rays: 28, distance: 0.22, strength: 1 };

// ----------------------------------------------------------------------------
const log = (...a) => console.log('[models]', ...a);
const SOURCE = process.argv[2] || ['models-src/venus.glb', 'public/models/venus.glb'].find((p) => existsSync(p));
if (!SOURCE || !existsSync(SOURCE)) {
  console.error('Modello sorgente non trovato. Mettilo in models-src/venus.glb (vedi README).');
  process.exit(1);
}
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

// ---------------------------------------------------------------------------
// 1. solo geometria, in spazio mondo
// ---------------------------------------------------------------------------
log(`lettura ${SOURCE} (${(statSync(SOURCE).size / 1e6).toFixed(1)} MB)`);
const src = await io.read(SOURCE);
const parts = [];
let vtot = 0, itot = 0;
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
    const out = new Float32Array(pos.length);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m);
      out.set([v.x, v.y, v.z], i);
    }
    parts.push({ pos: out, idx, base: vtot });
    vtot += pos.length / 3;
    itot += idx.length;
  }
}
const P0 = new Float32Array(vtot * 3);
const I0 = new Uint32Array(itot);
{
  let o = 0;
  for (const p of parts) {
    P0.set(p.pos, p.base * 3);
    for (let k = 0; k < p.idx.length; k++) I0[o + k] = p.idx[k] + p.base;
    o += p.idx.length;
  }
}
log(`${(itot / 3).toLocaleString('it')} triangoli`);

// ---------------------------------------------------------------------------
// 2. weld
// ---------------------------------------------------------------------------
const doc = new Document();
const buffer = doc.createBuffer();
const prim = doc
  .createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P0).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(I0).setBuffer(buffer));
doc.createScene('venus').addChild(doc.createNode('venus').setMesh(doc.createMesh('figure').addPrimitive(prim)));
await doc.transform(weld());
log(`weld: ${prim.getAttribute('POSITION').getCount().toLocaleString('it')} vertici`);

// ---------------------------------------------------------------------------
// 3. pulizia + normalizzazione
// ---------------------------------------------------------------------------
let meta;
{
  const P = prim.getAttribute('POSITION').getArray();
  const I = prim.getIndices().getArray();
  // componenti connesse: via i pezzetti sparsi
  const parent = new Int32Array(P.length / 3).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t < I.length; t += 3) {
    const r = find(I[t]);
    parent[find(I[t + 1])] = r;
    parent[find(I[t + 2])] = r;
  }
  const size = new Map();
  for (let t = 0; t < I.length; t += 3) size.set(find(I[t]), (size.get(find(I[t])) || 0) + 1);
  const minTris = (I.length / 3) * 0.002;
  const keep = [];
  for (let t = 0; t < I.length; t += 3) if (size.get(find(I[t])) >= minTris) keep.push(I[t], I[t + 1], I[t + 2]);
  log(`pulizia: tenute ${[...size.values()].filter((n) => n >= minTris).length} componenti su ${size.size}`);
  prim.getIndices().setArray(new Uint32Array(keep));
  compactPrimitive(prim);

  const Q = prim.getAttribute('POSITION').getArray();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < Q.length; i += 3) for (let j = 0; j < 3; j++) {
    min[j] = Math.min(min[j], Q[i + j]);
    max[j] = Math.max(max[j], Q[i + j]);
  }
  // centro della base rotonda (i vertici più bassi)
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (let i = 0; i < Q.length; i += 3) if (Q[i + 1] < min[1] + (max[1] - min[1]) * 0.01) {
    bx0 = Math.min(bx0, Q[i]); bx1 = Math.max(bx1, Q[i]);
    bz0 = Math.min(bz0, Q[i + 2]); bz1 = Math.max(bz1, Q[i + 2]);
  }
  const s = MODEL_HEIGHT / (max[1] - min[1]);
  const off = [-(bx0 + bx1) / 2, -min[1], -(bz0 + bz1) / 2];
  for (let i = 0; i < Q.length; i += 3) for (let j = 0; j < 3; j++) Q[i + j] = (Q[i + j] + off[j]) * s;

  // quota della base: il piano rivolto in alto più esteso nella parte bassa
  const Ix = prim.getIndices().getArray();
  const bins = new Map();
  for (let t = 0; t < Ix.length; t += 3) {
    const a = Ix[t] * 3, b = Ix[t + 1] * 3, c = Ix[t + 2] * 3;
    const ux = Q[b] - Q[a], uy = Q[b + 1] - Q[a + 1], uz = Q[b + 2] - Q[a + 2];
    const vx = Q[c] - Q[a], vy = Q[c + 1] - Q[a + 1], vz = Q[c + 2] - Q[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const area = Math.hypot(...n) / 2;
    const y = (Q[a + 1] + Q[b + 1] + Q[c + 1]) / 3;
    if (y < 0.25 && area > 0 && n[1] / (2 * area) > 0.95) {
      const k = Math.round(y * 200);
      bins.set(k, (bins.get(k) || 0) + area);
    }
  }
  const baseTop = [...bins.entries()].filter(([k]) => k > 1).sort((a, b) => b[1] - a[1])[0]?.[0] / 200 || 0.1;
  const bmin = [(min[0] + off[0]) * s, 0, (min[2] + off[2]) * s];
  const bmax = [(max[0] + off[0]) * s, MODEL_HEIGHT, (max[2] + off[2]) * s];
  meta = {
    source: 'Venus (Meshy), proporcionado por Alessia Studio',
    height: MODEL_HEIGHT,
    bboxMin: bmin,
    bboxMax: bmax,
    baseTop, // quota del piano della base rotonda (i piedi poggiano qui)
    baseRadius: (Math.max(bx1 - bx0, bz1 - bz0) / 2) * s,
  };
  log('bbox', bmin.map((v) => v.toFixed(3)), bmax.map((v) => v.toFixed(3)), 'base a y', baseTop.toFixed(3), 'raggio base', meta.baseRadius.toFixed(3));
}

// BVH sulla mesh completa: serve all'occlusione ambientale
const fullGeo = new THREE.BufferGeometry();
fullGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(prim.getAttribute('POSITION').getArray()), 3));
fullGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(prim.getIndices().getArray()), 1));
const fullBVH = new MeshBVH(fullGeo);

// ---------------------------------------------------------------------------
// 4. semplificazione per zone (vertici delle altre zone bloccati)
// ---------------------------------------------------------------------------
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;

function simplifyByRegions(document, target) {
  const pr = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = pr.getAttribute('POSITION').getArray();
  let I = new Uint32Array(pr.getIndices().getArray());
  const size = meta.bboxMax.map((v, i) => v - meta.bboxMin[i]);
  const regions = DETAIL_REGIONS.map((r) => ({ c: r.center.map((u, i) => meta.bboxMin[i] + u * size[i]), r: r.radius * MODEL_HEIGHT }));
  const cls = new Uint8Array(P.length / 3); // 0 = corpo, 1.. = zone
  for (let v = 0; v < cls.length; v++) {
    regions.forEach((r, i) => {
      if (Math.hypot(P[v * 3] - r.c[0], P[v * 3 + 1] - r.c[1], P[v * 3 + 2] - r.c[2]) < r.r) cls[v] = 1 + i;
    });
  }
  const density = [1, ...DETAIL_REGIONS.map((r) => r.density)];
  const triCount = density.map(() => 0);
  for (let t = 0; t < I.length; t += 3) triCount[cls[I[t]]]++;
  let lo = 0, hi = 1;
  const sum = (a) => triCount.reduce((s, n, c) => s + Math.min(n, n * density[c] * a), 0);
  for (let it = 0; it < 50; it++) (sum((lo + hi) / 2) > target ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2));
  const want = triCount.map((n, c) => Math.min(n, Math.round(n * density[c] * lo)));
  for (let c = 0; c < density.length; c++) {
    if (!triCount[c] || want[c] >= triCount[c]) continue;
    const lock = new Uint8Array(cls.length);
    for (let v = 0; v < cls.length; v++) lock[v] = cls[v] === c ? 0 : 1;
    const targetIndex = Math.max(0, I.length - (triCount[c] - want[c]) * 3);
    [I] = MeshoptSimplifier.simplifyWithAttributes(I, P, 3, new Float32Array(cls.length), 1, [], lock, targetIndex - (targetIndex % 3), 1, []);
  }
  pr.getIndices().setArray(I);
  compactPrimitive(pr);
  const names = ['corpo', ...DETAIL_REGIONS.map((r) => r.name)];
  log(`  ${(I.length / 3).toLocaleString('it')} triangoli  (` + names.map((n, c) => `${n} ${want[c]}`).join(', ') + ')');
}

// ---------------------------------------------------------------------------
// 5. occlusione ambientale per vertice
// ---------------------------------------------------------------------------
function bakeAO(document) {
  const pr = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = pr.getAttribute('POSITION').getArray();
  const I = pr.getIndices().getArray();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1));
  g.computeVertexNormals();
  const N = g.attributes.normal;
  const count = P.length / 3;
  const ao = new Uint8Array(count);
  const ray = new THREE.Ray();
  const o = new THREE.Vector3(), n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), d = new THREE.Vector3();
  // direzioni fisse su un emisfero (distribuzione coseno), ruotate per ogni vertice
  const dirs = [];
  for (let k = 0; k < AO.rays; k++) {
    const u = (k + 0.5) / AO.rays, phi = k * 2.399963;
    const r = Math.sqrt(u);
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)]);
  }
  const t0 = Date.now();
  for (let v = 0; v < count; v++) {
    n.fromBufferAttribute(N, v);
    o.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).addScaledVector(n, 0.002);
    t1.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
    t2.crossVectors(n, t1);
    let occ = 0;
    for (const [x, y, z] of dirs) {
      d.set(0, 0, 0).addScaledVector(t1, x).addScaledVector(t2, y).addScaledVector(n, z);
      ray.set(o, d);
      const hit = fullBVH.raycastFirst(ray, THREE.DoubleSide, 0, AO.distance);
      if (hit) occ += 1 - hit.distance / AO.distance; // vicino = più scuro
    }
    ao[v] = Math.round(255 * Math.max(0, 1 - (occ / AO.rays) * AO.strength));
  }
  pr.setAttribute('_AO', document.createAccessor().setType('SCALAR').setArray(ao).setNormalized(true).setBuffer(document.getRoot().listBuffers()[0]));
  log(`  occlusione su ${count.toLocaleString('it')} vertici in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

for (const [name, target] of Object.entries(TARGETS)) {
  log(`${name}: obiettivo ${target.toLocaleString('it')} triangoli`);
  const d = cloneDocument(doc);
  simplifyByRegions(d, target);
  bakeAO(d);
  d.getRoot().listNodes()[0].setExtras(meta);
  await d.transform(prune({ keepAttributes: true }), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeGeneric: 8, encodeSpeed: 3, decodeSpeed: 5 }));
  const file = `${OUT_DIR}/venus-${name}.glb`;
  await io.write(file, d);
  log(`  → ${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)`);
}
log('meta', JSON.stringify(meta));
