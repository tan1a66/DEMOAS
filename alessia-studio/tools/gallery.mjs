// Screenshot delle demo -> immagini della galleria (WebP in tre misure) + elenco per il sito.
//   node tools/gallery.mjs <cartella-png> hotel=0,2,3 pizzeria=1,2 ...
// Per ogni progetto prende <cartella>/<id>-<n>.png nell'ordine indicato e scrive
// public/gallery/<id>/01-{1280,720,320}.webp ...; aggiorna src/assets/gallery.json (gli altri progetti
// restano come sono). Le immagini vengono ritagliate a 16:10.
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const [src, ...specs] = process.argv.slice(2);
if (!src || !specs.length) {
  console.log('uso: node tools/gallery.mjs <cartella-png> <id>=<n,n,...> ...');
  process.exit(1);
}
const listFile = `${root}src/assets/gallery.json`;
const list = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : {};
const SIZES = [[1280, 80], [720, 78], [320, 72]];

for (const spec of specs) {
  const [id, nums] = spec.split('=');
  const out = `${root}public/gallery/${id}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const names = [];
  let bytes = 0;
  for (const [k, n] of nums.split(',').filter(Boolean).entries()) {
    const name = String(k + 1).padStart(2, '0');
    const img = sharp(`${src}/${id}-${n}.png`);
    const { width, height } = await img.metadata();
    // ritaglio centrale a 16:10
    const h = Math.min(height, Math.round(width / 1.6)), w = Math.round(h * 1.6);
    const base = img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h });
    for (const [size, quality] of SIZES) {
      const info = await base.clone().resize(size, Math.round(size / 1.6)).webp({ quality, effort: 5 }).toFile(`${out}/${name}-${size}.webp`);
      bytes += info.size;
    }
    names.push(name);
  }
  list[id] = names;
  console.log(`${id}: ${names.length} immagini, ${(bytes / 1024).toFixed(0)} KB`);
}
const sorted = Object.fromEntries(Object.entries(list).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(listFile, `${JSON.stringify(sorted, null, 2)}\n`);
