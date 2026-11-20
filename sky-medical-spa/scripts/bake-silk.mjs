// Calcola una volta sola la forma a riposo della seta (5 s di simulazione per qualità) e la
// salva in src/silk/baked.js. Da rilanciare se si cambiano misure, griglia o sotto-passi.
//   npm run bake
import { writeFileSync } from 'node:fs';
import { Silk, encodeRest } from '../src/silk/silk.js';

// un solo tessuto per tutti gli schermi (la qualità cambia solo la mesh)
const out = {};
for (const quality of ['mobile']) {
  const t = performance.now();
  const s = new Silk({ quality, bake: false });
  const q = encodeRest(s.restShape);
  out.cloth = {
    nx: s.nx,
    ny: s.ny,
    substeps: s.cloth.substeps,
    time: Number(s.restTime.toFixed(4)),
    rest: Buffer.from(q.buffer).toString('base64'),
  };
  console.log(`${s.nx}×${s.ny}, ${Math.round(performance.now() - t)} ms, ${out.cloth.rest.length} caratteri`);
}
writeFileSync(
  new URL('../src/silk/baked.js', import.meta.url),
  `// Generato da scripts/bake-silk.mjs (npm run bake): la forma a riposo della seta.\nexport const BAKED = ${JSON.stringify(out)};\n`,
);
