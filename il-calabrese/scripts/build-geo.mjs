// Genera src/data/world.json (tierra + fronteras) a partir de Natural Earth 1:50m (dominio público).
//
// Uso:
//   node scripts/build-geo.mjs land.geojson borders.geojson
// Fuente: https://github.com/nvkelso/natural-earth-vector (ne_50m_land, ne_50m_admin_0_boundary_lines_land)
// El archivo de salida ya está versionado: solo hace falta regenerarlo si se cambia la fuente.

import { readFile, writeFile } from 'node:fs/promises';

const [landPath, bordersPath] = process.argv.slice(2);
const OUT = new URL('../src/data/world.json', import.meta.url);
const q = (v) => Math.round(v * 100) / 100;

const rings = (geom) => {
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
};
const pack = (fc) =>
  fc.features.flatMap((f) => rings(f.geometry)).map((r) => r.flatMap(([x, y]) => [q(x), q(y)]));

const land = pack(JSON.parse(await readFile(landPath, 'utf8')));
const borders = pack(JSON.parse(await readFile(bordersPath, 'utf8')));
await writeFile(OUT, JSON.stringify({ land, borders }));
console.log(`OK: ${land.length} anillos de tierra, ${borders.length} fronteras`);
