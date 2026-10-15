// ─────────────────────────────────────────────────────────────────────────────
//  Hacienda Teya — esperienza 3D
//
//  1. Apertura (≈ 5 s, nessuna schermata di caricamento): la spina in punta al
//     cogollo dell'henequén si stacca, tira fuori la fibra e ricama "Hacienda
//     Teya" sul lino rojo almagre → "Desde 1683" + "Reservar mesa".
//  2. Scroll: il lino vola via, la camera si allontana e la pianta diventa una
//     delle tante del campo; la portada dell'hacienda appare nella luce
//     dorata, la camera attraversa l'arco ed entra nel cortile; la luce passa
//     dal pomeriggio alla sera (Eventos) e alla notte (Trova).
// ─────────────────────────────────────────────────────────────────────────────
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './styles.css';

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { QUALITY, PALETTE, INTRO, DEBUG, IS_MOBILE, THREAD } from './config.js';
import { createAgave } from './scene/agave.js';
import { placeText } from './scene/layout.js';
import { createLinenBand, createFabricUniforms, RAKE_DIR } from './scene/fabric.js';
import { Embroidery, STITCH } from './scene/embroidery.js';
import { createSunsetEnvironment, createSkyDome, createLights, createDust } from './scene/atmosphere.js';
import { createPost } from './scene/post.js';
import { createWorld } from './world/index.js';
import { MOODS, createMoodState, mixMood } from './world/timeOfDay.js';
import { createScroll, buildKeys, sampleCamera, sampleMood } from './scroll.js';
import { eraAt, eraState } from './world/era.js';
import { initSections } from './ui/sections.js';

// ── Renderer, scena, camera ──────────────────────────────────────────────────
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(QUALITY.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // ACES Filmic nel post-processing
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.night);
scene.fog = new THREE.FogExp2(PALETTE.night, 0.06);
const proceduralEnv = createSunsetEnvironment(renderer);
let hdriEnv = null; // HDRI di tramonto vero, caricato dopo l'apertura
scene.environment = proceduralEnv;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 600);

// ── Oggetti dell'apertura ────────────────────────────────────────────────────
const sky = createSkyDome();
const lights = createLights(QUALITY);
const agave = createAgave(QUALITY);
agave.group.scale.setScalar(1.12);
agave.group.updateMatrixWorld();
const agaveFill = { sky: agave.uniforms.uSkyFill.value.clone(), ground: agave.uniforms.uGroundFill.value.clone() };
const dust = createDust(QUALITY.dust);
dust.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
// lino + ricamo: il "porta-fascia" sta nel centro della fascia; i punti sono suoi figli
const fabricUniforms = createFabricUniforms();
const bandHolder = new THREE.Group();
const embroidery = new Embroidery(QUALITY, fabricUniforms);
bandHolder.add(embroidery.local);
let band = null;
lights.group.add(lights.fill.target, lights.rim.target);
scene.add(sky, lights.group, agave.group, dust, bandHolder, embroidery.world);

const post = DEBUG.noPost ? null : createPost(renderer, scene, camera, QUALITY);

// ── Il mondo (costruito a fine apertura, per non rallentarla) ────────────────
let world = null;
let keys = null;
const mood = createMoodState();

// ── Inquadratura dell'apertura: si adatta al formato dello schermo ───────────
const rest = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 34 };
let framing = null;
let place = null;

function computeFraming() {
  const aspect = innerWidth / innerHeight;
  const tall = aspect < 0.95;
  if (tall) {
    // in verticale la pianta deve stare tutta in larghezza: si allarga il campo visivo
    const dist = 6.6;
    const needW = 3.1;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(needW / (2 * dist * aspect)));
    return {
      tall,
      pos: new THREE.Vector3(0, 1.55, dist),
      target: new THREE.Vector3(0, 2.05, 0),
      fov: THREE.MathUtils.clamp(fov, 40, 68),
      // in verticale la fascia esce dai bordi dello schermo
      text: { layout: 'tall', centerY: 0.5, width: 0.86, maxHeight: 0.4, bandWidth: 1.12, marginEm: 0.22 },
    };
  }
  return {
    tall,
    pos: new THREE.Vector3(0, 1.75, 6.9),
    target: new THREE.Vector3(0, 1.8, 0),
    fov: aspect < 1.4 ? 40 : 34,
    text: { layout: 'wide', centerY: 0.53, width: 0.76, maxHeight: 0.4, bandWidth: 0.84, marginEm: 0.24 },
  };
}

