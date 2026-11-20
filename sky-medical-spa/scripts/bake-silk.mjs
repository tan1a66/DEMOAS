// Calcola una volta sola la forma a riposo della seta (5 s di simulazione per qualità) e la
// salva in src/silk/baked.js. Da rilanciare se si cambiano misure, griglia o sotto-passi.
//   npm run bake
import { writeFileSync } from 'node:fs';
import { Silk, encodeRest } from '../src/silk/silk.js';

const out = {};
for (const quality of ['mobile', 'high']) {
  const t = performance.now();
  const s = new Silk({ quality, bake: false });
  const q = encodeRest(s.restShape);
  out[quality] = {
    nx: s.nx,
    ny: s.ny,
    substeps: s.cloth.substeps,
    time: Number(s.restTime.toFixed(4)),
    rest: Buffer.from(q.buffer).toString('base64'),
  };
  console.log(`${quality}: ${s.nx}×${s.ny}, ${Math.round(performance.now() - t)} ms, ${out[quality].rest.length} caratteri`);
}
writeFileSync(
  new URL('../src/silk/baked.js', import.meta.url),
  `// Generato da scripts/bake-silk.mjs (npm run bake): la forma a riposo della seta.\nexport const BAKED = ${JSON.stringify(out)};\n`,
);
