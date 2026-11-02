// Caricamento dei dati geografici (Fase 1) tramite THREE.LoadingManager,
// così il loader (Fase 4) può seguirne l'avanzamento.
import { FileLoader } from 'three';
import { decode } from 'fast-png';

const BASE = `${import.meta.env.BASE_URL}data/`;

function loadFile(manager, url, responseType) {
  const loader = new FileLoader(manager);
  loader.setResponseType(responseType);
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

/** PNG 16 bit in scala di grigi → Float32Array di quote in metri */
async function loadHeightLevel(manager, meta) {
  const buf = await loadFile(manager, BASE + meta.file, 'arraybuffer');
  const png = decode(new Uint8Array(buf));
  if (png.depth !== 16 || png.channels !== 1) throw new Error(`${meta.file}: atteso PNG 16 bit grigio`);
  const n = png.width * png.height;
  const h = new Float32Array(n);
  const k = (meta.hMax - meta.hMin) / 65535;
  for (let i = 0; i < n; i++) h[i] = meta.hMin + png.data[i] * k;
  return { ...meta, data: h };
}

export async function loadGeoData(manager) {
  const [terrainMeta, road] = await Promise.all([
    loadFile(manager, BASE + 'terrain.json', 'json'),
    loadFile(manager, BASE + 'road.json', 'json'),
  ]);
  const names = Object.keys(terrainMeta.levels);
  const decoded = await Promise.all(names.map((n) => loadHeightLevel(manager, terrainMeta.levels[n])));
  const levels = Object.fromEntries(names.map((n, i) => [n, decoded[i]]));
  return { terrainMeta, levels, road };
}