// campo visivo del mondo: in verticale si apre per mantenere la larghezza
function worldFov() {
  const aspect = innerWidth / innerHeight;
  if (aspect >= 1) return 40;
  const h = THREE.MathUtils.degToRad(40);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect)), 40, 72);
}

function applyFraming() {
  framing = computeFraming();
  rest.pos.copy(framing.pos);
  rest.target.copy(framing.target);
  rest.fov = framing.fov;
  camera.aspect = innerWidth / innerHeight;
  camera.fov = rest.fov;
  // la scritta si posiziona con la camera nella posa finale
  camera.position.copy(rest.pos);
  camera.lookAt(rest.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const next = placeText(camera, framing.text);
  const changed = !place || place.layout !== next.layout || Math.abs(place.scale - next.scale) / place.scale > 0.015;
  place = next;
  document.body.classList.toggle('is-tall', framing.tall);
  if (changed) buildBand();
  positionOverlay();
  if (world) keys = buildKeys(rest, framing.tall);
}

// (ri)costruisce la fascia di lino e il ricamo per l'impaginazione corrente
function buildBand() {
  if (band) {
    bandHolder.remove(band.group);
    band.dispose();
  }
  const em = place.scale;
  // un punto copre ~8 fili della trama: così lino e ricamo hanno la stessa scala
  const pitch = (STITCH.length * em) / THREAD.threadsPerStitch;
  band = createLinenBand({
    width: place.band.width,
    height: place.band.height,
    scale: em,
    pitch,
    quality: QUALITY,
    uniforms: fabricUniforms,
    fringe: !framing.tall, // in verticale le estremità sono fuori schermo
  });
  bandHolder.position.copy(place.band.origin);
  bandHolder.add(band.group);
  embroidery.build(place, agave.group.localToWorld(agave.heart.clone()));
  computeShots();
}

// "Desde 1683" e il pulsante stanno subito sotto la fascia di lino
function positionOverlay() {
  const p = place.bandBottomWorld.clone().project(camera);
  const y = (1 - (p.y * 0.5 + 0.5)) * innerHeight;
  document.documentElement.style.setProperty('--hero-text-bottom', `${Math.round(y)}px`);
}

// ── Parallax leggero col mouse ───────────────────────────────────────────────
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
if (!matchMedia('(pointer: coarse)').matches) {
  addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  });
}

// ── Stato animato dall'apertura ──────────────────────────────────────────────
const state = {
  light: 0, // 0 buio → 1 luce dorata piena
  open: 0, // apertura della pianta
  fabric: 0, // luce radente sul lino
};

// ── Timeline dell'apertura (≈ 5 s) ───────────────────────────────────────────
// Il ricamo non è un tween: legge il tempo della timeline (vedi embroidery.update)
const ui = {
  heroUi: document.querySelector('.hero__ui'),
  since: document.querySelectorAll('[data-since]'),
  lines: document.querySelectorAll('.hero__line'),
  cta: document.getElementById('ctaReservar'),
  topbar: document.getElementById('topbar'),
  cue: document.getElementById('scrollCue'),
  caption: document.getElementById('heroCaption'),
  skip: document.getElementById('skip'),
};

