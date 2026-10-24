// Fotogramas de la intro (hojas + logo) avanzando la línea de tiempo a mano: ?introtest
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, isMobile: !process.env.W, hasTouch: !process.env.W });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5180/?introtest', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const settle = async (n = 3) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); };
const ps = [0, 0.12, 0.3, 0.5, 0.7, 0.86, 0.94, 1];
for (const [i, p] of ps.entries()) {
  await page.evaluate((p) => { window.__introTL.progress(p); }, p);
  await settle(3);
  await page.screenshot({ path: `${out}/intro-${i}.png` });
}
console.log(errors.join('\n') || 'no errors');
await browser.close();
