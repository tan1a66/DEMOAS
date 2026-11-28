// Enekén — demo. Carga (la línea de base del logo) → el castillo sobre las nubes → tres plazas: Nosotros, Visión, Contacto.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createRenderer, G, QUALITY, MOBILE } from './gl/core.js';
import { loadTextures, makeGobo } from './gl/textures.js';
import { buildSky } from './gl/sky.js';
import { buildCourtyard, POOL_R } from './gl/courtyard.js';
import { buildPlants } from './gl/plants.js';
import { buildPlants3D } from './gl/plants3d.js';
import { buildWorld } from './gl/world.js';
import { buildWater } from './gl/water.js';
import { createDirector, STOPS } from './gl/director.js';
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
// foto de Miguel Tapia (baja resolución: se muestra pequeña, a su tamaño)
$('#miguel').src = new URL('./assets/fotos/miguel_tapia.jpg', import.meta.url).href;
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
renderer.shadowMap.autoUpdate = false; // las sombras se recalculan sólo cuando algo se mueve
const scene = new THREE.Scene();
scene.background = null;
renderer.setClearColor(0x120d0a, 1);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 600);

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

// luz del día (sol alto de Mérida, desde el sureste)
const sun = new THREE.DirectionalLight(0xfff0dc, 0);
sun.position.copy(G.uSunDir.value).multiplyScalar(45).add(new THREE.Vector3(9, 0, -3));
sun.target.position.set(9, 0, -3);   // centro del castillo
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 5, far: 110 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 2.5;
sun.layers.enableAll(); // también ilumina el vaso (capa submarina): cáusticas
scene.add(sun, sun.target);
const bounce = new THREE.HemisphereLight(0xdfe7f2, 0xc98a62, 0.9); // cielo + rebote del chukum
scene.add(bounce);

const sky = buildSky(scene);
const courtyard = buildCourtyard(scene);
const world = buildWorld(scene, renderer);
courtyard.hotspots.contacto = world.hotContacto;   // la puerta del arco de ODA lleva a la tercera plaza
scene.fog = new THREE.Fog(0xc6d8e8, 45, 190);
buildPlants(courtyard.group);
let water = null, director = null;

// ---------------------------------------------------------------- UI según el progreso
const panels = [...document.querySelectorAll('[data-panel]')];
const navLinks = [...document.querySelectorAll('[data-stop]')];
let introDone = false;
function ui(p) {
  // la parada más cercana; su panel se ve sólo cuando la cámara está quieta en ella
  let cur = 0;
  STOPS.forEach((s, i) => { if (Math.abs(p - s) < Math.abs(p - STOPS[cur])) cur = i; });
  const near = Math.abs(p - STOPS[cur]) < 0.09;
  panels.forEach((el, i) => el.classList.toggle('on', introDone && near && i === cur));
  navLinks.forEach((a, i) => a.setAttribute('aria-current', String(i === cur)));
  curStop = cur;
}

