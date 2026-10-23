// Parti comuni delle due presentazioni dei servizi (orizzontale 16:9 e verticale A4): colori, logo, font,
// progetti, immagini e stampa in PDF con Chromium.
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const brand = `${root}brand`;
export const V = '#B8F03A', R = '#D4A39C', INK = '#111';
export const svg = (f) => readFileSync(`${brand}/logo/${f}.svg`, 'utf8');
export const fileUrl = (p) => `file://${p}`;

export const fontFaces = () => [
  ['Syne', 800, 'Syne-800'], ['Inter', 400, 'Inter-400'], ['Inter', 500, 'Inter-500'], ['Inter', 600, 'Inter-600'],
].map(([family, weight, file]) => `@font-face { font-family: ${family}; font-weight: ${weight}; src: url(${fileUrl(`${brand}/fonts/${file}.ttf`)}); }`).join('\n');

// id, nome, settore · luogo, una frase, immagine della galleria da usare
export const PROJECTS = [
  ['urbaz', 'URBAZ', 'Bienes raíces · Yucatán, México', 'La península de Yucatán en 3D: desarrollos para explorar, búsqueda con filtros y rutas animadas.', '03'],
  ['piedra-de-agua', 'Piedra de Agua', 'Hotel boutique · Mérida, México', 'Del agua al patio: un recorrido inmersivo por las habitaciones del hotel.', '02'],
  ['picheta', 'Picheta', 'Restaurante · Mérida, México', 'La casa se vuelve el sitio: de la entrada a la terraza, con menú, autores y reservas.', '03'],
  ['pusceddu', 'Avv. Pusceddu', 'Despacho de abogados · Cagliari, Italia', 'Un dron recorre un monumento de mármol inspirado en Dante: cada cornisa, un área de práctica.', '02'],
  ['hacienda-teya', 'Hacienda Teya', 'Hacienda y restaurante · Yucatán, México', 'Una espina de henequén borda el nombre sobre el lino; la historia se vuelve recorrido.', '02'],
  ['antica-roma', 'Antica Roma', 'Restaurante · Mérida, México', 'Un avión despega del Coliseo y aterriza en Paseo de Montejo; los platos son los botones.', '01'],
  ['carnal', 'CARNAL', 'Carnicería boutique · Mérida, México', 'Ocho escenas en una sola película con scroll: vitrinas, cortes, el privado y la reserva.', '01'],
  ['il-calabrese', 'Il Calabrese', 'Pizzería · Mérida, México', 'Del cielo de Calabria a la mesa familiar: menú, reservas y mapa son platos que se tocan.', '02'],
];

export function workDir(name) {
  const dir = `${brand}/.build/${name}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

// immagine del sito senza testi (cartella facoltativa con p0251.png, p0359.png… da shoot.mjs --notext);
// in mancanza, quella con i testi di brand/sito
export async function sitePic(clean, name, fallback, out, w, h) {
  const src = clean && existsSync(`${clean}/${name}.png`) ? `${clean}/${name}.png` : `${brand}/sito/${fallback}.jpg`;
  await sharp(src).resize(w, h, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
}

// un'immagine per progetto dalla galleria del sito, in JPEG (PDF leggero)
export async function projectPics(dir, width) {
  const gallery = JSON.parse(readFileSync(`${root}src/assets/gallery.json`, 'utf8'));
  for (const [id, , , , pick] of PROJECTS) {
    const n = gallery[id]?.includes(pick) ? pick : gallery[id]?.[0];
    await sharp(`${root}public/gallery/${id}/${n}-1280.webp`).resize(width).jpeg({ quality: 82, mozjpeg: true }).toFile(`${dir}/${id}.jpg`);
  }
}

export async function renderPdf(htmlFile, pdfFile) {
  const require = createRequire(import.meta.url);
  let pw;
  try {
    pw = require('playwright');
  } catch {
    pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
  }
  const browser = await pw.chromium.launch();
  const tab = await browser.newPage();
  await tab.goto(fileUrl(htmlFile), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true });
  await browser.close();
}
