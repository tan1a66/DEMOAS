// Arranque de la escena WebGL: renderer, bucle, suavizado del cielo y rendimiento.
// Se carga con import() dinámico: si no hay WebGL, three.js ni se descarga.

import * as THREE from 'three';
import { QUALITY, REDUCED_MOTION } from './config.js';
import { sunPosition, moonPosition } from './sun.js';
import { paletteAt, COLOR_KEYS } from './palette.js';
import { createScene, skyDirection, LIGHT_AZIMUTH_SCALE } from './scene/index.js';
import { createPost } from './scene/post.js';
import { CameraRig } from './camera.js';
import { INTRO_END, STAGES } from './intro.js';

/** Acerca la paleta mostrada a la paleta objetivo (transiciones lentísimas). */
function blendPalette(cur, target, k) {
  for (const key of Object.keys(target)) {
    if (COLOR_KEYS.includes(key)) {
      for (let i = 0; i < 3; i++) cur[key][i] += (target[key][i] - cur[key][i]) * k;
    } else {
      cur[key] += (target[key] - cur[key]) * k;
    }
  }
}

export async function startWebGL({ canvas, clock, ui, onFirstFrame, onFail }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // el MSAA lo pone el render target del composer
    stencil: false,
    powerPreference: 'high-performance',
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // respeta los tonos de marca mejor que ACES
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // la escena es estática: solo se rehace si el sol se mueve

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onFail?.();
  });

  const world = createScene(QUALITY);
  const rig = new CameraRig();
  const post = createPost(renderer, world.scene, rig.camera, { ...QUALITY, hideFromAO: [world.sky.mesh, ...world.casona.fire.transparent] });

  // ---------------------------------------------------------------- tamaño
  // El lienzo mide 100lvh: no cambia al aparecer/desaparecer la barra del navegador en móvil.
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    post.setSize(w, h, pixelRatio);
    rig.resize(w, h);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------------------------------------------------------------- película de entrada
  // Cocina → patio → cielo → terraza (intro.js). ?intro=0 la salta; R la repite.
  const timer = new THREE.Timer();
  const freezeAt = parseFloat(new URLSearchParams(location.search).get('introAt')); // depuración: congela la toma
  const intro = {
    skip: REDUCED_MOTION || new URLSearchParams(location.search).get('intro') === '0',
    start: null, // segundos del timer en que empieza (al quitarse el loader)
    done: {},
    running: false,
    time(t) {
      if (this.skip) return INTRO_END;
      if (Number.isFinite(freezeAt)) return freezeAt;
      if (this.start === null) return 0;
      return t - this.start;
    },
    play() {
      ui.stage('reset');
      this.done = {};
      this.skip = false;
      this.running = true;
      this.start = timer.getElapsed();
      if (clock.mode === 'timelapse') clock.tl.start = null; // el cielo espera a la película
    },
    finish() {
      this.start = timer.getElapsed() - INTRO_END;
    },
    stages(t) {
      if (this.skip || this.start === null) return;
      const it = this.time(t);
      for (const [name, at] of Object.entries(STAGES)) {
        if (!this.done[name] && it >= at) {
          this.done[name] = true;
          ui.stage(name);
          if (name === 'done') clock.startTimelapse();
        }
      }
      if (it >= INTRO_END) this.running = false;
    },
  };
  addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !REDUCED_MOTION && !e.target.closest?.('input, textarea')) {
      scrollTo({ top: 0, behavior: 'instant' });
      intro.play();
    }
  });
  document.getElementById('slider-intro')?.addEventListener('click', () => {
    if (!REDUCED_MOTION) intro.play();
  });

  // ---------------------------------------------------------------- scroll
  const hero = document.getElementById('hero');
  let covered = false;
  const onScroll = () => {
    const h = hero.offsetHeight || innerHeight;
    rig.scroll = Math.min(1, Math.max(0, scrollY / h));
    // Cuando la sección de la cocina tapa todo el lienzo, dejamos de dibujar.
    covered = scrollY > h + 80;
    // Si alguien baja durante la película, la terminamos al momento.
    if (scrollY > 60 && intro.running) intro.finish();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------------------------------------------------------------- estado del cielo
  const state = {
    palette: null,
    sunDir: new THREE.Vector3(),
    lightDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    moon: { fraction: 0.5, phase: 0.5 },
    time: 0,
  };
  const targetSun = new THREE.Vector3();
  const targetLight = new THREE.Vector3();
  const targetMoon = new THREE.Vector3();

  const step = (dt, snap) => {
    const now = clock.now();
    const sp = sunPosition(now);
    const mp = moonPosition(now);
    const target = paletteAt(sp.altitude);
    skyDirection(sp.altitude, sp.azimuth, targetSun);
    skyDirection(sp.altitude, sp.azimuth, targetLight, LIGHT_AZIMUTH_SCALE);
    skyDirection(mp.altitude, mp.azimuth, targetMoon);
    state.moon = mp;

    // Constante de tiempo del suavizado: en tiempo real todo cambia muy despacio; en el
    // timelapse hay que seguir el ritmo; con el control manual, transición de ~1 s.
    const tau = { timelapse: 0.15, manual: 1.1, fixed: 1.5, live: 2.5 }[clock.mode];
    const k = snap ? 1 : 1 - Math.exp(-dt / tau);
    if (!state.palette || snap) {
      state.palette = structuredClone(target);
      state.sunDir.copy(targetSun);
      state.lightDir.copy(targetLight);
      state.moonDir.copy(targetMoon);
    } else {
      blendPalette(state.palette, target, k);
      state.sunDir.lerp(targetSun, k).normalize();
      state.lightDir.lerp(targetLight, k).normalize();
      state.moonDir.lerp(targetMoon, k).normalize();
    }
  };

  // ---------------------------------------------------------------- rendimiento adaptativo
  // Si el dispositivo no llega, bajamos la resolución interna (nunca por debajo de 1).
  const perf = { frames: 0, time: 0, warm: 0 };
  const adapt = (dt) => {
    if (dt > 0.25) return; // pestaña en segundo plano, etc.: no cuenta
    perf.warm += dt;
    if (perf.warm < 2.5) return;
    perf.frames++;
    perf.time += dt;
    if (perf.frames < 90) return;
    const avg = perf.time / perf.frames;
    if (avg > 1 / 40 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      resize();
    }
    perf.frames = 0;
    perf.time = 0;
  };

  // Compila los shaders antes del primer fotograma (evita el tirón inicial).
  step(0, true);
  ui.forceNight = !intro.skip;
  ui.setTone(state.palette.day);
  rig.introT = intro.time(0);
  rig.update(0, 0.016);
  world.update(state, renderer, rig.camera);
  try {
    await renderer.compileAsync(world.scene, rig.camera);
  } catch {
    /* compileAsync no es crítico */
  }

  // ---------------------------------------------------------------- bucle
  let first = true;
  let uiClock = 0;
  const frame = (ts) => {
    requestAnimationFrame(frame);
    timer.update(ts);
    // dt real (hasta 1 s) para las transiciones del cielo: no se ralentizan en equipos lentos;
    // dt recortado para la cámara, que no debe dar saltos.
    const rawDt = Math.min(timer.getDelta(), 1);
    const dt = Math.min(rawDt, 0.1);
    const t = timer.getElapsed();

    uiClock += dt;
    if (uiClock > (clock.mode === 'timelapse' ? 0.05 : 0.5)) {
      ui.update();
      ui.setTone(state.palette.day);
      uiClock = 0;
    }
    if (covered && !first) return;

    step(rawDt, first);
    state.time = REDUCED_MOTION ? 0 : t;
    state.dt = dt;
    intro.stages(t);
    rig.introT = Math.min(intro.time(t), INTRO_END);
    rig.update(t, dt);
    world.update(state, renderer, rig.camera);
    post.render(dt, t);
    adapt(rawDt);

    if (first) {
      first = false;
      // La película arranca cuando el loader empieza a desaparecer.
      Promise.resolve(onFirstFrame?.()).then(() => {
        if (scrollY > innerHeight * 0.5) intro.skip = true; // ya estaba más abajo: sin película
        if (intro.skip) {
          ui.reveal();
          clock.startTimelapse();
        } else {
          intro.play();
        }
      });
    }
  };
  requestAnimationFrame(frame);
  clock.onChange(() => ui.update());

  // Acceso para depurar desde la consola.
  window.__picheta = { clock, renderer, world, rig, state, intro };
}