// ---------------------------------------------------------------- carga completa
const ready = (async () => {
  await new Promise((res) => { manager.onLoad = res; if (texLoaded >= texTotal && texTotal > 0) res(); });
  realProgress = Math.max(realProgress, 0.72);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex.sky).texture;
  scene.environmentIntensity = 0.08;
  pmrem.dispose();
  await buildPlants3D(courtyard.group, manager);
  water = buildWater(renderer, courtyard.group, tex.sky);
  director = createDirector({ camera, water, courtyard, world, sun, scene, renderer, ui, sky });
  realProgress = 0.82;
  try { await document.fonts.ready; } catch (e) { /* sin fuentes */ }
  // compilar todos los shaders con la cámara del pit y de la sala (evita tirones luego)
  courtyard.group.visible = true; sky.visible = true; world.reflector.visible = true;
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
// navegación: cada enlace lleva a su parada con un movimiento lento de cámara
const goTo = (i) => {
  const max = document.documentElement.scrollHeight - innerHeight;
  lenis.scrollTo(max * STOPS[i], { duration: 3.2, easing: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x) });
};
navLinks.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); if (introDone) goTo(i); }));
// segnaposto sulle porte: tocando una porta la cámara va a su parada
const pins = [...document.querySelectorAll('[data-pin]')];
pins.forEach((b, i) => b.addEventListener('click', () => { if (introDone) goTo(i); }));
const pinV = new THREE.Vector3();
let curStop = 0;
function updatePins() {
  const H = courtyard.hotspots;
  const pts = [H.nosotros, H.vision, H.contacto];
  const w = canvas.clientWidth, h = canvas.clientHeight;
  // fascia libera per i segnaposto: sotto il testo (in alto) o sopra il testo (in basso)
  const panel = document.querySelector('.panel.on');
  const pr = panel ? panel.getBoundingClientRect() : null;
  const below = !pr || !panel.classList.contains('bottom');
  const minY = below ? (pr ? pr.bottom + 30 : h * 0.18) : h * 0.2;
  const maxY = below ? h * 0.86 : pr.top - 26;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const used = { l: [], r: [] };   // i segnaposto sullo stesso bordo si impilano, non si sovrappongono
  pts.forEach((pt, i) => {
    const el = pins[i];
    const vis = introDone && i !== curStop;
    el.classList.toggle('on', vis);
    if (!vis) return;
    // en el espacio de la cámara: si la puerta está fuera del encuadre, el segnaposto se queda en el borde con una flecha
    pinV.copy(pt).applyMatrix4(camera.matrixWorldInverse);
    const inFront = pinV.z < -0.2;
    const sx = inFront ? pinV.x / (-pinV.z * halfH * camera.aspect) : Math.sign(pinV.x || 1) * 9;
    const sy = inFront ? pinV.y / (-pinV.z * halfH) : 0;
    let x = (sx + 1) / 2 * w, y = (1 - sy) / 2 * h;
    const edge = !inFront || Math.abs(sx) > 0.9 || sy < -0.9 || sy > 0.9;
    if (edge) {
      const right = sx > 0;
      x = right ? w - 12 - el.offsetWidth + 11 : 18;   // a la derecha el segnaposto termina en el borde
      y = Math.min(h * 0.82, Math.max(h * 0.62, y));
      el.dataset.edge = right ? 'r' : 'l';
      y = Math.min(maxY, Math.max(minY, y));
      const side = used[right ? 'r' : 'l'];
      while (side.some((yy) => Math.abs(yy - y) < 46)) y += below ? 52 : -52;
      side.push(y);
    } else delete el.dataset.edge;
    if (!edge) y = Math.min(maxY, Math.max(minY, y));
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });
}
$('#mark').addEventListener('click', (e) => { e.preventDefault(); if (introDone) goTo(0); });

// ---------------------------------------------------------------- intro
let introTl = null;
function playIntro() {
  const I = director.intro;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-intro');
  director.startIntro();
  const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' }, paused: CAPTURE });
  introTl = tl;
  // el logo de tinta se desvanece, el papel se abre en un círculo sobre la casa y el dron baja
  tl.to('.loader-mark', { opacity: 0, duration: 0.9, ease: 'sine.out' }, 0)
    .set(loaderEl, { opacity: 0 }, 0.9)        // el lienzo ya muestra el mismo papel: el cambio no se ve
    .set(loaderEl, { display: 'none' }, 1.0)
    .to(I, { k: 1, duration: 8.4, ease: 'sine.inOut' }, 0.9)
    .call(() => {
      introDone = true;
      director.endIntro();
      document.body.classList.remove('is-intro', 'on-paper');
      lenis.start();
      ui(0);
    }, null, 9.3)
    .call(() => { document.body.classList.add('ui-on'); document.body.classList.remove('on-paper'); }, null, 7.6);
  if (params.has('fast')) tl.timeScale(6);
}

Promise.all([ready, loaded]).then(() => {
  if (params.has('p')) {
    // saltar a un punto de la secuencia (para revisión): ?p=0.5
    director.intro.k = 1;
    loaderEl.style.display = 'none';
    document.body.classList.remove('is-loading', 'on-paper');
    document.body.classList.add('ui-on');
    introDone = true;
    lenis.start();
    const p = parseFloat(params.get('p')) || 0;
    smooth.p = target.p = p;
    const max = document.documentElement.scrollHeight - innerHeight;
    lenis.scrollTo(max * p, { immediate: true });
  } else if (params.has('k')) {
    // revisión de la entrada congelada en un punto: ?k=0.3
    director.intro.k = parseFloat(params.get('k')) || 0;
    director.startIntro();
    loaderEl.style.display = 'none';
    document.body.classList.remove('is-loading', 'on-paper');
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
  const poolVisible = introDone || director.intro.k > 0.02;
  water.update(dt, poolVisible);
  if (poolVisible) water.renderRefraction(scene, camera);
  renderer.render(scene, camera);
  updatePins();

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

if (DEBUG || CAPTURE) Object.assign(window, { THREE, renderer, scene, camera, G, courtyard, smooth, target, lenis });
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
