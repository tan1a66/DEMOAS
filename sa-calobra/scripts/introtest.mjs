// Prova dell'intro: schermata iniziale e la transizione (zoom nella M → strada) ferma a vari istanti.
// Uso: node scripts/introtest.mjs <url> <cartella> [istanti in s, es. 0.5,1.1,1.7,2.3]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, timesArg = '0.5,1.1,1.6,2.0,2.5'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const open = async (q) => {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url + q, { waitUntil: 'load' });
  await page.waitForSelector('#enter:not([disabled])', { timeout: 300000 });
  await page.waitForTimeout(700);
  return page;
};
let page = await open('');
await page.screenshot({ path: `${out}/0-intro.png` });
await page.close();
for (const [i, t] of timesArg.split(',').entries()) {
  page = await open(`?introAt=${t}`);
  await page.tap('#enter');
  await page.waitForSelector('body.intro-paused', { timeout: 120000 });
  await page.waitForTimeout(2500); // qualche fotogramma della scena dietro
  await page.screenshot({ path: `${out}/${i + 1}-t${t}.png`, timeout: 120000 });
  await page.close();
}
console.log('errori:', errs.length ? errs : 'nessuno');
await browser.close();
