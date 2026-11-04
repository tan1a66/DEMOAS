// La storia, a tappe: ogni gesto (swipe, rotella, frecce) porta alla tappa successiva e lì si
// ferma, dove c'è un testo. Sotto c'è un'unica timeline GSAP in secondi con un'etichetta per
// tappa; il controller la porta da un'etichetta all'altra.
// La camera resta quasi ferma (inquadrature da drone in hovering): a muoversi è la linea
// arancione, che scende dal Coll dels Reis al mare e poi si riaccende in salita.
// I testi vengono da config.js → copy: parlano di Nomads (il viaggio è in INFO MALLORCA).
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { Vector3 } from 'three';
import { CONFIG } from '../config.js';
import { drifted } from '../camera/rig.js';

gsap.registerPlugin(SplitText);

const $ = (s) => document.querySelector(s);
const ORDER = ['intro', 'a', 'b', 'port', 'up', 'climb', 'nus', 'top', 'stats', 'end'];

// i testi delle tappe, generati dai testi in config.js (il finale esiste già: ha i bottoni)
function buildBeats() {
  const host = $('#story');
  const end = $('#b-end');
  for (const key of ORDER) {
    const c = CONFIG.copy[key];
    const el = key === 'end' ? end : host.insertBefore(document.createElement('div'), end);
    el.id = `b-${key}`;
    el.classList.add('beat');
    if (c.size === 'big') el.classList.add('beat--big');
    const parts = [];
    if (c.kicker) parts.push(`<p class="kicker">${c.kicker}</p>`);
    const cls = c.size === 'lead' ? 'lead' : c.size === 'big' ? 'headline headline--big' : 'headline';
    const tag = key === 'intro' ? 'h1' : 'p';
    parts.push(`<${tag} class="${cls}" data-split>${c.text}</${tag}>`);
    el.insertAdjacentHTML('afterbegin', parts.join(''));
  }
}

