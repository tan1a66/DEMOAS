import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { World } from './scene/world.js';
import { uniforms } from './scene/materials.js';
import { Recorrido } from './recorrido.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const coarse = matchMedia('(pointer: coarse)').matches;
const phoneQuery = matchMedia('(max-width: 899px)');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const $ = (s) => document.querySelector(s);
const loader = $('#loader');
const bar = $('#loader-bar');
const mark = $('#loader-mark');
const veil = $('#veil');
const dots = [...document.querySelectorAll('.dots button')];

const progress = (p) => { bar.style.width = `${Math.round(p * 100)}%`; };
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function staticFallback() {
  html.classList.add('no-webgl');
  html.classList.remove('loading', 'intro', 'cine');
  loader.remove();
}

// ---- menú del teléfono ----
const menuBtn = $('#menu-btn');
function setMenu(open) {
  html.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  $('#menu').setAttribute('aria-hidden', String(!open));
}
menuBtn.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// ---- separadores: en el teléfono el texto va fijo y el scroll solo mueve la cámara ----
function layoutSpacers(cine) {
  for (const el of document.querySelectorAll('#recorrido > .travel, #recorrido > .stop[data-m]')) {
    const len = parseFloat((cine ? el.dataset.m : el.dataset.len) || '');
    if (el.classList.contains('stop') && !cine) { el.style.height = ''; continue; }
    if (!len) continue;
    el.style.height = `${len * 100}vh`;
    el.style.height = `${len * 100}svh`;
  }
}

// Textos que en el teléfono aparecen sincronizados con la cámara: [elemento, desde T, hasta T]
const captions = [
  [$('#paseo .hero'), -1, 0.9],
  [$('#paseo .card'), 1.03, 1.6],
  ...[1, 2, 3, 4, 5].map((i) => [document.querySelector(`.stop[data-stop="${i}"] .card`), 2 * i - 0.3, 2 * i + 1.12]),
];

// La Ō de Jost con letter-spacing se dibuja como O + macrón suelto (el macrón queda corrido a la
// derecha). Con tracking 0 en la letra sale bien; el espacio que le tocaba va como margen.
function fixMacron() {
  for (const o of document.querySelectorAll('.o')) {
    const ls = getComputedStyle(o.parentElement).letterSpacing;
    o.style.letterSpacing = '0';
    if (ls && ls !== 'normal') o.style.marginRight = ls;
  }
}

