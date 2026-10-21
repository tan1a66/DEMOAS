// Pipeline della scena: geometria -> atlante lightmap -> bake (sole, cielo, rimbalzi) ->
// lightmap KTX2 (2048 / 1024) + GLB Draco con uv della lightmap e cuscini "cotti" nei vertici.
//   node tools/scene/build.mjs [--size=2048] [--rays=128] [--preview=dir]
import { Worker } from 'node:worker_threads';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { buildArchitecture } from '../../src/scene/architecture.js';
import { buildCushions } from '../../src/scene/cushions.js';
import { LM_EMAX, CEIL_Y, SHELL } from '../../src/layout.js';
import { packAtlas, rasterize, denoise, dilate } from './atlas.mjs';
import { encodeRGBA } from '../lib/ktx.mjs';
import { writeManifest } from '../lib/manifest.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const SIZE = +(args.size || 2048);
const RAYS = +(args.rays || 128);
const PREVIEW = args.preview || null;
const outDir = `${root}assets`;
mkdirSync(outDir, { recursive: true });
const t0 = performance.now();
const log = (...m) => console.log(`[${((performance.now() - t0) / 1000).toFixed(1)}s]`, ...m);

// ---------------- geometria ----------------
const arch = buildArchitecture();
const cushions = buildCushions();
const proxy = buildCushions({ proxy: true }); // ostacolo leggero per i raggi
const groups = [
  { name: 'extForm', geometry: arch.extForm, zone: 0 },
  { name: 'extSmooth', geometry: arch.extSmooth, zone: 0 },
  { name: 'intForm', geometry: arch.intForm, zone: 1 },
  { name: 'intSmooth', geometry: arch.intSmooth, zone: 1 },
];
const atlas = packAtlas(groups, SIZE, 3);
log(`atlante ${SIZE}²: ${atlas.rects.length} chart, ${atlas.scale.toFixed(1)} texel/m (densità 1), riempimento ${(atlas.fill * 100).toFixed(0)}%`);
const tex = rasterize(groups, atlas.uv1, SIZE);

// scena per il ray tracing (memoria condivisa con i worker)
const shared = (Ctor, n) => new Ctor(new SharedArrayBuffer(n * Ctor.BYTES_PER_ELEMENT));
let nv = proxy.attributes.position.count, ni = proxy.index.count;
for (const g of groups) { nv += g.geometry.attributes.position.count; ni += g.geometry.index.count; }
const scene = {
  size: SIZE,
  pos: shared(Float32Array, nv * 3),
  idx: shared(Uint32Array, ni),
  kind: shared(Uint8Array, nv),
  lmuv: shared(Float32Array, nv * 2),
  cvid: shared(Int32Array, nv),
};
const noRoof = [];
{
  let vo = 0, io = 0;
  const add = (geo, kind, uv1) => {
    const P = geo.attributes.position.array, I = geo.index.array;
    scene.pos.set(P, vo * 3);
    for (let i = 0; i < P.length / 3; i++) {
      scene.kind[vo + i] = kind;
      scene.cvid[vo + i] = kind === 1 ? i : -1;
      if (uv1) { scene.lmuv[(vo + i) * 2] = uv1[i * 2]; scene.lmuv[(vo + i) * 2 + 1] = uv1[i * 2 + 1]; }
    }
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] + vo, b = I[t + 1] + vo, c = I[t + 2] + vo;
      scene.idx[io++] = a; scene.idx[io++] = b; scene.idx[io++] = c;
      // soffitto, lucernario e copertura non contano per il sole interno (lo fa l'apertura analitica)
      const ys = [a, b, c].map((v) => scene.pos[v * 3 + 1]);
      const inside = [a, b, c].every((v) => Math.abs(scene.pos[v * 3]) <= SHELL.x1 + 1e-3 && scene.pos[v * 3 + 2] <= SHELL.z1 + 1e-3);
      if (!(ys.every((y) => y >= CEIL_Y - 1e-3) && inside)) noRoof.push(a, b, c);
    }
    vo += P.length / 3;
  };
  for (const g of groups) add(g.geometry, 0, atlas.uv1.get(g.name));
  add(proxy, 1, null);
}
scene.idxNoRoof = shared(Uint32Array, noRoof.length);
scene.idxNoRoof.set(noRoof);

