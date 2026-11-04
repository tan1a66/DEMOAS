// La storia sul globo, a tappe: la linea arancione parte dalla Ciudad de México e attraversa
// l'Atlantico; a ogni gesto (swipe, rotella, frecce) la camera vola alla tappa successiva e lì
// si ferma, dove c'è un testo. All'arrivo, Mallorca (Capítulo 01); alla fine i prossimi capitoli.
// Un'unica timeline GSAP con un'etichetta per tappa, come nella Sa Calobra in 3D.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CONFIG } from '../config.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

gsap.registerPlugin(SplitText);

const $ = (s) => document.querySelector(s);
const ORDER = ['start', 'b', 'c', 'crew', 'coach', 'mallorca', 'next'];
const PHOTOS = {
  crew: { src: crewImg, alt: 'Ciclistas de Nomads en una pausa de café' },
  coach: { src: coachImg, alt: 'Alfredo “Freddy” Cruz revisa la estrategia con un ciclista' },
};

function buildBeats() {
  const C = CONFIG.copy, G = CONFIG.globe;
  const copy = { start: C.start, b: C.b, c: C.c, crew: C.port, coach: C.nus, mallorca: G.copy.mallorca, next: C.next };
  const host = $('#story');
  const end = $('#b-next');
  for (const key of ORDER) {
    const c = copy[key];
    const el = key === 'next' ? end : host.insertBefore(document.createElement('div'), end);
    el.id = `b-${key}`;
    el.classList.add('beat');
    const parts = [];
    if (key === 'next') {
      // i prossimi capitoli: con il luogo se c'è, altrimenti solo la data
      parts.push('<div class="chapters">' + G.chapters.filter((ch) => !ch.open).map((ch) => `
        <div class="chapter"><b>Capítulo ${ch.n}${ch.name ? ` · ${ch.name}` : ''}</b><span>${ch.when}</span><i>${G.copy.soon}</i></div>`).join('') + '</div>');
    }
    if (c.kicker) parts.push(`<p class="kicker">${c.kicker}</p>`);
    const cls = c.size === 'lead' ? 'lead' : 'headline';
    parts.push(`<${key === 'start' ? 'h1' : 'p'} class="${cls}" data-split>${c.text}</${key === 'start' ? 'h1' : 'p'}>`);
    if (c.sub) parts.push(`<p class="sub">${c.sub}</p>`);
    if (c.photo) parts.push(`<figure class="beat__photo"><img src="${PHOTOS[c.photo].src}" alt="${PHOTOS[c.photo].alt}" decoding="async" /></figure>`);
    if (key === 'mallorca') {
      parts.push(`<div class="end-actions"><button class="cta" id="see-chapter" type="button">${G.copy.seeChapter} <span aria-hidden="true">→</span></button>
        <a class="cta cta--ghost" id="go-3d" href="sacalobra.html">${G.copy.sacalobra}</a></div>`);
    }
    el.insertAdjacentHTML('afterbegin', parts.join(''));
  }
}

