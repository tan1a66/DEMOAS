// Velata — la seta come accompagnamento: viva nella brezza, la luce segue il dito o il
// mouse; con il dito la si tira (trascinamento orizzontale) o la si sfiora (tocco).
// Allo scroll il nome sale e si posa al centro della barra; compare la frase.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Silk, SILK_COLORS } from './silk/silk.js';
import { createChiStory } from './chi.js';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = coarse || Math.min(innerWidth, innerHeight) < 600;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = params.get('q') || (isMobile ? 'mobile' : 'high');

// ---------- renderer e scena ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(new THREE.Color(SILK_COLORS.ivory));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40);
// ?forma=tonda: la variante con il fazzoletto tondo
const tonda = params.get('forma') === 'tonda' || import.meta.env.VITE_FORMA === 'tonda';
const silk = new Silk({ quality, shape: tonda ? 'round' : 'square' });
scene.add(silk.mesh);

// ---------- inquadratura ----------
// La seta si misura direttamente sullo schermo a ogni fotogramma: la camera la tiene in alto
// con l'orlo a una quota fissa (60% sotto il nome nella prima pagina, ~31% nel menu e nelle
// sezioni), così la parte alta è sempre piena di seta e il testo resta sull'avorio.
// In orizzontale la camera segue la seta: quando la seta guida verso destra, le va dietro.
const frame = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const cam = { x: 0, y: -0.6 }; // punto inquadrato (mondo)
let guiding = false;
let hold = false; // durante la capriola l'inquadratura resta ferma
const page = { p: 0, shown: 0 }; // 0 = nome, 1 = menu / sezioni
const sect = { v: 0 }; // 1 = dentro una sezione: la seta si ritira (fascia sottile, schiarita)
const bg = { v: 0 }; // 1 = Chi sono: la seta diventa lo sfondo a tutta pagina (vicina, schiarita)
const DIST = 6.1;
const heroVis = { h: 2.6 }; // altezza visibile nella prima pagina (si adatta al fazzoletto)
const viewSize = () => {
  const aspect = innerWidth / innerHeight;
  // telefono: la seta riempie la larghezza; desktop: una fascia ampia al centro.
  // Come sfondo (Chi sono) la camera si avvicina: la seta copre tutto lo schermo.
  // prima pagina: l'altezza visibile la decide il controllo (fazzoletto intero); menu e
  // sezioni: inquadratura stretta sulla seta
  const visMenu = aspect < 0.85 ? 0.8 / aspect : 1.75;
  const visNormal = heroVis.h + (visMenu - heroVis.h) * page.shown;
  const visBg = aspect < 0.85 ? 0.42 / aspect : 0.5;
  const visH = visNormal + (visBg - visNormal) * bg.v;
  return { visH, visW: visH * aspect, portrait: aspect < 0.85 };
};
const hemTarget = () => {
  const { portrait } = viewSize();
  const menuT = portrait ? 0.6 - 0.29 * page.shown : 0.56 - 0.29 * page.shown;
  const t = menuT + (0.11 - menuT) * sect.v;
  return t + (1.35 - t) * bg.v; // come sfondo l'orlo scende sotto lo schermo
};
const _v = new THREE.Vector3();
const hemYs = [];
// misure filtrate: la camera reagisce solo alle medie lente, non alle piccole oscillazioni
const meas = { hem: null, low: null, rim: null, cx: null };
const filt = (key, v, dt, tau) => {
  if (meas[key] === null || !isFinite(meas[key])) meas[key] = v;
  else meas[key] += (v - meas[key]) * (1 - Math.exp(-dt / tau));
  return meas[key];
};
const dead = (e, d) => (Math.abs(e) <= d ? 0 : e - Math.sign(e) * d); // zona morta
const screenFrame = (dt) => {
  // (al primo fotogramma non è passato tempo: una misura lì entrerebbe nei filtri e li falserebbe)
  if (hold || !(dt > 0)) return;
  const c = silk.cloth;
  const { visH, visW } = viewSize();
  // orlo (ultime righe) e punto più basso tra quelli in vista
  hemYs.length = 0;
  let lowest = 2, sx = 0, sn = 0;
  for (let j = 0; j < c.ny; j += 2)
    for (let i = 0; i < c.nx; i += 2) {
      const k = (j * c.nx + i) * 3;
      if (c.active && !c.active[j * c.nx + i]) continue;
      _v.set(c.pos[k], c.pos[k + 1], c.pos[k + 2]).project(camera);
      sx += _v.x;
      sn++;
      const inView = _v.x > -1 && _v.x < 1;
      if (!inView) continue;
      if (j >= c.ny - 3) hemYs.push(_v.y);
      if (_v.y < lowest) lowest = _v.y;
    }
  // prima pagina: lo zoom tiene il bordo alto appena fuori dallo schermo (misura lenta)
  if (page.shown < 0.999) {
    let rim = -2;
    for (let i = Math.round(c.nx * 0.3); i < c.nx * 0.7; i++) {
      const k = i * 3;
      _v.set(c.pos[k], c.pos[k + 1], c.pos[k + 2]).project(camera);
      if (_v.y > rim) rim = _v.y;
    }
    const rimF = filt('rim', rim, dt, 1.6);
    const rimT = 1.32; // il bordo alto fuori dallo schermo: la seta è grande e riempie la larghezza
    heroVis.h *= Math.exp(dead(rimF - rimT, 0.04) * Math.min(1, dt * 0.8));
    heroVis.h = Math.min(4.2, Math.max(1.6, heroVis.h));
  }
  // orizzontale: il centro della seta verso il centro dello schermo (misura lenta)
  const cx = filt('cx', sx / sn, dt, guiding ? 0.5 : 1.6);
  cam.x += dead(cx, 0.03) * (visW / 2) * Math.min(1, dt * (guiding ? 1.8 : 0.5));
  // verticale: l'orlo "tipico" (un quarto dei punti più in basso può scendere di più)
  const yT = 1 - 2 * hemTarget();
  if (hemYs.length) {
    hemYs.sort((a, b) => a - b);
    const hem = filt('hem', hemYs[Math.floor(hemYs.length * 0.25)], dt, 1.2);
    cam.y += dead(hem - yT, 0.025) * (visH / 2) * Math.min(1, dt * 1.6);
  }
  // sicurezza: niente seta sul testo (una piega può scendere al massimo di un 3,5% in più)
  const yLimit = yT - 0.07;
  // (come sfondo la seta sta dietro al testo per scelta: niente limite)
  if (bg.v < 0.5 && lowest < yLimit) cam.y += (lowest - yLimit) * (visH / 2) * Math.min(1, dt * 5);
};

