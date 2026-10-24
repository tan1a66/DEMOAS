// Capturas del recorrido en viewport de iPhone (390x844) o escritorio.
// Uso: node scripts/shots.mjs [url] [outDir] [mobile|desktop] [dpr]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:5180/';
const out = process.argv[3] || 'shots';
const mode = process.argv[4] || 'mobile';
const dpr = +(process.argv[5] || 1);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mode === 'mobile'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'capture', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const settle = async (n = 3) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); };
const names = ['1-paseo', '2-porton', '3-patio', '4-boutiques', '5-aperitivo', '6-eventos', '7-salida'];
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
for (let i = 0; i < 7; i++) {
  if (only && !only.includes(i)) continue;
  // vista limpia de la parada (sin tarjeta) y vista con la tarjeta
  await page.evaluate((i) => { window.__T = 2 * i + 0.5; window.scrollTo(0, 0); }, i);
  await settle(4);
  await page.evaluate(() => { document.querySelector('main').style.visibility = 'hidden'; document.querySelector('.scrim').style.visibility = 'hidden'; });
  await settle(2);
  await page.screenshot({ path: `${out}/${names[i]}-3d.png` });
  await page.evaluate(() => { document.querySelector('main').style.visibility = ''; document.querySelector('.scrim').style.visibility = ''; });
  await page.evaluate((i) => { const y = window.__rec.scrollForStop(i, innerHeight); window.scrollTo(0, y); window.__T = undefined; }, i);
  await settle(4);
  await page.screenshot({ path: `${out}/${names[i]}-card.png` });
}
if (process.env.TRAVEL) {
  for (const T of process.env.TRAVEL.split(',').map(Number)) {
    await page.evaluate((T) => { window.__T = T; }, T);
    await settle(4);
    await page.evaluate(() => { document.querySelector('main').style.visibility = 'hidden'; document.querySelector('.scrim').style.visibility = 'hidden'; });
    await settle(1);
    await page.screenshot({ path: `${out}/t-${T}.png` });
    await page.evaluate(() => { document.querySelector('main').style.visibility = ''; document.querySelector('.scrim').style.visibility = ''; });
  }
}
const info = await page.evaluate(() => ({ calls: window.__world.renderer.info.render.calls, tris: window.__world.renderer.info.render.triangles, h: document.documentElement.scrollHeight, vh: innerHeight }));
console.log(JSON.stringify(info));
console.log(errors.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
