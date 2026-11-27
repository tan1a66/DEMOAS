// Enekén — demo. Carga → logo de madera → caída en la piscina → el pit desde el dron.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createRenderer, G, QUALITY, MOBILE } from './gl/core.js';
import { loadTextures, makeGobo, makeSpotGobo } from './gl/textures.js';
import { buildRoom } from './gl/sculpture.js';
import { buildCourtyard, POOL_R } from './gl/courtyard.js';
import { buildPlants } from './gl/plants.js';
import { buildWater } from './gl/water.js';
import { createDirector } from './gl/director.js';
import { LOGO_STROKES, LOGO_VIEWBOX } from './logo-data.js';
import { applyI18n, setLang } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
// ?capture: reloj manual a fotogramas fijos (para grabar el vídeo de revisión sin tirones)
const CAPTURE = params.has('capture');
let capT = 0;
const clock = () => (CAPTURE ? capT : performance.now());

// ---------------------------------------------------------------- logo SVG (cargador y marca)
function drawLogo(svg, { clipBase = false } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', LOGO_VIEWBOX.join(' '));
  if (clipBase) {
    const defs = document.createElementNS(NS, 'defs');
    const cp = document.createElementNS(NS, 'clipPath');
    cp.id = 'base-clip';
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', '0'); r.setAttribute('y', '0'); r.setAttribute('height', String(LOGO_VIEWBOX[3]));
    r.setAttribute('width', '0');
    r.id = 'base-clip-rect';
    cp.appendChild(r); defs.appendChild(cp); svg.appendChild(defs);
  }
  for (const s of LOGO_STROKES) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', s.d);
    p.dataset.stroke = s.id;
    if (clipBase && s.id === 'base') p.setAttribute('clip-path', 'url(#base-clip)');
    svg.appendChild(p);
  }
}
drawLogo($('#loader-logo'), { clipBase: true });
drawLogo($('#mark-logo'));
applyI18n();
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

// tamaño del logo en el cargador: pequeño, proporcional a la pantalla
const canvas = $('#gl');
const logoPx = () => Math.round(Math.min(96, Math.max(64, canvas.clientHeight * 0.095)));
document.documentElement.style.setProperty('--logo-h', logoPx() + 'px');

// la línea de base se dibuja de izquierda a derecha con la carga real
const baseRect = $('#base-clip-rect');
const loaderEl = $('#loader');
const baseStroke = LOGO_STROKES.find((s) => s.id === 'base');
const baseXs = baseStroke.d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
const baseX0 = Math.min(...baseXs) - 4, baseX1 = Math.max(...baseXs) + 4;
const shown = { v: 0 };
const setBase = (v) => {
  baseRect.setAttribute('width', String(baseX0 + (baseX1 - baseX0) * v));
  loaderEl.setAttribute('aria-valuenow', String(Math.round(v * 100)));
};
setBase(0);
let realProgress = 0;
const t0 = clock();
const MIN_LOAD = 2.2; // s: la línea siempre se dibuja con calma
let loaderDone = false;
function stepLoader() {
  if (loaderDone) return;
  const time = (clock() - t0) / 1000;
  const target = Math.min(realProgress, time / MIN_LOAD);
  shown.v += (target - shown.v) * 0.075;
  if (target >= 1 && shown.v > 0.995) shown.v = 1;
  setBase(shown.v);
  if (shown.v >= 1) { loaderDone = true; onLoaded(); }
}
function pumpLoader() { stepLoader(); if (!loaderDone) requestAnimationFrame(pumpLoader); }
if (!CAPTURE) requestAnimationFrame(pumpLoader);

// ---------------------------------------------------------------- three
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = null;
renderer.setClearColor(0x120d0a, 1);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
let lastW = canvas.clientWidth;
window.addEventListener('resize', () => {
  // en iOS la barra de Safari cambia la altura: el lienzo usa 100lvh, sólo reajustamos si cambia el ancho
  if (MOBILE && canvas.clientWidth === lastW) return;
  lastW = canvas.clientWidth;
  resize();
});

