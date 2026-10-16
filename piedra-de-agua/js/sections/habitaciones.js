// HABITACIONES: se elige la habitación desde el citófono 3D. Al pulsar un timbre:
// clic, el botón se hunde, se enciende el piloto y la habitación aparece con un
// fundido; al lado, su planta en latón crece hasta su medida real.
import { t, L, getLang, onLangChange, applyI18n } from '../i18n.js';
import { motion, waLink } from '../config.js';
import { ROOMS } from '../data.js';
import { setImg } from '../util/images.js';
import { playClick, playChime } from '../util/audio.js';
import { backButton, pageFooter } from './index.js';

// ───────────── planta a escala (SVG) ─────────────
const S = 10;                 // unidades SVG por metro
const VB = { w: 124, h: 84 };
const NS = 'http://www.w3.org/2000/svg';

const rectP = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
const lineP = (x1, y1, x2, y2) => `M${x1} ${y1}L${x2} ${y2}`;
const circleP = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

function bed(x, y, w, d, pillows = 2) {
  // cabecero a la izquierda: w a lo largo de x
  const p = [rectP(x, y, w, d), lineP(x + 0.12, y, x + 0.12, y + d)];
  const pw = (d - 0.24) / pillows;
  for (let i = 0; i < pillows; i++) p.push(rectP(x + 0.2, y + 0.12 + i * pw + 0.04, 0.42, pw - 0.08));
  p.push(lineP(x + w * 0.62, y, x + w * 0.62, y + d));
  return p;
}
function bathroom(x, y, w, d, { tub = false, double = false, rain = false } = {}) {
  const p = [rectP(x, y, w, d)];
  // ducha / tina
  if (tub) { p.push(`M${x + 0.15} ${y + 0.15}h1.5a0.35 0.35 0 0 1 0 0.7h-1.5Z`); p.push(circleP(x + 1.45, y + 0.5, 0.05)); }
  const sx = tub ? x + w - 0.95 : x + w - 0.95;
  p.push(rectP(sx, y + 0.08, 0.85, 0.85), lineP(sx, y + 0.08, sx + 0.85, y + 0.93));
  if (rain) p.push(circleP(sx + 0.42, y + 0.5, 0.18));
  // lavabo(s) e inodoro
  const n = double ? 2 : 1;
  for (let i = 0; i < n; i++) p.push(`M${x + 0.2 + i * 0.62} ${y + d - 0.08}h0.5v-0.42h-0.5Z`, circleP(x + 0.45 + i * 0.62, y + d - 0.3, 0.12));
  p.push(`M${x + w - 0.55} ${y + d - 0.1}v-0.5a0.2 0.25 0 0 1 0.4 0v0.5Z`);
  return p;
}
function door(x, y, w, dir = -1) {
  // hueco en el muro inferior con barrido de apertura hacia dentro
  return [`M${x} ${y}v${dir * w}`, `M${x} ${y + dir * w}A${w} ${w} 0 0 ${dir < 0 ? 1 : 0} ${x + w} ${y}`];
}
function balcony(x, y, w, d) {
  const p = [rectP(x, y - d, w, d)];
  for (let k = x + 0.2; k < x + w; k += 0.2) p.push(lineP(k, y - d, k, y - d + 0.12));
  return p;
}
function sofa(x, y, w, d) { return [rectP(x, y, w, d), rectP(x, y, w, 0.22), rectP(x, y, 0.22, d), rectP(x + w - 0.22, y, 0.22, d)]; }