// campioni: texel validi dell'atlante + vertici dei cuscini
const texIdx = [];
for (let i = 0; i < SIZE * SIZE; i++) if (tex.chart[i] >= 0) texIdx.push(i);
// ordine dei campioni: texel | vertici dei cuscini (esportati) | vertici del proxy (per i rimbalzi)
const nT = texIdx.length, nC = cushions.attributes.position.count, nP = proxy.attributes.position.count;
const nS = nT + nC + nP;
const sPos = shared(Float32Array, nS * 3), sNrm = shared(Float32Array, nS * 3), sZone = shared(Uint8Array, nS);
texIdx.forEach((ti, k) => {
  for (let c = 0; c < 3; c++) { sPos[k * 3 + c] = tex.pos[ti * 3 + c]; sNrm[k * 3 + c] = tex.nrm[ti * 3 + c]; }
  sZone[k] = tex.zone[ti];
});
for (const [geo, off] of [[cushions, nT], [proxy, nT + nC]]) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array;
  for (let i = 0; i < P.length / 3; i++) {
    for (let c = 0; c < 3; c++) { sPos[(off + i) * 3 + c] = P[i * 3 + c]; sNrm[(off + i) * 3 + c] = N[i * 3 + c]; }
    sZone[off + i] = 1;
  }
}
log(`${nT} texel + ${nC} vertici dei cuscini (+${nP} proxy), ${scene.idx.length / 3} triangoli nel BVH`);

// ---------------- worker ----------------
const nWorkers = Math.max(1, Math.min(os.cpus().length, 8));
const workers = await Promise.all(Array.from({ length: nWorkers }, () => new Promise((res) => {
  const w = new Worker(new URL('./bake-worker.mjs', import.meta.url));
  w.once('message', () => res(w));
  w.postMessage({ type: 'init', scene });
})));
log(`${nWorkers} worker pronti`);

function runPass(type, rays, extra = {}) {
  const res = new Float32Array(nS * 2);
  const chunk = 3000;
  const jobs = [];
  for (let s = 0; s < nS; s += chunk) jobs.push({ start: s, end: Math.min(nS, s + chunk) });
  let next = 0, done = 0;
  return new Promise((resolve) => {
    const feed = (w) => {
      if (next >= jobs.length) return;
      const j = jobs[next++];
      w.postMessage({ type, id: next, start: j.start, end: j.end, rays, pos: sPos, nrm: sNrm, zone: sZone, firstCushion: nT, ...extra });
    };
    for (const w of workers) {
      w.removeAllListeners('message');
      w.on('message', (m) => {
        res.set(m.out, m.start * 2);
        done++;
        if (done % 40 === 0) process.stdout.write(`\r  ${type} ${((done / jobs.length) * 100).toFixed(0)}%   `);
        if (done === jobs.length) { process.stdout.write('\n'); resolve(res); } else feed(w);
      });
      feed(w);
    }
  });
}

// mappa dell'irradianza totale (per i rimbalzi), estesa oltre i bordi dei chart
function toMaps(values) {
  const map = new Float32Array(SIZE * SIZE), valid = new Uint8Array(SIZE * SIZE);
  texIdx.forEach((ti, k) => { map[ti] = values[k]; valid[ti] = 1; });
  const d = dilate(map, valid, SIZE, 4);
  const Etot = shared(Float32Array, SIZE * SIZE);
  Etot.set(d.values);
  const EtotC = shared(Float32Array, nP);
  for (let i = 0; i < nP; i++) EtotC[i] = values[nT + nC + i];
  return { Etot, EtotC };
}

const dirRes = await runPass('direct', 24);
const vis = new Float32Array(nS), Edir = new Float32Array(nS);
for (let i = 0; i < nS; i++) { vis[i] = dirRes[i * 2]; Edir[i] = dirRes[i * 2 + 1]; }
log('luce diretta fatta');

let Eind = new Float32Array(nS);
const passes = [Math.max(32, RAYS / 3), Math.max(48, RAYS / 2), RAYS];
let back = new Float32Array(nS);
for (let p = 0; p < passes.length; p++) {
  const tot = new Float32Array(nS);
  for (let i = 0; i < nS; i++) tot[i] = Edir[i] + Eind[i];
  const maps = toMaps(tot);
  const r = await runPass('gather', passes[p], maps);
  const next = new Float32Array(nS);
  for (let i = 0; i < nS; i++) { next[i] = r[i * 2]; back[i] = r[i * 2 + 1]; }
  Eind = next;
  log(`rimbalzo ${p + 1}/${passes.length} (${passes[p]} raggi)`);
}
for (const w of workers) w.terminate();

