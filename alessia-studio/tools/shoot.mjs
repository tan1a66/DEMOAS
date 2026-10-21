// Screenshot e misure lungo il percorso (Playwright + Chromium headless).
//   node tools/shoot.mjs <url> <outdir> [--mobile] [--fps] [--points=0,0.3,...]
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
const mobile = !!flags.mobile;
const points = (flags.points || '0,0.12,0.24,0.32,0.38,0.43,0.51,0.575,0.66,0.765,0.84,0.89,0.94,1').split(',').map(Number);
mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext(mobile
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
const qs = [flags.q ? `q=${flags.q}` : '', flags.mask || flags.transition ? 'still' : '', flags.transition ? 'slowloader' : ''].filter(Boolean).join('&');
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

if (flags.scroll) {
  // scroll reale (rotella): la telecamera deve avanzare in modo continuo
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(120);
    samples.push(await page.evaluate(() => ({ y: Math.round(window.scrollY), u: +window.__stats.u.toFixed(4) })));
  }
  console.log('scroll', JSON.stringify(samples));
}

for (const p of points) {
  await page.evaluate((p) => window.__jump(p), p);
  await page.waitForTimeout(flags.fps ? 2500 : 400);
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
