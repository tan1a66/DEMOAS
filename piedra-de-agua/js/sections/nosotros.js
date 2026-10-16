// NOSOTROS · "1845 / hoy": historia de la casona con un comparador antiguo/actual
// (la misma foto revelada como albúmina de 1845 y a color hoy) y una línea de tiempo.
import { t, onLangChange, applyI18n } from '../i18n.js';
import { motion } from '../config.js';
import { loadImage, placeholderURL } from '../util/images.js';
import { makeCanvas, fbm, rng, placeholderCanvas } from '../util/textures.js';
import { backButton, pageFooter } from './index.js';

const SCENES = [
  { id: 'patio', file: 'patio.jpg', key: 'nos.scene.patio' },
  { id: 'pasillo', file: 'pasillo.jpg', key: 'nos.scene.pasillo' },
];

// Motivo de los cuadros de hilos de henequén: reloj de arena / mariposa de hilos tensos.
export function henequenSVG(cls = 'henequen', n = 22) {
  let lines = '';
  for (let i = 0; i <= n; i++) {
    const x = 10 + (i / n) * 100;
    const x2 = 110 - (i / n) * 100;
    lines += `<line x1="${x.toFixed(1)}" y1="6" x2="${x2.toFixed(1)}" y2="114"/>`;
  }
  for (let i = 0; i <= n; i += 2) {
    const y = 6 + (i / n) * 108;
    lines += `<line x1="6" y1="${y.toFixed(1)}" x2="114" y2="${(120 - y).toFixed(1)}" class="h2"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true"><rect x="4" y="4" width="112" height="112" rx="3" class="fr"/>${lines}</svg>`;
}

function coverDraw(ctx, img, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Revela una foto como si fuera de 1845: albúmina sepia, grano, manchas de papel, rayas y viñeta.
function agePhoto(img, w, h, seed = 3) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  coverDraw(ctx, img, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const rand = rng(seed);
  const cx = w / 2, cy = h / 2, maxR = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      let l = d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11;
      l = (l - 128) * 0.82 + 134;            // contraste suave, negros lavados
      l += (rand() - 0.5) * 34;              // grano
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const v = 1 - 0.62 * Math.max(0, (r - 0.42) / 0.58) ** 1.6;  // viñeta
      d[p] = Math.min(255, (l * 1.06 + 22) * v);
      d[p + 1] = Math.min(255, (l * 0.93 + 10) * v);
      d[p + 2] = Math.min(255, (l * 0.74 - 4) * v);
    }
  }
  ctx.putImageData(id, 0, 0);
  // manchas del papel (campo de ruido pequeño, ampliado y multiplicado)
  const sw = 160, sh = Math.round(160 * h / w);
  const stain = makeCanvas(sw, sh);
  const sctx = stain.getContext('2d');
  const sid = sctx.createImageData(sw, sh);
  const n = fbm(sw, sh, { octaves: 5, px: 3, py: 2, seed: seed + 7 });
  for (let i = 0; i < n.length; i++) {
    const v = 205 + n[i] * 55;
    sid.data[i * 4] = v; sid.data[i * 4 + 1] = v * 0.95; sid.data[i * 4 + 2] = v * 0.84; sid.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(sid, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(stain, 0, 0, w, h);
  // borde quemado
  const g = ctx.createRadialGradient(cx, cy, maxR * 0.55, cx, cy, maxR);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(120,80,40,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // rayas y motas de polvo
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    ctx.strokeStyle = `rgba(255,244,220,${0.08 + rand() * 0.18})`;
    ctx.lineWidth = 0.6 + rand();
    ctx.beginPath(); ctx.moveTo(x, rand() * h * 0.3); ctx.lineTo(x + (rand() - 0.5) * 30, h * (0.6 + rand() * 0.4)); ctx.stroke();
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rand() > 0.3 ? `rgba(40,25,10,${0.25 + rand() * 0.4})` : `rgba(255,248,230,${0.3 + rand() * 0.4})`;
    ctx.beginPath(); ctx.arc(rand() * w, rand() * h, rand() * 1.8 + 0.3, 0, Math.PI * 2); ctx.fill();
  }
  // pliegue diagonal del papel
  ctx.strokeStyle = 'rgba(255,245,225,0.18)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w * 0.62, 0); ctx.lineTo(w * 0.48, h); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,10,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.62 + 2, 0); ctx.lineTo(w * 0.48 + 2, h); ctx.stroke();
  return c;
}

function grainDataURL() {
  const c = makeCanvas(160);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 34;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

export function create({ root, onBack }) {
  const el = document.createElement('section');
  el.className = 'page is-paper page-nosotros';
  el.id = 'page-nosotros';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'title-nosotros');
  el.innerHTML = `
    <div class="nos-wrap">
      <div class="nos-top">
      <header class="nos-head">
        <p class="kicker" data-i18n="nos.kicker"></p>
        <h1 id="title-nosotros" class="sec-title" data-i18n="nos.title" tabindex="-1"></h1>
        <p class="nos-lead" data-i18n="nos.lead"></p>
        <p class="nos-body" data-i18n="nos.body"></p>
        <ul class="nos-facts">
          <li><b>1845</b><span>Calle 60 #498</span></li>
          <li><b>INAH</b><span data-i18n="nos.t2.title"></span></li>
          <li><b>2′</b><span data-i18n="con.cathedral"></span></li>
        </ul>
        ${henequenSVG('henequen nos-hen')}
      </header>

      <figure class="nos-compare">
        <div class="arch" id="nos-arch">
          <img class="now" alt="" draggable="false" />
          <div class="then-wrap"><canvas class="then"></canvas><div class="grain"></div></div>
          <div class="handle" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" data-i18n-aria="nos.slider">
            <span class="knob"><svg viewBox="0 0 40 20" aria-hidden="true"><path d="M12 4l-6 6 6 6M28 4l6 6-6 6"/></svg></span>
          </div>
          <span class="tag tag-then" data-i18n="nos.then"></span>
          <span class="tag tag-now" data-i18n="nos.now"></span>
        </div>
        <figcaption>
          <span data-i18n="nos.slider"></span>
          <span class="nos-tabs" role="group">
            ${SCENES.map((s, i) => `<button type="button" data-scene="${s.id}" aria-pressed="${i === 0}" data-i18n="${s.key}"></button>`).join('')}
          </span>
        </figcaption>
      </figure>
      </div>

      <ol class="timeline">
        ${[1, 2, 3].map((i) => `
          <li class="tl-item">
            <span class="tl-medal"><span data-i18n="nos.t${i}.year"></span></span>
            <h3 data-i18n="nos.t${i}.title"></h3>
            <p data-i18n="nos.t${i}.text"></p>
          </li>`).join('')}
      </ol>
    </div>`;
  el.prepend(backButton(onBack));
  el.append(pageFooter());
  root.append(el);
  applyI18n(el);

  const arch = el.querySelector('#nos-arch');
  const now = arch.querySelector('.now');
  const then = arch.querySelector('.then');
  const handle = arch.querySelector('.handle');
  arch.querySelector('.grain').style.backgroundImage = `url(${grainDataURL()})`;

  let pos = 50;
  const setPos = (v) => {
    pos = Math.max(0, Math.min(100, v));
    arch.style.setProperty('--pos', `${pos}%`);
    handle.setAttribute('aria-valuenow', String(Math.round(pos)));
    handle.setAttribute('aria-valuetext', `${Math.round(pos)}% 1845`);
  };
  setPos(50);

  let dragging = false;
  const fromEvent = (e) => {
    const r = arch.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100);
  };
  arch.addEventListener('pointerdown', (e) => { dragging = true; arch.setPointerCapture(e.pointerId); fromEvent(e); stopHint(); });
  arch.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
  arch.addEventListener('pointerup', () => { dragging = false; });
  arch.addEventListener('pointercancel', () => { dragging = false; });
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setPos(pos - step); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setPos(pos + step); e.preventDefault(); }
    if (e.key === 'Home') { setPos(0); e.preventDefault(); }
    if (e.key === 'End') { setPos(100); e.preventDefault(); }
    stopHint();
  });

  // carga de la escena elegida
  const cache = {};
  async function showScene(id) {
    const sc = SCENES.find((s) => s.id === id);
    el.querySelectorAll('.nos-tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === id)));
    now.alt = `${t(sc.key)} — ${t('nos.now')}`;
    if (!cache[id]) {
      cache[id] = (async () => {
        const res = await loadImage(sc.file);
        const src = res.ok ? res.img : placeholderCanvas(sc.file, 1200, 900, t('img.missing'));
        const w = 1000, h = Math.round(1000 * 1.25);
        return { now: res.ok ? res.img.src : placeholderURL(sc.file, 1000, 1250), then: agePhoto(src, w, h, id.length * 7) };
      })();
    }
    const data = await cache[id];
    now.src = data.now;
    then.width = data.then.width; then.height = data.then.height;
    then.getContext('2d').drawImage(data.then, 0, 0);
  }
  el.querySelectorAll('.nos-tabs button').forEach((b) => b.addEventListener('click', () => showScene(b.dataset.scene)));

  // pista animada: el corte se mueve solo para invitar a arrastrar
  let hintRaf = 0;
  function stopHint() { cancelAnimationFrame(hintRaf); hintRaf = 0; }
  function playHint() {
    if (motion.reduced) return;
    const t0 = performance.now();
    const step = (now2) => {
      const k = (now2 - t0) / 2600;
      if (k >= 1) { setPos(50); hintRaf = 0; return; }
      setPos(50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k));
      hintRaf = requestAnimationFrame(step);
    };
    hintRaf = requestAnimationFrame(step);
  }

  // línea de tiempo: se dibuja al entrar en pantalla
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) en.target.classList.add('is-in'); });
  }, { root: el, threshold: 0.3 });
  el.querySelectorAll('.timeline, .tl-item').forEach((n) => io.observe(n));

  onLangChange(() => applyI18n(el));
  let loaded = false;

  return {
    el, theme: 'paper', view: null,
    async enter() {
      if (!loaded) { loaded = true; await showScene('patio'); }
      setTimeout(playHint, 900);
    },
    exit() { stopHint(); },
  };
}