const computeFrame = () => {
  const { visW } = viewSize();
  const aspect = innerWidth / innerHeight;
  const tanV = visW / aspect / 2 / DIST;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV));
  frame.target.set(cam.x, cam.y, 0.2);
  frame.pos.set(cam.x + 0.75, cam.y + 0.15, DIST);
  camera.updateProjectionMatrix();
};

let lastW = 0, lastH = 0;
const resize = () => {
  const w = innerWidth, h = innerHeight;
  // su iPhone la barra di Safari cambia l'altezza di poco: si ignora
  if (w === lastW && Math.abs(h - lastH) < 120 && lastH) return;
  lastW = w;
  lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  computeFrame();
};
addEventListener('resize', resize);
resize();
const camPos = frame.pos.clone();
const camTarget = frame.target.clone();
// la camera è già al suo posto prima del primo fotogramma: le prime misure della seta
// sullo schermo (che guidano l'inquadratura) devono partire giuste
camera.position.copy(camPos);
camera.lookAt(camTarget);
camera.updateMatrixWorld();

// ---------- luce: segue il dito / il mouse (±30°), sempre smorzata ----------
const baseLight = new THREE.Vector3(-0.6, 0.42, 0.68).normalize(); // softbox laterale da sinistra
const MAX = THREE.MathUtils.degToRad(30);
const light = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };

// ---------- giroscopio (telefono e tablet): inclinando il dispositivo la luce scorre sul raso ----------
// Il "centro" è come lo si tiene all'inizio; se si cambia postura si riadatta piano (5 s).
// Funziona in verticale e in orizzontale (l'iPad soprattutto): l'inclinazione si legge nel
// riferimento dello schermo, non del dispositivo.
const gyro = { listening: false, on: false, fresh: false, init: false, rx: 0, ry: 0, bx: 0, by: 0 };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const onOrient = (e) => {
  if (e.beta == null || e.gamma == null) return;
  const D = Math.PI / 180;
  const b = e.beta * D, g = e.gamma * D;
  // la direzione "su" vista dal dispositivo (x a destra, y verso l'alto dello schermo, z verso chi guarda)
  const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b), uz = Math.cos(b) * Math.cos(g);
  // ...e vista dallo schermo, che in orizzontale è ruotato rispetto al dispositivo
  const a = (screen.orientation?.angle ?? window.orientation ?? 0) * D;
  const sx = ux * Math.cos(a) - uy * Math.sin(a);
  const sy = ux * Math.sin(a) + uy * Math.cos(a);
  gyro.rx = Math.asin(Math.max(-1, Math.min(1, -sx))); // inclinato a destra: positivo
  gyro.ry = Math.atan2(sy, uz); // 0 in piano, 90° in piedi
  gyro.fresh = gyro.on = true;
};
const listenGyro = () => {
  if (gyro.listening || reduceMotion) return;
  gyro.listening = true;
  addEventListener('deviceorientation', onOrient, { passive: true });
};
// dove non serve un permesso si ascolta subito; altrimenti lo chiede la soglia, al tocco
if (coarse && !document.documentElement.classList.contains('soglia-on')) listenGyro();
const gyroStep = (dt) => {
  if (!gyro.fresh) return;
  if (!gyro.init) {
    gyro.bx = gyro.rx;
    gyro.by = gyro.ry;
    gyro.init = true;
  }
  const kb = 1 - Math.exp(-dt / 5);
  gyro.bx = wrapA(gyro.bx + wrapA(gyro.rx - gyro.bx) * kb);
  gyro.by = wrapA(gyro.by + wrapA(gyro.ry - gyro.by) * kb);
  // 20° d'inclinazione ≈ 30° di luce, con un arrivo morbido al limite
  const G = 1.5;
  light.tYaw = MAX * Math.tanh((wrapA(gyro.rx - gyro.bx) * G) / MAX);
  light.tPitch = MAX * Math.tanh((-wrapA(gyro.ry - gyro.by) * G) / MAX);
};

