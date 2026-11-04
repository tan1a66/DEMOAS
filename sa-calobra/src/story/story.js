// La storia, a tappe: ogni gesto (swipe, rotella, frecce) porta alla tappa successiva e lì si
// ferma, dove c'è un testo. Sotto c'è un'unica timeline GSAP in secondi con un'etichetta per
// tappa; il controller la porta da un'etichetta all'altra.
// La camera resta quasi ferma (inquadrature da drone in hovering): a muoversi è la linea
// arancione, che scende dal Coll dels Reis al mare e poi si riaccende in salita; alla fine la
// linea prosegue verso il prossimo capitolo. Vista a 360° solo al porto, sul mare.
// I testi vengono da config.js → copy: parlano di Nomads (il viaggio è nel pannello del Capítulo 01).
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { Vector3, PerspectiveCamera, Euler } from 'three';
import { CONFIG } from '../config.js';
import { drifted } from '../camera/rig.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

gsap.registerPlugin(SplitText);

const $ = (s) => document.querySelector(s);
const ORDER = ['start', 'b', 'c', 'port', 'nus', 'top', 'next'];
const PHOTOS = {
  crew: { src: crewImg, alt: 'Ciclistas de Nomads en una pausa de café' },
  coach: { src: coachImg, alt: 'Alfredo “Freddy” Cruz revisa la estrategia con un ciclista' },
};
const SHARE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>';

// i testi delle tappe, generati dai testi in config.js (il finale esiste già: ha i bottoni)
function buildBeats() {
  const host = $('#story');
  const end = $('#b-next');
  for (const key of ORDER) {
    const c = CONFIG.copy[key];
    const el = key === 'next' ? end : host.insertBefore(document.createElement('div'), end);
    el.id = `b-${key}`;
    el.classList.add('beat');
    if (c.size === 'big') el.classList.add('beat--big');
    const parts = [];
    if (c.kicker) parts.push(`<p class="kicker">${c.kicker}</p>`);
    const cls = c.size === 'lead' ? 'lead' : c.size === 'big' ? 'headline headline--big' : 'headline';
    const tag = key === 'start' ? 'h1' : 'p';
    parts.push(`<${tag} class="${cls}" data-split>${c.text}</${tag}>`);
    if (c.sub) parts.push(`<p class="sub">${c.sub}</p>`);
    if (c.photo) parts.push(`<figure class="beat__photo"><img src="${PHOTOS[c.photo].src}" alt="${PHOTOS[c.photo].alt}" decoding="async" /></figure>`);
    if (key === 'top') parts.push(`<button class="share" id="share" type="button">${SHARE_ICON}<span>${CONFIG.copy.share}</span></button>`);
    el.insertAdjacentHTML('afterbegin', parts.join(''));
  }
  $('#next-label').textContent = CONFIG.copy.nextChapter;
}

