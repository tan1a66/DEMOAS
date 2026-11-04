// Contorni del mondo (Natural Earth via world-atlas, pubblico dominio) → anelli lon/lat in JSON,
// che scripts/build_land_tex.py trasforma nelle texture del globo.
// Uso: node scripts/build_land.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';

const out = new URL('../.cache/land/', import.meta.url);
mkdirSync(out, { recursive: true });
const load = (f) => JSON.parse(readFileSync(new URL(`../node_modules/world-atlas/${f}`, import.meta.url)));
const rings = (geo) => {
  const r = [];
  const add = (poly) => poly.forEach((ring, i) => r.push({ hole: i > 0, pts: ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]) }));
  for (const f of geo.type === 'FeatureCollection' ? geo.features : [geo]) {
    const g = f.geometry || f;
    if (g.type === 'Polygon') add(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(add);
  }
  return r;
};
for (const res of ['50m', '10m']) {
  const land = load(`land-${res}.json`);
  const lr = rings(feature(land, land.objects.land));
  const countries = load(`countries-${res}.json`);
  const borders = mesh(countries, countries.objects.countries, (a, b) => a !== b).coordinates;
  writeFileSync(new URL(`land-${res}.json`, out), JSON.stringify({ rings: lr, borders }));
  console.log(res, 'anelli', lr.length, 'confini', borders.length);
}
