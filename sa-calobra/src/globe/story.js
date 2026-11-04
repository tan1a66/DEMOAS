// La storia sul globo: dalla Ciudad de México un solo volo, che parte da solo, fino a Mallorca
// (la linea arancione si disegna mentre la camera la segue). La mappa diventa lo schermo di un
// ciclocomputer: siamo in sella, all'alba, e lo schermo si accende con "LLEGASTE" (ride.js).
// Si rientra nello schermo e si torna sul globo: in Europa scorrono le frasi, una per gesto,
// poi il racconto finisce e il mondo diventa esplorabile: si gira, ci si avvicina, si toccano
// le mete. Ogni capitolo ha la sua batteria:
// piena se completato, in carica (loading) se in arrivo.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CONFIG } from '../config.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

gsap.registerPlugin(SplitText);

const $ = (s) => document.querySelector(s);
const RAD = Math.PI / 180;
/** punto a metà strada (frazione f) sull'arco di cerchio massimo tra due punti {lat, lon} */
function slerpLL(a, b, f) {
  const v = (p) => [Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD), Math.sin(p.lat * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD)];
  const A = v(a), B = v(b);
  const w = Math.acos(Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), s = Math.sin(w) || 1;
  const ka = Math.sin((1 - f) * w) / s, kb = Math.sin(f * w) / s;
  const x = A[0] * ka + B[0] * kb, y = A[1] * ka + B[1] * kb, z = A[2] * ka + B[2] * kb;
  return [Math.asin(y / Math.hypot(x, y, z)) / RAD, Math.atan2(z, x) / RAD];
}
const ORDER = ['start', 'ride', 'b', 'c', 'crew', 'coach', 'explore'];
const PHOTOS = {
  crew: { src: crewImg, alt: 'Ciclistas de Nomads en una pausa de café' },
  coach: { src: coachImg, alt: 'Alfredo “Freddy” Cruz revisa la estrategia con un ciclista' },
};

/** la batteria del capitolo: piena se completato, in carica se in arrivo */
export function battery(status) {
  const G = CONFIG.globe;
  return `<span class="battery battery--${status}" aria-hidden="true"><i></i></span><em class="battery__t">${status === 'done' ? G.copy.done : G.copy.loading}</em>`;
}

function buildBeats() {
  const C = CONFIG.copy, G = CONFIG.globe;
  const copy = {
    start: C.start, b: C.b, c: C.c, crew: C.port, coach: C.nus,
    explore: { kicker: G.copy.exploreKicker, text: C.next.text, sub: G.copy.exploreHint },
  };
  const host = $('#story');
  const end = $('#b-next');
  const cta = $('#cta');
  end.innerHTML = '';
  for (const key of ORDER) {
    const c = copy[key];
    if (!c) continue; // in sella non c'è testo: parla lo schermo
    const el = key === 'explore' ? end : host.insertBefore(document.createElement('div'), end);
    el.id = `b-${key}`;
    el.classList.add('beat');
    if (key === 'explore') el.classList.remove('beat--end');
    const parts = [];
    if (c.kicker) parts.push(`<p class="kicker">${c.kicker}</p>`);
    const cls = c.size === 'lead' ? 'lead' : 'headline';
    const tag = key === 'start' ? 'h1' : 'p';
    parts.push(`<${tag} class="${cls}${key === 'explore' ? ' headline--small' : ''}" data-split>${c.text}</${tag}>`);
    if (c.sub) parts.push(`<p class="sub">${c.sub}</p>`);
    if (c.photo) parts.push(`<figure class="beat__photo"><img src="${PHOTOS[c.photo].src}" alt="${PHOTOS[c.photo].alt}" decoding="async" /></figure>`);
    el.insertAdjacentHTML('afterbegin', parts.join(''));
  }
  // in basso, durante l'esplorazione: i capitoli (con la batteria) e il contatto
  const dock = document.createElement('nav');
  dock.className = 'dock';
  dock.id = 'dock';
  dock.setAttribute('aria-label', 'Capítulos');
  dock.innerHTML = `<div class="dock__chapters">${G.chapters.map((ch) => `
      <button class="chapter" type="button" data-chapter="${ch.n}"><b>Capítulo ${ch.n}</b><i>${battery(ch.status)}</i><strong>${ch.name ?? ch.title}</strong><span>${ch.when}</span></button>`).join('')}
    </div>`;
  document.body.appendChild(dock);
  cta.classList.add('dock__cta');
  dock.appendChild(cta);
  dock.insertAdjacentHTML('beforeend', '<p class="dock__credit">Tierra: NASA Blue Marble · Mapa: Natural Earth</p>');
}