export function createStory({ rig, road, camera, capture = false }) {
  buildBeats();
  const S = CONFIG.story;
  const D = S.steps;
  const L = road.length;
  const st = rig.state;
  const P = rig.poses;
  const nusS = road.keypoints.CORBATA.index * road.step;
  st.hold = 0;     // salita dal porto al Nus, 0…1 (animata dalla timeline)
  st.climbTop = 0; // dal Nus al Coll, 0…1

  // righe mascherate per i reveal
  const lines = new Map();
  for (const el of document.querySelectorAll('[data-split]')) {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    lines.set(el, split.lines);
  }
  // righe di testo (si alzano dalla maschera) e altri elementi (foto, bottoni: salgono di poco)
  const partsOf = (beat) => {
    const text = [], other = [];
    for (const child of beat.children) {
      if (lines.has(child)) text.push(...lines.get(child));
      else other.push(child);
    }
    return { text, other };
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const veil = $('#veil');

  // ── utilità: entrate/uscite dei testi (maschera + leggero movimento verticale)
  const beatIn = (sel, at, { veilTo = 0.55 } = {}) => {
    const el = $(sel);
    const { text, other } = partsOf(el);
    tl.set(el, { visibility: 'visible' }, at);
    tl.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at + 0.25);
    if (veilTo !== null) tl.to(veil, { opacity: veilTo, duration: 0.6, ease: 'sine.inOut' }, at);
  };
  const beatOut = (sel, at, { veilTo = 0 } = {}) => {
    const el = $(sel);
    const { text, other } = partsOf(el);
    tl.fromTo(text, { yPercent: 0, opacity: 1 }, { yPercent: -115, opacity: 0, duration: 0.45, stagger: 0.035, ease: 'power2.in', immediateRender: false }, at);
    if (other.length) tl.fromTo(other, { y: 0, opacity: 1 }, { y: -14, opacity: 0, duration: 0.4, ease: 'power2.in', immediateRender: false }, at);
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
  // passaggio morbido: si sfuma nella luce calda del tramonto (non nel nero) e si riapre altrove
  const cutTo = (pz, at) => {
    tl.to('#cut', { opacity: 1, duration: 0.6, ease: 'sine.inOut' }, at);
    tl.set(st.sp, pose(pz), at + 0.62);
    tl.to('#cut', { opacity: 0, duration: 0.85, ease: 'sine.inOut' }, at + 0.66);
  };
  const stopOn = (at) => tl.to(st, { stop: 1, duration: 0.2 }, at);
  const stopOff = (at) => tl.to(st, { stop: 0, duration: 0.2 }, at);

  // la linea che alla fine prosegue verso l'orizzonte (disegnata dalla timeline)
  const nx = { p: 0 };
  const nextEls = { line: $('#next-line'), glow: $('#next-glow'), dot: $('#next-dot'), label: $('#next-label') };
  let nextLen = 1;
  const drawNext = () => {
    const off = nextLen * (1 - nx.p);
    for (const el of [nextEls.line, nextEls.glow]) el.style.strokeDashoffset = off;
    nextEls.dot.style.opacity = nx.p > 0.97 ? 1 : 0;
  };

  const labels = [0];
  const stops = []; // tappe con la vista a 360°
  let t = 0;
  const mark = (dur) => { t += dur; labels.push(t); };

  // 0 → 1 · quiénes somos: la linea scende dal Coll tra i tornanti
  beatOut('#b-start', t);
  fadeOut('#cue', t);
  shot(P.b, D.b * 0.55, t);
  settle(P.b, D.b * 0.45, t + D.b * 0.55);
  tl.to(st, { rider: 1, duration: 0.4 }, t + 0.2);
  draw(S.lineB, D.b * 0.85, t + D.b * 0.1);
  beatIn('#b-b', t + D.b * 0.5);
  mark(D.b);

  // 1 → 2 · qué hacemos: la linea arriva al mare
  beatOut('#b-b', t);
  shot(P.c, D.c * 0.55, t);
  settle(P.c, D.c * 0.45, t + D.c * 0.55);
  draw(L, D.c * 0.9, t + D.c * 0.05);
  beatIn('#b-c', t + D.c * 0.5, { veilTo: 0.62 });
  mark(D.c);

  // 2 → 3 · the crew: dissolvenza sulla cala del porto, sosta a 360°
  beatOut('#b-c', t);
  cutTo(P.port, t + 0.1);
  settle(P.port, D.port - 0.55, t + 0.55, 0.02);
  stopOn(t + D.port - 0.2);
  beatIn('#b-port', t + D.port * 0.4, { veilTo: 0.62 });
  fadeIn('#hint', t + D.port * 0.65);
  mark(D.port);
  stops.push(labels.length - 1);

  // 3 → 4 · head coach: ci si allarga sul mare mentre la salita si accende dal porto,
  //          poi luce calda e si arriva sul Nus de sa Corbata
  beatOut('#b-port', t, { veilTo: null });
  fadeOut('#hint', t);
  stopOff(t);
  tl.set(st, { dir: -1 }, t + 0.05); // da qui si sale: il punto arancione è il ciclista
  shot(P.sea, D.nus * 0.5, t);
  tl.to(st, { dim: 1, duration: D.nus * 0.4, ease: 'sine.inOut' }, t);
  tl.to(st, { hold: 1, duration: D.nus * 0.62, ease: 'sine.inOut' }, t + D.nus * 0.08);
  tl.to('#veil-b', { opacity: 0.55, duration: 0.6 }, t + D.nus * 0.3);
  if (S.counter) fadeIn('#counter', t + D.nus * 0.3);
  cutTo(P.nus, t + D.nus * 0.5);
  settle(P.nus, D.nus * 0.5 - 0.66, t + D.nus * 0.5 + 0.66, 0.02);
  beatIn('#b-nus', t + D.nus * 0.72, { veilTo: 0.55 });
  mark(D.nus);

  // 5 → 6 · ci si gira: tutta la salita e il mare al tramonto; il ciclista arriva al Coll
  beatOut('#b-nus', t);
  shot(P.top, D.top * 0.85, t);
  tl.to(st, { climbTop: 1, duration: D.top * 0.85, ease: 'sine.out' }, t + D.top * 0.05);
  beatIn('#b-top', t + D.top * 0.6, { veilTo: 0.5 });
  mark(D.top);

  // 6 → 7 · si alza lo sguardo all'orizzonte: la linea prosegue verso il prossimo capitolo
  if (S.counter) fadeOut('#counter', t);
  beatOut('#b-top', t, { veilTo: null });
  shot(P.next, D.next * 0.8, t);
  tl.set('#next', { visibility: 'visible' }, t + D.next * 0.3);
  tl.to(nx, { p: 1, duration: D.next * 0.6, ease: 'sine.inOut', onUpdate: drawNext }, t + D.next * 0.3);
  fadeIn('#next-label', t + D.next * 0.8);
  tl.to('#veil-b', { opacity: 1, duration: 0.6 }, t + D.next * 0.4);
  beatIn('#b-next', t + D.next * 0.55, { veilTo: 0.25 });
  mark(D.next);
  tl.to({}, { duration: 0.001 }, t); // la timeline termina esattamente qui
  const total = t;

  // geometria della linea finale: dal basso a destra (fuori dalla colonna dei testi) fino
  // all'orizzonte sotto il sole al tramonto, calcolata per le dimensioni dello schermo
  const layoutNext = () => {
    const W = innerWidth, H = innerHeight;
    const p = P.next;
    const cam = new PerspectiveCamera(camera.fov, W / H, 1, 1e7);
    cam.position.copy(p.pos);
    cam.quaternion.setFromEuler(new Euler(p.pitch, p.yaw, 0, 'YXZ'));
    cam.updateMatrixWorld();
    const az = (CONFIG.sun.azimuth * Math.PI) / 180; // da nord, in senso orario (x = est, z = sud)
    const far = new Vector3(p.pos.x + Math.sin(az) * 60000, 0, p.pos.z - Math.cos(az) * 60000).project(cam);
    const hx = Math.min(Math.max((far.x * 0.5 + 0.5) * W, W * 0.25), W * 0.8);
    const hy = Math.min(Math.max((-far.y * 0.5 + 0.5) * H, H * 0.12), H * 0.6);
    const x0 = W * 0.9, y0 = H + 30;
    const d = `M${x0},${y0} C${x0 + W * 0.02},${H * 0.72} ${hx + W * 0.26},${hy + H * 0.16} ${hx},${hy}`;
    $('#next').setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const el of [nextEls.line, nextEls.glow]) el.setAttribute('d', d);
    nextLen = nextEls.line.getTotalLength();
    for (const el of [nextEls.line, nextEls.glow]) el.style.strokeDasharray = `${nextLen} ${nextLen}`;
    nextEls.dot.setAttribute('cx', hx);
    nextEls.dot.setAttribute('cy', hy);
    // l'etichetta sotto l'orizzonte, a sinistra del punto (la linea arriva da destra);
    // se lì non c'è spazio, sopra a destra
    const lw = nextEls.label.offsetWidth;
    const left = hx - 14 - lw >= 12;
    nextEls.label.style.left = `${left ? hx - 14 - lw : Math.min(hx + 12, W - lw - 12)}px`;
    nextEls.label.style.top = `${left ? hy + 10 : hy - 26}px`;
    drawNext();
  };
  layoutNext();
  addEventListener('resize', layoutNext);

  // ── la linea come barra di avanzamento: un punto per tappa
  const railFill = $('#rail-fill');
  const dotsEl = $('#rail-dots');
  dotsEl.innerHTML = labels.map((x) => `<i style="top:${((x / total) * 100).toFixed(2)}%"></i>`).join('');
  const dots = [...dotsEl.children];
  const setBar = () => {
    const now = tl.time();
    railFill.style.transform = `scaleY(${(now / total).toFixed(4)})`;
    dots.forEach((d, k) => { d.classList.toggle('on', labels[k] <= now + 1e-3); d.classList.toggle('now', k === step); });
  };

  // ── navigazione a tappe
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
      onComplete: () => {
        anim = null;
        api.onStep?.(k);
      },
    });
    setBar();
  };
  const next = () => {
    if (locked) return;
    // uno swipe mentre si sta andando avanti accelera l'animazione invece di saltare la tappa
    if (anim && labels[step] > tl.time()) { anim.timeScale(S.hurry); return; }
    goTo(step + 1);
  };
  const prev = () => { if (!locked) goTo(step - 1); };

  const root = document.documentElement;

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
    const el = $('#b-start');
    const { text, other } = partsOf(el);
    gsap.set(el, { visibility: 'visible' });
    gsap.set(veil, { opacity: 1 });
    setBar();
    if (instant) { gsap.set([...text, ...other], { yPercent: 0, y: 0, opacity: 1 }); gsap.set(['#cue', '.rail'], { autoAlpha: 1 }); return; }
    gsap.fromTo(text, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out', delay: 0.2 });
    gsap.fromTo(other, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.2 });
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

  // ── profilo altimetrico della salita (dati veri del tracciato) e contatore
  // valori ufficiali della salita (PDF Nomads, "Coll de Sa Calobra"): il contatore li raggiunge
  // in proporzione a strada percorsa e quota guadagnata sul tracciato reale
  const kmEl = $('#c-km'), mEl = $('#c-m');
  const { km: KM, m: M } = CONFIG.trip.climb;
  const yPort = road.y(road.count - 1), yTop = road.y(0);
  const py = (y) => 95 - ((y - yPort) / (yTop - yPort)) * 88; // quota → y nel riquadro 0…100
  const prof = [];
  for (let k = 0; k <= 160; k++) {
    const i = Math.round((road.count - 1) * (1 - k / 160)); // dal porto (fondo della strada) al Coll
    prof.push(`${((k / 160) * 1000).toFixed(1)},${py(road.y(i)).toFixed(2)}`);
  }
  const profD = `M${prof.join(' L')}`;
  $('#profile-base').setAttribute('d', profD);
  $('#profile-done').setAttribute('d', profD);
  $('#profile-area').setAttribute('d', `${profD} L1000,100 L0,100 Z`);
  const cut = $('#profile-cut'), pdot = $('#profile-dot');
  const p = new Vector3();
  let lastKm = '', lastM = '', lastF = -1;

  /** a ogni fotogramma: dov'è il ciclista, profilo e contatore */
  const update = () => {
    st.climbS = L - st.hold * (L - nusS) - st.climbTop * nusS;

    const climbing = st.dir < 0;
    const rs = rig.riderS();
    road.at(rs, p);
    const fKm = climbing ? Math.min(Math.max((L - rs) / L, 0), 1) : 0;
    const fM = climbing ? Math.min(Math.max((p.y - yPort) / (yTop - yPort), 0), 1) : 0;
    const km = (fKm * KM).toFixed(1);
    const m = String(Math.round(fM * M));
    if (km !== lastKm) { kmEl.textContent = km; lastKm = km; }
    if (m !== lastM) { mEl.textContent = m; lastM = m; }
    if (Math.abs(fKm - lastF) > 1e-4) {
      cut.setAttribute('width', (fKm * 1000).toFixed(1));
      pdot.style.left = `${(fKm * 100).toFixed(2)}%`;
      pdot.style.top = `${py(p.y).toFixed(2)}%`;
      lastF = fKm;
    }
  };

  const api = {
    tl, total, intro, open, close, next, prev, goTo, update, finalOpen: false,
    onStep: null, // (tappa) => {}, quando si arriva a una tappa
    get step() { return step; },
    labels: labels.map((x) => x / total), // tappe, in frazione della storia
    stops: stops.map((k) => labels[k] / total), // tappe con la vista a 360°
    order: ORDER,
    // INFO e intro: la storia si ferma dov'è (anche a metà di un passaggio)
    pause() { locked = true; anim?.pause(); root.classList.add('is-locked'); },
    resume() { locked = false; anim?.resume(); root.classList.remove('is-locked'); },
    /** solo per la registrazione: posiziona la storia in un punto preciso */
    seek(progress) { tl.progress(progress); step = labels.findIndex((x) => x >= tl.time() - 1e-3); setBar(); },
  };
  return api;
}
