// Caricamento dei dati geografici (Fase 1) tramite THREE.LoadingManager,
// così il loader (Fase 4) può seguirne l'avanzamento.
import { FileLoader, Texture, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';
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

/** immagine WebP → texture (srgb: colore; altrimenti dati, come le maschere del globo) */
async function loadImageTexture(manager, file, { srgb = false, flipY = false } = {}) {
  const buf = await loadFile(manager, BASE + file, 'arraybuffer');
  const url = URL.createObjectURL(new Blob([buf], { type: 'image/webp' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  const t = new Texture(img);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.flipY = flipY;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** foto aerea → texture sRGB; la riga 0 dell'immagine è il nord (zMin), come le heightmap */
const loadOrtho = (manager, meta) => loadImageTexture(manager, meta.file, { srgb: true });

/** il globo: la Terra (colori e rilievo) e le maschere di terra, costa e confini su tre livelli */
export async function loadGlobeData(manager) {
  const meta = await loadFile(manager, BASE + 'globe.json', 'json');
  const names = ['world', 'med', 'bal', 'earth', 'topo', 'eu', 'mx'];
  const photo = ['earth', 'eu', 'mx'];
  const tex = await Promise.all(names.map((n) => loadImageTexture(manager, meta[n].file, { flipY: true, srgb: photo.includes(n) })));
  return { meta, tex: Object.fromEntries(names.map((n, i) => [n, tex[i]])) };
}

/** pini riconosciuti nella foto: x·2, z·2 (int16) e grandezza 0…255 */
async function loadTrees(manager, meta) {
  const buf = await loadFile(manager, BASE + meta.file, 'arraybuffer');
  const n = new DataView(buf).getUint32(0, true);
  return { count: n, xz: new Int16Array(buf.slice(4, 4 + n * 4)), size: new Uint8Array(buf, 4 + n * 4, n) };
}

export async function loadGeoData(manager) {
  const [terrainMeta, road] = await Promise.all([
    loadFile(manager, BASE + 'terrain.json', 'json'),
    loadFile(manager, BASE + 'road.json', 'json'),
  ]);
  const names = Object.keys(terrainMeta.levels);
  const decoded = await Promise.all(names.map((n) => loadHeightLevel(manager, terrainMeta.levels[n])));
  const levels = Object.fromEntries(names.map((n, i) => [n, decoded[i]]));
  // foto aerea e pini veri (se presenti: senza, il terreno resta procedurale)
  const om = terrainMeta.ortho;
  const [orthoHi, orthoBase, trees] = await Promise.all([
    om ? loadOrtho(manager, om.hi) : null,
    om ? loadOrtho(manager, om.base) : null,
    terrainMeta.trees ? loadTrees(manager, terrainMeta.trees) : null,
  ]);
  return { terrainMeta, levels, road, ortho: om ? { hi: orthoHi, base: orthoBase } : null, trees };
}
