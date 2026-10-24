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
import { Recorrido, STOPS } from './recorrido.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
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
  html.classList.remove('loading', 'intro');
  loader.remove();
}

// travesías: alto según la distancia recorrida
for (const t of document.querySelectorAll('.travel')) {
  const len = parseFloat(t.dataset.len || '1.2');
  t.style.height = `${len * 100}vh`;
  t.style.height = `${len * 100}svh`;
}

async function boot() {
  if (!hasWebGL() || params.has('nowebgl')) return staticFallback();
  progress(0.12);
  await Promise.race([
    Promise.all([document.fonts.load('400 40px Jost'), document.fonts.load('500 40px "Cormorant Garamond"')]),
    wait(1500),
  ]).catch(() => {});
  progress(0.35);
  await frame();

  let world;
  try {
    world = new World($('#gl'), { mobile });
  } catch (e) {
    console.error(e);
    return staticFallback();
  }
  progress(0.7);
  await frame();

  const rec = new Recorrido();
  rec.reduced = reduced;
  if (reduced) uniforms.uWind.value = 0.25;
  const items = [...document.querySelectorAll('#recorrido > .stop, #recorrido > .travel')];
  rec.bind(items);

  // ---- tamaño y encuadre (lente descentrada: la casa arriba, las tarjetas abajo) ----
  const canvas = $('#gl');
  let lastW = 0, lastH = 0;
  function resize(force = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    const aspect = w / h;
    let shift = aspect < 0.8 ? { x: 0, y: 0.3 } : aspect < 1.25 ? { x: 0.08, y: 0.18 } : { x: 0.24, y: 0.06 };
    if (params.has('og')) shift = { x: 0, y: -0.02 };
    world.resize(w, h, shift);
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
  const introFrom = new THREE.Vector3(0, 0.3, 4.2);
  const intro = { k: reduced || CAPTURE ? 1 : 0 };
  let Ts = rec.timelineFromScroll(window.scrollY, innerHeight);
  let lastG = -1;

  function place(G, k, snap, dt = 0.016) {
    rec.pose(G, pos, dir);
    if (k < 1) pos.addScaledVector(introFrom, 1 - k);
    if (snap || CAPTURE) smoothDir.copy(dir);
    else smoothDir.lerp(dir, 1 - Math.exp(-dt * 14)).normalize();
    cam.position.copy(pos);
    look.copy(pos).add(smoothDir);
    cam.lookAt(look);
  }

  // primer cuadro y compilación de shaders antes de quitar el loader
  place(rec.G(Ts), intro.k, true);
  world.update(0, rec.state(Ts));
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
    const y = rec.scrollForStop(i, innerHeight);
    const cur = rec.stopIndex(Ts);
    if (reduced || Math.abs(i - cur) > 1) {
      jumping = true;
      veil.classList.add('on');
      await wait(330);
      window.scrollTo(0, y);
      Ts = rec.timelineFromScroll(y, innerHeight);
      place(rec.G(Ts), 1, true);
      await frame();
      veil.classList.remove('on');
      jumping = false;
    } else {
      gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 1.5, ease: 'power2.inOut' });
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    goTo(+a.dataset.go);
  });

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
    else Ts += (target - Ts) * (1 - Math.exp(-dt * 5.2));
    const G = rec.G(Ts);
    if (reduced && lastG >= 0 && Math.round(G) !== Math.round(lastG)) {
      veil.classList.add('on');
      setTimeout(() => veil.classList.remove('on'), 260);
    }
    lastG = G;
    place(G, intro.k, false, dt);
    world.update(time, rec.state(Ts));
    world.render();
    setActive(rec.stopIndex(Ts));

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
    html.classList.remove('loading', 'intro');
    loader.remove();
  }

  // ---- intro: hojas que se abren + logo que se posa en la fachada ----
  function runIntro() {
    html.classList.add('intro');
    html.classList.remove('loading');
    const { curtain, curtainLeaves } = world.plants;
    curtain.visible = true;
    world.M.letrero.opacity = 0;

    // dónde queda el letrero 3D al final del movimiento
    const end = new THREE.Vector3(), endDir = new THREE.Vector3();
    rec.pose(rec.G(Ts), end, endDir);
    const probe = cam.clone();
    probe.position.copy(end);
    probe.lookAt(end.clone().add(endDir));
    probe.updateMatrixWorld();
    probe.projectionMatrix.copy(cam.projectionMatrix);
    const sign = world.house.sign;
    const tw = 4.7 * (world.M.letrero.map.userData.textFraction || 0.6);
    const toScreen = (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(probe);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    };
    const yc = sign.position.y - 0.053;
    const a = toScreen(-tw / 2, yc, sign.position.z), b = toScreen(tw / 2, yc, sign.position.z);
    const r = mark.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(mark).fontSize);
    const markW = r.width - 0.18 * fs;
    const scale = (b.x - a.x) / markW;
    const dx = (a.x + b.x) / 2 - (r.left + markW / 2);
    const dy = (a.y + b.y) / 2 - (r.top + r.height / 2);

    const tl = gsap.timeline({
      onComplete: () => {
        curtain.visible = false;
        loader.remove();
      },
    });
    tl.add(() => loader.classList.add('clear'), 0.15);
    tl.to(intro, { k: 1, duration: 3.4, ease: 'power2.inOut' }, 0);
    curtainLeaves.forEach((leaf, i) => {
      const side = leaf.userData.side;
      tl.to(leaf.position, {
        x: leaf.userData.base.x + side * (3.6 + (i % 4) * 0.5),
        y: leaf.userData.base.y + 0.9 + (i % 3) * 0.4,
        duration: 2.4, ease: 'power2.inOut',
      }, 0.25 + (i % 6) * 0.05);
      tl.to(leaf.rotation, { z: leaf.rotation.z + side * 0.9, duration: 2.4, ease: 'power2.inOut' }, 0.25);
    });
    tl.to(mark, { x: dx, y: dy, scale, duration: 3.3, ease: 'power2.inOut' }, 0.1);
    tl.to(world.M.letrero, { opacity: 1, duration: 0.5, ease: 'none' }, 3.25);
    tl.to(mark, { opacity: 0, duration: 0.5, ease: 'none' }, 3.3);
    tl.add(() => html.classList.remove('intro'), 2.7);

    if (params.has('introtest')) { tl.pause(); window.__introTL = tl; window.__ready = true; return; }
    const skip = () => { if (tl.isActive()) tl.timeScale(4); };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, skip, { once: true, passive: true }));
  }
}

boot();
