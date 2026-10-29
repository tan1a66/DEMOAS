// Il pesce del fondale: dal GLB originale (Meshy, ~84 MB, 1,8 milioni di triangoli) agli asset del sito.
//   node tools/fish.mjs [sorgente.glb]   (predefinito: tools/.cache/fish/source.glb, fuori dal repo)
// - assets/fish.glb: solo geometria (posizione, normale, UV), semplificata a ~40k triangoli e compressa
//   con Draco; normalizzata nel riferimento del nuoto: muso verso +x, dorso verso +y, lungo 1, centrato
// - assets/tex/fish-color-1024.ktx2 e fish-normal-1024.ktx2: colori (verde e rosa, scaglie e raggi delle
//   pinne) e rilievo, UASTC + Zstandard
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { weld, simplify, draco, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { encodeRGBA } from './lib/ktx.mjs';
import { writeManifest } from './lib/manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = process.argv[2] || `${root}tools/.cache/fish/source.glb`;
const TRIANGLES = 40000;
// nel sorgente il pesce è lungo z (muso verso HEAD·z), alto y, largo x
const HEAD = 1;
const log = (...a) => console.log('[pesce]', ...a);

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(src);
const rootDef = doc.getRoot();

// ---------------- texture: colore (sRGB) e normal map ----------------
const mat = rootDef.listMaterials()[0];
const maps = { color: mat.getBaseColorTexture(), normal: mat.getNormalTexture() };
for (const [name, tex] of Object.entries(maps)) {
  const s = 1024;
  const { data } = await sharp(Buffer.from(tex.getImage())).resize(s, s).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const normal = name === 'normal';
  const ktx = await encodeRGBA(data, s, s, { srgb: !normal, normalMap: normal, mipmaps: true, rdo: normal ? 1.5 : 3.0, quality: 2 });
  writeFileSync(`${root}assets/tex/fish-${name}-${s}.ktx2`, ktx);
  log(`fish-${name}-${s}.ktx2 ${(ktx.byteLength / 1024).toFixed(0)} KB`);
}
// nel GLB resta solo la geometria (il materiale è uno shader del sito)
for (const t of rootDef.listTextures()) t.dispose();
for (const m of rootDef.listMaterials()) m.dispose();

// ---------------- geometria: semplificata e normalizzata ----------------
const prim = rootDef.listMeshes()[0].listPrimitives()[0];
const before = prim.getIndices().getCount() / 3;
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGLES / before, error: 0.002, lockBorder: false }),
  prune(),
);
const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL');
const arr = pos.getArray(), narr = nor.getArray();
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) {
  min[k] = Math.min(min[k], arr[i + k]);
  max[k] = Math.max(max[k], arr[i + k]);
}
const L = max[2] - min[2], c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
// (x, y, z) del sorgente -> (HEAD·z, y, -HEAD·x): una rotazione attorno a y, il muso va verso +x
const rot = (a, i, scale, center) => {
  const x = (a[i] - center[0]) / scale, y = (a[i + 1] - center[1]) / scale, z = (a[i + 2] - center[2]) / scale;
  a[i] = HEAD * z;
  a[i + 1] = y;
  a[i + 2] = -HEAD * x;
};
for (let i = 0; i < arr.length; i += 3) {
  rot(arr, i, L, c);
  rot(narr, i, 1, [0, 0, 0]);
}
pos.setArray(arr);
nor.setArray(narr);
for (const n of rootDef.listNodes()) n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
log(`triangoli ${before} -> ${prim.getIndices().getCount() / 3}; ingombro 1 x ${((max[1] - min[1]) / L).toFixed(3)} x ${((max[0] - min[0]) / L).toFixed(3)}`);

await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
const out = `${root}assets/fish.glb`;
await io.write(out, doc);
log(`fish.glb ${(statSync(out).size / 1024).toFixed(0)} KB`);
writeManifest();