function planItems(room) {
  const { w, d } = room.plan;
  const it = { lines: [], soft: [], stone: [], balcony: [], gaps: [] };
  switch (room.id) {
    case 'premium':
      it.lines.push(...bed(0.1, 0.9, 2.0, 1.6), ...bathroom(2.35, 2.35, 1.6, 1.6));
      it.balcony.push(...balcony(0.7, 0, 2.3, 0.7));
      it.gaps.push([0.75, 0, 2.2, 'h']);
      it.soft.push(...door(0.4, d, 0.8), rectP(2.6, 0.3, 1.1, 0.45));
      break;
    case 'doble':
      it.lines.push(...bed(0.1, 0.45, 1.95, 1.4), ...bed(0.1, 2.25, 1.95, 1.4), ...bathroom(3.1, 3.1, 1.85, 1.85));
      it.gaps.push([1.4, 0, 1.6, 'h']);
      it.soft.push(...door(2.2, d, 0.8), rectP(3.4, 0.35, 1.3, 0.45), rectP(2.25, 1.6, 0.45, 0.45), rectP(2.25, 3.3, 0.45, 0.45));
      break;
    case 'master':
      it.lines.push(...bed(0.15, 1.3, 2.1, 2.0), ...bathroom(4.85, 2.75, 2.1, 2.2, { double: true, rain: true }));
      it.stone.push(0); // muro de piedra original (lado izquierdo)
      it.soft.push(...sofa(3.6, 0.35, 2.2, 0.85), circleP(4.7, 1.85, 0.35), ...door(2.9, d, 0.85));
      it.gaps.push([2.0, 0, 3.0, 'h']);
      break;
    case 'presidencial':
      it.lines.push(...bed(0.15, 1.6, 2.15, 2.0), ...bathroom(2.9, 3.65, 2.6, 2.3, { tub: true }));
      it.lines.push(lineP(5.8, 0, 5.8, 2.6), lineP(5.8, 3.6, 5.8, d));
      it.soft.push(...sofa(7.2, 0.5, 2.4, 0.9), rectP(7.6, 1.9, 1.6, 0.8), circleP(6.6, 4.6, 0.55), rectP(9.3, 3.0, 0.5, 1.7), ...door(8.2, d, 0.9));
      it.soft.push(rectP(6.3, 3.9, 0.55, 0.55), rectP(6.95, 4.9, 0.55, 0.55));
      it.balcony.push(...balcony(0.9, 0, 2.4, 0.8), ...balcony(6.4, 0, 2.4, 0.8));
      it.gaps.push([0.95, 0, 2.3, 'h'], [6.45, 0, 2.3, 'h']);
      break;
  }
  return it;
}

