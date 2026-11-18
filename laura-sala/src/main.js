// Velata — la seta come accompagnamento: viva nella brezza, la luce segue il dito o il
// mouse; con il dito la si tira (trascinamento orizzontale) o la si sfiora (tocco).
// Allo scroll il nome sale e si posa al centro della barra; compare la frase.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Silk, SILK_COLORS } from './silk/silk.js';
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
const silk = new Silk({ quality });
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
const DIST = 6.1;
const viewSize = () => {
  const aspect = innerWidth / innerHeight;
  // telefono: la seta riempie la larghezza; desktop: una fascia ampia al centro
  const visH = aspect < 0.85 ? 0.8 / aspect : 1.75;
  return { visH, visW: visH * aspect, portrait: aspect < 0.85 };
};
const hemTarget = () => {
  const { portrait } = viewSize();
  const menuT = portrait ? 0.6 - 0.29 * page.shown : 0.56 - 0.29 * page.shown;
  return menuT + (0.11 - menuT) * sect.v;
};
const _v = new THREE.Vector3();
const hemYs = [];
const screenFrame = (dt) => {
  if (hold) return;
  const c = silk.cloth;
  const { visH, visW } = viewSize();
  // orlo (ultime righe) e punto più basso tra quelli in vista
  hemYs.length = 0;
  let lowest = 2, sx = 0, sn = 0;
  for (let j = 0; j < c.ny; j += 2)
    for (let i = 0; i < c.nx; i += 2) {
      const k = (j * c.nx + i) * 3;
      _v.set(c.pos[k], c.pos[k + 1], c.pos[k + 2]).project(camera);
      sx += _v.x;
      sn++;
      const inView = _v.x > -1 && _v.x < 1;
      if (!inView) continue;
      if (j >= c.ny - 3) hemYs.push(_v.y);
      if (_v.y < lowest) lowest = _v.y;
    }
  // orizzontale: il centro della seta verso il centro dello schermo
  const cx = sx / sn;
  cam.x += cx * (visW / 2) * Math.min(1, dt * (guiding ? 1.8 : 0.5));
  // verticale: l'orlo "tipico" (un quarto dei punti più in basso può scendere di più)
  const yT = 1 - 2 * hemTarget();
  if (hemYs.length) {
    hemYs.sort((a, b) => a - b);
    const hem = hemYs[Math.floor(hemYs.length * 0.25)];
    cam.y += (hem - yT) * (visH / 2) * Math.min(1, dt * 2.4);
  }
  // sicurezza: niente seta sul testo (una piega può scendere al massimo di un 3,5% in più)
  const yLimit = yT - 0.07;
  if (lowest < yLimit) cam.y += (lowest - yLimit) * (visH / 2) * Math.min(1, dt * 8);
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

// ---------- luce: segue il dito / il mouse (±30°), sempre smorzata ----------
const baseLight = new THREE.Vector3(-0.55, 0.38, 0.75).normalize();
const MAX = THREE.MathUtils.degToRad(30);
const light = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
const aimLight = (x, y) => {
  light.tYaw = (x / innerWidth - 0.5) * 2 * MAX;
  light.tPitch = (y / innerHeight - 0.5) * 2 * MAX;
};
addEventListener('pointermove', (e) => aimLight(e.clientX, e.clientY), { passive: true });

// ---------- il dito sulla seta ----------
const ndc = (x, y) => [(x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1];
const grabTarget = new THREE.Vector3();
const grabPlane = new THREE.Plane();
const ray = new THREE.Raycaster();
let touch = null;

canvas.addEventListener('pointerdown', (e) => {
  aimLight(e.clientX, e.clientY);
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
    end: () => innerHeight * 0.95,
    // tutto segue lo scroll (nessuno scatto automatico); solo un filo di morbidezza
    scrub: reduceMotion ? true : 0.6,
    invalidateOnRefresh: true,
    onRefresh: () => measureName(),
    onUpdate: (st) => {
      menu.style.visibility = st.progress > 0.02 ? 'visible' : 'hidden';
      mono.style.visibility = st.progress > 0.9 ? 'visible' : 'hidden';
      social.style.visibility = st.progress > 0.55 ? 'visible' : 'hidden';
      if (st.progress > 0.1 && !intro._flicked) {
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
  .to(menuItems, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'sine.out' }, 0.42)
  .to(menuCta, { opacity: 1, y: 0, duration: 0.4, ease: 'sine.out' }, 0.6)
  .to(social.children, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'sine.out' }, 0.62);

document.fonts?.ready.then(() => ScrollTrigger.refresh());

// ---------- sezioni: la seta guida verso destra ----------
// Si sceglie una voce: un colpo di vento porta la seta a destra, la camera la segue con
// un attimo di ritardo, il menu scivola via e la sezione entra da destra. Indietro (anche
// con il gesto del browser) la seta riporta tutto a sinistra.
const html = document.documentElement;
const backBtn = document.querySelector('.back-btn');
const pages = new Map([...document.querySelectorAll('.page')].map((el) => [el.id, el]));
const GUIDE = 1.35; // metri percorsi dalla seta a ogni passaggio
let current = null;

const guide = (toX) => {
  if (reduceMotion) return;
  const dir = Math.sign(toX - silk.panX) || 1;
  guiding = true;
  gsap.delayedCall(1.2, () => (silk.untangle = Math.max(silk.untangle, 0.8)));
  gsap.to(silk, { panX: toX, duration: 1.7, ease: 'sine.inOut', overwrite: true, onComplete: () => gsap.delayedCall(1.6, () => (guiding = false)) });
  gsap.timeline({ overwrite: true })
    .to(silk.wind.push, { x: 1.9 * dir, z: 0.4, duration: 0.7, ease: 'sine.out' })
    .to(silk.wind.push, { x: 0, z: 0, duration: 1.4, ease: 'sine.inOut' });
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
  if (id === 'chi-sono') requestAnimationFrame(() => measureChi());
  // Chi sono: la seta fa una capriola attorno al titolo, poi si ritira.
  // Le altre sezioni: la seta guida verso destra e si ritira.
  const scenic = id === 'chi-sono' && !reduceMotion;
  const retreat = scenic ? 2.7 : 0.5;
  if (scenic) {
    hold = true;
    silk.capriola(3.0);
    gsap.timeline({ overwrite: true })
      .to(silk.wind.push, { z: 1.1, x: 0.5, duration: 1.0, ease: 'sine.out' })
      .to(silk.wind.push, { z: 0, x: 0, duration: 1.6, ease: 'sine.inOut' });
    gsap.delayedCall(2.8, () => (hold = false));
  } else {
    guide(silk.panX + GUIDE);
  }
  // poi la seta si ritira: il contenuto è il protagonista
  gsap.to(sect, { v: 1, duration: 2.2, delay: retreat, ease: 'sine.inOut', overwrite: true });
  gsap.to(silk.uniforms.uVeil, { value: 0.55, duration: 2.2, delay: retreat + 0.3, ease: 'sine.inOut', overwrite: true });
  if (reduceMotion) {
    gsap.set(menu, { opacity: 0 });
    if (prev) prev.hidden = true;
    gsap.fromTo(el, { opacity: 0, xPercent: 0 }, { opacity: 1, duration: 0.5 });
    return;
  }
  gsap.to(menu, { x: -70, opacity: 0, duration: 0.8, ease: 'sine.in', overwrite: true });
  if (prev) gsap.to(prev, { xPercent: -40, opacity: 0, duration: 0.9, ease: 'sine.in', overwrite: true, onComplete: () => (prev.hidden = true) });
  gsap.fromTo(el, { xPercent: 100, opacity: 1 }, { xPercent: 0, duration: scenic ? 1.8 : 1.5, delay: scenic ? 0.5 : 0.3, ease: 'power3.out', overwrite: true });
};

const closeSection = () => {
  if (!current) return;
  const el = pages.get(current);
  current = null;
  html.classList.remove('in-section');
  menu.inert = false;
  backBtn.hidden = true;
  hold = false;
  silk.move = null;
  guide(0);
  gsap.to(sect, { v: 0, duration: 1.6, ease: 'sine.inOut', overwrite: true });
  gsap.to(silk.uniforms.uVeil, { value: 0, duration: 1.4, ease: 'sine.inOut', overwrite: true });
  if (reduceMotion) {
    el.hidden = true;
    gsap.to(menu, { opacity: 1, duration: 0.5 });
    return;
  }
  gsap.to(el, { xPercent: 100, duration: 1.1, ease: 'power2.in', overwrite: true, onComplete: () => (el.hidden = true) });
  gsap.fromTo(menu, { x: 70 }, { x: 0, opacity: 1, duration: 1.3, delay: 0.45, ease: 'power3.out', overwrite: true });
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

// ---------- Chi sono: la foto grande si mette piccola accanto al nome, scorrendo ----------
const chi = pages.get('chi-sono');
const chiHead = chi.querySelector('.chi-head');
const chiPhoto = chi.querySelector('.chi-photo');
const chiName = chi.querySelector('.chi-name span');
const chiGeo = {};
const measureChi = () => {
  gsap.set([chiPhoto, chiName], { clearProps: 'transform' });
  const h = chiHead.getBoundingClientRect();
  const ph = chiPhoto.getBoundingClientRect();
  const nm = chiName.getBoundingClientRect();
  const padL = parseFloat(getComputedStyle(chiHead).paddingLeft);
  // stato piccolo: foto da 58 px a sinistra, nome a destra, nella fascia sotto "CHI SONO"
  const small = 58, rowY = 46 + 43;
  const sPhoto = small / ph.width;
  const sName = 23 / parseFloat(getComputedStyle(chiName.parentElement).fontSize);
  chiGeo.photo = { dx: h.left + padL + small / 2 - (ph.left + ph.width / 2), dy: h.top + rowY - (ph.top + ph.height / 2), s: sPhoto };
  chiGeo.name = {
    dx: h.left + padL + small + 14 + (nm.width * sName) / 2 - (nm.left + nm.width / 2),
    dy: h.top + rowY - (nm.top + nm.height / 2),
    s: sName,
  };
  // spazio sotto l'intestazione: il testo comincia dopo il nome grande
  const space = nm.bottom - h.top + 34 - h.height;
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
  chiHead.style.setProperty('--fade', e.toFixed(3));
};
chi.addEventListener('scroll', updateChi, { passive: true });
addEventListener('resize', () => !chi.hidden && measureChi());

// link diretto a una sezione (#chi-sono…): si parte dal menu e si entra
const startHash = location.hash.slice(1);
if (pages.has(startHash)) {
  history.replaceState({}, '', location.pathname + location.search);
  scrollTo(0, innerHeight);
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
  page.p = intro.progress();
  page.shown += (page.p - page.shown) * (1 - Math.exp(-dt * 6));
  screenFrame(dt);
  computeFrame();

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
  // la morbidezza la dà già il controllo dell'inquadratura: qui nessun secondo ritardo
  camPos.copy(frame.pos);
  camTarget.copy(frame.target);
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

window.__velata = { silk, camera, renderer, cam, page, gsap };
