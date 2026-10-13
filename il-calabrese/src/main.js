import * as THREE from 'three';
import gsap from 'gsap';
import { createGlobe } from './scene/globe.js';
import { createTable } from './scene/table.js';
import { renderMenu, renderReservar, renderUbicacion } from './ui/pages.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
const quality = mobile ? 0.5 : 1;
// ?lite: mesa sin vidrio con transmisión ni sombras grandes (grabación de video con render por software).
const tableQuality = params.has('lite') ? 0.5 : quality;

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(params.has('pr') ? +params.get('pr') : Math.min(devicePixelRatio, mobile ? 1.6 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const bar = $('#bar-fill');
const step = $('#loader-step');
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const progress = async (pct, text) => {
  bar.style.width = pct + '%';
  step.textContent = text;
  await tick();
};

let globe, table;
// ?t=12 congela la intro en ese segundo (útil para revisar tomas).
const frozen = params.has('t');
let mode = 'loading'; // loading | intro | table
const clock = new THREE.Clock();

// ---------- Etiquetas de los platos ----------
const labelsEl = $('#labels');
const labelEls = [];
function buildLabels() {
  labelsEl.innerHTML = '';
  table.plates.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'plate-label';
    b.innerHTML = `<b>${p.title}</b><span>${p.sub}</span>`;
    b.addEventListener('click', () => openPage(p.id));
    b.addEventListener('pointerenter', () => table.setHovered(i));
    b.addEventListener('pointerleave', () => table.setHovered(-1));
    labelsEl.appendChild(b);
    labelEls.push(b);
  });
}

// ---------- Páginas ----------
const pages = {};
function setupPages() {
  pages.menu = { el: $('#page-menu'), ...renderMenu($('#page-menu')) };
  pages.reservar = { el: $('#page-reservar'), ...renderReservar($('#page-reservar')) };
  pages.ubicacion = { el: $('#page-ubicacion'), ...renderUbicacion($('#page-ubicacion')) };
  for (const [id, p] of Object.entries(pages)) {
    p.el.querySelector('[data-close]').addEventListener('click', () => closePage(id));
    p.el.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => {
        closePage(id, true);
        setTimeout(() => openPage(b.dataset.goto), 150);
      })
    );
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) closePage(current);
  });
}

let current = null;
let busy = false;
function openPage(id) {
  if (mode !== 'table' || busy || current === id) return;
  if (current) {
    closePage(current, true);
  }
  const i = table.plates.findIndex((p) => p.id === id);
  const v = table.focusView(i);
  busy = true;
  table.setFocus(i);
  table.setHovered(-1);
  document.body.classList.add('focused');
  gsap.killTweensOf([table.view.pos, table.view.target]);
  const tl = gsap.timeline({
    onComplete: () => {
      busy = false;
    },
  });
  tl.to(table.view.pos, { x: v.pos.x, y: v.pos.y, z: v.pos.z, duration: 1.1, ease: 'power3.inOut' }, 0)
    .to(table.view.target, { x: v.target.x, y: v.target.y, z: v.target.z, duration: 1.1, ease: 'power3.inOut' }, 0)
    .add(() => {
      current = id;
      const p = pages[id];
      p.el.classList.add('open');
      p.el.setAttribute('aria-hidden', 'false');
      p.onOpen?.();
      document.body.classList.add('page-open');
    }, 0.8);
}
function closePage(id, instant = false) {
  const p = pages[id];
  p.el.classList.remove('open');
  p.el.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('page-open');
  current = null;
  if (instant) return;
  document.body.classList.remove('focused');
  gsap.to(table.view.pos, { ...xyz(table.HOME.pos), duration: 1.2, ease: 'power3.inOut', delay: 0.15 });
  gsap.to(table.view.target, { ...xyz(table.HOME.target), duration: 1.2, ease: 'power3.inOut', delay: 0.15, onComplete: () => table.setFocus(null) });
}
const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });

// ---------- Intro ----------
const story = { el: $('#story'), k: $('#story-kicker'), t: $('#story-title'), s: $('#story-sub') };
let storyIdx = -1;
function showStory(i) {
  storyIdx = i;
  const s = globe.story[i];
  story.el.classList.remove('show');
  setTimeout(() => {
    story.k.textContent = s.kicker;
    story.t.textContent = s.title;
    story.s.textContent = s.sub;
    story.el.classList.add('show');
    story.el.dataset.i = i;
  }, 350);
}

function startIntro() {
  mode = 'intro';
  current && closePage(current, true);
  document.body.classList.remove('focused', 'at-table');
  document.body.classList.add('in-intro');
  globe.state.t = frozen ? +params.get('t') : 0;
  storyIdx = -1;
  story.el.classList.remove('show');
  resize();
}

