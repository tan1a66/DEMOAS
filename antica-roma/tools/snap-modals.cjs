// Screenshot dei modali: node tools/snap-modals.cjs out_dir [w h]
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const out = process.argv[2] || 'snaps'; const W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080);
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?rec');
  await page.evaluate(() => window.__arReady); await page.evaluate(() => window.__arSkipIntro());
  const tick = async (n) => { for (let i = 0; i < n; i++) await page.evaluate(() => window.__arTick(1000 / 30)); };
  await page.mouse.move(W * 0.55, H * 0.4);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await tick(150);
  const shot = (n) => page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 80 });
  await shot('00-table');
  await page.evaluate(() => AR.modals.open('menu')); await tick(8); await shot('01-menu-opening'); await tick(50); await shot('02-menu-cover');
  await page.mouse.move(W * 0.7, H * 0.75); await tick(30); await shot('03-menu-peel');
  await page.evaluate(() => AR.book.next()); await tick(9); await shot('04-menu-midflip'); await tick(50); await shot('05-menu-spread1');
  await page.evaluate(() => AR.book.next()); await tick(60); await shot('06-menu-spread2');
  await page.evaluate(() => AR.book.next()); await tick(60); await shot('07-menu-spread3');
  await page.keyboard.press('Escape'); await tick(40);
  for (const m of ['reserva', 'ubicacion', 'historia']) { await page.evaluate((m) => AR.modals.open(m), m); await tick(60); await shot('1-' + m); await page.keyboard.press('Escape'); await tick(40); }
  await shot('99-after');
  console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'no errors');
  await b.close();
})();