class PlanView {
  constructor(svg) {
    this.svg = svg;
    this.w = 0; this.d = 0;
    this.walls = this.mk('path', { class: 'pl-wall' });
    this.inner = this.mk('path', { class: 'pl-inner' });
    this.items = document.createElementNS(NS, 'g');
    this.svg.append(this.walls, this.inner, this.items);
    this.dimW = this.mk('text', { class: 'pl-dim', 'text-anchor': 'middle' });
    this.dimD = this.mk('text', { class: 'pl-dim', 'text-anchor': 'middle' });
    this.svg.append(this.dimW, this.dimD);
    // escala gráfica 1 m
    const sb = document.createElementNS(NS, 'g');
    sb.setAttribute('class', 'pl-scale');
    sb.innerHTML = `<path d="M6 ${VB.h - 6}h10M6 ${VB.h - 7.5}v3M16 ${VB.h - 7.5}v3"/><text x="11" y="${VB.h - 8.5}" text-anchor="middle">1 m</text>`;
    this.svg.append(sb);
  }
  mk(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  frame(w, d) {
    const ox = (VB.w - w * S) / 2, oy = (VB.h - d * S) / 2 + 3;
    return { ox, oy };
  }
  drawWalls(w, d) {
    const { ox, oy } = this.frame(w, d);
    this.walls.setAttribute('d', rectP(ox, oy, w * S, d * S));
    this.inner.setAttribute('d', rectP(ox + 1.3, oy + 1.3, w * S - 2.6, d * S - 2.6));
    this.dimW.setAttribute('x', ox + (w * S) / 2); this.dimW.setAttribute('y', oy + d * S + 6);
    this.dimW.textContent = `${w.toFixed(1).replace('.', getLang() === 'es' ? ',' : '.')} m`;
    this.dimD.setAttribute('transform', `translate(${ox - 4} ${oy + (d * S) / 2}) rotate(-90)`);
    this.dimD.textContent = `${d.toFixed(1).replace('.', getLang() === 'es' ? ',' : '.')} m`;
  }
  drawItems(room) {
    const { w, d } = room.plan;
    const { ox, oy } = this.frame(w, d);
    const it = planItems(room);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${ox} ${oy}) scale(${S})`);
    const add = (dStr, cls, delay) => {
      const p = this.mk('path', { d: dStr, class: `pl-item ${cls}`, pathLength: '1', 'vector-effect': 'non-scaling-stroke' });
      p.style.transitionDelay = `${delay}s`;
      g.append(p);
    };
    // huecos de ventanas/balcones en el muro superior (se tapan con papel)
    it.gaps.forEach(([x, y, len]) => {
      const r = this.mk('rect', { x, y: y - 0.12, width: len, height: 0.24, class: 'pl-gap' });
      g.append(r);
      add(lineP(x, y, x + len, y), 'pl-glass', 0.1);
    });
    it.lines.forEach((p, i) => add(p, 'pl-line', 0.12 + i * 0.035));
    it.soft.forEach((p, i) => add(p, 'pl-soft', 0.3 + i * 0.03));
    it.balcony.forEach((p, i) => add(p, 'pl-balcony', 0.2 + i * 0.02));
    if (it.stone.length) {
      for (let y = 0.2; y < d; y += 0.32) add(lineP(0.04, y, 0.26, y + 0.18), 'pl-stone', 0.1 + y * 0.03);
      add(rectP(0, 0, 0.3, d), 'pl-stone', 0.1);
    }
    return g;
  }
  show(room, animate = true) {
    const from = { w: this.w || room.plan.w * 0.6, d: this.d || room.plan.d * 0.6 };
    const to = room.plan;
    this.w = to.w; this.d = to.d;
    // fuera los muebles anteriores
    const old = [...this.items.children];
    old.forEach((g) => g.classList.add('is-out'));
    setTimeout(() => old.forEach((g) => g.remove()), 350);
    const dur = animate && !motion.reduced ? 1100 : 1;
    const t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.drawWalls(from.w + (to.w - from.w) * e, from.d + (to.d - from.d) * e);
      if (k < 1) this.raf = requestAnimationFrame(step);
      else {
        const g = this.drawItems(room);
        this.items.append(g);
        requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add('is-in')));
      }
    };
    this.raf = requestAnimationFrame(step);
  }
}

function countUp(el, from, to, dur = 1100) {
  if (motion.reduced) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const ICONS = {
  guests: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.3a4.3 4.3 0 0 1 5.5 4.2"/></svg>',
  beds: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/></svg>',
  size: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 9h5V4M15 20v-5h5"/></svg>',
};

export async function create({ root, engine, onBack }) {
  const { createIntercom } = await import('../scenes/intercom.js');
  const el = document.createElement('section');
  el.className = 'page is-glass page-hab';
  el.id = 'page-habitaciones';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'title-hab');
  el.innerHTML = `
    <aside class="hab-panel">
      <div class="hab-frame">
        <span class="corner tl" aria-hidden="true"></span><span class="corner tr" aria-hidden="true"></span>
        <span class="corner bl" aria-hidden="true"></span><span class="corner br" aria-hidden="true"></span>
        <div class="hab-scroll">
          <header class="hab-head">
            <p class="kicker" data-i18n="hab.kicker"></p>
            <h1 id="title-hab" class="sec-title" tabindex="-1" data-i18n="hab.title"></h1>
            <p class="hab-lead" data-i18n="hab.lead"></p>
          </header>
          <div class="hab-keys" role="group" data-i18n-aria="hab.intercom"></div>
          <article class="hab-room" aria-live="polite" hidden>
            <figure class="hab-photo"><img class="a" alt="" /><img class="b" alt="" /></figure>
            <div class="hab-main">
              <div class="hab-info">
                <h2 class="hab-name"></h2>
                <dl class="hab-data">
                  <div><dt>${ICONS.guests}<span data-i18n="hab.capacity"></span></dt><dd class="d-guests"></dd></div>
                  <div><dt>${ICONS.beds}<span data-i18n="hab.beds"></span></dt><dd class="d-beds"></dd></div>
                  <div><dt>${ICONS.size}<span data-i18n="hab.size"></span></dt><dd class="d-size"><b class="m2">0</b> m²</dd></div>
                </dl>
              </div>
              <div class="hab-plan">
                <svg viewBox="0 0 ${VB.w} ${VB.h}" role="img" class="plan-svg"></svg>
                <p class="hab-plan-cap"><span data-i18n="hab.plan"></span><span class="plan-m2"><b class="m2b">0</b> m²</span></p>
              </div>
            </div>
            <p class="hab-text"></p>
            <a class="cta-brass" target="_blank" rel="noopener"><span data-i18n="hab.reserve"></span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>
          </article>
        </div>
      </div>
    </aside>`;
  el.prepend(backButton(onBack));
  el.querySelector('.hab-scroll').append(pageFooter());
  root.append(el);
  applyI18n(el);

  const roomsForIntercom = ROOMS.map((r) => ({ id: r.id, cardText: L(r.card) }));
  const ic = createIntercom(engine, roomsForIntercom);
  const keys = el.querySelector('.hab-keys');
  const roomEl = el.querySelector('.hab-room');
  const imgA = el.querySelector('.hab-photo .a');
  const imgB = el.querySelector('.hab-photo .b');
  const plan = new PlanView(el.querySelector('.plan-svg'));
  let current = null;
  let frontImg = imgA;

  function renderKeys() {
    // del más pequeño (abajo) a la suite (arriba), como en el citófono
    keys.innerHTML = [...ROOMS].reverse().map((r) => `
      <button type="button" class="hab-key" data-room="${r.id}" aria-pressed="${current === r.id}">
        <span class="lamp" aria-hidden="true"></span><span class="nm">${L(r.name)}</span><span class="sz">${r.m2} m²</span>
      </button>`).join('');
    keys.querySelectorAll('.hab-key').forEach((b) => {
      b.addEventListener('click', () => ic.press(b.dataset.room));
      b.addEventListener('mouseenter', () => ic.setHover(b.dataset.room));
      b.addEventListener('mouseleave', () => ic.setHover(null));
      b.addEventListener('focus', () => ic.setHover(b.dataset.room));
      b.addEventListener('blur', () => ic.setHover(null));
    });
  }
  renderKeys();

  function fillRoom(r) {
    el.querySelector('.hab-name').textContent = L(r.name);
    el.querySelector('.d-guests').textContent = L(r.guests);
    el.querySelector('.d-beds').textContent = L(r.beds);
    el.querySelector('.hab-text').textContent = L(r.text);
    el.querySelector('.plan-svg').setAttribute('aria-label', `${t('hab.plan')}: ${L(r.name)}, ${r.m2} m²`);
    el.querySelector('.cta-brass').href = waLink(t('hab.msg', { room: L(r.name) }));
  }

  async function showRoom(id) {
    const r = ROOMS.find((x) => x.id === id);
    const prev = ROOMS.find((x) => x.id === current);
    const first = !current;
    current = id;
    keys.querySelectorAll('.hab-key').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === id)));
    playClick();
    setTimeout(playChime, 160);
    el.classList.add('has-room');
    roomEl.hidden = false;
    roomEl.classList.remove('is-in');
    // fundido de la foto
    const back = frontImg === imgA ? imgB : imgA;
    back.alt = L(r.name);
    await setImg(back, r.photo, 1200, 800);
    back.classList.add('is-front');
    frontImg.classList.remove('is-front');
    frontImg = back;
    fillRoom(r);
    requestAnimationFrame(() => roomEl.classList.add('is-in'));
    countUp(el.querySelector('.m2'), prev ? prev.m2 : 0, r.m2);
    countUp(el.querySelector('.m2b'), prev ? prev.m2 : 0, r.m2);
    plan.show(r, true);
    if (first) el.querySelector('.hab-scroll').scrollTo({ top: 0 });
  }

  ic.on('select', (id) => showRoom(id));
  ic.on('hover', (id) => keys.querySelectorAll('.hab-key').forEach((b) => b.classList.toggle('is-hot', b.dataset.room === id)));

  function layout() {
    const w = engine.size.w, h = engine.size.h;
    if (w / h < 0.9 || w < 760) {
      ic.setLayout({ cx: 0.5, cy: 0.29 });
    } else {
      const panel = el.querySelector('.hab-panel').getBoundingClientRect();
      const free = panel.left > 0 ? panel.left : w * 0.5;
      ic.setLayout({ cx: (free / 2) / w, cy: 0.52 });
    }
  }
  engine.onResize(() => { if (el.classList.contains('is-open')) layout(); });

  onLangChange(() => {
    applyI18n(el);
    renderKeys();
    ic.setCards(ROOMS.map((r) => L(r.card)));
    if (current) fillRoom(ROOMS.find((x) => x.id === current));
  });

  return {
    el, theme: 'dark', view: ic, ownCredit: true,
    enter() { requestAnimationFrame(layout); },
    exit() {},
  };
}
