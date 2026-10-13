// Registra il video demo fotogramma per fotogramma (reloj virtual ?rec) → MP4 fluido a 60 fps.
//   node tools/record.cjs [out.mp4] [--fps 60] [--from 0] [--to 999] [--scale 1]
// Movimenti di scroll e cursore sono curve morbide; nessun frame perso, a prescindere dalla velocità della macchina.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : path.resolve(__dirname, '../../video/antica-roma-demo.mp4');
const FPS = +opt('fps', 60);
const FROM = +opt('from', 0), TO = +opt('to', 1e9); // finestra (secondi) da esportare: utile per anteprime veloci
const SCALE = +opt('scale', 1);
const W = 1920, H = 1080;

const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  out: (t) => 1 - Math.pow(1 - t, 3),
  lin: (t) => t,
};
// Catmull-Rom centripeta semplificata per percorsi del mouse naturali
function spline(pts, t) {
  if (pts.length === 1) return pts[0];
  const n = pts.length - 1, f = Math.min(n - 1e-9, t * n), i = Math.floor(f), u = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

class Film {
  constructor(page, cdp, ff) { this.page = page; this.cdp = cdp; this.ff = ff; this.frame = 0; this.mouse = [W * 0.6, H * 0.45]; this.p = 0; this.down = false; }
  get t() { return this.frame / FPS; }
  async setScroll(p) {
    this.p = p;
    await this.page.evaluate((p) => { const max = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, p * max); }, p);
  }
  async step() {
    await this.page.evaluate((ms) => window.__arTick(ms), 1000 / FPS);
    const t = this.t;
    if (t >= FROM - 1e-9 && t < TO - 1e-9) {
      const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true, captureBeyondViewport: false });
      const buf = Buffer.from(data, 'base64');
      if (!this.ff.stdin.write(buf)) await new Promise((r) => this.ff.stdin.once('drain', r));
    }
    this.frame++;
    if (this.frame % (FPS * 5) === 0) process.stdout.write(`  ${this.t.toFixed(1)}s\n`);
    if (this.t >= TO) throw new Error('__SEGMENT_DONE__'); // fine della finestra: inutile proseguire
  }
  // anima scroll e/o mouse insieme per `dur` secondi
  async play(dur, { scroll, mouse, e = 'inOut', me, se } = {}) {
    const n = Math.max(1, Math.round(dur * FPS));
    const p0 = this.p, m0 = this.mouse;
    const path = mouse ? [m0, ...mouse] : null;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      if (scroll != null) await this.setScroll(p0 + (scroll - p0) * ease[se || e](u));
      if (path) {
        const [x, y] = spline(path, ease[me || e](u));
        this.mouse = [x, y];
        await this.page.mouse.move(x, y);
      }
      await this.step();
    }
  }
  async wait(dur) { await this.play(dur, {}); }
  async click(hold = 0.08) {
    await this.page.mouse.down(); await this.play(hold, {});
    await this.page.mouse.up();
  }
  async key(k) { await this.page.keyboard.press(k); }
  async type(text, cps = 9) {
    for (const ch of text) { await this.page.keyboard.type(ch); await this.play(1 / cps, {}); }
  }
  async center(sel) {
    const r = await this.page.evaluate((s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width, b.height]; }, sel);
    if (!r) throw new Error('selector not found: ' + sel);
    return r;
  }
  async moveTo(sel, dur = 0.9, dx = 0, dy = 0, via) {
    const [x, y] = await this.center(sel);
    await this.play(dur, { mouse: [...(via || []), [x + dx, y + dy]] });
  }
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?rec');
  await page.evaluate(() => window.__arReady);
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
    '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

  const f = new Film(page, cdp, ff);
  const scene = require('./scene.cjs');
  const t0 = Date.now();
  try { await scene(f, { W, H, ease }); } catch (e) { if (!String(e && e.message).includes('__SEGMENT_DONE__')) throw e; }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`frames: ${f.frame} (${f.t.toFixed(1)}s) in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${OUT}`);
  if (errs.length) console.log('page errors:\n' + [...new Set(errs)].join('\n'));
  await browser.close();
})();
