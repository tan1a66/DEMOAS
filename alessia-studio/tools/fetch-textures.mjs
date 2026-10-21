// Scarica un cemento reale CC0 (Poly Haven, poi ambientCG) in tools/.cache/base/<id>/.
//   node tools/fetch-textures.mjs [id]
// Le mappe vengono usate da tools/textures.mjs come micro-dettaglio della superficie a cassero.
import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cache = fileURLToPath(new URL('./.cache/base', import.meta.url));
const POLYHAVEN = ['concrete_wall_008', 'concrete_wall_006', 'concrete_floor_02', 'concrete_wall_004'];
const AMBIENTCG = ['Concrete034', 'Concrete031', 'Concrete044A'];

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

async function fromPolyHaven(id) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  const pick = (k) => files[k]?.['2k']?.png?.url || files[k]?.['2k']?.jpg?.url;
  const maps = { albedo: pick('Diffuse'), normal: pick('nor_gl'), roughness: pick('Rough') };
  if (!maps.albedo || !maps.normal || !maps.roughness) throw new Error(`mappe incomplete per ${id}`);
  const dir = `${cache}/${id}`;
  mkdirSync(dir, { recursive: true });
  for (const [k, url] of Object.entries(maps)) {
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    writeFileSync(`${dir}/${k}${url.slice(url.lastIndexOf('.'))}`, buf);
  }
  return dir;
}

async function fromAmbientCG(id) {
  const dir = `${cache}/${id}`;
  const tmp = `${cache}/.zip-${id}`;
  mkdirSync(tmp, { recursive: true });
  const zip = Buffer.from(await (await get(`https://ambientcg.com/get?file=${id}_2K-PNG.zip`)).arrayBuffer());
  writeFileSync(`${tmp}/a.zip`, zip);
  // estrazione con il modulo zipfile di Python (isolato, nessun codice dall'archivio)
  execFileSync('python3', ['-I', '-m', 'zipfile', '-e', `${tmp}/a.zip`, `${tmp}/x`]);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(`${tmp}/x`)) {
    const l = f.toLowerCase();
    const k = l.includes('color') ? 'albedo' : l.includes('normalgl') ? 'normal' : l.includes('roughness') ? 'roughness' : null;
    if (k) renameSync(`${tmp}/x/${f}`, `${dir}/${k}${f.slice(f.lastIndexOf('.'))}`);
  }
  rmSync(tmp, { recursive: true, force: true });
  return dir;
}

const wanted = process.argv[2];
const tries = wanted ? [[wanted, wanted.includes('_') ? fromPolyHaven : fromAmbientCG]]
  : [...POLYHAVEN.map((id) => [id, fromPolyHaven]), ...AMBIENTCG.map((id) => [id, fromAmbientCG])];
mkdirSync(cache, { recursive: true });
for (const [id, fn] of tries) {
  if (existsSync(`${cache}/${id}`)) {
    console.log(`già presente: ${id}`);
    process.exit(0);
  }
  try {
    const dir = await fn(id);
    console.log(`scaricato ${id} in ${dir}`);
    process.exit(0);
  } catch (e) {
    console.warn(`${id}: ${e.message || e}`);
  }
}
console.error('Nessuna texture scaricata: polyhaven.com e ambientcg.com non sono raggiungibili da questa rete.');
process.exit(1);
