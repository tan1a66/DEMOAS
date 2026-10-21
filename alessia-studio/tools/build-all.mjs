// Rigenera tutti gli asset: texture KTX2 e scena (geometria, bake, lightmap, GLB Draco).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (script, args = []) => execFileSync(process.execPath, [`${root}${script}`, ...args], { stdio: 'inherit', cwd: root });
try {
  run('tools/fetch-textures.mjs');
} catch {
  console.warn('texture CC0 non scaricate: si usa solo il generatore procedurale');
}
run('tools/textures.mjs');
run('tools/scene/build.mjs', process.argv.slice(2));