// ---------------- lightmap ----------------
const E = new Float32Array(SIZE * SIZE), V = new Float32Array(SIZE * SIZE);
const valid = new Uint8Array(SIZE * SIZE);
let invalid = 0;
texIdx.forEach((ti, k) => {
  if (back[k] > 0.2) { invalid++; return; } // texel dentro un altro volume
  E[ti] = Eind[k];
  V[ti] = vis[k];
  valid[ti] = 1;
});
log(`texel scartati (dentro i volumi): ${invalid}`);
const Ed = denoise(E, tex.chart, valid, SIZE, 3, 1.7);
const Vd = denoise(V, tex.chart, valid, SIZE, 1, 0.7);
const dE = dilate(Ed, valid, SIZE, 10), dV = dilate(Vd, valid, SIZE, 10);
const srgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const rgba = new Uint8Array(SIZE * SIZE * 4);
let maxE = 0;
for (let i = 0; i < SIZE * SIZE; i++) {
  maxE = Math.max(maxE, dE.values[i]);
  const e = Math.round(srgb(Math.min(1, Math.max(0, dE.values[i] / LM_EMAX))) * 255);
  rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = e;
  rgba[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, dV.values[i])) * 255);
}
log(`irradianza indiretta max ${maxE.toFixed(2)} (EMAX ${LM_EMAX})`);

// versione a metà risoluzione (mobile)
function half(src, size) {
  const n = size / 2, out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let c = 0; c < 4; c++) {
    const at = (yy, xx) => src[((yy * size + xx) * 4) + c];
    out[(y * n + x) * 4 + c] = Math.round((at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4);
  }
  return out;
}
const lmHalf = half(rgba, SIZE);
for (const [data, s] of [[rgba, SIZE], [lmHalf, SIZE / 2]]) {
  const ktx = await encodeRGBA(data, s, s, { srgb: true, mipmaps: false, rdo: 1.0, quality: 2 });
  writeFileSync(`${outDir}/lightmap-${s}.ktx2`, ktx);
  log(`lightmap-${s}.ktx2 ${(ktx.byteLength / 1024).toFixed(0)} KB`);
}
if (PREVIEW) {
  mkdirSync(PREVIEW, { recursive: true });
  const rgb = Buffer.alloc(SIZE * SIZE * 3), a = Buffer.alloc(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = rgba[i * 4];
    a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = rgba[i * 4 + 3];
  }
  await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).flip().resize(1024).png().toFile(`${PREVIEW}/lightmap-E.png`);
  await sharp(a, { raw: { width: SIZE, height: SIZE, channels: 3 } }).flip().resize(1024).png().toFile(`${PREVIEW}/lightmap-vis.png`);
}

// ---------------- GLB ----------------
const doc = new Document();
const buffer = doc.createBuffer();
const sceneNode = doc.createScene('scene');
const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
for (const g of groups) {
  const geo = g.geometry;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(geo.attributes.position.array, 'VEC3'))
    .setAttribute('NORMAL', acc(geo.attributes.normal.array, 'VEC3'))
    .setAttribute('TEXCOORD_0', acc(geo.attributes.uv.array, 'VEC2'))
    .setAttribute('TEXCOORD_1', acc(atlas.uv1.get(g.name), 'VEC2'))
    .setIndices(acc(new Uint32Array(geo.index.array), 'SCALAR'));
  sceneNode.addChild(doc.createNode(g.name).setMesh(doc.createMesh(g.name).addPrimitive(prim)));
}
{
  const color = new Float32Array(nC * 4);
  for (let i = 0; i < nC; i++) {
    const e = Math.min(1, Math.max(0, Eind[nT + i] / LM_EMAX));
    color[i * 4] = color[i * 4 + 1] = color[i * 4 + 2] = e;
    color[i * 4 + 3] = vis[nT + i];
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(cushions.attributes.position.array, 'VEC3'))
    .setAttribute('NORMAL', acc(cushions.attributes.normal.array, 'VEC3'))
    .setAttribute('COLOR_0', acc(color, 'VEC4'))
    .setIndices(acc(new Uint32Array(cushions.index.array), 'SCALAR'));
  sceneNode.addChild(doc.createNode('cushions').setMesh(doc.createMesh('cushions').addPrimitive(prim)));
}
await doc.transform(draco({
  method: 'edgebreaker',
  quantizePosition: 16,
  quantizeNormal: 10,
  quantizeTexcoord: 14,
  quantizeColor: 10,
  quantizationVolume: 'scene',
}));
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await io.write(`${outDir}/scene.glb`, doc);
log(`scene.glb ${(statSync(`${outDir}/scene.glb`).size / 1024).toFixed(0)} KB`);

writeManifest();
log('fatto');
