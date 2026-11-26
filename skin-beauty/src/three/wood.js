import * as THREE from 'three';

// Textura de veta de madera generada en canvas (sin descargas).
// Clara y casi neutra: el color final lo da el material (nogal o miel).
// Es periódica en horizontal para que no se vea la costura en las piezas torneadas.

const SIZE = 512;

const hash = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// Ruido de valor periódico en X (periodo px celdas) para un mosaico sin costuras.
const makeNoise = (px, seed) => (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const a = hash(x0, yi, seed);
  const b = hash(x1, yi, seed);
  const c = hash(x0, yi + 1, seed);
  const d = hash(x1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export const createWoodTexture = (renderer) => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;

  const warp = makeNoise(6, 11);
  const warp2 = makeNoise(14, 23);
  const fiber = makeNoise(220, 37);
  const pores = makeNoise(160, 53);

  for (let py = 0; py < SIZE; py++) {
    const v = py / SIZE;
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE;
      // Desplazamiento suave de las vetas a lo largo de la pieza
      const w = warp(u * 6, v * 1.6) * 1.6 + warp2(u * 14, v * 4) * 0.35;
      const ring = (u * 5 + w + v * 0.6) % 1;
      // Banda de madera tardía (más oscura), con transición suave
      const late = Math.pow(Math.max(0, Math.sin(ring * Math.PI)), 6);
      const fine = fiber(u * 220, v * 7);
      const pore = pores(u * 160, v * 40);
      let lum = 0.95 - late * 0.2 - fine * 0.07 - (pore > 0.86 ? (pore - 0.86) * 0.7 : 0);
      lum = Math.min(1, Math.max(0, lum));
      const i = (py * SIZE + px) * 4;
      // Ligero tono cálido para que la veta no sea gris
      data[i] = 255 * lum;
      data[i + 1] = 255 * (lum * 0.965);
      data[i + 2] = 255 * (lum * 0.92);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
};

export const createWoodMaterials = (renderer) => {
  const { map, bump } = createWoodTexture(renderer);
  const wood = (color, opts = {}) =>
    new THREE.MeshPhysicalMaterial({
      color,
      map,
      bumpMap: bump,
      bumpScale: opts.bump ?? 0.6,
      roughness: opts.roughness ?? 0.42,
      clearcoat: opts.clearcoat ?? 0.35,
      clearcoatRoughness: 0.32,
      sheen: 0.25,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#f3d2c4'),
      envMapIntensity: 0.9,
    });

  return {
    honey: wood('#E2AA72'),
    honeyLight: wood('#EBC08F', { roughness: 0.44 }),
    walnut: wood('#94603F', { roughness: 0.34, clearcoat: 0.55 }),
    walnutDeep: wood('#7E4F33', { roughness: 0.34, clearcoat: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: '#7d7068', metalness: 0.85, roughness: 0.35 }),
    cord: new THREE.MeshStandardMaterial({ color: '#F5EDE6', roughness: 0.8 }),
  };
};