const manager = new THREE.LoadingManager();
let texLoaded = 0, texTotal = 6;
manager.onProgress = (_u, l, t) => { texLoaded = l; texTotal = t; realProgress = Math.max(realProgress, 0.7 * (l / t)); };
const tex = loadTextures(manager, renderer);
G.uPlasterNor.value = tex.plasterNor;
G.uPlasterDiff.value = tex.plasterDiff;
G.uPebbleNor.value = tex.pebbleNor;
G.uPebbleDiff.value = tex.pebbleDiff;
G.uWoodNor.value = tex.woodNor;
G.uGoboTex.value = makeGobo(G.uGoboRect.value);
G.uSpotGoboTex.value = makeSpotGobo();

// luz del día (sol alto de Mérida, desde el sureste)
const sun = new THREE.DirectionalLight(0xfff0dc, 0);
sun.position.copy(G.uSunDir.value).multiplyScalar(30);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -11, near: 5, far: 60 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 2.5;
sun.layers.enableAll(); // también ilumina el vaso (capa submarina): cáusticas
scene.add(sun, sun.target);

const room = buildRoom(scene, tex);
const courtyard = buildCourtyard(scene);
buildPlants(courtyard.group);
let water = null, director = null;

// ---------------------------------------------------------------- UI según el progreso
const capIntro = $('#cap-intro'), capPlace = $('#cap-place'), capTouch = $('#cap-touch'), hint = $('#hint');
let introDone = false;
function ui(p) {
  capIntro.classList.toggle('on', introDone && p < 0.03);
  hint.classList.toggle('on', introDone && p < 0.02);
  capPlace.classList.toggle('on', p > 0.6 && p < 0.86);
  capTouch.classList.toggle('on', p > 0.9);
}

// ---------------------------------------------------------------- carga completa
const ready = (async () => {
  await new Promise((res) => { manager.onLoad = res; if (texLoaded >= texTotal && texTotal > 0) res(); });
  realProgress = Math.max(realProgress, 0.72);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex.sky).texture;
  scene.environmentIntensity = 0.08;
  pmrem.dispose();
  water = buildWater(renderer, courtyard.group, tex.sky);
  director = createDirector({ camera, room, water, courtyard, sun, scene, renderer, ui });
  director.setFlatPx(logoPx());
  realProgress = 0.82;
  try { await document.fonts.ready; } catch (e) { /* sin fuentes */ }
  // compilar todos los shaders con la cámara del pit y de la sala (evita tirones luego)
  room.group.visible = true; courtyard.group.visible = true;
  camera.position.set(0, 12, 2); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  water.renderRefraction(scene, camera);
  realProgress = 0.95;
  director.frameIntro(0);
  renderer.render(scene, camera);
  realProgress = 1;
})();

let loadedResolved;
const loaded = new Promise((r) => (loadedResolved = r));
function onLoaded() { loadedResolved(); }

// ---------------------------------------------------------------- scroll
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.8, smoothWheel: true, syncTouch: false });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
const target = { p: 0 };
ScrollTrigger.create({
  trigger: '#seq', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => { target.p = self.progress; },
});
hint.addEventListener('click', () => lenis.scrollTo('bottom', { duration: 16, easing: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x) }));

// ---------------------------------------------------------------- intro
let introTl = null;
function playIntro() {
  const I = director.intro;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-intro');
  director.startIntro();
  const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' }, paused: CAPTURE });
  introTl = tl;
  tl.to('.wordmark', { opacity: 0, duration: 0.9, ease: 'sine.out' }, 0)
    .to(loaderEl, { opacity: 0, duration: 1.0, ease: 'sine.inOut' }, 0.45)
    .set(loaderEl, { display: 'none' }, 1.5)
    .to(I, { k: 1, duration: 6.6, ease: 'power2.inOut' }, 0.6)
    .to(I, { thick: 1, duration: 2.6, ease: 'sine.inOut' }, 1.6)
    .to(I, { ink: 0, duration: 1.8, ease: 'sine.inOut' }, 1.7)
    .to(I, { fill: 0.55, duration: 1.4 }, 1.4)
    .to(I, { spot: 120, duration: 3.2, ease: 'sine.inOut' }, 1.5)
    .to(I, { paper: 0, duration: 3.0, ease: 'sine.inOut' }, 2.0)
    .to(I, { rake: 1, duration: 4.2, ease: 'sine.inOut' }, 2.2)
    .to(I, { fill: 0.1, duration: 3.0 }, 3.2)
    .to(I, { inkAlb: 0, duration: 2.6, ease: 'sine.inOut' }, 3.1)
    .to(I, { carve: 1, duration: 2.8, ease: 'sine.inOut' }, 3.3)
    .to(I, { dust: 1, duration: 3.5, ease: 'sine.out' }, 4.2)
    .call(() => {
      introDone = true;
      director.endIntro();
      document.body.classList.remove('is-intro');
      document.body.classList.add('ui-on');
      lenis.start();
      ui(0);
    }, null, 6.6);
  if (params.has('fast')) tl.timeScale(6);
}

