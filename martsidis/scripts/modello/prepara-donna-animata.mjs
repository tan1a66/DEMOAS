// Prepara la figura animata di Meshy/Mixamo (GLB con scheletro e animazione) per il sito:
// capelli riconosciuti dal colore della texture → COLOR_0 (r = 1 sui capelli); niente texture; animazione sul posto
// (tolto lo spostamento orizzontale del bacino); allineamento all'apparato negli extras; compressione Meshopt.
// Uso: node scripts/modello/prepara-donna-animata.mjs <file.glb> [nome animazione, default Red_Carpet_Walk] → public/models/donna.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const prim = root.listMeshes()[0].listPrimitives()[0];
const mat = prim.getMaterial();
const tex = mat.getBaseColorTexture();
const { data: px, info } = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const pos = prim.getAttribute('POSITION').getArray();
const n = pos.length / 3;
const col = new Float32Array(n * 4);
for (let v = 0; v < n; v++) {
  const x = Math.round(Math.min(Math.max(uv[v * 2], 0), 1) * (info.width - 1));
  const y = Math.round(Math.min(Math.max(uv[v * 2 + 1], 0), 1) * (info.height - 1));
  const k = (y * info.width + x) * info.channels;
  const lum = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
  col.set([lum < 0.36 ? 1 : 0, 0, 0, 1], v * 4);
}
prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setBuffer(root.listBuffers()[0]));
for (const s of ['TEXCOORD_0', 'TANGENT']) prim.setAttribute(s, null);
for (const t of root.listTextures()) t.dispose();
mat.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);

// misure: il cavallo al 47% dell'altezza; in scala del sito la figura è alta 16,8 e il cavallo è a y = -0,5
let yMin = Infinity, yMax = -Infinity, zs = 0, zn = 0;
for (let v = 0; v < n; v++) { yMin = Math.min(yMin, pos[v * 3 + 1]); yMax = Math.max(yMax, pos[v * 3 + 1]); }
const H = yMax - yMin, cav = yMin + H * 0.47;
for (let v = 0; v < n; v++) { const y = pos[v * 3 + 1]; if (y > cav + H * 0.03 && y < cav + H * 0.06 && Math.abs(pos[v * 3]) < H * 0.1) { zs += pos[v * 3 + 2]; zn++; } }
const S = 16.8 / H;
const allineamento = { scala: S, posizione: [0, -0.5 - cav * S, -0.12 - (zs / zn) * S] };

// una sola animazione (le altre si tolgono), sul posto: il bacino resta in orizzontale dove è nella posa di partenza,
// così il corpo resta centrato sull'apparato
const scelta = process.argv[3] ?? 'Red_Carpet_Walk';
const anims = root.listAnimations();
const tenuta = anims.find((a) => a.getName() === scelta) ?? anims[0];
for (const a of anims) if (a !== tenuta) a.dispose();
console.log('animazione:', tenuta.getName(), '(disponibili:', anims.map((a) => a.getName()).join(', ') + ')');
for (const ch of tenuta.listChannels()) {
  const nodo = ch.getTargetNode();
  if (ch.getTargetPath() !== 'translation' || !/Hips/.test(nodo?.getName() ?? '')) continue;
  const [bx, , bz] = nodo.getTranslation();
  const out = ch.getSampler().getOutput();
  const a = out.getArray().slice();
  for (let i = 0; i < a.length; i += 3) { a[i] = bx; a[i + 2] = bz; }
  out.setArray(a);
}
root.listScenes()[0].listChildren()[0].setExtras({ allineamento });
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await doc.transform(resample(), dedup(), prune(), quantize());
await io.write('public/models/donna.glb', doc);
const { statSync } = await import('node:fs');
console.log('public/models/donna.glb', (statSync('public/models/donna.glb').size / 1024).toFixed(0), 'kB', JSON.stringify(allineamento), 'capelli', Array.from({ length: n }, (_, v) => col[v * 4]).filter(Boolean).length, '/', n);