const aimLight = (x, y, type) => {
  if (gyro.on && type !== 'mouse') return; // con il giroscopio attivo la luce la guida l'inclinazione
  // dentro le sezioni si legge: il mouse sposta la luce la metà (i riflessi non distraggono)
  const amp = MAX * (1 - 0.5 * silk.calm);
  light.tYaw = (x / innerWidth - 0.5) * 2 * amp;
  light.tPitch = (y / innerHeight - 0.5) * 2 * amp;
};
addEventListener('pointermove', (e) => aimLight(e.clientX, e.clientY, e.pointerType), { passive: true });

// ---------- il dito sulla seta ----------
const ndc = (x, y) => [(x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1];
const grabTarget = new THREE.Vector3();
const grabPlane = new THREE.Plane();
const ray = new THREE.Raycaster();
let touch = null;

canvas.addEventListener('pointerdown', (e) => {
  aimLight(e.clientX, e.clientY, e.pointerType);
  if (reduceMotion) return;
  const [nx, ny] = ndc(e.clientX, e.clientY);
  const p = silk.pick(nx, ny, camera, coarse ? 70 : 50, [innerWidth, innerHeight]);
  touch = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t: performance.now(), p, grabbing: false };
});

canvas.addEventListener('pointermove', (e) => {
  if (!touch || touch.id !== e.pointerId || touch.p < 0) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  // con il dito: solo i gesti orizzontali tirano la seta (quelli verticali scorrono la pagina)
  const intent = touch.type === 'mouse' ? Math.hypot(dx, dy) > 6 : Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
  if (!touch.grabbing && intent) {
    const c = silk.cloth;
    const q = new THREE.Vector3(c.pos[touch.p * 3], c.pos[touch.p * 3 + 1], c.pos[touch.p * 3 + 2]);
    grabPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), q);
    touch.origin = q.clone();
    grabTarget.copy(q);
    silk.grab(touch.p, grabTarget);
    touch.grabbing = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-grabbing');
  }
  if (touch.grabbing) {
    const [nx, ny] = ndc(e.clientX, e.clientY);
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const hit = ray.ray.intersectPlane(grabPlane, new THREE.Vector3());
    if (hit) {
      // non oltre ~70 cm dal punto preso: la seta si tira, non si strappa
      const d = hit.sub(touch.origin);
      if (d.length() > 0.7) d.setLength(0.7);
      grabTarget.copy(touch.origin).add(d);
    }
  }
});

const endTouch = (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  if (touch.grabbing) silk.release();
  else if (e.type === 'pointerup' && touch.p >= 0 && performance.now() - touch.t < 450) {
    // tocco breve: la seta si solleva in un'onda morbida
    const dir = camera.getWorldDirection(new THREE.Vector3());
    dir.y += 0.25;
    silk.poke(touch.p, dir, 1.7);
  }
  canvas.classList.remove('is-grabbing');
  touch = null;
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// ---------- scroll come cambio pagina: il nome sale nella barra, compare il menu ----------
const nameEl = document.querySelector('.hero-name');
const roleEl = document.querySelector('.hero-role');
const menu = document.querySelector('.menu');
const menuItems = menu.querySelectorAll('li');
const menuCta = menu.querySelectorAll('.menu-cta, .demo-note');
const hint = document.querySelector('.scroll-hint');
const manifesto = document.querySelector('.manifesto');
// le parole della frase si accendono una dopo l'altra mentre si scorre
const mWords = [];
if (!reduceMotion) {
  for (const p of manifesto.querySelectorAll('p')) {
    const text = p.textContent.replace(/\s+/g, ' ').trim().split(' ');
    p.textContent = '';
    text.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      span.style.opacity = '0.16';
      p.appendChild(span);
      if (i < text.length - 1) p.appendChild(document.createTextNode(' '));
      mWords.push(span);
    });
  }
}
const mReveal = { k: 0 };
const paintWords = () => {
  const n = mWords.length;
  mWords.forEach((w, i) => {
    const a = Math.min(1, Math.max(0, mReveal.k * (n + 6) - i) / 6);
    w.style.opacity = (0.16 + 0.84 * a).toFixed(2);
  });
};
const mono = document.querySelector('.mono');
const social = document.querySelector('.social');
const keepL = nameEl.querySelector('.k-l');
const keepS = nameEl.querySelector('.k-s');
const fades = nameEl.querySelectorAll('.fade');
const targetL = mono.querySelector('.m-l');
const targetS = mono.querySelector('.m-s');

