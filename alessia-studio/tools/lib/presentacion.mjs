// Parti comuni delle due presentazioni dei servizi (orizzontale 16:9 e verticale A4): colori, logo, font,
// immagini del sito e stampa in PDF con Chromium.
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