const intro = gsap.timeline({ paused: true, onComplete: finishIntro });
intro
  .to(state, { light: 1, duration: 1.6, ease: 'power2.inOut' }, 0)
  .to(state, { open: 1, duration: INTRO.openPlant, ease: 'power2.out' }, 0.05)
  .to(state, { fabric: 1, duration: 1.3, ease: 'power2.inOut' }, 0.3)
  .fromTo(ui.lines, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.out' }, INTRO.subtitleAt)
  .fromTo(ui.since, { opacity: 0, y: 8, letterSpacing: '0.42em' }, { opacity: 1, y: 0, letterSpacing: '0.18em', duration: 0.9, ease: 'power3.out' }, INTRO.subtitleAt)
  .fromTo(ui.cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, INTRO.ctaAt)
  .fromTo([ui.topbar, ui.caption, ui.cue], { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power2.out' }, INTRO.ctaAt + 0.2)
  .fromTo(ui.skip, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.4)
  .to(ui.skip, { opacity: 0, duration: 0.3 }, INTRO.ctaAt + 0.1);

let introDone = false;
function finishIntro() {
  if (introDone) return;
  introDone = true;
  ui.skip.hidden = true;
  ensureWorld();
  document.body.classList.add('intro-done');
  lenis.start();
  ScrollTrigger.refresh();
  keys = buildKeys(rest, framing.tall);
  loadHdri();
}

// "Saltar" (o il primo scroll durante l'apertura): avanza rapidamente alla fine
function skipIntro() {
  if (introDone || intro.progress() > 0.97) return;
  intro.pause();
  gsap.to(intro, { progress: 1, duration: 0.6, ease: 'power2.inOut', onComplete: finishIntro });
}
ui.skip.addEventListener('click', skipIntro);
for (const ev of ['wheel', 'touchmove', 'keydown']) addEventListener(ev, () => !introDone && skipIntro(), { passive: true });

// ── Scroll ───────────────────────────────────────────────────────────────────
const lenis = createScroll();
lenis.stop();
let scrollOverride = null; // per la registrazione fotogramma per fotogramma
const scrollProgress = () => (scrollOverride !== null ? scrollOverride : introDone ? lenis.progress || 0 : 0);

function ensureWorld() {
  if (world) return;
  world = createWorld(QUALITY);
  world.group.visible = false;
  scene.add(world.group);
  // compila gli shader del mondo adesso, non al primo scroll
  world.group.visible = true;
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).catch(() => {});
  world.group.visible = false;
}

async function loadHdri() {
  try {
    const [{ default: url }, { EXRLoader }] = await Promise.all([import('@pmndrs/assets/hdri/sunset.exr'), import('three/examples/jsm/loaders/EXRLoader.js')]);
    const tex = await new EXRLoader().loadAsync(url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    hdriEnv = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
  } catch (e) {
    console.warn('HDRI non caricato, resta il cielo procedurale', e);
  }
}

// ── Regia della camera durante l'apertura ────────────────────────────────────
// 0–0,75 s   inquadratura larga sulla pianta che si accende
// 0,75–1,6 s segue la spina che sale e si avvicina al lino, dove nasce la "H"
// 1,6–2,4 s  primo piano: si vedono trama, ago e filo che attraversano i fori
// 2,4–4,15 s si allontana mentre il time-lapse completa il nome → posa finale
const shot = {
  startPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  closePos: new THREE.Vector3(),
  closeTarget: new THREE.Vector3(),
};
const CAM = { push: 0.75, close: 1.6, hold: 2.4, rest: 4.15 };

function computeShots() {
  shot.startPos.copy(rest.pos).add(new THREE.Vector3(0.18, -0.22, -0.9));
  shot.startTarget.copy(rest.target);
  // primo piano: un po' a destra del primo foro (lì corrono i primi punti),
  // visto da sinistra e dal basso perché la luce radente mostri il rilievo
  const em = place.scale;
  shot.closeTarget.copy(embroidery.firstHoleWorld()).add(new THREE.Vector3(0.28 * em, -0.06 * em, 0));
  shot.closePos.copy(shot.closeTarget).add(new THREE.Vector3(-0.55 * em, -0.3 * em, 3.3 * em));
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

function cameraPose(t, pos, target) {
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  if (t < CAM.push) {
    const k = 1 - Math.pow(1 - t / CAM.push, 2);
    pos.copy(shot.startPos).add(_p.set(0, 0.06 * k, -0.15 * k));
    target.copy(shot.startTarget).add(_t.set(0, 0.12 * k, 0));
  } else if (t < CAM.close) {
    const k = easeInOut(clamp01((t - CAM.push) / (CAM.close - CAM.push)));
    pos.copy(shot.startPos).add(_p.set(0, 0.06, -0.15)).lerp(shot.closePos, k);
    target.copy(shot.startTarget).add(_t.set(0, 0.12, 0)).lerp(shot.closeTarget, k);
  } else if (t < CAM.hold) {
    // leggera deriva in avanti: il primo piano respira
    const k = (t - CAM.close) / (CAM.hold - CAM.close);
    pos.copy(shot.closePos).add(_p.set(0.05 * k * place.scale, 0, -0.12 * k * place.scale));
    target.copy(shot.closeTarget);
  } else {
    const k = easeInOut(clamp01((t - CAM.hold) / (CAM.rest - CAM.hold)));
    pos.copy(shot.closePos).add(_p.set(0.05 * place.scale, 0, -0.12 * place.scale)).lerp(rest.pos, k);
    target.copy(shot.closeTarget).lerp(rest.target, k);
  }
}

const camTarget = new THREE.Vector3();
function updateCamera(dt, s) {
  if (!keys || s <= 1e-5) {
    cameraPose(intro.time(), camera.position, camTarget);
    camera.fov = rest.fov;
  } else {
    sampleCamera(keys, s, camera.position, camTarget);
    camera.fov = THREE.MathUtils.lerp(rest.fov, worldFov(), smooth(0, fieldS() * 0.8, s));
  }
  camera.updateProjectionMatrix();
  // parallax col mouse
  const k = 1 - Math.exp(-dt * 3);
  pointer.sx += (pointer.x - pointer.sx) * k;
  pointer.sy += (pointer.y - pointer.sy) * k;
  camera.position.x += pointer.sx * 0.22;
  camera.position.y += -pointer.sy * 0.1;
  camera.lookAt(camTarget);
}

// inizio del capitolo "campo" in [0,1] (fine della prima transizione)
const fieldS = () => (keys && keys.cam[1] ? keys.cam[1].s : 0.08);

// ── Luce: rampa dell'apertura + ora del giorno guidata dallo scroll ──────────
const sunView = new THREE.Vector3();
const focus = new THREE.Vector3();
const heroShadow = { l: -3.4, r: 3.4, t: 3.4, b: -2.2 };
let shadowMode = 'hero';

function applyLight(s) {
  if (keys) sampleMood(keys, s, mood);
  else mixMood(mood, MOODS.stage, MOODS.stage, 0);
  // durante l'apertura (s = 0) la luce sale con la rampa dell'intro
  const gain = s > 0.001 ? 1 : state.light;
  const hero = s <= 0.001;

  lights.sun.color.copy(mood.sunColor);
  lights.sun.intensity = mood.sunI * gain;
  lights.fill.color.copy(mood.fillColor);
  lights.fill.intensity = mood.fillI * gain;
  lights.rim.intensity = mood.rimI * gain;
  scene.fog.color.copy(mood.fog);
  scene.fog.density = mood.fogDensity;
  const su = sky.material.uniforms;
  su.uZenith.value.copy(mood.zenith);
  su.uMid.value.copy(mood.mid);
  su.uHorizon.value.copy(mood.horizon);
  su.uSun.value.copy(mood.sunGlow);
  su.uGround.value.copy(mood.skyGround);
  su.uSunDir.value.copy(mood.sunDir);
  scene.environment = mood.hdri > 0.5 && hdriEnv ? hdriEnv : proceduralEnv;
  scene.environmentIntensity = hero ? 0.06 + 0.26 * state.light : mood.env;

  // il sole (e la sua ombra) segue la zona inquadrata
  if (hero) {
    focus.set(0, 0.6, 0.6);
    lights.sun.position.copy(mood.sunDir).multiplyScalar(9).add(new THREE.Vector3(0, 0.5, 0));
    if (shadowMode !== 'hero') setShadowBox(heroShadow, 2, 20);
    shadowMode = 'hero';
  } else {
    focus.copy(camTarget).lerp(camera.position, 0.35);
    focus.y = 0;
    lights.sun.position.copy(focus).addScaledVector(mood.sunDir, 90);
    if (shadowMode !== 'world') {
      const h = IS_MOBILE ? 20 : 26;
      setShadowBox({ l: -h, r: h, t: h, b: -h }, 10, 220);
      lights.sun.shadow.mapSize.set(QUALITY.worldShadowSize, QUALITY.worldShadowSize);
      lights.sun.shadow.map?.dispose();
      lights.sun.shadow.map = null;
      lights.sun.shadow.normalBias = 0.04;
    }
    shadowMode = 'world';
  }
  lights.sun.target.position.copy(focus);
  lights.fill.position.copy(focus).add(new THREE.Vector3(2.5, 2.2, 6));
  lights.rim.position.copy(focus).add(new THREE.Vector3(3, 5, -4));
  lights.fill.target.position.copy(focus);
  lights.rim.target.position.copy(focus);

  // luce del ricamo e dell'apertura
  fabricUniforms.uRakeColor.value.set('#ffc68a').multiplyScalar(1.5 * state.fabric);
  fabricUniforms.uLight.value = state.light;
  agave.uniforms.uLight.value = state.light * (1 - mood.night * 0.6);
  // la pianta protagonista: nel mondo in pieno giorno perde la luce "da palcoscenico"
  const stage = 1 - smooth(0, fieldS(), s);
  agave.uniforms.uSkyFill.value.copy(agaveFill.sky).multiplyScalar(0.2 + 0.8 * stage);
  agave.uniforms.uGroundFill.value.copy(agaveFill.ground).multiplyScalar(0.2 + 0.8 * stage);
  agave.mesh.material.envMapIntensity = 0.85 + 0.95 * stage;
  dust.material.uniforms.uOpacity.value = gain * (1 - mood.night * 0.75);
  agave.setOpen(state.open);
}

function setShadowBox(b, near, far) {
  const sc = lights.sun.shadow.camera;
  sc.left = b.l;
  sc.right = b.r;
  sc.top = b.t;
  sc.bottom = b.b;
  sc.near = near;
  sc.far = far;
  sc.updateProjectionMatrix();
}

// ── Il lino vola via al primo scroll (resta legato alla pianta come un aquilone)
function updateBandFlight(s) {
  const k = smooth(0, fieldS() * 0.75, s);
  bandHolder.position.copy(place.band.origin).add(_p.set(-k * 1.5, k * k * 18, -k * 7));
  bandHolder.rotation.set(-k * 0.55, 0, Math.sin(k * 5) * 0.12 * k);
  const gone = k > 0.995;
  bandHolder.visible = !gone;
  embroidery.world.visible = !gone;
  // l'interfaccia dell'apertura sfuma
  const o = 1 - smooth(0, 0.012, s);
  ui.heroUi.style.opacity = o;
  ui.heroUi.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  ui.topbar.classList.toggle('is-scrolled', s > 0.01);
}

// ── Antes → Hoy ──────────────────────────────────────────────────────────────
// Al primo scroll il colore se ne va (si entra nel ricordo del henequén); la
// linea del tempo di Historia porta il mondo fino a oggi (vedi world/era.js)
const era = eraState(0);
function updateEra(s) {
  const h = keys && keys.chapters.historia;
  const p = h ? THREE.MathUtils.clamp((s - h.sIn) / Math.max(h.sOut - h.sIn, 1e-4), 0, 1) : 0;
  eraState(eraAt(p), era);
  era.past *= smooth(0.0, fieldS() * 0.7, s);
  if (post && post.memory) {
    post.memory.past.value = era.past;
    post.memory.cool.value = era.cool;
  }
}

// ── Ciclo di rendering ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
let worldTime = 0;

function frame(dt, render = true) {
  worldTime += dt;
  const s = scrollProgress();
  updateCamera(dt, s);
  applyLight(s);
  updateBandFlight(s);
  updateEra(s);
  fabricUniforms.uWindTime.value = worldTime;
  embroidery.update(intro.time(), dt, worldTime);
  agave.update(worldTime);
  dust.material.uniforms.uTime.value = worldTime;

  // direzioni nello spazio vista (traslucenza delle foglie, luce radente)
  sunView.copy(mood.sunDir).transformDirection(camera.matrixWorldInverse);
  agave.uniforms.uSunDirView.value.copy(sunView);
  fabricUniforms.uSunDirView.value.copy(sunView);
  fabricUniforms.uRakeDirView.value.copy(RAKE_DIR).transformDirection(camera.matrixWorldInverse);
  agave.uniforms.uUpView.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);

  if (world) {
    world.group.visible = s > 0.0005;
    world.update(worldTime, mood, era);
    const fu = world.field.uniforms;
    fu.uGrow.value = smooth(0.002, fieldS() * 0.9, s) * 1.08;
    fu.uSunDirView.value.copy(sunView);
    fu.uUpView.value.copy(agave.uniforms.uUpView.value);
    fu.uLight.value = 1 - mood.night * 0.6;
    // la polvere segue la zona inquadrata
    dust.position.set(camTarget.x * 0.6 + camera.position.x * 0.4, 0, camTarget.z * 0.6 + camera.position.z * 0.4).multiplyScalar(s > 0.001 ? 1 : 0);
  }
  if (!render) return;
  if (post) post.render(dt);
  else renderer.render(scene, camera);
}

function loop() {
  frame(Math.min(clock.getDelta(), 1 / 20));
  requestAnimationFrame(loop);
}

// ── Avvio ────────────────────────────────────────────────────────────────────
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.setSize(innerWidth, innerHeight);
  applyFraming();
}
addEventListener('resize', onResize);
applyFraming();
initSections({ scrollTo: (y) => lenis.scrollTo(y, { duration: 1.8 }) });
document.body.classList.toggle('is-mobile', IS_MOBILE);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (DEBUG.capture) {
  // registrazione fotogramma per fotogramma: window.__teya.frame(t) e .scroll(s)
  let simT = 0;
  let gsapBase = null;
  ensureWorld();
  window.__teya = {
    duration: intro.duration(),
    // avanza la simulazione a 30 fps fino a t (senza disegnare), poi disegna t
    frame(t) {
      while (simT + 1 / 30 < t - 1e-6) {
        simT += 1 / 30;
        intro.time(simT, false);
        worldTime = simT - 1 / 30;
        frame(1 / 30, false);
      }
      simT = t;
      intro.time(t, false);
      worldTime = t - 1 / 30;
      frame(1 / 30);
    },
    // scroll: s ∈ [0,1] a fine apertura; time = tempo del mondo (vento, lucine)
    async scroll(s, time = 8) {
      if (!introDone) {
        intro.progress(1, false);
        finishIntro();
      }
      if (!hdriEnv) await loadHdri();
      scrollOverride = s;
      worldTime = time;
      for (let i = 0; i < 20; i++) frame(1 / 30, false); // assesta fili e ombre
      frame(1 / 30);
      return keys.cam.map((k) => +k.s.toFixed(4));
    },
    // video del percorso: un fotogramma allo scroll s e al tempo t (secondi).
    // Anche l'HTML scorre lì e il tempo di GSAP (comparse, parole cucite)
    // avanza con quello del video invece che con l'orologio reale.
    async journey(s, t) {
      if (!introDone) {
        intro.progress(1, false);
        finishIntro();
      }
      if (!hdriEnv) await loadHdri();
      if (gsapBase === null) {
        // da qui il tempo di GSAP lo dà il video, non il ticker
        gsapBase = gsap.ticker.time - t;
        gsap.ticker.remove(gsap.updateRoot);
      }
      scrollOverride = s;
      window.scrollTo(0, s * (document.documentElement.scrollHeight - innerHeight));
      ScrollTrigger.update();
      gsap.updateRoot(gsapBase + t);
      worldTime = t - 1 / 30;
      frame(1 / 30);
    },
  };
} else if (DEBUG.freezeAt !== null) {
  intro.time(DEBUG.freezeAt, false);
  worldTime = DEBUG.freezeAt;
  frame(0);
  clock.getDelta();
  requestAnimationFrame(function still() {
    frame(0);
    requestAnimationFrame(still);
  });
} else {
  if (reduceMotion) intro.progress(1);
  else intro.play(0);
  requestAnimationFrame(loop);
}
