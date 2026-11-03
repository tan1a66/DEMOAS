// Registrazione dell'intera storia in viewport iPhone 15, fotogramma per fotogramma
// (il browser headless non ha GPU: si posiziona la storia e si fotografa ogni fotogramma).
// Uso: node scripts/capture.mjs <url-base> <cartella-fotogrammi> [fotogrammi=600] [dpr=1] [da=0] [a=1]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const [base, outDir, nArg = '600', dprArg = '1', fromArg = '0', toArg = '1'] = process.argv.slice(2);
const N = Number(nArg), from = Number(fromArg), to = Number(toArg);
const FPS = Number(process.env.FPS || 24);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: Number(dprArg), isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${base}${base.includes('?') ? '&' : '?'}capture`, { waitUntil: 'load' });
await page.waitForSelector('body.ready, body.error', { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);
const stops = await page.evaluate(() => window.__story.story.stops);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const p = from + (to - from) * (N === 1 ? 0 : i / (N - 1));
  // nelle soste si simula un trascinamento a 360° (andata e ritorno)
  let yaw = 0;
  for (const [a, b] of stops) {
    if (p > a && p < b) {
      const u = (p - a) / (b - a);
      // un giro lento verso sinistra e ritorno (come una persona che si guarda attorno)
      yaw = Math.sin(Math.PI * Math.min(Math.max((u - 0.1) / 0.8, 0), 1)) * Math.PI * 0.35;
    }
  }
  await page.evaluate(([p, yaw, fps]) => window.__story.seek(p, 1 / fps, yaw), [p, yaw, FPS]);
  await page.screenshot({ path: `${outDir}/${String(i).padStart(5, '0')}.png`, timeout: 120000 });
  if (i % 25 === 0) console.log(`fotogramma ${i}/${N} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
