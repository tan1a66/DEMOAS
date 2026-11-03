// La storia: un'unica timeline GSAP guidata dallo scroll (ScrollTrigger, scrub) con Lenis.
// Si scende dal Coll dels Reis al mare, sosta al porto, si risale, sosta al Nus de sa Corbata,
// cima. La timeline anima lo stato della camera (rig.state) e i testi; tutto il resto
// (linea, ciclista, contatore, audio) si calcola da quello stato a ogni fotogramma.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Vector3 } from 'three';
import { CONFIG } from '../config.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s) => document.querySelector(s);

export function createStory({ rig, road, capture = false }) {
  const U = CONFIG.story;
  const L = road.length;
  const st = rig.state;
  const poses = rig.poses;
  const nusS = road.keypoints.CORBATA.index * road.step;

  const total = U.rise + U.swoop + U.descent + U.arrive + U.stop1 + U.leave + U.ascent + U.arrive2 + U.stop2 + U.top + U.finale;
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

  let t = 0;
  // 1 · Apertura: dalla strada al Coll la camera sale e ruota, rivela serpentina, gola e mare
  tl.to(st.sp, { ...pose(poses.overview), duration: U.rise, ease: 'power2.inOut' }, t);
  beatOut('#b-intro', t + U.rise * 0.42, { veilTo: 0 });
  t += U.rise;

  // 2 · Discesa (un solo movimento continuo dal Coll al porto: niente scatti di velocità)
  const descDur = U.swoop + U.descent + U.arrive;
  // velocità costante: niente accelerazioni (le transizioni del drone ammorbidiscono inizio e fine)
  tl.fromTo(st, { camS: 0 }, { camS: L, duration: descDur, ease: 'none', immediateRender: false }, t);
  tl.to(st, { drone: 0, duration: U.swoop, ease: 'power2.inOut' }, t);
  tl.to(st, { rider: 1, duration: U.swoop * 0.6 }, t + U.swoop * 0.4);
  beatIn('#b-down', t + U.swoop + U.descent * 0.22);
  beatOut('#b-down', t + U.swoop + U.descent * 0.68);
  t += U.swoop + U.descent;
  // arrivo al porto: il drone rallenta e si ferma sopra la fine della strada, con la stessa
  // direzione di marcia (nessuna rotazione brusca)
  const portIn = rig.followPose(1, L), portOut = portIn; // si arriva e si riparte guardando il mare
  tl.set(st.sp, pose(portIn), t);
  tl.to(st, { drone: 1, duration: U.arrive, ease: 'sine.inOut' }, t);
  t += U.arrive;

  // 3 · Sosta 1: il porto, 360°. Orbita lenta: dal mare alla foce del Torrent de Pareis
  // e ritorno. L'utente può guardarsi attorno in ogni momento.
  const stops = [[t, t + U.stop1]];
  // un'unica orbita continua (velocità angolare quasi costante, con partenza e arrivo dolci)
  tl.to(st.sp, { keyframes: { '50%': pose(poses.port), '100%': pose(portOut), easeEach: 'none' }, duration: U.stop1, ease: 'sine.inOut' }, t);
  tl.to(st, { stop: 1, duration: 0.12 }, t);
  beatIn('#b-port', t, { dur: 0.22, veilTo: 0.6 });
  fadeIn('#hint', t + 0.1);
  fadeOut('#hint', t + U.stop1 * 0.45);
  beatOut('#b-port', t + U.stop1 * 0.42, { veilTo: null });
  beatIn('#b-up', t + U.stop1 * 0.6);
  tl.to(st, { stop: 0, duration: 0.15 }, t + U.stop1 - 0.15);
  tl.set(st, { dir: -1 }, t + U.stop1 - 0.02); // da qui si sale: il drone vola all'indietro davanti al ciclista
  t += U.stop1;

  // 4 · Salita (movimento continuo dal porto al Nus) con il contatore
  const ascDur = U.leave + U.ascent + U.arrive2;
  tl.fromTo(st, { camS: L }, { camS: nusS, duration: ascDur, ease: 'none', immediateRender: false }, t);
  tl.to(st, { drone: 0, duration: U.leave, ease: 'sine.inOut' }, t);
  beatOut('#b-up', t + U.leave * 0.3);
  fadeIn('#counter', t + U.leave * 0.5, 0.3);
  tl.to('#veil-b', { opacity: 0.55, duration: 0.3 }, t + U.leave * 0.5);
  t += U.leave + U.ascent;
  tl.set(st.sp, pose(rig.followPose(1, nusS)), t);
  tl.to(st, { drone: 1, duration: U.arrive2, ease: 'sine.inOut' }, t);
  t += U.arrive2;

  // 5 · Sosta 2: il Nus de sa Corbata, 360°; poi l'orbita si apre verso il sole
  stops.push([t, t + U.stop2]);
  // dal Nus la camera sale lenta fino alla vista finale su tutta la salita (stessa direzione)
  const orbitDur = U.stop2 + U.top;
  tl.to(st.sp, {
    keyframes: { '35%': pose(poses.nus), '100%': pose(poses.top), easeEach: 'none' },
    duration: orbitDur, ease: 'sine.inOut',
  }, t);
  tl.to(st, { stop: 1, duration: 0.12 }, t);
  beatIn('#b-nus', t, { dur: 0.22, veilTo: 0.5 });
  fadeIn('#hint', t + 0.1);
  fadeOut('#hint', t + U.stop2 * 0.6);
  tl.to(st, { stop: 0, duration: 0.15 }, t + U.stop2 - 0.15);
  t += U.stop2;

  // 6 · Cima: gli ultimi metri e la vista si apre su tutta la salita e sul mare al tramonto
  beatOut('#b-nus', t, { veilTo: 0 });
  tl.to(st, { camS: 0, riderOff: 0, duration: U.top, ease: 'sine.inOut' }, t); // il ciclista arriva in cima
  beatIn('#b-top', t + U.top * 0.55, { dur: 0.2, veilTo: 0.45 });
  t += U.top;

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
  const kmEl = $('#c-km'), mEl = $('#c-m');
  const yPort = road.y(road.count - 1);
  const p = new Vector3();
  let lastKm = '', lastM = '';
  const updateCounter = () => {
    const rs = rig.riderS();
    const climbing = st.dir < 0;
    road.at(rs, p);
    // valori reali misurati sulla strada: 0 → 10,1 km e 0 → ~700 m di dislivello
    const km = (climbing ? Math.max(L - rs, 0) / 1000 : 0).toFixed(1);
    const m = String(climbing ? Math.max(0, Math.round(p.y - yPort)) : 0);
    if (km !== lastKm) { kmEl.textContent = km; lastKm = km; }
    if (m !== lastM) { mEl.textContent = m; lastM = m; }
  };

  const api = {
    tl, lenis, total, intro, open, close, finalOpen: false,
    stops: stops.map(([a, b]) => [a / t, b / t]), // finestre delle soste, in frazione della storia
    updateCounter,
    /** solo per la registrazione: posiziona la storia senza scroll */
    seek(progress) { tl.progress(progress); progressEl.style.transform = `scaleX(${progress})`; },
  };
  return api;
}