// Il nome si trasforma nel monogramma: le altre lettere svaniscono, la L e la S volano al
// centro della barra. Le posizioni si misurano a riposo (e a ogni ridimensionamento).
const geo = {};
const centerOf = (el) => {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, fs: parseFloat(getComputedStyle(el).fontSize) };
};
const measureName = () => {
  const p = intro ? intro.progress() : 0;
  if (intro) intro.progress(0);
  geo.L0 = centerOf(keepL);
  geo.S0 = centerOf(keepS);
  geo.L1 = centerOf(targetL);
  geo.S1 = centerOf(targetS);
  if (intro) {
    intro.invalidate();
    intro.progress(p);
  }
};
let intro = null;
measureName();
const fly = (from, to) => ({
  x: () => geo[to].x - geo[from].x,
  y: () => geo[to].y - geo[from].y,
  scale: () => geo[to].fs / geo[from].fs,
});

gsap.set(menuItems, { opacity: 0, y: 22 });
gsap.set(menuCta, { opacity: 0, y: 16 });
gsap.set(social.children, { opacity: 0, y: -6 });
intro = gsap.timeline({
  defaults: { ease: 'sine.inOut' },
  scrollTrigger: {
    start: 0,
    // tre tempi: il nome diventa LS, la frase sulla chirurgia, il menu
    end: () => innerHeight * 2.2,
    // tutto segue lo scroll (nessuno scatto automatico); solo un filo di morbidezza
    scrub: reduceMotion ? true : 0.6,
    invalidateOnRefresh: true,
    onRefresh: () => measureName(),
    onUpdate: (st) => {
      if (st.progress > 0.03 && !intro._flicked) {
        intro._flicked = true;
        silk.flick(0.5);
      }
      if (st.progress < 0.02) intro._flicked = false;
    },
  },
});
intro
  .to(hint, { opacity: 0, duration: 0.12, ease: 'none' }, 0)
  .to(roleEl, { opacity: 0, y: -14, duration: 0.3, ease: 'sine.out' }, 0)
  // le lettere che non restano svaniscono salendo appena
  .to(fades, { opacity: 0, y: -10, duration: 0.38, ease: 'sine.out', stagger: 0.02 }, 0.02)
  // la L e la S salgono, si avvicinano e diventano il monogramma
  .to(keepL, { ...fly('L0', 'L1'), duration: 0.85 }, 0.08)
  .to(keepS, { ...fly('S0', 'S1'), duration: 0.85 }, 0.11)
  .to(social.children, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'sine.out' }, 0.62)
  // la frase sulla chirurgia: entra, le parole si accendono, poi lascia il posto al menu
  .fromTo(manifesto, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.3, ease: 'sine.out' }, 1.0)
  .to(mReveal, { k: 1, duration: 0.75, ease: 'none', onUpdate: paintWords }, 1.1)
  .to(manifesto, { opacity: 0, y: -26, duration: 0.25, ease: 'sine.in' }, 2.0)
  .to(menuItems, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'sine.out' }, 2.2)
  .to(menuCta, { opacity: 1, y: 0, duration: 0.4, ease: 'sine.out' }, 2.45);

document.fonts?.ready.then(() => ScrollTrigger.refresh());

// ---------- la soglia (telefono e tablet) ----------
// iPhone, iPad (e i browser recenti) danno il giroscopio solo dopo un tocco della persona:
// il tocco sulla soglia lo chiede.
// Poi la L e la S del monogramma vanno a posarsi sulle loro lettere nel nome, il fondo avorio
// si apre sulla seta e il resto del nome compare intorno.
if (document.documentElement.classList.contains('soglia-on')) {
  const soglia = document.querySelector('.soglia');
  const btn = soglia.querySelector('.soglia-btn');
  const monoEl = soglia.querySelector('.soglia-mono');
  const sL = soglia.querySelector('.s-l'), sS = soglia.querySelector('.s-s');
  const heroEl = document.querySelector('.hero');
  const behind = [document.querySelector('main'), document.querySelector('.site-head')];
  behind.forEach((el) => (el.inert = true));
  gsap.set(heroEl, { opacity: 0 });
  gsap.set([keepL, keepS], { visibility: 'hidden' });

  const finish = () => {
    document.documentElement.classList.remove('soglia-on');
    behind.forEach((el) => (el.inert = false));
    soglia.remove();
    ScrollTrigger.refresh();
  };
  const enter = () => {
    // il respiro si ferma dov'è e torna alla misura piena, come una risposta al tocco
    // (le animazioni CSS prevalgono sugli stili in linea: si fermano prima, lasciando ogni cosa dov'è)
    const label = soglia.querySelectorAll('.soglia-rule, .soglia-label');
    for (const el of [monoEl, ...label]) {
      const cs = getComputedStyle(el);
      const from = { transform: cs.transform, opacity: cs.opacity };
      el.style.animation = 'none';
      gsap.set(el, from);
    }
    // ogni lettera va sulla sua nel nome (misurato quando parte, a misura piena)
    const path = new Map();
    const to = (a, b) => () => {
      if (!path.has(a)) {
        const A = centerOf(a), B = centerOf(b);
        path.set(a, { x: B.x - A.x, y: B.y - A.y, scale: B.fs / A.fs });
      }
      return path.get(a);
    };
    const pL = to(sL, keepL), pS = to(sS, keepS);
    gsap
      .timeline({ onComplete: finish })
      .to(monoEl, { scale: 1, opacity: 1, duration: 0.28, ease: 'sine.out' }, 0)
      .to(label, { opacity: 0, y: 8, duration: 0.4, ease: 'sine.in' }, 0)
      .to(sL, { x: () => pL().x, y: () => pL().y, scale: () => pL().scale, duration: 1.35, ease: 'power3.inOut' }, 0.28)
      .to(sS, { x: () => pS().x, y: () => pS().y, scale: () => pS().scale, duration: 1.35, ease: 'power3.inOut' }, 0.32)
      .to(soglia, { backgroundColor: 'rgba(247, 242, 236, 0)', duration: 1.2, ease: 'sine.inOut' }, 0.45)
      .add(() => silk.flick(0.55), 0.5)
      .to(heroEl, { opacity: 1, duration: 0.7, ease: 'sine.out' }, 1.15)
      // passaggio di consegne: le lettere della soglia lasciano il posto a quelle del nome
      .add(() => {
        gsap.set([keepL, keepS], { visibility: 'visible' });
        gsap.set([sL, sS], { opacity: 0 });
      }, 1.92);
  };

  let asked = false;
  btn.addEventListener('click', () => {
    if (asked) return;
    asked = true;
    let ask = null;
    try {
      ask = window.DeviceOrientationEvent?.requestPermission?.();
    } catch {
      ask = null;
    }
    if (!ask || typeof ask.then !== 'function') {
      listenGyro();
      enter();
      return;
    }
    // la soglia resta finché si risponde alla richiesta di iOS (che appare sopra la pagina)
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      enter();
    };
    // se il permesso non c'è, i dati semplicemente non arrivano: ascoltare non costa nulla
    ask
      .catch(() => {})
      .finally(() => {
        listenGyro();
        start();
      });
    setTimeout(start, 9000);
  });
}

