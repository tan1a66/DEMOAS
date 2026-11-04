// Anteprime delle tappe: una foto ferma per ogni tappa della storia (viewport iPhone 15).
// Uso: node scripts/steps.mjs <url-base> <cartella> [dpr=2] [tappe es. 0,3,5]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, outDir, dprArg = '2', only = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: Number(dprArg), isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${base}${base.includes('?') ? '&' : '?'}capture`, { waitUntil: 'load' });
await page.waitForSelector('body.ready, body.error', { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);
const labels = await page.evaluate(() => window.__story.story.labels);
const pick = only ? only.split(',').map(Number) : labels.map((_, i) => i);
for (const i of pick) {
  // dt lungo: lo stabilizzatore della camera arriva a regime in un fotogramma
  await page.evaluate((p) => { window.__story.seek(p, 10); window.__story.seek(p, 10); }, labels[i]);
  await page.screenshot({ path: `${outDir}/step-${i}.png`, timeout: 120000 });
  console.log('tappa', i, labels[i].toFixed(3));
}
// EXTRA=1: anche l'immagine "Comparte tu cima" e il pannello del viaggio
if (process.env.EXTRA) {
  const { writeFileSync } = await import('node:fs');
  const top = labels[await page.evaluate(() => window.__story.story.order.indexOf('top'))];
  await page.evaluate((p) => { window.__story.seek(p, 10); window.__story.seek(p, 10); }, top);
  const url = await page.evaluate(() => window.__story.share.dataURL());
  writeFileSync(`${outDir}/share.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  // il pannello del Capítulo 01, con il livello "Difícil" scelto
  await page.evaluate(() => window.__story.info.open());
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/info-1.png`, timeout: 120000 });
  await page.evaluate(() => { document.querySelector('#levels button:last-child').click(); document.getElementById('info-scroll').scrollTop = 520; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/info-2.png`, timeout: 120000 });
  await page.evaluate(() => { document.getElementById('info-scroll').scrollTop = 99999; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/info-3.png`, timeout: 120000 });
  console.log('extra ok');
}
await browser.close();
