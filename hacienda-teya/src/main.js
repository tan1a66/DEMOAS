// ─────────────────────────────────────────────────────────────────────────────
//  Hacienda Teya — apertura 3D
//  pianta di henequén → il filo nasce dal cogollo e scrive "Hacienda Teya"
//  → "Desde 1683" + "Reservar mesa". Nessuna schermata di caricamento:
//  l'apertura stessa parte al primo fotogramma.
// ─────────────────────────────────────────────────────────────────────────────
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './styles.css';

import * as THREE from 'three';
import { gsap } from 'gsap';
import { QUALITY, PALETTE, INTRO, LINKS, DEBUG, IS_MOBILE } from './config.js';
import { createAgave } from './scene/agave.js';
import { HenequenThread, placeText } from './scene/thread.js';
import { createSunsetEnvironment, createSkyDome, createLights, createGround, createDust, SUN_DIR } from './scene/atmosphere.js';
import { createPost } from './scene/post.js';

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
scene.environment = createSunsetEnvironment(renderer);
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);

// ── Oggetti ──────────────────────────────────────────────────────────────────
const sky = createSkyDome();
const lights = createLights(QUALITY);
const ground = createGround();
const agave = createAgave(QUALITY);
agave.group.scale.setScalar(1.12);
agave.group.updateMatrixWorld();
const dust = createDust(QUALITY.dust);
dust.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
const thread = new HenequenThread(QUALITY);
scene.add(sky, lights.group, ground, agave.group, dust, thread.group);

const post = DEBUG.noPost ? null : createPost(renderer, scene, camera, QUALITY);

// ── Inquadratura: si adatta al formato dello schermo ─────────────────────────
// Orizzontale: scritta su una riga sopra la pianta. Verticale: su due righe.
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
      text: { layout: 'tall', centerY: 0.52, width: 0.9, maxHeight: 0.44 },
    };
  }
  return {
    tall,
    pos: new THREE.Vector3(0, 1.75, 6.9),
    target: new THREE.Vector3(0, 1.8, 0),
    fov: aspect < 1.4 ? 40 : 34,
    text: { layout: 'wide', centerY: 0.56, width: 0.78, maxHeight: 0.44 },
  };
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
  if (changed) thread.build(place, agave.group.localToWorld(agave.heart.clone()));
  positionOverlay();
}

// "Desde 1683" e il pulsante stanno subito sotto la scritta 3D
function positionOverlay() {
  const p = place.bottomWorld.clone().project(camera);
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
  write: 0, // avanzamento del filo (tempo di scrittura)
  sweep: -1, // riflesso finale lungo il filo
  dolly: 0, // 0 posa iniziale → 1 posa finale
};

function applyState() {
  const L = state.light;
  lights.sun.intensity = 3.2 * L;
  lights.fill.intensity = 0.6 * L;
  lights.rim.intensity = 0.7 * L;
  scene.environmentIntensity = 0.06 + 0.26 * L;
  agave.uniforms.uLight.value = L;
  dust.material.uniforms.uOpacity.value = L;
  agave.setOpen(state.open);
  thread.setProgress(state.write);
  thread.uniforms.uSweep.value = state.sweep;
}

// ── Timeline dell'apertura (≈ 4,8 s) ─────────────────────────────────────────
const ui = {
  since: document.querySelectorAll('[data-since]'),
  lines: document.querySelectorAll('.hero__line'),
  cta: document.getElementById('ctaReservar'),
  topbar: document.getElementById('topbar'),
  cue: document.getElementById('scrollCue'),
  caption: document.getElementById('heroCaption'),
  skip: document.getElementById('skip'),
};
ui.cta.href = LINKS.reservarHacienda;
document.querySelectorAll('[data-link="reservar"]').forEach((a) => (a.href = LINKS.reservarHacienda));

const intro = gsap.timeline({ paused: true, onComplete: finishIntro });
intro
  .to(state, { light: 1, duration: 1.6, ease: 'power2.inOut' }, 0)
  .to(state, { open: 1, duration: INTRO.openPlant, ease: 'power2.out' }, 0.05)
  .to(state, { dolly: 1, duration: 4.8, ease: 'power2.out' }, 0)
  .to(state, { write: 1, duration: INTRO.writeDuration, ease: 'power1.inOut' }, INTRO.threadStart)
  .to(state, { sweep: 1.15, duration: 1.1, ease: 'power1.inOut' }, INTRO.threadStart + INTRO.writeDuration - 0.15)
  .fromTo(ui.lines, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.out' }, INTRO.subtitleAt)
  .fromTo(ui.since, { opacity: 0, y: 8, letterSpacing: '0.42em' }, { opacity: 1, y: 0, letterSpacing: '0.18em', duration: 0.9, ease: 'power3.out' }, INTRO.subtitleAt)
  .fromTo(ui.cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, INTRO.ctaAt)
  .fromTo([ui.topbar, ui.caption, ui.cue], { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power2.out' }, INTRO.ctaAt + 0.2)
  .fromTo(ui.skip, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.4)
  .to(ui.skip, { opacity: 0, duration: 0.3 }, INTRO.ctaAt + 0.1);

function finishIntro() {
  document.body.classList.add('intro-done');
  ui.skip.hidden = true;
}

// "Saltar": avanza rapidamente alla fine (non un taglio brusco)
ui.skip.addEventListener('click', () => {
  intro.pause();
  gsap.to(intro, { progress: 1, duration: 0.6, ease: 'power2.inOut' });
});

// ── Ciclo di rendering ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
let worldTime = 0;
const sunView = new THREE.Vector3();
const camStart = new THREE.Vector3();

function updateCamera(dt) {
  // carrellata d'apertura: parte un po' più vicina e bassa, poi si assesta
  const d = state.dolly;
  camStart.copy(rest.pos).add(new THREE.Vector3(0.18, -0.22, -0.9));
  camera.position.lerpVectors(camStart, rest.pos, d);
  // parallax
  const k = 1 - Math.exp(-dt * 3);
  pointer.sx += (pointer.x - pointer.sx) * k;
  pointer.sy += (pointer.y - pointer.sy) * k;
  camera.position.x += pointer.sx * 0.22;
  camera.position.y += -pointer.sy * 0.1;
  camera.lookAt(rest.target);
}

function frame(dt) {
  worldTime += dt;
  applyState();
  updateCamera(dt);
  agave.update(worldTime);
  dust.material.uniforms.uTime.value = worldTime;
  // direzione del sole nello spazio vista (per la traslucenza delle foglie)
  sunView.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
  agave.uniforms.uSunDirView.value.copy(sunView);
  agave.uniforms.uUpView.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
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
document.body.classList.toggle('is-mobile', IS_MOBILE);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (DEBUG.capture) {
  // registrazione fotogramma per fotogramma: window.__teya.frame(t)
  window.__teya = {
    duration: intro.duration(),
    frame(t) {
      intro.time(t, false);
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
