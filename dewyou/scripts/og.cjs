// Imagen de vista previa del enlace (1200×630) a partir del hero real.
// Uso: con `npm run dev` en marcha →  node scripts/og.cjs [url]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5173/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  await p.addStyleTag({ content: '.wa-float,.hero__foot,.cursor{display:none!important}' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, '..', 'public', 'og.jpg'), type: 'jpeg', quality: 86 });
  await b.close();
})();
