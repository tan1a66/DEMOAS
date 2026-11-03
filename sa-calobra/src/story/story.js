// La storia: un'unica timeline GSAP guidata dallo scroll (ScrollTrigger, scrub) con Lenis.
// La camera resta quasi ferma (inquadrature da drone in hovering): a muoversi è la linea
// arancione, che scende dal Coll dels Reis al mare e poi si riaccende in salita.
// La timeline anima lo stato (rig.state) e i testi; linea, ciclista, contatore e audio si
// calcolano da quello stato a ogni fotogramma.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Vector3 } from 'three';
import { CONFIG } from '../config.js';
import { drifted } from '../camera/rig.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s) => document.querySelector(s);

export function createStory({ rig, road, capture = false }) {
  const U = CONFIG.story;
  const L = road.length;
  const st = rig.state;
  const poses = rig.poses;
  const nusS = road.keypoints.CORBATA.index * road.step;

  const total = U.rise + U.drawA + U.moveAB + U.drawB + U.moveBC + U.drawC + U.arrive + U.stop1 + U.leave + U.climb + U.cut + U.stop2 + U.lookback + U.finale;
  document.documentElement.style.setProperty('--units', total.toFixed(3));

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
  const beatIn = (sel, at, { dur = 0.3, veilTo = 1 } = {}) => {
    const el = $(sel);
    tl.set(el, { visibility: 'visible' }, at);
    tl.fromTo(partsOf(el), { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: dur, stagger: 0.045, ease: 'power3.out', immediateRender: false }, at);
    if (veilTo) tl.to(veil, { opacity: veilTo, duration: dur }, at);
  };
  const beatOut = (sel, at, { dur = 0.24, veilTo = 0 } = {}) => {
    const el = $(sel);
    tl.fromTo(partsOf(el), { yPercent: 0, opacity: 1 }, { yPercent: -115, opacity: 0, duration: dur, stagger: 0.03, ease: 'power2.in', immediateRender: false }, at);
    tl.set(el, { visibility: 'hidden' }, at + dur + 0.04);
    if (veilTo !== null) tl.to(veil, { opacity: veilTo, duration: dur }, at);
  };
  const fadeIn = (sel, at, dur = 0.2) => tl.fromTo(sel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', immediateRender: false }, at);
  const fadeOut = (sel, at, dur = 0.2) => tl.fromTo(sel, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -8, duration: dur, ease: 'power2.in', immediateRender: false }, at);
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

  const P = poses;
  const draw = (to, dur, at) => tl.to(st, { lineS: to, duration: dur, ease: 'none' }, at);
  const shot = (pz, dur, at, ease = 'none') => tl.to(st.sp, { ...pose(pz), duration: dur, ease }, at);
  let t = 0;

  // 1 · Apertura: dalla strada al Coll la camera sale sulla prima inquadratura
  shot(P.a, U.rise, t, 'sine.inOut');
  beatOut('#b-intro', t + U.rise * 0.42, { veilTo: 0 });
  t += U.rise;

  // 2 · Discesa: tre inquadrature quasi ferme; la linea scende verso il mare
  tl.to(st, { rider: 1, duration: 0.25 }, t);
  shot(drifted(P.a), U.drawA, t);
  draw(U.lineA, U.drawA, t);
  t += U.drawA;
  shot(P.b, U.moveAB, t, 'sine.inOut');
  draw(U.lineAB, U.moveAB, t);
  t += U.moveAB;
  shot(drifted(P.b), U.drawB, t);
  draw(U.lineB, U.drawB, t);
  beatIn('#b-down', t + U.drawB * 0.1);
  beatOut('#b-down', t + U.drawB * 0.72);
  t += U.drawB;
  shot(P.c, U.moveBC, t, 'sine.inOut');
  draw(U.lineBC, U.moveBC, t);
  t += U.moveBC;
  shot(drifted(P.c), U.drawC, t);
  draw(L, U.drawC, t);
  t += U.drawC;

  // 3 · Al porto: la camera scende lenta sopra la cala; sosta a 360°
  shot(P.port, U.arrive, t, 'sine.inOut');
  t += U.arrive;
  const stops = [[t, t + U.stop1]];
  shot(drifted(P.port, 0.02), U.stop1, t);
  tl.to(st, { stop: 1, duration: 0.12 }, t);
  beatIn('#b-port', t, { dur: 0.22, veilTo: 0.6 });
  fadeIn('#hint', t + 0.1);
  fadeOut('#hint', t + U.stop1 * 0.45);
  beatOut('#b-port', t + U.stop1 * 0.42, { veilTo: null });
  beatIn('#b-up', t + U.stop1 * 0.58);
  tl.to(st, { stop: 0, duration: 0.15 }, t + U.stop1 - 0.15);
  tl.set(st, { dir: -1 }, t + U.stop1 - 0.02); // da qui si sale: il punto arancione è il ciclista
  t += U.stop1;

  // 4 · Salita: si allarga sul mare; la salita si accende dal porto verso la montagna
  shot(P.sea, U.leave, t, 'sine.inOut');
  tl.to(st, { dim: 1, duration: U.leave }, t);
  tl.to(st, { climbS: nusS, duration: U.leave + U.climb + U.cut, ease: 'none' }, t);
  beatOut('#b-up', t + U.leave * 0.3);
  fadeIn('#counter', t + U.leave * 0.5, 0.3);
  tl.to('#veil-b', { opacity: 0.55, duration: 0.3 }, t + U.leave * 0.5);
  t += U.leave;
  shot(drifted(P.sea, 0.06), U.climb, t);
  t += U.climb;
  // dissolvenza verso il Nus (niente lunghi voli di camera)
  tl.to('#cut', { opacity: 1, duration: U.cut * 0.45, ease: 'power1.in' }, t);
  tl.set(st.sp, pose(P.nus), t + U.cut * 0.5);
  tl.to('#cut', { opacity: 0, duration: U.cut * 0.45, ease: 'power1.out' }, t + U.cut * 0.55);
  t += U.cut;

  // 5 · Sosta 2: il Nus de sa Corbata, 360°
  stops.push([t, t + U.stop2]);
  shot(drifted(P.nus, 0.02), U.stop2, t);
  tl.to(st, { stop: 1, duration: 0.12 }, t);
  beatIn('#b-nus', t, { dur: 0.22, veilTo: 0.5 });
  fadeIn('#hint', t + 0.1);
  fadeOut('#hint', t + U.stop2 * 0.6);
  tl.to(st, { stop: 0, duration: 0.15 }, t + U.stop2 - 0.15);
  t += U.stop2;

  // 6 · Ci si gira: tutta la salita e il mare al tramonto; il ciclista arriva al Coll
  beatOut('#b-nus', t, { veilTo: 0 });
  shot(P.top, U.lookback, t, 'sine.inOut');
  tl.to(st, { climbS: 0, duration: U.lookback, ease: 'sine.inOut' }, t);
  beatIn('#b-top', t + U.lookback * 0.6, { dur: 0.2, veilTo: 0.45 });
  t += U.lookback;

  // il contatore lascia il posto al totale della tappa, poi la frase e il bottone
  fadeOut('#counter', t, 0.2);
  beatOut('#b-top', t, { dur: 0.18, veilTo: null });
  beatIn('#b-stats', t + 0.12, { dur: 0.26, veilTo: 0.75 });
  beatOut('#b-stats', t + U.finale * 0.42, { veilTo: null });
  beatIn('#b-end', t + U.finale * 0.55, { dur: 0.3, veilTo: 0.25 });
  tl.to('#veil-b', { opacity: 1, duration: 0.3 }, t + U.finale * 0.5);
  t += U.finale;
  tl.to({}, { duration: 0.001 }, t); // la timeline termina esattamente qui

  // ── scroll
  let lenis = null;
  const progressEl = $('#progress');
  if (!capture) {
    ScrollTrigger.config({ ignoreMobileResize: true });
    lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.create({
      trigger: '#scroll',
      start: 'top top',
      end: 'bottom bottom',
      scrub: U.scrub,
      animation: tl,
      onUpdate: (self) => { progressEl.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
    });
  }

  // ── apertura (non legata allo scroll): la prima frase entra da sola
  const intro = (instant = false) => {
    const el = $('#b-intro');
    gsap.set(el, { visibility: 'visible' });
    gsap.set(veil, { opacity: 1 });
    if (instant) gsap.set(partsOf(el), { yPercent: 0, opacity: 1 });
    else gsap.fromTo(partsOf(el), { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out', delay: 0.2 });
  };

  // ── schermata finale
  const final = $('#final');
  const open = (e) => {
    const r = e?.currentTarget?.getBoundingClientRect?.();
    const at = r ? `${r.left + r.width / 2}px ${r.top + r.height / 2}px` : '50% 80%';
    lenis?.stop();
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
    lenis?.start();
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
    tl, lenis, total, intro, open, close, finalOpen: false,
    pause() { lenis?.stop(); document.documentElement.classList.add('is-locked'); },
    resume() { lenis?.start(); document.documentElement.classList.remove('is-locked'); },
    stops: stops.map(([a, b]) => [a / t, b / t]), // finestre delle soste, in frazione della storia
    updateCounter,
    /** solo per la registrazione: posiziona la storia senza scroll */
    seek(progress) { tl.progress(progress); progressEl.style.transform = `scaleX(${progress})`; },
  };
  return api;
}