export function createGlobeStory({ capture = false } = {}) {
  buildBeats();
  const G = CONFIG.globe;
  const V = [...G.views, G.explore];
  const F = G.flight.duration;
  const D = [F + 3.9, 2.6, 1.6, 1.6, 1.6, 2.4];
  // stato: camera (lat, lon, distanza), rotte disegnate, pin. Durante il racconto lo anima la
  // timeline; durante l'esplorazione lo cambiano le dita (main.js)
  // low: quanto il globo sta in basso sotto i testi (1 nel racconto; esplorando torna quasi al centro)
  const state = { lat: V[0].lat, lon: V[0].lon, dist: V[0].dist, prog: G.progress[0], prog2: 0, soon: 0, mallorca: 0, low: 1,
    ride: 0, rk: 0, screen: 0 }; // in sella: quanto si vede, inquadratura (0..3), mappa → LLEGASTE

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
    if (!el) return;
    const { text, other } = partsOf(el);
    tl.set(el, { visibility: 'visible' }, at);
    tl.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at + 0.25);
  };
  const beatOut = (sel, at) => {
    const el = $(sel);
    if (!el) return;
    const { text, other } = partsOf(el);
    tl.fromTo(text, { yPercent: 0, opacity: 1 }, { yPercent: -115, opacity: 0, duration: 0.45, stagger: 0.035, ease: 'power2.in', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 0, opacity: 1 }, { y: -14, opacity: 0, duration: 0.4, ease: 'power2.in', immediateRender: false }, at);
    tl.set(el, { visibility: 'hidden' }, at + 0.6);
  };

  const labels = [0];
  let t = 0;
  for (let k = 1; k < ORDER.length; k++) {
    const d = D[k - 1], v = V[k], key = ORDER[k];
    beatOut(`#b-${ORDER[k - 1]}`, key === 'ride' ? t + 0.2 : t);
    if (key === 'ride') {
      // un volo solo, lungo l'arco: la camera segue la rotta e la linea la precede di poco;
      // a metà ci si allontana per vedere l'oceano, poi si scende su Mallorca
      const fly = { f: 0 }, from = V[0];
      tl.to(fly, { f: 1, duration: F, ease: 'sine.inOut', onUpdate: () => { [state.lat, state.lon] = slerpLL(from, v, fly.f); } }, t);
      tl.to(state, { dist: G.flight.peak, duration: F * 0.45, ease: 'sine.inOut' }, t);
      tl.to(state, { dist: v.dist, duration: F * 0.55, ease: 'sine.inOut' }, t + F * 0.45);
      tl.to(state, { low: 0, duration: F * 0.5, ease: 'sine.inOut' }, t + F * 0.5);
      tl.to(state, { prog: 1, duration: F * 0.86, ease: 'sine.inOut' }, t);
      tl.to(state, { mallorca: 1, duration: 0.6 }, t + F * 0.8);
      // la mappa diventa lo schermo del ciclocomputer: la camera si allontana e siamo in sella
      tl.to(state, { ride: 1, duration: 0.55, ease: 'sine.inOut' }, t + F - 0.55);
      tl.to(state, { rk: 1, duration: 1.9, ease: 'power2.inOut' }, t + F);
      // poi ci si avvicina al ciclocomputer e lo schermo si accende: LLEGASTE
      tl.to(state, { rk: 2, duration: 1.4, ease: 'power2.inOut' }, t + F + 2.4);
      tl.to(state, { screen: 1, duration: 0.6, ease: 'sine.inOut' }, t + F + 3.0);
      // l'invito a scorrere: si va avanti col gesto
      tl.to('#cue', { autoAlpha: 1, duration: 0.5 }, t + d - 0.5);
    } else if (key === 'b') {
      // si rientra nello schermo, la mappa si riapre: di nuovo il globo, sull'Europa
      tl.fromTo('#cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, immediateRender: false }, t);
      tl.to(state, { screen: 0, duration: 0.5, ease: 'sine.inOut' }, t);
      tl.to(state, { rk: 3, duration: 0.8, ease: 'power2.in' }, t);
      tl.to(state, { ride: 0, duration: 0.45, ease: 'sine.inOut' }, t + 0.55);
      tl.to(state, { low: 1, duration: 1.8, ease: 'sine.inOut' }, t + 0.6);
      tl.to(state, { lat: v.lat, lon: v.lon, dist: v.dist, duration: d - 0.6, ease: 'sine.inOut' }, t + 0.6);
    } else {
      tl.to(state, { lat: v.lat, lon: v.lon, duration: d * 0.95, ease: 'sine.inOut' }, t);
      tl.to(state, { dist: v.dist, duration: d * 0.95, ease: 'sine.inOut' }, t);
      tl.to(state, { prog: G.progress[k] ?? 1, duration: d * 0.8, ease: 'sine.inOut' }, t + d * 0.05);
    }
    if (k === ORDER.length - 1) {
      // l'Europa: partono le rotte dei prossimi capitoli, compaiono le mete e la barra in basso
      tl.to(state, { prog2: 1, duration: d * 0.75, ease: 'sine.inOut' }, t + d * 0.15);
      tl.to(state, { low: 0.15, duration: d * 0.95, ease: 'sine.inOut' }, t);
      tl.to(state, { soon: 1, mallorca: 1, duration: 0.6 }, t + d * 0.6);
      tl.fromTo('#dock', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', immediateRender: false }, t + d * 0.7);
      tl.to('.rail', { autoAlpha: 0, duration: 0.5 }, t + d * 0.6);
    }
    beatIn(`#b-${key}`, key === 'b' ? t + 1.4 : t + d * 0.4);
    t += d;
    labels.push(t);
  }
  tl.to({}, { duration: 0.001 }, t);
  const total = t;
  const LAST = labels.length - 1;

  // ── la linea come barra di avanzamento: un punto per tappa del racconto
  const railFill = $('#rail-fill'), dotsEl = $('#rail-dots');
  dotsEl.innerHTML = labels.map((x) => `<i style="top:${((x / total) * 100).toFixed(2)}%"></i>`).join('');
  const dots = [...dotsEl.children];
  let step = 0, anim = null, locked = true, exploring = false;
  const root = document.documentElement;
  const setBar = () => {
    const now = tl.time();
    railFill.style.transform = `scaleY(${(now / total).toFixed(4)})`;
    dots.forEach((d, k) => { d.classList.toggle('on', labels[k] <= now + 1e-3); d.classList.toggle('now', k === step); });
  };
  const goTo = (k) => {
    k = Math.max(0, Math.min(LAST, k));
    if (k === step && !anim) return;
    const to = labels[k], dist = Math.abs(to - tl.time()), forward = to > tl.time();
    step = k;
    anim?.kill();
    anim = gsap.to(tl, {
      time: to, duration: forward ? dist : dist / 2.2, ease: forward ? 'none' : 'sine.inOut', onUpdate: setBar,
      onComplete: () => {
        anim = null;
        if (k === LAST) { exploring = true; root.classList.add('is-exploring'); }
        api.onStep?.(k);
      },
    });
    setBar();
  };
  // durante l'esplorazione i gesti girano il mondo, non cambiano tappa
  const next = () => {
    if (locked || exploring) return;
    if (anim && labels[step] > tl.time()) { anim.timeScale(3); return; }
    goTo(step + 1);
  };
  const prev = () => { if (!locked && !exploring) goTo(step - 1); };

  if (!capture) {
    let acc = 0, busy = false, lastWheel = 0, fired = 0;
    addEventListener('wheel', (e) => {
      if (e.target.closest?.('.info, .final')) return;
      e.preventDefault();
      if (exploring) return; // la rotella avvicina il globo (main.js)
      const now = performance.now();
      if (busy && now - lastWheel > 180 && now - fired > 450) busy = false;
      lastWheel = now;
      if (busy) return;
      acc += e.deltaY;
      if (Math.abs(acc) > 30) { acc > 0 ? next() : prev(); acc = 0; busy = true; fired = now; }
    }, { passive: false });
    let tx = 0, ty = 0, tracking = false;
    addEventListener('touchstart', (e) => {
      tracking = !e.target.closest('.info, .final, .dock') && e.touches.length === 1;
      if (tracking) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    }, { passive: true });
    addEventListener('touchmove', (e) => { if (!e.target.closest('.info__scroll, .dock__chapters')) e.preventDefault(); }, { passive: false });
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
    gsap.set('#dock', { autoAlpha: 0 });
    setBar();
    gsap.set('#cue', { autoAlpha: 0 });
    if (instant) { gsap.set([...text, ...other], { yPercent: 0, y: 0, opacity: 1 }); gsap.set('.rail', { autoAlpha: 1 }); return; }
    gsap.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out', delay: 0.2 });
    gsap.fromTo('.rail', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 1.4 });
    // il volo parte da solo (se nel frattempo c'è un pannello aperto, aspetta che si chiuda)
    if (capture) return;
    const fly = () => { if (step !== 0 || anim) return; if (locked || api.finalOpen) gsap.delayedCall(1, fly); else goTo(1); };
    gsap.delayedCall(1.1 + G.flight.delay, fly);
  };

  // ── schermata finale (contatto)
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

  const api = {
    tl, total, state, intro, open, close, next, prev, goTo, finalOpen: false, onStep: null,
    get step() { return step; },
    get exploring() { return exploring; },
    labels: labels.map((x) => x / total),
    order: ORDER,
    pause() { locked = true; anim?.pause(); root.classList.add('is-locked'); },
    resume() { locked = false; anim?.resume(); root.classList.remove('is-locked'); },
    seek(p) {
      tl.progress(p);
      step = labels.findIndex((x) => x >= tl.time() - 1e-3);
      exploring = step === LAST;
      root.classList.toggle('is-exploring', exploring);
      setBar();
    },
  };
  return api;
}
