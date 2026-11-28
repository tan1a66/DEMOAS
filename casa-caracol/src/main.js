import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/inter/wght.css';
import './styles/main.css';

import { ENV } from './core/env.js';
import { applyTranslations, onLangChange, t } from './i18n/index.js';
import { PALETTE } from './config.js';
import { U } from './gl/uniforms.js';
import { Stage } from './gl/stage.js';
import { createWorld } from './gl/world.js';
import { PHOTO_MODES } from './gl/photoPass.js';
import { loadPhotoTexture } from './core/assets.js';
import { SeaAudio } from './core/sea.js';
import { CameraRig } from './story/rig.js';
import { createState, buildStory, gsap, ScrollTrigger } from './story/timeline.js';
import { WordReveal } from './ui/reveal.js';
import { initNav } from './ui/nav.js';
import { initGrain } from './ui/grain.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const root = document.documentElement;
root.classList.toggle('is-touch', ENV.touch);
root.classList.toggle('is-reduced', ENV.reducedMotion);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// Tinta → blanco según el fondo (arena clara / cielo y foto).
const INK = [0x1e, 0x2e, 0x38];
const setTone = (k) => {
  const c = INK.map((v) => Math.round(v + (255 - v) * k));
  root.style.setProperty('--fg', `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
  root.style.setProperty('--tone', k.toFixed(3));
};

const loadFonts = () =>
  Promise.race([
    Promise.all([
      document.fonts.load('300 48px "Fraunces Variable"', 'Acerca'),
      document.fonts.load('400 14px "Inter Variable"', 'Toca'),
    ]).catch(() => null),
    sleep(1600),
  ]);

const hideLoader = async (t0) => {
  const wait = 700 - (performance.now() - t0);
  if (wait > 0) await sleep(wait);
  window.__loader?.hide();
};

// Sin WebGL (o si algo falla): textos estáticos sobre fondo de cal. La versión
// estática completa con fotos llega en la Fase 3.
const startWithoutGL = () => {
  root.classList.add('no-gl');
  window.__loader?.hide();
};

const boot = async () => {
  const t0 = performance.now();
  applyTranslations();
  initGrain();
  setTone(0);
  if (!ENV.webgl) {
    startWithoutGL();
    return;
  }

  const stage = new Stage($('gl'));
  const world = await createWorld(stage);
  const rig = new CameraRig(stage.camera);
  rig.setAspect(stage.aspect);

  // ── foto del match cut (o segmento de reemplazo) ──
  const fontsReady = loadFonts();
  const photo = await loadPhotoTexture('spires-sky.jpg');
  const refreshPhoto = () => {
    if (!world.photo.isPlaceholder) return;
    world.usePlaceholder(t('placeholder.label') + ' · encuadre de referencia');
    world.photo.setPose(rig.photoPose.quaternion, rig.photoPose.fov);
  };
  if (photo) {
    world.photo.setPhoto(photo.texture, photo.aspect);
    rig.setPhotoAspect(photo.aspect);
  } else {
    rig.setPhotoAspect(3 / 4);
  }
  world.photo.setPose(rig.photoPose.quaternion, rig.photoPose.fov);

  // ── historia ──
  const state = createState();
  const story = buildStory({ state, storyEl: $('story'), reduced: ENV.reducedMotion });
  const ui = { settle: ENV.reducedMotion ? 0 : 1, introReveal: 0, tap: 0, scrollHint: 0, leave: 0 };
  const clock = { time: 0 };
  let active = true;

  const audio = new SeaAudio({ getVisualTime: () => clock.time });
  initNav({ audio });

  const reveals = {
    intro: new WordReveal($('t-intro'), { stagger: 0.42, blur: 9 }),
    a: new WordReveal($('t-a')),
    b: new WordReveal($('t-b')),
  };
  onLangChange(() => Object.values(reveals).forEach((r) => r.split()));

  // la escena 3D se pausa cuando la sección siguiente cubre la pantalla
  ScrollTrigger.create({
    trigger: '#casa',
    start: 'top bottom',
    end: 'top 35%',
    scrub: true,
    onUpdate: (self) => {
      ui.leave = self.progress;
    },
  });
  ScrollTrigger.create({
    trigger: '#casa',
    start: 'top top',
    onEnter: () => {
      active = false;
    },
    onLeaveBack: () => {
      active = true;
    },
  });

  stage.onResize(() => {
    rig.setAspect(stage.aspect);
    ScrollTrigger.refresh();
  });

  // ── primer toque: arranca el mar y aparece la indicación de scroll ──
  let gestured = false;
  let down = null;
  const markGesture = () => {
    if (gestured) return;
    gestured = true;
    gsap.to(ui, { tap: 0, duration: 0.6 });
    gsap.to(ui, { scrollHint: 1, duration: 1.2, delay: 0.3 });
  };
  const isNav = (el) => el?.closest?.('.nav, .skip, #cc-copybox, .cc-gui');
  window.addEventListener(
    'pointerdown',
    (ev) => {
      down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
      if (isNav(ev.target)) return;
      const p = world.pickGround(ev.clientX, ev.clientY);
      if (p) world.ripples.add(p.x, p.z, 1);
    },
    { passive: true },
  );
  window.addEventListener(
    'pointerup',
    (ev) => {
      if (!down) return;
      const tap = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 12 && performance.now() - down.t < 700;
      down = null;
      if (!tap) return;
      if (isNav(ev.target)) {
        markGesture();
        return;
      }
      if (!gestured && !audio.playing) audio.play();
      markGesture();
    },
    { passive: true },
  );
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || gestured) return;
    audio.play();
    markGesture();
  });
  // si no hay toque, la indicación de scroll aparece sola
  setTimeout(() => {
    if (!gestured) gsap.to(ui, { scrollHint: 1, duration: 1.2 });
  }, 5200);

  // ondas al mover el ratón
  let lastMove = 0;
  let lastP = null;
  window.addEventListener(
    'pointermove',
    (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - lastMove < 110) return;
      const p = world.pickGround(ev.clientX, ev.clientY);
      if (!p) return;
      if (lastP && Math.hypot(p.x - lastP.x, p.z - lastP.z) < 0.18) return;
      lastMove = now;
      lastP = { x: p.x, z: p.z };
      world.ripples.add(p.x, p.z, 0.4);
    },
    { passive: true },
  );

  // ── "Ver la casa": salto directo, tapado con un velo de cal ──
  const veil = $('veil');
  const jumpTo = (selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    gsap.to(veil, {
      opacity: 1,
      duration: 0.45,
      ease: 'power2.in',
      onComplete: () => {
        window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
        ScrollTrigger.update();
        story.trigger.getTween?.()?.progress(1);
        gsap.to(veil, { opacity: 0, duration: 0.8, delay: 0.15, ease: 'power2.out' });
      },
    });
  };
  $('skip').addEventListener('click', (ev) => {
    ev.preventDefault();
    markGesture();
    jumpTo('#casa');
  });

  // ── depuración (?debug) ──
  let debug = null;
  if (ENV.debug) {
    const mod = await import('./ui/debug.js');
    debug = mod.initDebug({ world, rig, story, stage, refreshPhoto });
    root.classList.add('is-debug');
  }

  // ── bucle de render (un único rAF: el ticker de GSAP) ──
  const els = {
    intro: document.querySelector('.overlay__intro'),
    tap: $('t-tap'),
    scroll: $('scrollhint'),
    skip: $('skip'),
    overlay: $('overlay'),
  };
  let toneShown = -1;
  const writeDom = () => {
    const introOut = clamp01(state.intro);
    const lock = debug?.lock;
    reveals.intro.set(ui.introReveal);
    els.intro.style.opacity = (1 - introOut).toFixed(3);
    els.intro.style.transform = `translate3d(0, ${(-introOut * 3).toFixed(2)}svh, 0)`;
    els.tap.style.opacity = (ui.tap * (1 - introOut)).toFixed(3);
    const hint = ui.scrollHint * (1 - clamp01(introOut * 1.6));
    els.scroll.style.opacity = hint.toFixed(3);
    els.skip.style.opacity = (Math.max(ui.tap, ui.scrollHint) * (1 - clamp01(introOut * 1.6))).toFixed(3);
    els.skip.style.pointerEvents = introOut > 0.6 ? 'none' : 'auto';
    reveals.a.set(state.lineA);
    reveals.b.set(state.lineB);
    els.overlay.style.opacity = lock ? '0' : (1 - ui.leave).toFixed(3);
    // tinta sobre arena, blanco sobre cielo o foto (según lo que hay detrás del texto)
    const skyBehind = smooth(0.06, 0.32, rig.topRayY ?? -1);
    const tone = Math.max(skyBehind, clamp01(state.cut * 1.5)) * (1 - ui.leave);
    if (Math.abs(tone - toneShown) > 0.004) {
      toneShown = tone;
      setTone(tone);
    }
    if (ENV.reducedMotion) veil.style.opacity = state.veil.toFixed(3);
  };

  const tick = (_time, deltaMs) => {
    const dt = Math.min(deltaMs, 100) / 1000;
    clock.time += dt * (ENV.reducedMotion ? 0.45 : 1);
    U.uTime.value = clock.time;
    stage.sample(deltaMs);
    writeDom();
    if (!active) return;
    world.caustics.render();
    const lock = Boolean(debug?.lock);
    rig.update({
      descent: state.descent,
      push: ENV.reducedMotion ? 0 : state.push,
      settle: ui.settle,
      time: clock.time,
      reduced: ENV.reducedMotion,
      lock,
    });
    world.sky.position.copy(stage.camera.position);
    const mode = lock ? debug.photoMode() : PHOTO_MODES.dissolve;
    world.photo.update(stage.camera, stage.width, stage.height, state.cut, mode, debug?.overlay ?? 0);
    stage.render();
  };

  // ── primer fotograma listo antes de quitar el loader ──
  rig.update({ settle: ui.settle });
  await stage.compile();
  await fontsReady;
  if (!photo) refreshPhoto();
  stage.render();
  gsap.ticker.add(tick);
  await hideLoader(t0);

  // aterrizaje suave de la cámara + la frase de la intro palabra a palabra
  gsap.to(ui, { settle: 0, duration: 3.2, ease: 'power2.out' });
  gsap.to(ui, { introReveal: 1, duration: 2.2, ease: 'none', delay: 0.55 });
  gsap.to(ui, { tap: gestured ? 0 : 1, duration: 1.2, delay: 2.2 });
  // primera ola de cáusticas desde la concha, como si respirara
  setTimeout(() => world.ripples.add(0, 0.2, 0.8), 900);

  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) ScrollTrigger.refresh();
  });
  if (ENV.debug) window.__cc = { ...(window.__cc || {}), state, ui, stage, PALETTE };
};

boot().catch((err) => {
  console.error('[casa-caracol]', err);
  startWithoutGL();
});