// ---------- sezioni: ogni voce è un luogo sulla seta ----------
// Fino al menu la camera la governa l'inquadratura. Scelta una voce, la seta fa un gesto
// che indica la via e la camera vola lungo il tessuto (sale, plana, scende) fino al luogo
// di quella voce; poi il contenuto appare. Tra una voce e l'altra si viaggia sulla seta;
// con le tre linee (o il gesto indietro) si torna all'inquadratura del menu.
const html = document.documentElement;
const backBtn = document.querySelector('.back-btn');
const pages = new Map([...document.querySelectorAll('.page')].map((el) => [el.id, el]));
let current = null;

// luoghi: punto sul fazzoletto (u da sinistra, v dall'alto), direzione e distanza della camera
const STATIONS = {
  'chi-sono': { u: 0.4, v: 0.42, dir: [-0.35, 0.15, 1], dist: 1.4, fov: 30 }, // sotto il drappeggio a cappuccio
  // le quattro aree: luoghi sulla seta (con ?figura=1, la sperimentazione della seta che
  // prende forma di figura: vedi FIG_STATIONS)
  'chirurgia-ricostruttiva': { u: 0.8, v: 0.45, dir: [0.6, 0.05, 1], dist: 1.0, fov: 30 }, // la piega sul lato destro
  'chirurgia-estetica': { u: 0.5, v: 0.55, dir: [0.1, -0.25, 1], dist: 1.1, fov: 30 }, // il centro del telo
  'medicina-estetica': { u: 0.32, v: 0.68, dir: [-0.2, 0.1, 1], dist: 0.3, fov: 30 }, // macro sulla trama
  'medicina-rigenerativa': { u: 0.6, v: 0.96, dir: [0.25, -0.45, 1], dist: 0.95, fov: 30 }, // l'orlo libero
  sedi: { u: 0.5, v: 0.5, dir: [0.3, 0.75, 1], dist: 3.4, fov: 30 }, // il fazzoletto intero, dall'alto
};
// sperimentale (?figura=1): la seta che prende la forma di una figura femminile
const FIGURE_ON = params.has('figura');
const FIG_STATIONS = {
  'chirurgia-ricostruttiva': { fig: [0, -0.2, 0], dir: [-0.5, -0.04, 1], dist: 3.3, fov: 30 },
  'chirurgia-estetica': { fig: [0, -0.2, 0], dir: [0.03, -0.04, 1], dist: 3.3, fov: 30 },
  'medicina-estetica': { fig: [0, 0.1, 0], dir: [0.35, -0.02, 1], dist: 2.3, fov: 30 },
  'medicina-rigenerativa': { fig: [0, -0.2, 0], dir: [-0.85, -0.04, 0.8], dist: 3.2, fov: 30 },
};
if (FIGURE_ON) Object.assign(STATIONS, FIG_STATIONS);
for (const st of Object.values(STATIONS)) {
  st.d = new THREE.Vector3(...st.dir).normalize();
  st.p = null;
}
const trip = { mode: 'menu', to: null, k: 1, A: { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 } };
const B = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 };
const _pt = new THREE.Vector3();
const stationPose = (st, dt, out) => {
  if (st.fig) {
    // luogo sulla figura (ferma): la camera non segue le pieghe, guarda la forma
    const f = silk.figure;
    out.target.set(f.x + st.fig[0], f.y + st.fig[1], f.z + st.fig[2]);
    out.pos.copy(out.target).addScaledVector(st.d, st.dist);
    out.fov = st.fov;
    return;
  }
  const c = silk.cloth;
  const i0 = Math.round(st.u * (c.nx - 1)), j0 = Math.round(st.v * (c.ny - 1));
  _pt.set(0, 0, 0);
  let n = 0;
  for (let j = Math.max(0, j0 - 1); j <= Math.min(c.ny - 1, j0 + 1); j++)
    for (let i = Math.max(0, i0 - 1); i <= Math.min(c.nx - 1, i0 + 1); i++) {
      const k = (j * c.nx + i) * 3;
      _pt.x += c.pos[k];
      _pt.y += c.pos[k + 1];
      _pt.z += c.pos[k + 2];
      n++;
    }
  _pt.multiplyScalar(1 / n);
  // la camera segue il punto con calma (la seta si muove, la camera respira con lei)
  if (!st.p) st.p = _pt.clone();
  // molto calma: la camera non trema con la seta; da calma (dentro le sezioni) quasi ferma
  else st.p.lerp(_pt, 1 - Math.exp(-dt * 0.6 * (1 - 0.8 * silk.calm)));
  out.target.copy(st.p);
  out.pos.copy(st.p).addScaledVector(st.d, st.dist);
  out.fov = st.fov;
};
const flyTo = (dest) => {
  // dest: id di una voce, oppure null = ritorno all'inquadratura del menu
  trip.A.pos.copy(camPos);
  trip.A.target.copy(camTarget);
  trip.A.fov = camera.fov;
  trip.to = dest;
  trip.mode = 'flying';
  hold = true;
  if (dest && STATIONS[dest]) STATIONS[dest].p = null;
  trip.k = 0;
  gsap.to(trip, {
    k: 1,
    duration: reduceMotion ? 0.01 : 2.3,
    ease: 'sine.inOut',
    overwrite: true,
    onComplete: () => {
      if (dest === null) {
        trip.mode = 'menu';
        hold = false;
      } else trip.mode = 'station';
    },
  });
};
// posa della camera durante il volo o ferma in un luogo (chiamata nel ciclo)
const flyPose = (dt) => {
  if (trip.mode === 'menu') return false;
  if (trip.to) stationPose(STATIONS[trip.to], dt, B);
  else {
    B.pos.copy(frame.pos);
    B.target.copy(frame.target);
    B.fov = camera.fov; // quella dell'inquadratura del menu
  }
  const e = trip.k;
  const arc = Math.sin(Math.PI * e);
  camPos.lerpVectors(trip.A.pos, B.pos, e);
  camPos.y += 0.35 * arc; // sale, plana, scende
  camPos.z += 0.45 * arc;
  camTarget.lerpVectors(trip.A.target, B.target, e);
  camera.fov = trip.A.fov + (B.fov - trip.A.fov) * e;
  camera.updateProjectionMatrix();
  return true;
};