Promise.all([ready, loaded]).then(() => {
  if (params.has('p')) {
    // saltar a un punto de la secuencia (para revisión): ?p=0.5
    Object.assign(director.intro, { k: 1, thick: 1, ink: 0, inkAlb: 0, paper: 0, rake: 1, dust: 1, carve: 1, spot: 120, fill: 0.1 });
    loaderEl.style.display = 'none';
    document.body.classList.remove('is-loading');
    document.body.classList.add('ui-on');
    introDone = true;
    lenis.start();
    const p = parseFloat(params.get('p')) || 0;
    smooth.p = target.p = p;
    const max = document.documentElement.scrollHeight - innerHeight;
    lenis.scrollTo(max * p, { immediate: true });
  } else {
    playIntro();
  }
  if (!CAPTURE) gsap.ticker.add(tick);
  ticking = true;
});

// ---------------------------------------------------------------- interacción con el agua
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -G.uWaterY.value);
const hit = new THREE.Vector3();
let lastDrop = 0;
function touchWater(e, strength) {
  if (!director || !director.state.hub || !water) return false;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(waterPlane, hit)) return false;
  if (Math.hypot(hit.x, hit.z) > POOL_R - 0.02) return false;
  water.drop(hit.x, hit.z, 0.07, strength);
  return true;
}
canvas.addEventListener('pointerdown', (e) => { touchWater(e, -0.55); });
window.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - lastDrop < 45) return;
  if (e.pointerType === 'mouse' || e.buttons) { if (touchWater(e, -0.12)) lastDrop = now; }
});

// ---------------------------------------------------------------- bucle
const smooth = { p: 0 };
let time = 0, last = clock(), frames = 0, acc = 0, dprScale = 1, ticking = false;
function tick() {
  const now = clock();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  G.uTime.value = time;

  if (director.introRunning || !introDone) {
    director.frameIntro(time);
  } else {
    // peso: el progreso sigue al scroll con inercia, como una cámara pesada
    smooth.p += (target.p - smooth.p) * (1 - Math.exp(-dt * 2.6));
    if (Math.abs(target.p - smooth.p) < 1e-5) smooth.p = target.p;
    director.frameScroll(smooth.p, time, dt);
  }
  const p = introDone ? smooth.p : 0;
  const poolVisible = p > 0.1;
  water.update(dt, poolVisible);
  if (poolVisible) water.renderRefraction(scene, camera);
  renderer.render(scene, camera);

  // calidad adaptativa: si el móvil no llega, bajamos la resolución
  frames++; acc += dt;
  if (acc > 1.5 && !CAPTURE) {
    const fps = frames / acc;
    if (fps < 48 && dprScale > 0.62) { dprScale -= 0.12; renderer.setPixelRatio(QUALITY.dpr * dprScale); resize(); }
    frames = 0; acc = 0;
    if (DEBUG) console.log('fps', fps.toFixed(1), 'dpr', (QUALITY.dpr * dprScale).toFixed(2), 'calls', renderer.info.render.calls);
  }
}
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((t) => lenis.raf(t * 1000));

if (DEBUG || CAPTURE) Object.assign(window, { THREE, renderer, scene, camera, G, room, courtyard, smooth, target, lenis });
if (CAPTURE) {
  gsap.ticker.sleep();
  window.__cap = {
    get ready() { return realProgress >= 1; },
    get intro() { return introDone; },
    step(ms) {
      capT += ms;
      stepLoader();
      if (introTl && introTl.progress() < 1) introTl.time(introTl.time() + ms / 1000);
      if (ticking) tick(); else renderer.render(scene, camera);
    },
    setP(p) { target.p = p; },
    drop(x, z, s = -0.55) { water && water.drop(x, z, 0.07, s); },
  };
}