export function createGlobeStory({ capture = false } = {}) {
  buildBeats();
  const G = CONFIG.globe;
  const V = G.views;
  const D = [3.4, 3.2, 3.2, 3.2, 3.8, 3.8];
  // stato animato dalla timeline: camera (lat, lon, distanza), rotta disegnata, prossimi capitoli
  const state = { lat: V[0].lat, lon: V[0].lon, dist: V[0].dist, prog: G.progress[0], prog2: 0, soon: 0, mallorca: 0 };

  const lines = new Map();
  for (const el of document.querySelectorAll('[data-split]')) {
    lines.set(el, SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' }).lines);
  }
  const partsOf = (beat) => {
    const text = [], other = [];
    for (const child of beat.children) (lines.has(child) ? text.push(...lines.get(child)) : other.push(child));
    return { text, other };
  };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const beatIn = (sel, at) => {
    const el = $(sel);
    const { text, other } = partsOf(el);
    tl.set(el, { visibility: 'visible' }, at);
    tl.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at + 0.25);
  };
  const beatOut = (sel, at) => {
    const el = $(sel);
    const { text, other } = partsOf(el);
    tl.fromTo(text, { yPercent: 0, opacity: 1 }, { yPercent: -115, opacity: 0, duration: 0.45, stagger: 0.035, ease: 'power2.in', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 0, opacity: 1 }, { y: -14, opacity: 0, duration: 0.4, ease: 'power2.in', immediateRender: false }, at);
    tl.set(el, { visibility: 'hidden' }, at + 0.6);
  };

  const labels = [0];
  let t = 0;
  for (let k = 1; k < ORDER.length; k++) {
    const d = D[k - 1], v = V[k];
    beatOut(`#b-${ORDER[k - 1]}`, t);
    if (k === 1) tl.to('#cue', { autoAlpha: 0, duration: 0.4 }, t);
    // la camera vola sopra la rotta: lenta all'inizio e all'arrivo
    tl.to(state, { lat: v.lat, lon: v.lon, duration: d * 0.95, ease: 'sine.inOut' }, t);
    tl.to(state, { dist: v.dist, duration: d * 0.95, ease: k === 5 ? 'power2.inOut' : 'sine.inOut' }, t);
    tl.to(state, { prog: G.progress[k], duration: d * 0.8, ease: 'sine.inOut' }, t + d * 0.05);
    if (k === 4) tl.to(state, { mallorca: 1, duration: 0.6 }, t + d * 0.7);
    if (k === 6) {
      tl.to(state, { prog2: 1, duration: d * 0.7, ease: 'sine.inOut' }, t + d * 0.25);
      tl.to(state, { soon: 1, duration: 0.6 }, t + d * 0.7);
    }
    beatIn(`#b-${ORDER[k]}`, t + d * 0.55);
    t += d;
    labels.push(t);
  }
  tl.to({}, { duration: 0.001 }, t);
  const total = t;

  // ── la linea come barra di avanzamento: un punto per tappa
  const railFill = $('#rail-fill'), dotsEl = $('#rail-dots');
  dotsEl.innerHTML = labels.map((x) => `<i style="top:${((x / total) * 100).toFixed(2)}%"></i>`).join('');
  const dots = [...dotsEl.children];
  let step = 0, anim = null, locked = true;
  const setBar = () => {
    const now = tl.time();
    railFill.style.transform = `scaleY(${(now / total).toFixed(4)})`;
    dots.forEach((d, k) => { d.classList.toggle('on', labels[k] <= now + 1e-3); d.classList.toggle('now', k === step); });
  };
  const goTo = (k) => {
    k = Math.max(0, Math.min(labels.length - 1, k));
    if (k === step && !anim) return;
    const to = labels[k], dist = Math.abs(to - tl.time()), forward = to > tl.time();
    step = k;
    anim?.kill();
    anim = gsap.to(tl, {
      time: to, duration: forward ? dist : dist / 2.2, ease: forward ? 'none' : 'sine.inOut', onUpdate: setBar,
      onComplete: () => { anim = null; api.onStep?.(k); },
    });
    setBar();
  };
  const next = () => {
    if (locked) return;
    if (anim && labels[step] > tl.time()) { anim.timeScale(3); return; }
    goTo(step + 1);
  };
  const prev = () => { if (!locked) goTo(step - 1); };

  if (!capture) {
    let acc = 0, busy = false, lastWheel = 0, fired = 0;
    addEventListener('wheel', (e) => {
      if (e.target.closest?.('.info, .final')) return;
      e.preventDefault();
      const now = performance.now();
      if (busy && now - lastWheel > 180 && now - fired > 450) busy = false;
      lastWheel = now;
      if (busy) return;
      acc += e.deltaY;
      if (Math.abs(acc) > 30) { acc > 0 ? next() : prev(); acc = 0; busy = true; fired = now; }
    }, { passive: false });
    let tx = 0, ty = 0, tracking = false;
    addEventListener('touchstart', (e) => {
      tracking = !e.target.closest('.info, .final') && e.touches.length === 1;
      if (tracking) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    }, { passive: true });
    addEventListener('touchmove', (e) => { if (!e.target.closest('.info__scroll')) e.preventDefault(); }, { passive: false });
    addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const p = e.changedTouches[0], dx = p.clientX - tx, dy = p.clientY - ty;
      if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.2) (dy < 0 ? next : prev)();
    }, { passive: true });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('.info, .final')) return;
      if (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.target.closest?.('button, a'))) { e.preventDefault(); next(); }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    });
  }

  const intro = (instant = false) => {
    const el = $('#b-start');
    const { text, other } = partsOf(el);
    gsap.set(el, { visibility: 'visible' });
    gsap.set('#veil', { opacity: 1 });
    setBar();
    if (instant) { gsap.set([...text, ...other], { yPercent: 0, y: 0, opacity: 1 }); gsap.set(['#cue', '.rail'], { autoAlpha: 1 }); return; }
    gsap.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out', delay: 0.2 });
    gsap.fromTo(['#cue', '.rail'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 1.4 });
  };

  // ── schermata finale
  const final = $('#final');
  const open = (e) => {
    const r = e?.currentTarget?.getBoundingClientRect?.();
    const at = r ? `${r.left + r.width / 2}px ${r.top + r.height / 2}px` : '50% 80%';
    locked = true;
    final.setAttribute('aria-hidden', 'false');
    gsap.set(final, { visibility: 'visible' });
    gsap.fromTo(final, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1.15, ease: 'power3.inOut' });
    gsap.fromTo(final.querySelectorAll('.final__inner > *'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', delay: 0.55 });
    api.finalOpen = true;
  };
  const close = () => {
    gsap.to(final, {
      clipPath: 'circle(0% at 50% 90%)', duration: 0.8, ease: 'power3.inOut',
      onComplete: () => { gsap.set(final, { visibility: 'hidden' }); final.setAttribute('aria-hidden', 'true'); },
    });
    locked = false;
    api.finalOpen = false;
  };
  $('#cta').addEventListener('click', open);
  $('#back').addEventListener('click', close);

  const root = document.documentElement;
  const api = {
    tl, total, state, intro, open, close, next, prev, goTo, finalOpen: false, onStep: null,
    get step() { return step; },
    labels: labels.map((x) => x / total),
    order: ORDER,
    pause() { locked = true; anim?.pause(); root.classList.add('is-locked'); },
    resume() { locked = false; anim?.resume(); root.classList.remove('is-locked'); },
    seek(p) { tl.progress(p); step = labels.findIndex((x) => x >= tl.time() - 1e-3); setBar(); },
  };
  return api;
}
