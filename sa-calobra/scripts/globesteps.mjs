// Anteprime del globo: una foto ferma per tappa (viewport iPhone 15).
// Uso: node scripts/globesteps.mjs <url-base> <cartella> [dpr=1] [tappe es. 0,5]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, outDir, dprArg = '1', only = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: Number(dprArg), isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${base}${base.includes('?') ? '&' : '?'}capture`, { waitUntil: 'load' });
await page.waitForSelector('body.ready, body.error', { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);
const labels = await page.evaluate(() => window.__globe.story.labels);
for (const i of (only ? only.split(',').map(Number) : labels.map((_, i) => i))) {
  await page.evaluate((p) => window.__globe.seek(p), labels[i]);
  await page.waitForFunction(() => [...document.images].every((im) => im.complete), null, { timeout: 30000 });
  await page.waitForTimeout(500); // le foto si dipingono un attimo dopo il caricamento
  await page.screenshot({ path: `${outDir}/g-${i}.png`, timeout: 120000 });
  console.log('tappa', i);
}
if (process.env.INFO) {
  await page.evaluate(() => window.__globe.info.open());
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/g-info.png`, timeout: 120000 });
}
if (process.env.CH) {
  await page.evaluate((n) => window.__globe.openChapter(n), process.env.CH);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/g-cap${process.env.CH}.png`, timeout: 120000 });
}
await browser.close();
