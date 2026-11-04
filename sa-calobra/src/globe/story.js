// La storia, in breve. Si apre in sella: il manubrio al tramonto di Mallorca (ride.js), il
// ciclocomputer acceso, nero, con il logo e "LLEGASTE"; da sola la camera gli si avvicina. Si
// tocca il pulsante ENTRA sotto lo schermo: il mondo compare dentro lo schermo piccolo e si
// allarga, senza stacchi, fino a tutta la pagina: l'Europa, già esplorabile: si gira, ci si
// avvicina, si toccano le mete. Ogni capitolo ha la sua batteria: piena se completato, in
// carica (loading) se in arrivo.
import gsap from 'gsap';
import { CONFIG } from '../config.js';

const $ = (s) => document.querySelector(s);
// pov: in sella · llegaste: vicino al ciclocomputer · explore: l'Europa da esplorare
const ORDER = ['pov', 'llegaste', 'explore'];

/** la batteria del capitolo: piena se completato, in carica se in arrivo */
export function battery(status) {
  const G = CONFIG.globe;
  return `<span class="battery battery--${status}" aria-hidden="true"><i></i></span><em class="battery__t">${status === 'done' ? G.copy.done : G.copy.loading}</em>`;
}

/** in basso, durante l'esplorazione: i capitoli con la batteria (il contatto è nel menu) */
function buildDock() {
  const G = CONFIG.globe;
  const dock = document.createElement('nav');
  dock.className = 'dock';
  dock.id = 'dock';
  dock.setAttribute('aria-label', 'Capítulos');
  dock.innerHTML = `<div class="dock__chapters">${G.chapters.map((ch) => `
      <button class="chapter" type="button" data-chapter="${ch.n}"><b>Capítulo ${ch.n}</b><i>${battery(ch.status)}</i><strong>${ch.name ?? ch.title}</strong><span>${ch.when}</span></button>`).join('')}
    </div>`;
  document.body.appendChild(dock);
  dock.insertAdjacentHTML('beforeend', '<p class="dock__credit">Tierra: NASA Blue Marble · Mapa: Natural Earth</p>');
}

export function createGlobeStory({ capture = false } = {}) {
  buildDock();
  const G = CONFIG.globe;
  const [ride, E] = [G.views[0], G.explore];
  // stato: camera (lat, lon, distanza), pin, quanto il globo si centra tra menu e capitoli (low), e la scena in
  // sella: quanto si vede (ride), inquadratura (rk, 0..3); il mondo nello schermo: quanto è
  // visibile (portalA) e quanto si è allargato (portal, 0 = lo schermo, 1 = tutta la pagina).
  // Si parte in sella; il globo intanto aspetta su Mallorca, da vicino. Esplorando lo cambiano
  // le dita (main.js).
  const state = { lat: ride.lat, lon: ride.lon, dist: ride.dist, soon: 0, mallorca: 1, low: 0, ride: 1, rk: 1, portal: 0, portalA: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const labels = [0];
  let t = 0;
  // 1 · ci si avvicina al ciclocomputer: LLEGASTE, e sotto il pulsante ENTRA
  tl.to(state, { rk: 2, duration: G.intro.approach, ease: 'power2.inOut' }, t);
  t += G.intro.approach;
  labels.push(t);
  // 2 · il mondo compare nello schermo e, in un solo movimento, si allarga a tutta la pagina
  // mentre il globo si apre da Mallorca sull'Europa; poi le mete e la barra dei capitoli
  const d = G.intro.open; // 2,5 s
  tl.to(state, { portalA: 1, duration: 0.35, ease: 'sine.inOut' }, t + 0.1);
  tl.to(state, { rk: 3, duration: 1.5, ease: 'power1.in' }, t + 0.15);
  tl.to(state, { portal: 1, duration: 1.4, ease: 'power2.inOut' }, t + 0.25);
  tl.to(state, { lat: E.lat, lon: E.lon, dist: E.dist, duration: 2.2, ease: 'power2.inOut' }, t + 0.25);
  tl.to(state, { low: 1, duration: 2.0, ease: 'sine.inOut' }, t + 0.25);
  tl.set(state, { ride: 0 }, t + 1.7);
  tl.to(state, { soon: 1, duration: 0.5 }, t + 1.7);
  tl.fromTo('#dock', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', immediateRender: false }, t + 1.85);
  t += d;
  labels.push(t);
  tl.to({}, { duration: 0.001 }, t);
  const total = t;
  const LAST = labels.length - 1;

  let step = 0, anim = null, locked = true, exploring = false, auto = null;
  const root = document.documentElement;
  const goTo = (k) => {
    k = Math.max(0, Math.min(LAST, k));
    if (k === step && !anim) return;
    const to = labels[k], dist = Math.abs(to - tl.time()), forward = to > tl.time();
    step = k;
    anim?.kill();
    auto?.kill();
    anim = gsap.to(tl, {
      time: to, duration: forward ? dist : dist / 2.2, ease: forward ? 'none' : 'sine.inOut',
      onComplete: () => {
        anim = null;
        if (k === LAST) { exploring = true; root.classList.add('is-exploring'); }
        api.onStep?.(k);
      },
    });
  };
  /** va da solo alla tappa k dopo s secondi (se nel frattempo c'è un pannello aperto, aspetta) */
  const later = (s, k) => {
    auto?.kill();
    auto = gsap.delayedCall(s, () => { if (step !== k - 1 || anim) return; if (locked || api.finalOpen) later(1, k); else goTo(k); });
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

  let homing = false;
  const intro = () => {
    gsap.set('#veil', { opacity: 1 });
    gsap.set('#dock', { autoAlpha: 0 });
    // dopo un attimo in sella la camera va da sola verso il ciclocomputer
    if (!capture) later(G.intro.delay, 1);
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
  $('#back').addEventListener('click', close);

  const api = {
    tl, total, state, intro, open, close, next, prev, goTo, finalOpen: false, onStep: null,
    get step() { return step; },
    get exploring() { return exploring; },
    labels: labels.map((x) => x / total),
    order: ORDER,
    // torna all'inizio: dissolvenza, si riparte in sella
    home() {
      if (homing) return;
      homing = true;
      const fade = $('#fade');
      gsap.to(fade, {
        autoAlpha: 1, duration: 0.45, ease: 'sine.in',
        onComplete: () => {
          anim?.kill(); anim = null; auto?.kill();
          if (api.finalOpen) { gsap.set(final, { visibility: 'hidden' }); final.setAttribute('aria-hidden', 'true'); api.finalOpen = false; }
          locked = false; root.classList.remove('is-locked');
          exploring = false; root.classList.remove('is-exploring');
          tl.progress(0); step = 0;
          intro();
          gsap.to(fade, { autoAlpha: 0, duration: 0.7, ease: 'sine.out', delay: 0.15, onComplete: () => { homing = false; } });
        },
      });
    },
    pause() { locked = true; anim?.pause(); root.classList.add('is-locked'); },
    resume() { locked = false; anim?.resume(); root.classList.remove('is-locked'); },
    seek(p) {
      tl.progress(p);
      step = labels.findIndex((x) => x >= tl.time() - 0.01);
      if (step < 0) step = LAST; // in fondo alla timeline (arrotondamenti)
      exploring = step === LAST;
      root.classList.toggle('is-exploring', exploring);
    },
  };
  return api;
}
