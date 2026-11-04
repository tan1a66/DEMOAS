// Crea il PDF della proposta da index.html (A4, fondi e font inclusi).
// Uso: NODE_PATH=$(npm root -g) node proposal/build.mjs <file.pdf> [index.html | corta.html]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, 'Alessia-Studio-x-Nomads.pdf'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(join(here, process.argv[3] || 'index.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`));
await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
console.log('PDF:', out, '· font caricati:', [...new Set(fonts)].join(', ') || 'nessuno');
await browser.close();