// la seta che diventa figura (e torna fazzoletto): è sempre seta, cambia solo forma
const setFigure = (on) => {
  const d = reduceMotion ? 0.01 : on ? 2.8 : 2.4;
  gsap.to(silk.figure, { amount: on ? 1 : 0, duration: d, delay: on ? 0.3 : 0, ease: 'sine.inOut', overwrite: true });
  gsap.to(silk, { figBlend: on ? 1 : 0, duration: d, delay: on ? 0.3 : 0, ease: 'sine.inOut', overwrite: 'auto' });
  // un vento leggero da davanti preme la seta sulla forma (il panneggio delle statue classiche)
  gsap.to(silk.wind.push, { x: 0, z: on ? -0.4 : 0, duration: d, ease: 'sine.inOut', overwrite: true });
  if (!on) silk.untangle = Math.max(silk.untangle, 0.8);
};

const openSection = (id, { push = true } = {}) => {
  const el = pages.get(id);
  if (!el || current === id) return;
  const prev = current ? pages.get(current) : null;
  current = id;
  if (push) history.pushState({ s: id }, '', '#' + id);
  html.classList.add('in-section');
  menu.inert = true;
  backBtn.hidden = false;
  el.hidden = false;
  el.scrollTop = 0;
  const sc = el.querySelector('.chi-scroll');
  if (sc) sc.scrollTop = 0;
  if (id === 'chi-sono') requestAnimationFrame(() => {
    measureChi();
    measureChiScroll();
  });
  // la seta indica la via (un gesto e un soffio verso il luogo), la camera ci vola;
  // nelle quattro aree la seta prende la forma di una figura femminile
  const st = STATIONS[id];
  const figure = Boolean(st.fig);
  setFigure(figure);
  if (!reduceMotion && !figure) {
    silk.flick(0.6);
    const side = Math.sign((st.u ?? 0.5) - 0.5) || 1;
    gsap.timeline({ overwrite: true })
      .to(silk.wind.push, { x: 1.0 * side, z: 0.5, duration: 0.6, ease: 'sine.out' })
      .to(silk.wind.push, { x: 0, z: 0, duration: 1.4, ease: 'sine.inOut' });
  }
  flyTo(id);
  gsap.to(silk, { calm: 1, duration: 3, delay: 1.2, ease: 'sine.inOut', overwrite: 'auto' });
  gsap.to(silk.uniforms.uVeil, { value: 0, duration: 1, overwrite: true });
  gsap.to(menu, { opacity: 0, y: -16, duration: 0.6, ease: 'sine.in', overwrite: true });
  if (prev) gsap.to(prev, { opacity: 0, y: -20, duration: 0.6, ease: 'sine.in', overwrite: true, onComplete: () => (prev.hidden = true) });
  // il contenuto appare quando si arriva
  gsap.fromTo(el, { opacity: 0, y: 30, xPercent: 0 }, { opacity: 1, y: 0, duration: 1.0, delay: reduceMotion ? 0 : 1.5, ease: 'power3.out', overwrite: true });
};

