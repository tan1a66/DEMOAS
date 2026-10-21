// Texture del cemento -> KTX2 (public/assets/tex/*.ktx2), in due risoluzioni.
// Ogni texture: R,G = normale, B = albedo (neutro, la tinta rosa è nello shader), A = rugosità.
//
// Sorgente: il generatore in src/textures/concrete.js. Se in tools/.cache/base/ ci sono le
// mappe di un cemento reale CC0 (ambientCG / Poly Haven, vedi tools/fetch-textures.mjs),
// vengono fuse come micro-dettaglio di base (pori, macchie, rugosità).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateFormwork, generateSmooth } from '../src/textures/concrete.js';
import { encodeRGBA, downsample } from './lib/ktx.mjs';
import { loadBaseConcrete, blendBase } from './lib/base-concrete.mjs';
import { writeManifest } from './lib/manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}assets/tex`;
mkdirSync(out, { recursive: true });

const SRC = 2048;
const base = await loadBaseConcrete(SRC);
console.log(base ? `base reale: ${base.name}` : 'base reale non disponibile: solo generatore procedurale');

for (const [name, gen] of [['formwork', generateFormwork], ['smooth', generateSmooth]]) {
  const t0 = performance.now();
  const { data, tileM } = gen(SRC);
  if (base) blendBase(data, base, SRC, name === 'smooth' ? 0.8 : 0.6);
  console.log(`${name}: generata in ${((performance.now() - t0) / 1000).toFixed(1)} s (tile ${tileM} m)`);
  let img = data, size = SRC;
  const levels = {};
  while (size > 512) {
    img = downsample(img, size);
    size /= 2;
    levels[size] = img;
  }
  for (const s of [1024, 512]) {
    // RDO più spinto sulla 1024 (desktop): stessa resa a distanza di visione, file più leggero
    const ktx = await encodeRGBA(levels[s], s, s, { mipmaps: true, rdo: s >= 1024 ? 3.0 : 1.5, quality: 2 });
    writeFileSync(`${out}/${name}-${s}.ktx2`, ktx);
    console.log(`  ${name}-${s}.ktx2  ${(ktx.byteLength / 1024).toFixed(0)} KB`);
  }
}
writeManifest();
