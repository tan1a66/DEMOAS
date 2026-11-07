// Genera l'immagine Open Graph (anteprima nei social e su WhatsApp): public/og/default.jpg (1200×630).
// Richiede Playwright con Chromium:  npx playwright install chromium  (una tantum), poi:
//   node scripts/genera-og.cjs
// Il disegno è in scripts/og/og.html (usa gli stessi font del sito).
const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'og', 'og.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(__dirname, '..', 'public', 'og', 'default.jpg'), type: 'jpeg', quality: 88 });
  await browser.close();
  console.log('Creato public/og/default.jpg');
})();
