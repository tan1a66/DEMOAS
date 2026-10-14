// ─────────────────────────────────────────────────────────────────────────────
//  Hacienda Teya — apertura 3D
//  pianta di henequén → la spina in punta al cogollo si stacca e tira fuori la
//  fibra (ago e filo dalla stessa pianta) → ricama "Hacienda Teya" sul lino
//  rojo almagre → "Desde 1683" + "Reservar mesa". Nessuna schermata di
//  caricamento: l'apertura stessa parte al primo fotogramma.
// ─────────────────────────────────────────────────────────────────────────────
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './styles.css';

import * as THREE from 'three';
import { gsap } from 'gsap';
import { QUALITY, PALETTE, INTRO, LINKS, DEBUG, IS_MOBILE, THREAD } from './config.js';
import { createAgave } from './scene/agave.js';
import { placeText } from './scene/layout.js';
import { createLinenBand, createFabricUniforms, RAKE_DIR } from './scene/fabric.js';
import { Embroidery, STITCH } from './scene/embroidery.js';
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
// lino + ricamo: il "porta-fascia" sta nel centro della fascia; i punti sono suoi figli
const fabricUniforms = createFabricUniforms();
const bandHolder = new THREE.Group();
const embroidery = new Embroidery(QUALITY, fabricUniforms);
bandHolder.add(embroidery.local);
let band = null;
scene.add(sky, lights.group, ground, agave.group, dust, bandHolder, embroidery.world);

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

function applyState() {
  const L = state.light;
  lights.sun.intensity = 3.2 * L;
  lights.fill.intensity = 0.6 * L;
  lights.rim.intensity = 0.7 * L;
  fabricUniforms.uRakeColor.value.set('#ffc68a').multiplyScalar(1.5 * state.fabric);
  fabricUniforms.uLight.value = L;
  scene.environmentIntensity = 0.06 + 0.26 * L;
  agave.uniforms.uLight.value = L;
  dust.material.uniforms.uOpacity.value = L;
  agave.setOpen(state.open);
}

// ── Timeline dell'apertura (≈ 5 s) ───────────────────────────────────────────
// Il ricamo non è un tween: legge il tempo della timeline (vedi embroidery.update)
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
  .to(state, { fabric: 1, duration: 1.3, ease: 'power2.inOut' }, 0.3)
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
// ── Regia della camera ───────────────────────────────────────────────────────
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
function updateCamera(dt) {
  cameraPose(intro.time(), camera.position, camTarget);
  // parallax col mouse
  const k = 1 - Math.exp(-dt * 3);
  pointer.sx += (pointer.x - pointer.sx) * k;
  pointer.sy += (pointer.y - pointer.sy) * k;
  camera.position.x += pointer.sx * 0.22;
  camera.position.y += -pointer.sy * 0.1;
  camera.lookAt(camTarget);
}

function frame(dt, render = true) {
  worldTime += dt;
  applyState();
  updateCamera(dt);
  fabricUniforms.uWindTime.value = worldTime;
  embroidery.update(intro.time(), dt, worldTime);
  agave.update(worldTime);
  dust.material.uniforms.uTime.value = worldTime;
  // direzione del sole nello spazio vista (per la traslucenza delle foglie)
  sunView.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
  agave.uniforms.uSunDirView.value.copy(sunView);
  fabricUniforms.uSunDirView.value.copy(sunView);
  fabricUniforms.uRakeDirView.value.copy(RAKE_DIR).transformDirection(camera.matrixWorldInverse);
  agave.uniforms.uUpView.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
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
document.body.classList.toggle('is-mobile', IS_MOBILE);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (DEBUG.capture) {
  // registrazione fotogramma per fotogramma: window.__teya.frame(t)
  let simT = 0;
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
