// Screenshot e misure lungo il percorso (Playwright + Chromium headless).
//   node tools/shoot.mjs <url> <outdir> [--device=desktop|phone|phone-land|ipad|ipad-land|ipad-pro|insta|story]
//        [--stops] [--points=0,0.3,...] [--lang=es] [--fps] [--mask] [--scroll]
//   --stops: uno scatto per ogni sosta dello scroll guidato; --scroll: gesti reali di rotella (una sosta per gesto)
//   --dpr=2: densità dei pixel (immagini da ritagliare: 1080x1350 a --dpr=2 dà 2160x2700)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}

const [url = 'http://127.0.0.1:4173/', out = 'shots'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IOS },
  'phone-land': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IOS },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPAD },
  'ipad-land': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPAD },
  'ipad-pro': { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPAD },
  // formati Instagram: post verticale 4:5 e storia 9:16
  insta: { viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 },
  story: { viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 },
};
const device = flags.device || (flags.mobile ? 'phone' : 'desktop');
const mobile = device !== 'desktop';
let points = (flags.points || '0,0.12,0.24,0.32,0.38,0.43,0.51,0.575,0.66,0.765,0.84,0.89,0.94,1').split(',').map(Number);
mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
// --size=1200x800: finestra su misura (al posto del dispositivo)
const size = flags.size ? flags.size.split('x').map(Number) : null;
const ctx = await browser.newContext({
  ...DEVICES[device],
  ...(size ? { viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 } : {}),
  ...(flags.dpr ? { deviceScaleFactor: Number(flags.dpr) } : {}),
  reducedMotion: flags.reduced ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
page.setDefaultTimeout(240000);
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
const qs = [flags.q ? `q=${flags.q}` : '', flags.mask || flags.transition || flags.stops ? 'still' : '', flags.transition ? 'slowloader' : '', flags.notext ? 'notext' : '', flags.lang ? `lang=${flags.lang}` : ''].filter(Boolean).join('&');
await page.goto(url + (url.includes('?') ? '&' : '?') + qs);
if (flags.loader) {
  for (const t of [300, 900]) {
    await page.waitForTimeout(t);
    await page.screenshot({ path: `${out}/loader-${t}.png` });
  }
}
if (flags.transition) {
  // fotogrammi del passaggio loader -> orizzonte
  let k = 0;
  while (!(await page.evaluate(() => window.__ready || window.__error)) && k < 60) {
    await page.screenshot({ path: `${out}/transition-${String(k).padStart(2, '0')}.png` });
    k++;
    await page.waitForTimeout(250);
  }
}
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) {
  console.log('ERROR', err);
  console.log(logs.join('\n'));
  await browser.close();
  process.exit(1);
}
console.log('ready in', Date.now() - t0, 'ms');
const info = await page.evaluate(() => ({ ...window.__stats }));
console.log('tier', info.tier, 'gpu', info.gpu, 'dpr', info.dpr);
if (flags.sections) console.log('sections', JSON.stringify(await page.evaluate(() => window.__sections)));

if (flags.scroll) {
  // gesti reali di rotella (una raffica di eventi = un gesto): ogni gesto porta alla sosta successiva
  // e la telecamera ci arriva con un movimento continuo
  await page.mouse.move(700, 450);
  for (let g = 0; g < 3; g++) {
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(30);
    }
    const samples = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(400);
      samples.push(await page.evaluate(() => +window.__stats.p.toFixed(3)));
    }
    console.log(`gesto ${g + 1}: p`, samples.join(' '));
  }
}
if (flags.stops) points = await page.evaluate(() => window.__stops.map((s) => s.p));

for (const p of points) {
  await page.evaluate((p) => window.__jump(p), p);
  await page.waitForTimeout(flags.fps ? 2500 : +(flags.wait || 400));
  const s = await page.evaluate(() => ({ ...window.__stats }));
  const name = `p${String(Math.round(p * 1000)).padStart(4, '0')}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  if (flags.mask) {
    await page.evaluate(() => window.__mask(true));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/mask-${name}` });
    await page.evaluate(() => window.__mask(false));
  }
  console.log(`p=${p.toFixed(3)} fps=${s.fps} calls=${s.calls} tris=${s.triangles} dpr=${s.dpr}`);
}
if (logs.length) console.log(logs.slice(0, 30).join('\n'));
await browser.close();