const closeSection = () => {
  if (!current) return;
  const el = pages.get(current);
  current = null;
  html.classList.remove('in-section');
  menu.inert = false;
  backBtn.hidden = true;
  const wasFigure = silk.figBlend > 0.01;
  setFigure(false);
  if (!reduceMotion && !wasFigure) silk.flick(0.5);
  gsap.to(silk, { calm: 0, duration: 2.5, ease: 'sine.inOut', overwrite: 'auto' });
  flyTo(null);
  gsap.to(el, { opacity: 0, y: 20, duration: 0.6, ease: 'sine.in', overwrite: true, onComplete: () => (el.hidden = true) });
  gsap.fromTo(menu, { y: 16 }, { y: 0, opacity: 1, duration: 1.0, delay: reduceMotion ? 0 : 1.6, ease: 'power3.out', overwrite: true });
};

document.querySelectorAll('[data-section]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openSection(a.dataset.section);
  }),
);
backBtn.addEventListener('click', () => (history.state?.s ? history.back() : closeSection()));
addEventListener('popstate', (e) => (e.state?.s ? openSection(e.state.s, { push: false }) : closeSection()));

mono.addEventListener('click', (e) => {
  e.preventDefault();
  if (current) history.state?.s ? history.back() : closeSection();
  else scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

// ---------- Chi sono: la foto grande scivola piccola in alto a destra, il nome accanto ----------
// Niente placca: foto e nome restano liberi sulla seta; il testo che scorre sfuma prima
// di arrivare alla loro riga (maschera sul contenitore che scorre).
const chiPage = pages.get('chi-sono');
const chi = chiPage.querySelector('.chi-scroll');
const chiHead = chiPage.querySelector('.chi-head');
const chiPhoto = chiPage.querySelector('.chi-photo');
const chiName = chiPage.querySelector('.chi-name span');
const chiGeo = {};
const measureChi = () => {
  gsap.set([chiPhoto, chiName], { clearProps: 'transform' });
  const h = chiHead.getBoundingClientRect();
  const ph = chiPhoto.getBoundingClientRect();
  const nm = chiName.getBoundingClientRect();
  const padR = parseFloat(getComputedStyle(chiHead).paddingRight);
  // stato piccolo: sulla riga di "CHI SONO", la foto in alto a destra e il nome alla sua sinistra
  const small = 46, rowY = 30;
  const sPhoto = small / ph.width;
  const sName = 17 / parseFloat(getComputedStyle(chiName.parentElement).fontSize);
  const photoCx = h.right - padR - small / 2;
  chiGeo.photo = { dx: photoCx - (ph.left + ph.width / 2), dy: h.top + rowY - (ph.top + ph.height / 2), s: sPhoto };
  chiGeo.name = {
    dx: photoCx - small / 2 - 12 - (nm.width * sName) / 2 - (nm.left + nm.width / 2),
    dy: h.top + rowY - (nm.top + nm.height / 2),
    s: sName,
  };
  // il testo comincia dopo il nome grande
  const space = nm.bottom - h.top + 34;
  chi.style.setProperty('--chi-space', `${Math.max(0, space)}px`);
  // il nome sale almeno veloce quanto il testo: niente sovrapposizioni durante il passaggio
  chiGeo.range = Math.max(120, Math.abs(chiGeo.name.dy) * 0.92);
  updateChi();
};
const updateChi = () => {
  if (!chiGeo.photo) return;
  const k = Math.min(1, Math.max(0, chi.scrollTop / chiGeo.range));
  const e = 1 - (1 - k) * (1 - k); // parte deciso, si posa piano
  const { photo, name } = chiGeo;
  gsap.set(chiPhoto, { x: photo.dx * e, y: photo.dy * e, scale: 1 + (photo.s - 1) * e });
  gsap.set(chiName, { x: name.dx * e, y: name.dy * e, scale: 1 + (name.s - 1) * e });
};
chi.addEventListener('scroll', () => {
  updateChi();
  updateChiScroll();
  // la seta respira con lo scroll: la velocità diventa un soffio di vento
  const now = performance.now();
  const v = Math.abs(chi.scrollTop - breath.lastTop) / Math.max(8, now - breath.lastT); // px/ms
  // (nessun soffio: dentro Chi sono la seta resta calma)
  breath.lastTop = chi.scrollTop;
  breath.lastT = now;
}, { passive: true });

// ---------- Chi sono: una storia a capitoli, ognuno con il suo effetto ----------
const breath = { target: 0, lastTop: 0, lastT: 0 };
const story = createChiStory(chi, chiHead, reduceMotion);
const measureChiScroll = () => {
  if (!chiPage.hidden) story.measure();
};
const updateChiScroll = () => story.update();
addEventListener('resize', () => !chiPage.hidden && measureChiScroll());
document.fonts?.ready.then(() => !chiPage.hidden && measureChiScroll());
addEventListener('resize', () => !chiPage.hidden && measureChi());

// link diretto a una sezione (#chi-sono…): si parte dal menu e si entra
const startHash = location.hash.slice(1);
if (pages.has(startHash)) {
  history.replaceState({}, '', location.pathname + location.search);
  scrollTo(0, innerHeight * 2.3);
  setTimeout(() => openSection(startHash), 400);
}

// ---------- misura (solo con ?debug) ----------
const fpsEl = document.getElementById('fps');
const debug = params.has('debug');
fpsEl.hidden = !debug;
let frames = 0, acc = 0, simAcc = 0;
// se per 2 secondi si sta sotto i 45 fps, la mesh della seta passa a metà dei segmenti
const perf = { t: 0, n: 0, reduced: false };

// ---------- ciclo ----------
const clock = new THREE.Clock();
const L = new THREE.Vector3();
const AX_Y = new THREE.Vector3(0, 1, 0), AX_X = new THREE.Vector3(1, 0, 0);
const studioM = new THREE.Matrix4(), studioRY = new THREE.Matrix4();
const loop = () => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  silk.update(reduceMotion ? dt * 0.35 : dt);
  page.p = Math.min(1, intro.time() / 1.0); // la seta va in alto già quando si forma LS
  // cosa è visibile lo decide il tempo reale dell'animazione (che segue lo scroll con morbidezza)
  {
    const t = intro.time();
    const vis = (el, on) => {
      const v = on ? 'visible' : 'hidden';
      if (el.style.visibility !== v) el.style.visibility = v;
    };
    vis(menu, t > 2.12);
    vis(manifesto, t > 0.95 && t < 2.35);
    vis(mono, t > 0.9);
    vis(social, t > 0.55);
  }
  breath.target *= Math.exp(-dt * 1.6);
  silk.wind.breath += (breath.target - silk.wind.breath) * (1 - Math.exp(-dt * 2.5));
  page.shown += (page.p - page.shown) * (1 - Math.exp(-dt * 6));
  screenFrame(dt);
  computeFrame();

  gyroStep(dt);
  const kL = 1 - Math.exp(-dt * 2.5);
  light.yaw += (light.tYaw - light.yaw) * kL;
  light.pitch += (light.tPitch - light.pitch) * kL;
  L.copy(baseLight).applyAxisAngle(AX_Y, -light.yaw).applyAxisAngle(AX_X, -light.pitch);
  silk.uniforms.uLightDir.value.copy(L);
  // lo studio riflesso ruota come la luce
  studioM.makeRotationX(light.pitch).multiply(studioRY.makeRotationY(light.yaw));
  silk.uniforms.uStudio.value.setFromMatrix4(studioM);

  // camera smorzata con un piccolissimo respiro
  const drift = reduceMotion ? 0 : 1;
  // la morbidezza la dà già il controllo dell'inquadratura: qui nessun secondo ritardo;
  // durante un volo (o fermi in un luogo della seta) comanda il volo
  if (!flyPose(dt)) {
    camPos.copy(frame.pos);
    camTarget.copy(frame.target);
  }
  camera.position.set(
    camPos.x + Math.sin(time * 0.21) * 0.03 * drift,
    camPos.y + Math.sin(time * 0.17 + 1.3) * 0.02 * drift,
    camPos.z,
  );
  camera.lookAt(camTarget);

  renderer.render(scene, camera);

  if (!perf.reduced && dt > 0) {
    perf.t += dt;
    perf.n++;
    if (perf.t >= 2) {
      if (perf.n / perf.t < 45 && clock.elapsedTime > 4) {
        silk.setSegments(silk.segments[0] / 2, silk.segments[1] / 2);
        perf.reduced = true;
      }
      perf.t = perf.n = 0;
    }
  }

  if (debug) {
    frames++;
    acc += dt;
    simAcc += silk.simMs;
    if (acc > 0.5) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps · sim ${(simAcc / frames).toFixed(1)} ms · ${silk.nx}×${silk.ny} · mesh ${silk.segments.join('×')}`;
      frames = acc = simAcc = 0;
    }
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

window.__velata = { silk, camera, renderer, cam, page, gsap, trip, light, gyro };
