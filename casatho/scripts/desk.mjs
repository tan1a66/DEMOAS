// Captura de escritorio (1440x900) de las paradas, para revisar el encuadre con la tarjeta a la izquierda.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1440), height: +(process.env.H || 900) } });
await page.goto('http://127.0.0.1:5180/?capture');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const settle = async (n = 3) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); };
for (const i of (process.env.ONLY || '0,2,5').split(',').map(Number)) {
  await page.evaluate((i) => { const y = window.__rec.scrollForStop(i, innerHeight); window.scrollTo(0, y); window.__T = undefined; }, i);
  await settle(4);
  await page.screenshot({ path: `${out}/desk-${i}-${process.env.W || 1440}.png` });
}
await browser.close();
