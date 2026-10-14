// Genera src/data/mapa.json: el mapa minimalista de puntos de la escena "Orígenes"
// (Pacífico al centro: Japón y Australia a la izquierda, Norteamérica y Yucatán a la derecha).
//
// Uso:
//   node scripts/build-mapa.mjs world.json
// Entrada: tierra de Natural Earth 1:50m (dominio público) en el formato compacto
//   { "land": [[lon, lat, lon, lat, ...], ...] }  (el mismo world.json de la demo Il Calabrese)
//   o un GeoJSON (FeatureCollection de Polygon/MultiPolygon).
// El archivo de salida ya está versionado: solo hace falta regenerarlo si cambia la vista.

import { readFile, writeFile } from 'node:fs/promises';

// Vista: longitudes 95°E → 292°E (= 68°O), latitudes 62°N → 50°S. 10 unidades SVG por grado.
export const VISTA = { lon0: 95, lon1: 292, lat0: 62, lat1: -50, escala: 10 };
const PASO = 1.8; // grados entre puntos

const [entrada] = process.argv.slice(2);
if (!entrada) throw new Error('Uso: node scripts/build-mapa.mjs world.json');
const OUT = new URL('../src/data/mapa.json', import.meta.url);

const datos = JSON.parse(await readFile(entrada, 'utf8'));
let anillos;
if (datos.land) {
  anillos = datos.land.map((r) => {
    const pts = [];
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
    return pts;
  });
} else {
  anillos = datos.features.flatMap((f) =>
    f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat(),
  );
}

// Caja de cada anillo para descartar rápido.
const cajas = anillos.map((r) => {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const [x, y] of r) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
  return [a, b, c, d];
});

// Par/impar sobre todos los anillos (los lagos quedan como huecos).
const enTierra = (lon, lat) => {
  let dentro = false;
  for (let k = 0; k < anillos.length; k++) {
    const [a, b, c, d] = cajas[k];
    if (lon < a || lon > b || lat < c || lat > d) continue;
    const r = anillos[k];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
};

const { lon0, lon1, lat0, lat1, escala } = VISTA;
const puntos = [];
for (let lat = lat0 - PASO / 2; lat > lat1; lat -= PASO) {
  for (let lon = lon0 + PASO / 2; lon < lon1; lon += PASO) {
    const lonReal = lon > 180 ? lon - 360 : lon;
    if (enTierra(lonReal, lat)) puntos.push([Math.round((lon - lon0) * escala), Math.round((lat0 - lat) * escala)]);
  }
}

const ancho = (lon1 - lon0) * escala;
const alto = (lat0 - lat1) * escala;
await writeFile(OUT, JSON.stringify({ vista: VISTA, ancho, alto, paso: PASO * escala, puntos }));
console.log(`OK: ${puntos.length} puntos, ${ancho}×${alto}`);
