import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Mappe di cemento reale (CC0) scaricate da tools/fetch-textures.mjs in tools/.cache/base/<id>/
// con i nomi albedo.*, normal.* (OpenGL, y in alto) e roughness.*
const cacheDir = fileURLToPath(new URL('../.cache/base', import.meta.url));

async function readGray(file, size) {
  const { data } = await sharp(file).resize(size, size, { fit: 'fill' }).removeAlpha().grayscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}
async function readRGB(file, size) {
  const { data } = await sharp(file).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

export async function loadBaseConcrete(size) {
  if (!existsSync(cacheDir)) return null;
  const ids = readdirSync(cacheDir);
  for (const id of ids) {
    const dir = `${cacheDir}/${id}`;
    const find = (key) => readdirSync(dir).find((f) => f.toLowerCase().startsWith(key));
    const a = find('albedo'), n = find('normal'), r = find('roughness');
    if (!a || !n || !r) continue;
    const albedo = await readGray(`${dir}/${a}`, size);
    const normal = await readRGB(`${dir}/${n}`, size);
    const rough = await readGray(`${dir}/${r}`, size);
    let mean = 0;
    for (let i = 0; i < albedo.length; i++) mean += albedo[i];
    mean /= albedo.length;
    // l'immagine ha la prima riga in alto; il generatore usa la riga 0 in basso (v = 0)
    const flip = (buf, ch) => {
      const out = Buffer.alloc(buf.length);
      const row = size * ch;
      for (let y = 0; y < size; y++) buf.copy(out, (size - 1 - y) * row, y * row, (y + 1) * row);
      return out;
    };
    return { name: id, albedo: flip(albedo, 1), normal: flip(normal, 3), rough: flip(rough, 1), mean };
  }
  return null;
}

// Fonde il micro-dettaglio reale sulla superficie generata (stesso formato RGBA del generatore)
export function blendBase(data, base, size, amount) {
  for (let i = 0; i < size * size; i++) {
    const nx = data[i * 4] / 127.5 - 1, ny = data[i * 4 + 1] / 127.5 - 1;
    const bx = base.normal[i * 3] / 127.5 - 1, by = base.normal[i * 3 + 1] / 127.5 - 1;
    const x = nx + bx * amount, y = ny + by * amount;
    const l = Math.max(1, Math.hypot(x, y) / 0.98);
    data[i * 4] = Math.round(((x / l) * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round(((y / l) * 0.5 + 0.5) * 255);
    const k = base.albedo[i] / base.mean;
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(data[i * 4 + 2] * (1 + (k - 1) * amount))));
    data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - amount * 0.5) + base.rough[i] * amount * 0.5);
  }
}