async function boot() {
  fixMacron();
  if (!hasWebGL() || params.has('nowebgl')) return staticFallback();
  let cine = phoneQuery.matches;
  html.classList.toggle('cine', cine);
  for (const [el] of captions) el.classList.toggle('cap', cine);
  layoutSpacers(cine);

  progress(0.12);
  await Promise.race([
    Promise.all([document.fonts.load('400 40px Jost', "CASA T'HŌ"), document.fonts.load('500 40px "Cormorant Garamond"')]),
    wait(1500),
  ]).catch(() => {});
  progress(0.35);
  await frame();

  let world;
  try {
    world = new World($('#gl'), { mobile: coarse || cine });
  } catch (e) {
    console.error(e);
    return staticFallback();
  }
  progress(0.7);
  await frame();

  const items = [...document.querySelectorAll('#recorrido > .stop, #recorrido > .travel')];
  let rec;
  function makeRecorrido() {
    rec = new Recorrido(cine ? 'cine' : 'desk');
    rec.reduced = reduced;
    rec.bind(items);
  }
  makeRecorrido();
  if (reduced) uniforms.uWind.value = 0.25;

  // ---- tamaño y encuadre (lente descentrada: la casa arriba, el texto abajo) ----
  const canvas = $('#gl');
  let lastW = 0, lastH = 0;
  let baseShift = { x: 0, y: 0 }, heroShift = { x: 0, y: 0 };
  let Ts;
  const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function shiftAt(T) {
    const w = 1 - smoothstep(0.5, 1.45, T);
    return { x: baseShift.x + (heroShift.x - baseShift.x) * w, y: baseShift.y + (heroShift.y - baseShift.y) * w };
  }
  function resize(force = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const nowCine = phoneQuery.matches;
    if (nowCine !== cine) {
      cine = nowCine;
      html.classList.toggle('cine', cine);
      for (const [el] of captions) el.classList.toggle('cap', cine);
      layoutSpacers(cine);
      makeRecorrido();
      force = true;
    }
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    const aspect = w / h;
    baseShift = aspect < 0.8 ? { x: 0, y: 0.3 } : aspect < 1.25 ? { x: 0.08, y: 0.18 } : { x: 0.24, y: 0.06 };
    heroShift = aspect < 0.8 ? { x: 0, y: -0.27 } : aspect < 1.25 ? { x: 0.04, y: -0.14 } : { x: 0.12, y: -0.16 };
    if (params.has('og')) baseShift = heroShift = { x: 0.08, y: -0.08 };
    world.resize(w, h, shiftAt(Ts ?? 0));
    rec.measure();
  }
  resize(true);
  window.addEventListener('resize', () => resize());
  ScrollTrigger.addEventListener('refresh', () => rec.measure());
  new ResizeObserver(() => rec.measure()).observe($('#recorrido'));
  ScrollTrigger.create({ trigger: '#recorrido', start: 'top top', end: 'bottom bottom' });

  // ---- cámara ----
  const cam = world.camera;
  const pos = new THREE.Vector3(), dir = new THREE.Vector3(), look = new THREE.Vector3();
  const smoothDir = new THREE.Vector3(0, 0, -1);
  // Intro: la cámara empieza de frente al letrero, con la lente cerrada y el nombre del loader
  // exactamente encima; se acerca (zoom sobre la fachada) y luego se aleja hasta el jardín.
  // k: 0 = de frente al letrero → 1 = posición inicial del recorrido; zoom: acercamiento previo.
  const intro = { k: reduced || CAPTURE ? 1 : 0, zoom: 0, open: 0, gate: 0 };
  const introC0 = new THREE.Vector3(), introC1 = new THREE.Vector3(), introC = new THREE.Vector3(), introCtrl = new THREE.Vector3();
  const FRONT = new THREE.Vector3(0, 0, -1);
  let introFov = 0;
  Ts = rec.timelineFromScroll(window.scrollY, innerHeight);
  world.setShift(shiftAt(Ts));
  let lastStop = -1;

  function place(T, snap, dt = 0.016) {
    rec.pose(T, pos, dir);
    const inIntro = intro.k < 1 && introFov > 0;
    if (inIntro) {
      introC.lerpVectors(introC0, introC1, intro.zoom);
      const k = intro.k, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(a * introC.x + b * introCtrl.x + c * pos.x, a * introC.y + b * introCtrl.y + c * pos.y, a * introC.z + b * introCtrl.z + c * pos.z);
      const kd = k * k * (3 - 2 * k);
      dir.lerpVectors(FRONT, dir, kd).normalize();
      world.setFov(introFov + (world.baseFov - introFov) * kd);
    }
    if (snap || CAPTURE || inIntro) smoothDir.copy(dir);
    else smoothDir.lerp(dir, 1 - Math.exp(-dt * 14)).normalize();
    cam.position.copy(pos);
    look.copy(pos).add(smoothDir);
    cam.lookAt(look);
  }

  // ---- textos sincronizados (teléfono) ----
  let shownCap = null;
  function syncCaptions(T) {
    if (!cine) return;
    let active = null;
    const introOn = html.classList.contains('intro');
    for (const [el, a, b] of captions) {
      const on = !introOn && T >= a && T < b;
      if (on) active = el;
      if (el.classList.contains('show') !== on) el.classList.toggle('show', on);
    }
    shownCap = active;
  }

  // primer cuadro y compilación de shaders antes de quitar el loader
  place(Ts, true);
  world.update(0, rec.state(Ts));
  world.curtain.group.visible = !(reduced || CAPTURE);
  if (world.renderer.compileAsync) await world.renderer.compileAsync(world.scene, cam);
  else world.renderer.compile(world.scene, cam);
  world.render();
  progress(1);
  await frame();

  // ---- navegación ----
  let activeStop = -1;
  function setActive(i) {
    if (i === activeStop) return;
    activeStop = i;
    dots.forEach((d, k) => {
      d.classList.toggle('on', k === i);
      d.setAttribute('aria-current', k === i ? 'step' : 'false');
    });
    const d = dots[i];
    if (d && !html.classList.contains('intro')) {
      dots.forEach((x) => x.classList.remove('flash'));
      d.classList.add('flash');
      clearTimeout(setActive.t);
      setActive.t = setTimeout(() => d.classList.remove('flash'), 1600);
    }
  }

  let jumping = false;
  async function goTo(i) {
    setMenu(false);
    const y = rec.scrollForStop(i, innerHeight);
    const cur = rec.stopIndex(Ts);
    if (reduced || Math.abs(i - cur) > 1) {
      jumping = true;
      veil.classList.add('on');
      await wait(330);
      window.scrollTo(0, y);
      Ts = rec.timelineFromScroll(y, innerHeight);
      place(Ts, true);
      await frame();
      veil.classList.remove('on');
      jumping = false;
    } else {
      gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 1.4, ease: 'power2.inOut' });
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    goTo(+a.dataset.go);
  });

  // escritorio: las tarjetas entran al llegar a su parada
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) en.target.classList.add('in');
  }, { threshold: 0.2 });
  document.querySelectorAll('.card').forEach((c) => io.observe(c));

  // ---- bucle ----
  let last = performance.now(), time = 0;
  let acc = 0, frames = 0, dprCheck = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    time += dt;
    const target = rec.timelineFromScroll(window.scrollY, innerHeight);
    if (CAPTURE) Ts = window.__T ?? target;
    else if (reduced || jumping) Ts = target;
    else Ts += (target - Ts) * (1 - Math.exp(-dt * 8.5));
    const stop = rec.stopIndex(Ts);
    if (reduced && lastStop >= 0 && stop !== lastStop) {
      veil.classList.add('on');
      setTimeout(() => veil.classList.remove('on'), 260);
    }
    lastStop = stop;
    world.setShift(shiftAt(Ts));
    place(Ts, false, dt);
    if (world.curtain.group.visible) world.curtain.update(time, intro.open);
    world.gateOverride = intro.k < 1 ? intro.gate : 1;
    world.update(time, rec.state(Ts));
    world.render();
    syncCaptions(Ts);
    setActive(stop);

    // calidad adaptativa: si el teléfono sufre, baja la resolución
    acc += dt; frames++; dprCheck += dt;
    if (dprCheck > 2.5) {
      const avg = acc / frames;
      if (avg > 0.024 && world.dpr > 1.2) world.setDpr(Math.max(1, world.dpr - 0.35));
      acc = 0; frames = 0; dprCheck = 0;
    }
  }
  requestAnimationFrame(tick);

  if (params.has('og')) {
    html.classList.add('og');
    const o = document.createElement('div');
    o.className = 'og-card';
    o.innerHTML = '<p>Recorrido</p><span>Paseo de Montejo 498 · Mérida</span>';
    document.body.append(o);
  }
  if (CAPTURE) {
    window.__world = world;
    window.__rec = rec;
    window.__intro = intro;
    window.__ready = true;
    staticIntroEnd();
    return;
  }
  if (reduced) {
    staticIntroEnd();
    return;
  }
  runIntro();

  function staticIntroEnd() {
    world.M.letrero.opacity = 1;
    intro.gate = 1;
    html.classList.remove('loading', 'intro');
    loader.remove();
    world.curtain.dispose();
    world.disposeCurtainPass();
  }

  // ---- intro: hojas de palma que se abren + zoom sobre la fachada ----
  function runIntro() {
    html.classList.add('intro');
    html.classList.remove('loading');
    world.M.letrero.opacity = 0;

    // Dónde poner la cámara para que el letrero 3D quede exactamente bajo el nombre del loader:
    // de frente (sin inclinación), a distancia d, con la lente cerrada lo justo.
    const sign = world.house.sign;
    const tw = 4.7 * (world.M.letrero.map.userData.textFraction || 0.6);
    const yc = sign.position.y - 0.053;
    const W = innerWidth, Hc = canvas.clientHeight;
    const r = mark.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(mark).fontSize);
    const markW = r.width - 0.18 * fs;
    const mx = ((r.left + markW / 2) / W) * 2 - 1;
    const my = 1 - ((r.top + r.height / 2) / Hc) * 2;
    const d0 = cine ? 12.2 : 13.0;
    const P00 = (2 * markW * d0) / (tw * W);
    const aspect = W / Hc;
    introFov = THREE.MathUtils.radToDeg(2 * Math.atan(1 / (P00 * aspect)));
    const P11 = P00 * aspect;
    const sh = world.shift;
    introC0.set(sign.position.x - ((mx - sh.x) * d0) / P00, yc - ((my - sh.y) * d0) / P11, sign.position.z + d0);
    introC1.copy(introC0).addScaledVector(FRONT, d0 * 0.3);
    // curva de regreso: baja hacia el jardín pasando por delante
    rec.pose(0, pos, dir);
    introCtrl.set((introC1.x + pos.x) / 2, pos.y + (introC1.y - pos.y) * 0.35, Math.max(introC1.z, pos.z) + 1.2);

    world.curtain.group.position.copy(introC0);
    world.curtain.group.quaternion.identity();
    world.curtain.group.visible = true;
    place(Ts, true);

    // el nombre sigue al letrero mientras la cámara se acerca (de frente, solo escala)
    const toScreen = (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(cam);
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * Hc };
    };
    const follow = () => {
      cam.updateMatrixWorld();
      const a = toScreen(-tw / 2 + sign.position.x, yc, sign.position.z), b = toScreen(tw / 2 + sign.position.x, yc, sign.position.z);
      gsap.set(mark, {
        x: (a.x + b.x) / 2 - (r.left + markW / 2),
        y: (a.y + b.y) / 2 - (r.top + r.height / 2),
        scale: (b.x - a.x) / markW,
      });
    };

    const tl = gsap.timeline({
      onComplete: () => {
        loader.remove();
        world.curtain.dispose();
        world.disposeCurtainPass();
        introFov = 0;
        world.setFov(null);
      },
    });
    tl.add(() => loader.classList.add('clear'), 0.1);
    tl.to(intro, { open: 1, duration: 2.1, ease: 'power1.inOut' }, 0.3);
    tl.to(intro, { zoom: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: () => { place(Ts, true); follow(); } }, 0);
    // cambio invisible: el nombre y el letrero coinciden píxel por píxel, sin fundido
    tl.add(() => { world.M.letrero.opacity = 1; gsap.set(mark, { opacity: 0 }); }, 2.2);
    tl.to(intro, { k: 1, duration: 3.2, ease: 'power2.inOut' }, 2.2);
    tl.to(intro, { gate: 1, duration: 1.6, ease: 'power2.inOut' }, 2.3);
    tl.add(() => html.classList.remove('intro'), 4.4);

    if (params.has('introtest')) { tl.pause(); window.__introTL = tl; window.__ready = true; return; }
    const skip = () => { if (tl.isActive()) tl.timeScale(4); };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, skip, { once: true, passive: true }));
  }
}

boot();
