// Grabación determinista de la demo: reloj virtual (rAF, timers, performance.now, animaciones CSS)
// avanzado fotograma a fotograma, captura JPEG por fotograma.
// Uso (ver README, sección "Video"):
//   PW=$(npm root -g)/playwright W=1280 H=720 DPR=1.5 LITE=1 PR=1 node capture.cjs <A|B|test|btest> <dirSalida>
// La página debe estar servida en http://localhost:5191/ (build-page.py + python3 -m http.server 5191).
const { chromium } = require(process.env.PW);
const fs = require('fs');
const path = require('path');

const FPS = 30;
const W = +(process.env.W || 1920);
const H = +(process.env.H || 1080);
const [seg, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const VIRTUAL_TIME = () => {
  let now = 0;
  const t0 = 1760000000000;
  const raf = new Map();
  let rafId = 0;
  const timers = new Map();
  let tid = 0;
  window.requestAnimationFrame = (cb) => (raf.set(++rafId, cb), rafId);
  window.cancelAnimationFrame = (id) => raf.delete(id);
  window.setTimeout = (cb, ms = 0, ...a) => (timers.set(++tid, { at: now + (+ms || 0), cb, a }), tid);
  window.clearTimeout = (id) => timers.delete(id);
  window.setInterval = (cb, ms = 0) => {
    const id = ++tid;
    const run = () => (timers.set(id, { at: now + Math.max(1, +ms || 0), cb: () => (cb(), run()), a: [] }));
    run();
    return id;
  };
  window.clearInterval = (id) => timers.delete(id);
  performance.now = () => now;
  Date.now = () => t0 + now;
  const syncAnims = () => {
    for (const an of document.getAnimations()) {
      if (an.__vs === undefined) {
        an.__vs = now;
        an.pause();
      }
      an.currentTime = Math.max(0, now - an.__vs);
    }
  };
  window.__vt = {
    advance(ms) {
      now += ms;
      for (let guard = 0; guard < 1000; guard++) {
        let next = null;
        for (const [id, t] of timers) if (t.at <= now && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        timers.delete(next[0]);
        try { next[1].cb(...next[1].a); } catch (e) { console.error(e); }
      }
      const q = [...raf.values()];
      raf.clear();
      for (const cb of q) try { cb(now); } catch (e) { console.error(e); }
      syncAnims();
    },
    now: () => now,
  };
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DPR || 1) });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && console.log('console', m.text().slice(0, 200)));
  await page.addInitScript(VIRTUAL_TIME);
  const url = 'http://localhost:5191/?debug' + (seg === 'B' || seg === 'btest' ? '&mesa' : '') + (process.env.LITE ? '&lite' : '') + (process.env.PR ? '&pr=' + process.env.PR : '');
  await page.goto(url);

  let n = 0;
  let scale = 1;
  const cur = { x: W * 0.5, y: H * 0.62, on: false };
  // START_AT: re-grabar solo desde ese fotograma (los anteriores se recorren sin renderizar).
  const START_AT = +(process.env.START_AT || 0);
  const step = async (fn) => {
    await page.evaluate(([ms, c, f, skip]) => {
      if (skip !== null) window.__skipRender = skip;
      if (f) (0, eval)(f)();
      window.__vt.advance(ms);
      const el = document.getElementById('vcursor');
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
      el.classList.toggle('on', c.on);
    }, [1000 / FPS * scale, cur, fn ? fn.toString() : null, START_AT ? n < START_AT : null]);
  };
  const shot = async () => {
    if (n < START_AT) return void n++;
    await page.screenshot({ path: path.join(outDir, String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92, timeout: 0 });
  };
  const frame = async (fn) => { await step(fn); await shot(); };
  const hold = async (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) await frame(); };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  // Mueve el cursor y emite pointermove sobre lo que haya debajo (hover de los platos).
  const move = async (x, y, sec) => {
    const x0 = cur.x, y0 = cur.y, N = Math.max(1, Math.round(sec * FPS));
    for (let i = 1; i <= N; i++) {
      const k = ease(i / N);
      cur.x = x0 + (x - x0) * k;
      cur.y = y0 + (y - y0) * k;
      await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        el && el.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      }, [cur.x, cur.y]);
      await frame();
    }
  };
  const click = async () => {
    await page.evaluate(([x, y]) => {
      const c = document.getElementById('vcursor');
      c.classList.add('down');
      const r = document.createElement('div');
      r.className = 'vripple';
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
      setTimeout(() => c.classList.remove('down'), 140);
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('a')) el.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
    }, [cur.x, cur.y]);
  };
  const rectOf = (sel) => page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, h: r.height };
  }, sel);
  const plate = (i) => page.evaluate(([i, w, h]) => window.__demo.table.plateScreen(i, w, h), [i, W, H]);
  // Desplaza un contenedor con easing, fotograma a fotograma.
  const scroll = async (sel, to, sec) => {
    const from = await page.evaluate((s) => document.querySelector(s).scrollTop, sel);
    const N = Math.round(sec * FPS);
    for (let i = 1; i <= N; i++) {
      const y = from + (to - from) * ease(i / N);
      await page.evaluate(([s, y]) => { document.querySelector(s).scrollTop = y; document.querySelector(s).dispatchEvent(new Event('scroll')); }, [sel, y]);
      await frame();
    }
  };
  const type = async (sel, text, sec) => {
    const N = Math.round(sec * FPS);
    for (let i = 1; i <= N; i++) {
      await page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.focus({ preventScroll: true }); }, [sel, text.slice(0, Math.round((text.length * i) / N))]);
      await frame();
    }
  };

  // Carga sin capturar hasta que el botón "Entrar" esté listo.
  for (let i = 0; i < 2000; i++) {
    await step();
    if (await page.evaluate(() => !!document.querySelector('#enter.ready') && !!window.__demo)) break;
  }
  const t0 = Date.now();
  const report = () => console.log(`${seg}: ${n} frames, ${((Date.now() - t0) / Math.max(1, n)).toFixed(0)} ms/frame`);

  if (seg === 'test') {
    await page.evaluate(() => document.getElementById('enter').click());
    await hold(1);
    report();
  }

  if (seg === 'btest') {
    await page.evaluate(() => (window.__skipRender = true));
    for (let i = 0; i < 110; i++) await step();
    await page.evaluate(() => (window.__skipRender = false));
    let t = Date.now();
    await hold(0.2);
    console.log('frame ms', (Date.now() - t) / 6);
  }

  if (seg === 'A') {
    // Loader -> clic en Entrar -> vuelo (acelerado) -> llegada a la mesa.
    await hold(0.6);
    cur.on = true;
    const e = await rectOf('#enter');
    await move(e.x, e.y, 0.8);
    await click();
    await hold(0.25);
    cur.on = false;
    scale = 1.6; // la intro dura 19.5 s reales -> ~12 s en el video
    const T = await page.evaluate(() => window.__demo.globe.T.end);
    while (await page.evaluate(() => window.__demo.globe.state.t) < T) {
      await frame();
      if (n > 2000) break;
    }
    scale = 1;
    await hold(3.5); // fundido + la cámara baja hacia la mesa
    report();
  }

  if (seg === 'B') {
    // Empieza ya en la mesa (?mesa): avanzar sin capturar (ni renderizar) hasta el mismo punto que el final de A.
    await page.evaluate(() => (window.__skipRender = true));
    for (let i = 0; i < Math.round(2.6 * FPS) + Math.round(0.9 * FPS); i++) await step();
    await page.evaluate(() => (window.__skipRender = false));
    cur.x = W * 0.5; cur.y = H * 0.85;
    cur.on = true;
    await hold(0.3);
    for (const i of [2, 1, 0]) { const p = await plate(i); await move(p.x, p.y, 0.5); await hold(0.12); }
    await click(); // Menú
    await hold(1.5);
    cur.on = false;
    const max = await page.evaluate(() => { const s = document.querySelector('.menu-scroll'); return s.scrollHeight - s.clientHeight; });
    const items = await page.evaluate(() => [...document.querySelectorAll('#page-menu .pizza')].map((a) => a.offsetTop));
    const target = Math.min(max, items[5] - 40);
    await scroll('.menu-scroll', target, 6.0);
    await hold(0.4);
    cur.on = true;
    let r = await rectOf('#page-menu [data-close]');
    await move(r.x, r.y, 0.6);
    await click();
    await hold(1.4);
    let p = await plate(1);
    await move(p.x, p.y, 0.6);
    await click(); // Reservar
    await hold(1.3);
    r = await rectOf('#page-reservar input[name=nombre]');
    await move(r.x, r.y, 0.4);
    await click();
    await type('#page-reservar input[name=nombre]', 'Familia Rossi', 0.7);
    r = await rectOf('#page-reservar input[name=tel]');
    await move(r.x, r.y, 0.35);
    await click();
    await type('#page-reservar input[name=tel]', '999 123 4567', 0.6);
    r = await rectOf('#page-reservar .people button[data-n="4"]');
    await move(r.x, r.y, 0.4);
    await click();
    await hold(0.25);
    const btn = await rectOf('#page-reservar button[type=submit]');
    const scrollMax = await page.evaluate(() => { const s = document.querySelector('#page-reservar .page-scroll'); return s.scrollHeight - s.clientHeight; });
    if (btn.y > H - 80 && scrollMax > 0) await scroll('#page-reservar .page-scroll', Math.min(scrollMax, btn.y - H * 0.6), 0.5);
    r = await rectOf('#page-reservar button[type=submit]');
    await move(r.x, r.y, 0.4);
    await click();
    await hold(0.2);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); document.querySelector('#page-reservar .page-scroll').scrollTop = 0; });
    await hold(1.6);
    r = await rectOf('#page-reservar [data-close]');
    await move(r.x, r.y, 0.5);
    await click();
    await hold(1.3);
    p = await plate(2);
    await move(p.x, p.y, 0.6);
    await click(); // Ubicación
    await hold(1.4);
    cur.on = false;
    await hold(1.6);
    cur.on = true;
    r = await rectOf('#page-ubicacion [data-close]');
    await move(r.x, r.y, 0.5);
    await click();
    await hold(0.6);
    cur.on = false;
    await hold(0.9);
    await page.evaluate(() => document.getElementById('vend').classList.add('on'));
    await hold(2.2);
    report();
  }
  await browser.close();
})();
