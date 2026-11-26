// Anteprima del link (public/og-eia.jpg, 1200×630) e icone (favicon-96.png, apple-touch-icon.png).
// L'anteprima è una foto del sito vero: la prima pagina a 1200×630, con i mirtilli a riposo
// (?still) e senza "Desliza". Le icone: la É di ÉIA, rosso smaltato su azzurro.
// Con il sito avviato (npm run dev) e Playwright installato:  node scripts/og-icons.cjs
const { chromium } = require('playwright');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');
const URL = process.env.URL || 'http://127.0.0.1:5183/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(URL + '?still', { waitUntil: 'load' });
  await p.addStyleTag({ content: '.scroll-hint{display:none!important}' });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(pub, 'og-eia.jpg'), type: 'jpeg', quality: 86 });
  const font = 'file://' + path.join(__dirname, '..', 'src', 'fonts', 'bodoni-moda-normal.woff2');
  for (const [name, size, radius] of [['favicon-96.png', 96, 22], ['apple-touch-icon.png', 180, 0]]) {
    const q = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await q.setContent(`<html><head><style>@font-face{font-family:B;src:url(${font})}
      html,body{margin:0;background:transparent}
      div{width:${size}px;height:${size}px;border-radius:${radius}px;background:#bbd5ec;display:grid;place-items:center;
      font:600 ${Math.round(size * 0.74)}px/1 B;color:#b0101d;padding-top:${Math.round(size * 0.1)}px;box-sizing:border-box}</style></head>
      <body><div>É</div></body></html>`);
    await q.evaluate(() => document.fonts.ready);
    await q.waitForTimeout(300);
    await q.screenshot({ path: path.join(pub, name), omitBackground: true });
  }
  await b.close();
  console.log('ok');
})();