export function createStory({ rig, road, capture = false }) {
  buildBeats();
  const S = CONFIG.story;
  const D = S.steps;
  const L = road.length;
  const st = rig.state;
  const P = rig.poses;
  const nusS = road.keypoints.CORBATA.index * road.step;

  // righe mascherate per i reveal
  const lines = new Map();
  for (const el of document.querySelectorAll('[data-split]')) {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    lines.set(el, split.lines);
  }
  const partsOf = (beat) => {
    const out = [];
    for (const child of beat.children) {
      if (lines.has(child)) out.push(...lines.get(child));
      else out.push(child);
    }
    return out;
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const veil = $('#veil');

  // ── utilità: entrate/uscite dei testi (maschera + leggero movimento verticale)
  const beatIn = (sel, at, { veilTo = 0.55 } = {}) => {
    const el = $(sel);
    tl.set(el, { visibility: 'visible' }, at);
    tl.fromTo(partsOf(el), { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at);
    if (veilTo !== null) tl.to(veil, { opacity: veilTo, duration: 0.6, ease: 'sine.inOut' }, at);
  };
  const beatOut = (sel, at, { veilTo = 0 } = {}) => {
    const el = $(sel);
    tl.fromTo(partsOf(el), { yPercent: 0, opacity: 1 }, { yPercent: -115, opacity: 0, duration: 0.45, stagger: 0.035, ease: 'power2.in', immediateRender: false }, at);
    tl.set(el, { visibility: 'hidden' }, at + 0.6);
    if (veilTo !== null) tl.to(veil, { opacity: veilTo, duration: 0.5, ease: 'sine.inOut' }, at);
  };
  const fadeIn = (sel, at, dur = 0.5) => tl.fromTo(sel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', immediateRender: false }, at);
  const fadeOut = (sel, at, dur = 0.35) => tl.fromTo(sel, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -8, duration: dur, ease: 'power2.in', immediateRender: false }, at);
  // le inquadrature in ordine cronologico: la rotta di ognuna si "srotola" vicino alla precedente,
  // così ogni passaggio gira per la via più breve e senza salti di 360°
  let lastYaw = st.sp.yaw;
  const pose = (p) => {
    let yaw = p.yaw;
    while (yaw - lastYaw > Math.PI) yaw -= 2 * Math.PI;
    while (yaw - lastYaw < -Math.PI) yaw += 2 * Math.PI;
    lastYaw = yaw;
    return { px: p.pos.x, py: p.pos.y, pz: p.pos.z, yaw, pitch: p.pitch };
  };
  const shot = (pz, dur, at, ease = 'sine.inOut') => tl.to(st.sp, { ...pose(pz), duration: dur, ease }, at);
  // si arriva sull'inquadratura e il drone continua ad avvicinarsi piano, fino a fermarsi
  const settle = (pz, dur, at, k) => shot(drifted(pz, k), dur, at, 'sine.out');
  const draw = (to, dur, at, ease = 'sine.inOut') => tl.to(st, { lineS: to, duration: dur, ease }, at);
  const climb = (to, dur, at, ease = 'sine.inOut') => tl.to(st, { climbS: to, duration: dur, ease }, at);
  const cutTo = (pz, at) => {
    tl.to('#cut', { opacity: 1, duration: 0.4, ease: 'power1.in' }, at);
    tl.set(st.sp, pose(pz), at + 0.42);
    tl.to('#cut', { opacity: 0, duration: 0.55, ease: 'power1.out' }, at + 0.45);
  };

  const labels = [0];
  const stops = []; // tappe con la vista a 360°
  let t = 0;
  const mark = (dur) => { t += dur; labels.push(t); };

  // 0 → 1 · dalla strada al Coll si sale sulla prima inquadratura; la linea scende verso il mare
  beatOut('#b-intro', t);
  fadeOut('#cue', t);
  shot(P.a, D.a * 0.5, t);
  settle(P.a, D.a * 0.5, t + D.a * 0.5);
  tl.to(st, { rider: 1, duration: 0.4 }, t + 0.2);
  draw(S.lineA, D.a * 0.8, t + D.a * 0.2);
  beatIn('#b-a', t + D.a * 0.5);
  mark(D.a);

  // 1 → 2 · seconda inquadratura, la linea continua
  beatOut('#b-a', t);
  shot(P.b, D.b * 0.5, t);
  settle(P.b, D.b * 0.5, t + D.b * 0.5);
  draw(S.lineB, D.b * 0.85, t + D.b * 0.1);
  beatIn('#b-b', t + D.b * 0.45, { veilTo: 0.62 });
  mark(D.b);

  // 2 → 3 · la linea arriva al mare; dissolvenza sulla cala del porto: sosta a 360°
  beatOut('#b-b', t);
  shot(P.c, D.c * 0.45, t);
  draw(L, D.c * 0.55, t + D.c * 0.05);
  cutTo(P.port, t + D.c * 0.58);
  settle(P.port, D.c * 0.42 - 0.45, t + D.c * 0.58 + 0.45, 0.02);
  tl.to(st, { stop: 1, duration: 0.2 }, t + D.c - 0.2);
  beatIn('#b-port', t + D.c * 0.68, { veilTo: 0.62 });
  fadeIn('#hint', t + D.c * 0.8);
  mark(D.c);
  stops.push(labels.length - 1);

  // 3 → 4 · "Ahora, sube."
  beatOut('#b-port', t, { veilTo: null });
  fadeOut('#hint', t);
  tl.to(st, { stop: 0, duration: 0.2 }, t);
  settle(P.port, D.up, t, 0.04);
  beatIn('#b-up', t + D.up * 0.3);
  tl.set(st, { dir: -1 }, t + D.up - 0.02); // da qui si sale: il punto arancione è il ciclista
  mark(D.up);

  // 4 → 5 · si allarga sul mare; la salita si accende dal porto verso la montagna
  beatOut('#b-up', t);
  shot(P.sea, D.climb * 0.45, t);
  settle(P.sea, D.climb * 0.55, t + D.climb * 0.45, 0.05);
  tl.to(st, { dim: 1, duration: D.climb * 0.4, ease: 'sine.inOut' }, t);
  climb(S.climbStop, D.climb * 0.9, t + D.climb * 0.1);
  if (S.counter) fadeIn('#counter', t + D.climb * 0.3);
  tl.to('#veil-b', { opacity: 0.55, duration: 0.5 }, t + D.climb * 0.3);
  beatIn('#b-climb', t + D.climb * 0.5);
  mark(D.climb);

  // 5 → 6 · dissolvenza sul Nus de sa Corbata (niente lunghi voli di camera): sosta a 360°
  beatOut('#b-climb', t);
  climb(nusS, D.nus * 0.8, t, 'sine.in');
  cutTo(P.nus, t + D.nus * 0.2);
  settle(P.nus, D.nus * 0.8 - 0.45, t + D.nus * 0.2 + 0.45, 0.02);
  tl.to(st, { stop: 1, duration: 0.2 }, t + D.nus - 0.2);
  beatIn('#b-nus', t + D.nus * 0.45, { veilTo: 0.5 });
  fadeIn('#hint', t + D.nus * 0.6);
  mark(D.nus);
  stops.push(labels.length - 1);

  // 6 → 7 · ci si gira: tutta la salita e il mare al tramonto; il ciclista arriva al Coll
  beatOut('#b-nus', t);
  fadeOut('#hint', t);
  tl.to(st, { stop: 0, duration: 0.2 }, t);
  shot(P.top, D.top * 0.85, t);
  climb(0, D.top * 0.85, t + D.top * 0.05, 'sine.out');
  beatIn('#b-top', t + D.top * 0.6, { veilTo: 0.5 });
  mark(D.top);

  // 7 → 8
  if (S.counter) fadeOut('#counter', t);
  beatOut('#b-top', t, { veilTo: null });
  settle(P.top, D.stats, t, 0.02);
  beatIn('#b-stats', t + 0.4, { veilTo: 0.6 });
  mark(D.stats);

  // 8 → 9 · la frase finale e i bottoni
  beatOut('#b-stats', t, { veilTo: null });
  beatIn('#b-end', t + 0.4, { veilTo: 0.25 });
  tl.to('#veil-b', { opacity: 1, duration: 0.6 }, t + 0.3);
  mark(D.end);
  tl.to({}, { duration: 0.001 }, t); // la timeline termina esattamente qui
  const total = t;

  // ── navigazione a tappe
  const progressEl = $('#progress');
  const setBar = () => { progressEl.style.transform = `scaleX(${(tl.time() / total).toFixed(4)})`; };
  let step = 0, anim = null, locked = true;
  const goTo = (k) => {
    k = Math.max(0, Math.min(labels.length - 1, k));
    if (k === step && !anim) return;
    const to = labels[k];
    const dist = Math.abs(to - tl.time());
    const forward = to > tl.time();
    step = k;
    anim?.kill();
    anim = gsap.to(tl, {
      time: to,
      duration: forward ? dist : dist / S.backSpeed,
      ease: forward ? 'none' : 'sine.inOut',
      onUpdate: setBar,
      onComplete: () => { anim = null; },
    });
  };
  const next = () => {
    if (locked) return;
    // uno swipe mentre si sta andando avanti accelera l'animazione invece di saltare la tappa
    if (anim && labels[step] > tl.time()) { anim.timeScale(S.hurry); return; }
    goTo(step + 1);
  };
  const prev = () => { if (!locked) goTo(step - 1); };

  if (!capture) {
    // rotella / trackpad: un gesto = una tappa (l'inerzia del trackpad non conta come altri gesti)
    let acc = 0, busy = false, lastWheel = 0, fired = 0;
    addEventListener('wheel', (e) => {
      if (e.target.closest?.('.info, .final')) return;
      e.preventDefault();
      const now = performance.now();
      if (busy && now - lastWheel > 180 && now - fired > 450) busy = false;
      lastWheel = now;
      if (busy) return;
      acc += e.deltaY;
      if (Math.abs(acc) > 30) {
        acc > 0 ? next() : prev();
        acc = 0; busy = true; fired = now;
      }
    }, { passive: false });
    // touch: swipe verticale (quello orizzontale, nelle soste, gira la vista)
    let tx = 0, ty = 0, tracking = false;
    addEventListener('touchstart', (e) => {
      tracking = !e.target.closest('.info, .final') && e.touches.length === 1;
      if (tracking) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (!e.target.closest('.info__scroll')) e.preventDefault(); // niente rimbalzo della pagina
    }, { passive: false });
    addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const p = e.changedTouches[0];
      const dx = p.clientX - tx, dy = p.clientY - ty;
      if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.2) (dy < 0 ? next : prev)();
    }, { passive: true });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('.info, .final')) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.target.closest?.('button, a'))) { e.preventDefault(); next(); }
      else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); prev(); }
    });
  }

  // ── apertura: la prima frase entra da sola, poi l'invito a scorrere
  const intro = (instant = false) => {
    const el = $('#b-intro');
    gsap.set(el, { visibility: 'visible' });
    gsap.set(veil, { opacity: 1 });
    if (instant) { gsap.set(partsOf(el), { yPercent: 0, opacity: 1 }); gsap.set('#cue', { autoAlpha: 1 }); return; }
    gsap.fromTo(partsOf(el), { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out', delay: 0.2 });
    gsap.fromTo('#cue', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 1.4 });
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

  // ── contatore (aggiornato a ogni fotogramma, il DOM solo quando cambia)
  // valori ufficiali della salita (PDF Nomads, "Coll de Sa Calobra"): il contatore li raggiunge
  // in proporzione a strada percorsa e quota guadagnata sul tracciato reale
  const kmEl = $('#c-km'), mEl = $('#c-m');
  const { km: KM, m: M } = CONFIG.trip.climb;
  const yPort = road.y(road.count - 1), yTop = road.y(0);
  const p = new Vector3();
  let lastKm = '', lastM = '';
  const updateCounter = () => {
    const climbing = st.dir < 0;
    const rs = rig.riderS();
    road.at(rs, p);
    const fKm = climbing ? Math.min(Math.max((L - rs) / L, 0), 1) : 0;
    const fM = climbing ? Math.min(Math.max((p.y - yPort) / (yTop - yPort), 0), 1) : 0;
    const km = (fKm * KM).toFixed(1);
    const m = String(Math.round(fM * M));
    if (km !== lastKm) { kmEl.textContent = km; lastKm = km; }
    if (m !== lastM) { mEl.textContent = m; lastM = m; }
  };

  const api = {
    tl, total, intro, open, close, next, prev, goTo, finalOpen: false,
    get step() { return step; },
    labels: labels.map((x) => x / total), // tappe, in frazione della storia
    stops: stops.map((k) => labels[k] / total), // tappe con la vista a 360°
    // INFO MALLORCA e intro: la storia si ferma dov'è (anche a metà di un passaggio)
    pause() { locked = true; anim?.pause(); document.documentElement.classList.add('is-locked'); },
    resume() { locked = false; anim?.resume(); document.documentElement.classList.remove('is-locked'); },
    updateCounter,
    /** solo per la registrazione: posiziona la storia in un punto preciso */
    seek(progress) { tl.progress(progress); setBar(); },
  };
  return api;
}
