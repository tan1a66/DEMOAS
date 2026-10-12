// Screenshot di controllo: node tools/snap.cjs out_dir "0,0.1,0.5" [width height]
// Usa la modalità ?rec (reloj virtual) e porta la scena allo stato di ogni progresso p.
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const out = process.argv[2] || 'snaps';
  const ps = (process.argv[3] || '0,0.1,0.3,0.5,0.72,0.8,0.84,0.88,0.92,1').split(',').map(Number);
  const W = +(process.argv[4] || 1920), H = +(process.argv[5] || 1080);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?rec');
  await page.evaluate(() => window.__arReady);
  await page.evaluate(() => window.__arSkipIntro());
  await page.mouse.move(W * 0.62, H * 0.42);
  for (const p of ps) {
    await page.evaluate((p) => { const max = document.documentElement.scrollHeight - innerHeight; scrollTo(0, p * max); }, p);
    for (let i = 0; i < 120; i++) await page.evaluate(() => window.__arTick(1000 / 30));
    await page.screenshot({ path: `${out}/p${String(p).padEnd(5, '0')}.jpg`, quality: 80, type: 'jpeg' });
  }
  console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'no errors');
  await browser.close();
})();
