// Genera src/data/yucatan.geo.json a partir de Natural Earth (dominio público).
//
// Uso:
//   node scripts/build-geo.mjs                 -> descarga ne_10m_admin_1 desde GitHub
//   node scripts/build-geo.mjs ruta/local.json -> usa un archivo ya descargado
//
// Fuente: https://github.com/nvkelso/natural-earth-vector (ne_10m_admin_1_states_provinces)
// El archivo de salida ya está versionado: solo hace falta regenerarlo si se cambia el área.

import { readFile, writeFile } from 'node:fs/promises';

const SRC_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const OUT = new URL('../src/data/yucatan.geo.json', import.meta.url);

// Área de la escena (lon/lat). Incluye un poco de contexto: Tabasco, Chiapas, Belice, Guatemala, Cuba.
const BBOX = { minLon: -94.0, maxLon: -84.6, minLat: 15.0, maxLat: 23.4 };
const MAIN = { 'MX-YUC': 'yucatan', 'MX-ROO': 'quintana-roo', 'MX-CAM': 'campeche' };
const CONTEXT_COUNTRIES = new Set(['MEX', 'BLZ', 'GTM', 'CUB', 'HND']);

const load = async () => {
  const local = process.argv[2];
  if (local) return JSON.parse(await readFile(local, 'utf8'));
  console.log('Descargando Natural Earth admin-1 (≈40 MB)…');
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// Recorte Sutherland–Hodgman de un anillo contra el rectángulo BBOX.
const clipRing = (ring) => {
  const edges = [
    [(p) => p[0] >= BBOX.minLon, (a, b) => lerpAt(a, b, 0, BBOX.minLon)],
    [(p) => p[0] <= BBOX.maxLon, (a, b) => lerpAt(a, b, 0, BBOX.maxLon)],
    [(p) => p[1] >= BBOX.minLat, (a, b) => lerpAt(a, b, 1, BBOX.minLat)],
    [(p) => p[1] <= BBOX.maxLat, (a, b) => lerpAt(a, b, 1, BBOX.maxLat)],
  ];
  let out = ring;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cut(prev, cur));
      }
    }
    if (!out.length) return out;
  }
  return out;
};
const lerpAt = (a, b, axis, v) => {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

// Simplificación por distancia mínima entre vértices (grados) + redondeo.
const simplify = (ring, minDist) => {
  const out = [];
  for (const p of ring) {
    const q = [+p[0].toFixed(4), +p[1].toFixed(4)];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= minDist) out.push(q);
  }
  // Quitar el cierre duplicado: la escena cierra los anillos sola.
  const f = out[0], l = out[out.length - 1];
  if (out.length > 1 && f[0] === l[0] && f[1] === l[1]) out.pop();
  return out;
};

const ringArea = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

const polygonsOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

const intersectsBbox = (geom) =>
  polygonsOf(geom).some((poly) =>
    poly[0].some(([x, y]) => x >= BBOX.minLon && x <= BBOX.maxLon && y >= BBOX.minLat && y <= BBOX.maxLat)
  );

const src = await load();
const features = [];

for (const f of src.features) {
  const p = f.properties;
  const isoCode = p.iso_3166_2;
  const main = MAIN[isoCode];
  if (!main && !CONTEXT_COUNTRIES.has(p.adm0_a3)) continue;
  if (!intersectsBbox(f.geometry)) continue;

  const minDist = main ? 0.004 : 0.012;
  const polys = [];
  for (const poly of polygonsOf(f.geometry)) {
    const rings = poly
      .map((ring) => simplify(main ? ring : clipRing(ring), minDist))
      .filter((r) => r.length >= 3);
    if (!rings.length || ringArea(rings[0]) < (main ? 0.0004 : 0.004)) continue;
    polys.push(rings);
  }
  if (!polys.length) continue;

  features.push({
    type: 'Feature',
    properties: {
      id: main ?? isoCode ?? p.adm1_code,
      name: p.name,
      country: p.adm0_a3,
      main: Boolean(main),
    },
    geometry: { type: 'MultiPolygon', coordinates: polys },
  });
}

const out = {
  type: 'FeatureCollection',
  source: 'Natural Earth 1:10m admin-1 (public domain) — scripts/build-geo.mjs',
  bbox: [BBOX.minLon, BBOX.minLat, BBOX.maxLon, BBOX.maxLat],
  features,
};
await writeFile(OUT, JSON.stringify(out));
console.log(
  `OK: ${features.length} entidades (${features.filter((f) => f.properties.main).length} principales) -> ${OUT.pathname}`
);