function endIntro() {
  if (mode !== 'intro') return;
  mode = 'fading';
  const fade = $('#fade');
  fade.classList.add('on');
  story.el.classList.remove('show');
  setTimeout(() => {
    mode = 'table';
    document.body.classList.remove('in-intro');
    document.body.classList.add('at-table');
    resize();
    // Entrada a la mesa: desde arriba, bajando como si nos sentáramos.
    table.view.pos.set(0, 3.2, 0.4);
    table.view.target.copy(table.HOME.target);
    gsap.to(table.view.pos, { ...xyz(table.HOME.pos), duration: 2.6, ease: 'power3.out' });
    fade.classList.remove('on');
    const hint = $('#table-hint');
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 5200);
  }, 900);
}

// ---------- Bucle ----------
const hud = { fill: $('#flight-fill'), plane: $('#flight-plane'), km: $('#flight-km') };
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (mode === 'intro' || mode === 'fading') {
    if (mode === 'intro' && !frozen) globe.state.t += dt;
    const gt = globe.state.t;
    globe.update(dt, t);
    for (let i = globe.story.length - 1; i >= 0; i--) {
      if (gt >= globe.story[i].at) {
        if (storyIdx !== i) showStory(i);
        break;
      }
    }
    const u = globe.flightU(gt);
    hud.fill.style.transform = `scaleX(${u})`;
    hud.plane.style.left = `${u * 100}%`;
    hud.km.textContent = `${Math.round(u * globe.routeKm).toLocaleString('es-MX')} km`;
    if (gt >= globe.T.end) endIntro();
    if (!window.__skipRender) renderer.render(globe.scene, globe.camera);
  } else if (mode === 'table' && !(current && !busy)) {
    // Con una página abierta la mesa queda tapada: no se renderiza (ahorra batería en móvil).
    table.update(dt, t);
    if (!window.__skipRender) renderer.render(table.scene, table.camera);
    const w = innerWidth;
    const h = innerHeight;
    const lp = table.labelPositions(w, h);
    // Si los platos quedan juntos en pantalla, las etiquetas se encogen para no pisarse.
    const gap = Math.min(...lp.slice(1).map((l, i) => Math.hypot(l.x - lp[i].x, (l.y - lp[i].y) * 2.2)));
    const fit = Math.min(1, gap / 175);
    lp.forEach((l, i) => {
      const el = labelEls[i];
      el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, 0) scale(${(1 + l.hover * 0.06) * fit})`;
      el.style.transformOrigin = '50% 0';
      el.classList.toggle('hover', l.hover > 0.5);
    });
  }
  requestAnimationFrame(frame);
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  if (globe) {
    globe.camera.aspect = w / h;
    globe.camera.fov = w / h < 0.8 ? 68 : 50;
    globe.camera.updateProjectionMatrix();
  }
  if (table) {
    table.layout(w / h);
    if (mode === 'table' && !current && !busy) table.view.pos.copy(table.HOME.pos), table.view.target.copy(table.HOME.target);
  }
}
addEventListener('resize', resize);

// ---------- Entrada (puntero) ----------
canvas.addEventListener('pointermove', (e) => {
  if (!table) return;
  table.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (mode === 'table' && table.focus === null) {
    const i = table.pick();
    table.setHovered(i);
    canvas.style.cursor = i >= 0 ? 'pointer' : '';
  }
});
canvas.addEventListener('pointerleave', () => table && table.setHovered(-1));
canvas.addEventListener('click', (e) => {
  if (mode !== 'table' || table.focus !== null) return;
  table.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const i = table.pick();
  if (i >= 0) openPage(table.plates[i].id);
});
$('#skip').addEventListener('click', () => endIntro());
$('#replay').addEventListener('click', () => startIntro());
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openPage(b.dataset.open)));
$('#logo').addEventListener('click', (e) => {
  e.preventDefault();
  if (current) closePage(current);
});

// ---------- Carga ----------
(async function boot() {
  await progress(8, 'Amasando la masa…');
  await document.fonts?.ready;
  await progress(20, 'Dibujando las costas de Italia y Yucatán…');
  globe = createGlobe({ quality });
  await progress(55, 'Poniendo el mantel…');
  table = createTable(renderer, { quality: tableQuality });
  buildLabels();
  setupPages();
  await progress(75, 'Encendiendo el horno de leña…');
  resize();
  globe.update(0, 0);
  renderer.compile(globe.scene, globe.camera);
  renderer.compile(table.scene, table.camera);
  await progress(100, 'Pronto. ¡A tavola!');
  clock.start();
  requestAnimationFrame(frame);
  const enter = $('#enter');
  enter.classList.add('ready');
  const go = () => {
    $('#loader').classList.add('done');
    if (params.has('mesa') || location.hash === '#mesa') {
      mode = 'intro';
      endIntro();
    } else startIntro();
  };
  enter.addEventListener('click', go, { once: true });
  if (params.has('debug')) gsap.ticker.lagSmoothing(0);
  if (params.has('debug')) window.__demo = { globe, table, openPage, closePage, endIntro };
  if (params.has('auto') || params.has('mesa') || location.hash === '#mesa') go();
})();
