// La statua del fondale: dal GLB originale (Meshy, ~18 MB, 370k triangoli) agli asset del sito.
//   node tools/statue.mjs [sorgente.glb]   (predefinito: tools/.cache/statue/source.glb, fuori dal repo)
// - assets/statue.glb: solo geometria (posizione, normale, UV), semplificata a ~60k triangoli e
//   compressa con Draco; normalizzata: base a y = 0, centrata in x/z, alta 1, volti verso +z
// - assets/tex/statue-color-1024.ktx2 e statue-normal-1024.ktx2: patina del bronzo e rilievo (normal
//   map in spazio tangente), UASTC + Zstandard. Sott'acqua, con la nebbia, 1024 basta (a 2048 il colore
//   pesa 4 MB)
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
const src = process.argv[2] || `${root}tools/.cache/statue/source.glb`;
const TRIANGLES = 60000;
const log = (...a) => console.log('[statua]', ...a);

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
  for (const s of [1024]) {
    const { data } = await sharp(Buffer.from(tex.getImage())).resize(s, s).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const normal = name === 'normal';
    const ktx = await encodeRGBA(data, s, s, { srgb: !normal, normalMap: normal, mipmaps: true, rdo: normal ? 1.5 : 3.0, quality: 2 });
    const out = `${root}assets/tex/statue-${name}-${s}.ktx2`;
    writeFileSync(out, ktx);
    log(`statue-${name}-${s}.ktx2 ${(ktx.byteLength / 1024).toFixed(0)} KB`);
  }
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
const pos = prim.getAttribute('POSITION');
const arr = pos.getArray();
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) {
  min[k] = Math.min(min[k], arr[i + k]);
  max[k] = Math.max(max[k], arr[i + k]);
}
const H = max[1] - min[1], cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
for (let i = 0; i < arr.length; i += 3) {
  arr[i] = (arr[i] - cx) / H;
  arr[i + 1] = (arr[i + 1] - min[1]) / H;
  arr[i + 2] = (arr[i + 2] - cz) / H;
}
pos.setArray(arr);
for (const n of rootDef.listNodes()) n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
log(`triangoli ${before} -> ${prim.getIndices().getCount() / 3}; ingombro ${((max[0] - min[0]) / H).toFixed(3)} x 1 x ${((max[2] - min[2]) / H).toFixed(3)}`);

await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
const out = `${root}assets/statue.glb`;
await io.write(out, doc);
log(`statue.glb ${(statSync(out).size / 1024).toFixed(0)} KB`);
writeManifest();
