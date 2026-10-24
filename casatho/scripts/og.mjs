// Genera public/og.jpg (1200x630, vista previa en WhatsApp/Instagram) y los favicons PNG.
// Requiere el servidor de desarrollo en marcha: npx vite
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5180/';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });

const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(base + '?capture&og', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => { window.__T = 0.3; });
for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 86 });

const svg = fs.readFileSync('public/favicon.svg', 'utf8');
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:#f6f2ea">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `public/${name}`, omitBackground: name === 'favicon-32.png' });
  await p.close();
}
await browser.close();
console.log('ok');
