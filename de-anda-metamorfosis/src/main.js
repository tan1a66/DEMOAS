// =============================================================================
//  main.js — mette insieme scena, scroll, testi e interazioni
// =============================================================================
//  Parametri utili nell'indirizzo:
//    ?debug              percorso del drone, zone, fps (tasto O: vista dall'alto)
//    ?quality=mobile     forza la versione leggera (o =desktop)
//    ?lang=en            lingua iniziale
//    ?reduced            simula prefers-reduced-motion

import './styles.css';
import * as THREE from 'three';
import { QUALITY, ADAPTIVE, POLISH, DOCTOR_SPIN } from './config.js';
import { ATMOSPHERES } from './drone-path.js';
import { applyStaticTexts, setLang, onLangChange } from './i18n.js';
import { initScroll, measure, resolveAnchor, scrollFraction, currentChapter, getChapters, getLenis, gsap, ScrollTrigger } from './core/scroll.js';
import { createStage } from './three/stage.js';
import { createTemple, LAYOUT } from './three/temple.js';
import { loadModel, createStatue } from './three/statue.js';
import { modelUrl } from './three/model-source.js';
import { createDust } from './three/dust.js';
import { Drone, resolveShot } from './three/drone.js';
import { PostFX } from './three/post.js';
import { marbleUniforms } from './three/materials.js';
import { renderAllTitles, createLayer } from './ui/text.js';
import { createLoader } from './ui/loader.js';
import { bindWhatsApp } from './ui/whatsapp.js';
import { createProcedures } from './ui/procedures.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const ADAPT = !params.has('noadapt');
const reducedMotion = params.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dispositivo: decide il modello e la qualità (una volta sola)
const coarse = matchMedia('(pointer: coarse)').matches;
const smallScreen = Math.min(screen.width, screen.height) < 820;
const quality = QUALITY[params.get('quality')] || (coarse && smallScreen ? QUALITY.mobile : QUALITY.desktop);
const lowQuality = quality === QUALITY.mobile;
// Inquadrature "da telefono": dipendono dalla forma della finestra
const portraitLayout = () => window.innerWidth < 820 || window.innerWidth / window.innerHeight < 0.85;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const deg = THREE.MathUtils.degToRad;

boot().catch((err) => {
  console.error(err);
  document.getElementById('loader')?.classList.add('is-error');
});

async function boot() {
  // si parte sempre dall'inizio del racconto
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // ---------------------------------------------------------------- testi
  applyStaticTexts();
  renderAllTitles();
  bindWhatsApp();
  const loader = createLoader();

  // foto del dottore: se manca public/img/doctor.jpg resta un segnaposto elegante
  const portrait = document.querySelector('.portrait');
  const photo = portrait?.querySelector('img');
  const noPhoto = () => portrait.classList.add('no-photo');
  if (photo) {
    photo.addEventListener('error', noPhoto);
    if (photo.complete && !photo.naturalWidth) noPhoto();
  }

  // ---------------------------------------------------------------- scena
  const canvas = document.getElementById('scene');
  const stage = createStage(canvas, quality);
  const { renderer, scene, camera } = stage;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);

  const temple = createTemple({ quality });
  scene.add(temple.group);
  loader.set(0.1);

  const gltf = await loadModel(modelUrl(quality, lowQuality), (p) => loader.set(0.1 + p * 0.7));
  const statue = createStatue(gltf, { physical: quality.physical, lowQuality });
  scene.add(statue.object);
  const dust = createDust({ motes: quality.motes });
  scene.add(dust.object);

  // ---------------------------------------------------------------- scroll + drone
  initScroll({ smooth: !reducedMotion });
  let mobileLayout = portraitLayout();
  // le zone della statua in coordinate del mondo: diventano soste del drone (04)
  statue.object.updateMatrixWorld(true);
  const zonesWorld = Object.fromEntries(statue.zones.map((z) => [z.id, { center: statue.toWorld(z.center), cam: z.cam, mobile: z.mobile }]));
  const drone = new Drone(camera, { mobile: mobileLayout, reducedMotion, zones: zonesWorld });
  const post = new PostFX(renderer, { samples: lowQuality ? 0 : 4, taps: lowQuality ? 12 : 20, volumetric: quality.volumetric });
  post.dofEnabled = quality.dof;
  temple.setBeamPlanes(!quality.volumetric);

  // punti dello scroll della levigatura e delle atmosfere (ricalcolati se cambia il layout)
  let anchors;
  const col = (hex) => new THREE.Color(hex);
  function computeAnchors() {
    anchors = {
      polish: [resolveAnchor(POLISH.start), resolveAnchor(POLISH.end)],
      atm: ATMOSPHERES.map((a) => ({
        s: resolveAnchor(a.at),
        sunAz: a.sun.az, sunEl: a.sun.el, sunIntensity: a.sun.intensity, sunColor: col(a.sun.color),
        zenith: col(a.sky.zenith), horizon: col(a.sky.horizon), sea: col(a.sky.sea || '#4c7f9c'),
        ambient: a.ambient, fill: a.fill, fog: a.fog, mist: a.mist,
        gobo: a.gobo, goboAz: a.goboAz, goboEl: a.goboEl,
        open: a.curtains.open, wind: a.curtains.wind, beams: a.beams, moon: a.moon,
      })),
    };
  }
  computeAnchors();

  // stato dell'atmosfera interpolato
  const atm = {
    sunDir: new THREE.Vector3(), sunIntensity: 0, sunColor: new THREE.Color(),
    zenith: new THREE.Color(), horizon: new THREE.Color(), sea: new THREE.Color(),
    ambient: 0, fill: 0, fog: 0, mist: 0, gobo: 0, goboAz: 0, goboEl: 0, open: 0, wind: 0, beams: 0, moon: 0,
  };
  const NUM = ['sunIntensity', 'ambient', 'fill', 'fog', 'mist', 'gobo', 'goboAz', 'goboEl', 'open', 'wind', 'beams', 'moon'];
  function atmosphereAt(s) {
    const L = anchors.atm;
    let i = 0;
    while (i < L.length - 2 && s > L[i + 1].s) i++;
    const a = L[i], b = L[Math.min(i + 1, L.length - 1)];
    const k = smooth(clamp01((s - a.s) / Math.max(1e-6, b.s - a.s)));
    for (const key of NUM) atm[key] = a[key] + (b[key] - a[key]) * k;
    const az = deg(a.sunAz + (((b.sunAz - a.sunAz + 540) % 360) - 180) * k);
    const el = deg(a.sunEl + (b.sunEl - a.sunEl) * k);
    atm.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    atm.sunColor.copy(a.sunColor).lerp(b.sunColor, k);
    atm.zenith.copy(a.zenith).lerp(b.zenith, k);
    atm.horizon.copy(a.horizon).lerp(b.horizon, k);
    atm.sea.copy(a.sea).lerp(b.sea, k);
    return atm;
  }

  // ---------------------------------------------------------------- dimensioni
  let debug = null; // pannello ?debug (creato più sotto)
  const size = { w: 1, h: 1 };
  let pxScale = 800;
  function resize() {
    size.w = canvas.clientWidth || window.innerWidth;
    size.h = canvas.clientHeight || window.innerHeight;
    stage.setSize(size.w, size.h, pixelRatio);
    camera.aspect = size.w / size.h;
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    post.setSize(db.x, db.y);
    temple.water.getRenderTarget().setSize(Math.round(db.x * quality.reflection), Math.round(db.y * quality.reflection));
    pxScale = db.y / (2 * Math.tan(deg(camera.fov) / 2));
    if (portraitLayout() !== mobileLayout) {
      mobileLayout = portraitLayout();
      drone.mobile = mobileLayout;
      drone.build();
      debug?.rebuild();
    }
  }
  resize();
  // su telefono la barra del browser che appare/sparisce cambia solo l'altezza
  // della finestra: il canvas (100lvh) non cambia e non serve ricalcolare nulla
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (coarse && w === lastW && Math.abs(h - lastH) < 160) return;
    lastW = w;
    lastH = h;
    resize();
    ScrollTrigger.refresh();
  });
  ScrollTrigger.addEventListener('refresh', () => {
    measure();
    computeAnchors();
    drone.build();
  });

  // ---------------------------------------------------------------- dissolvenza (reduced motion)
  const veilEl = document.querySelector('.veil');
  function veil(fn) {
    gsap.timeline()
      .to(veilEl, { autoAlpha: 1, duration: 0.28, ease: 'power1.in' })
      .add(fn)
      .to(veilEl, { autoAlpha: 0, duration: 0.6, ease: 'power1.out' });
  }

  // ---------------------------------------------------------------- testi e procedure
  const procedures = createProcedures({ statue, reducedMotion });
  const layers = [...document.querySelectorAll('[data-layer]')].map((el) => ({ el, layer: createLayer(el, { reducedMotion }) }));

  onLangChange(() => {
    renderAllTitles();
    layers.forEach(({ layer }) => layer.refresh());
    bindWhatsApp();
    procedures.renderTexts();
  });
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  document.querySelector('.monogram').addEventListener('click', (e) => {
    e.preventDefault();
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0, { duration: 2.4 });
    else window.scrollTo(0, 0);
  });

  /** Ogni livello di testo è visibile in una finestra del suo capitolo (data-window) */
  function createTextTriggers() {
    layers.forEach(({ el, layer }) => {
      const chapterId = el.dataset.layer.split('.')[0];
      const [a, b] = el.dataset.window.split(',').map(Number);
      const range = () => getChapters().find((c) => c.id === chapterId);
      ScrollTrigger.create({
        start: () => {
          const c = range();
          return a <= 0 && c.start === 0 ? -1 : c.start + (c.end - c.start) * a;
        },
        end: () => {
          const c = range();
          return c.start + (c.end - c.start) * b + (b >= 1 && c.end >= document.documentElement.scrollHeight - innerHeight - 1 ? 100 : 0);
        },
        onToggle: (self) => (self.isActive ? layer.show() : layer.hide()),
      });
    });
    // "Desliza para descubrir": entra dopo il titolo, sparisce appena si scorre
    const hint = document.querySelector('.scroll-hint');
    gsap.to(hint, { autoAlpha: 1, duration: 1.2, delay: 1.4, ease: 'power2.out' });
    ScrollTrigger.create({
      start: 40,
      onEnter: () => gsap.to(hint, { autoAlpha: 0, duration: 0.6, overwrite: true }),
      onLeaveBack: () => gsap.to(hint, { autoAlpha: 1, duration: 0.6, overwrite: true }),
    });
  }

  // ---------------------------------------------------------------- debug
  if (DEBUG) {
    const { createDebug } = await import('./three/debug.js');
    debug = createDebug({ scene, camera, renderer, drone, statue });
  }

  // ---------------------------------------------------------------- prima immagine
  loader.set(0.86);
  drone.update({ scroll: 0, dt: 0, time: 0 });
  let envSky = -1; // ultimo stato del cielo usato per i riflessi
  function refreshEnvironment(s) {
    // i riflessi del marmo seguono il cielo: ricalcolati solo a scatti (costa)
    const step = Math.round(s * 12);
    if (step === envSky) return;
    envSky = step;
    stage.bakeEnvironment(temple.sky.mesh);
  }
  atmosphereAt(0);
  temple.update({ time: 0, sunDir: atm.sunDir, sky: atm, mist: atm.mist, wind: atm.wind, open: atm.open, beams: atm.beams, moon: atm.moon, sunColor: atm.sunColor, cameraPos: camera.position });
  refreshEnvironment(0);
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }
  loader.set(0.96);

  // ---------------------------------------------------------------- frame
  let elapsed = 0;
  let lastChapter = null;
  let override = null; // inquadratura fissa (reduced motion)
  let rmScroll = 0; // con reduced motion l'atmosfera salta da un capitolo all'altro
  let testShot = null; // inquadratura forzata dai test automatici
  const fpsMon = { acc: 0, frames: 0, warm: 0 };

  // ---------------------------------------------------------------- work in progress: nell'acqua
  //  Il clic su un pulsante (DEMO_MODE) apre il velo "Work in progress": la
  //  camera scende nella vasca e si ferma a pelo d'acqua. Scroll fermo finché
  //  il velo è aperto; alla chiusura la camera risale al suo punto del racconto.
  let diving = false;
  let underAmount = 0;
  const waterColor = new THREE.Color();
  const waterBase = new THREE.Color('#3d8aa3');
  window.addEventListener('wip:open', () => {
    if (diving) return;
    diving = true;
    drone.setDive(true);
    getLenis()?.stop();
    document.documentElement.classList.add('is-diving');
  });
  window.addEventListener('wip:close', () => {
    if (!diving) return;
    diving = false;
    drone.setDive(false);
    getLenis()?.start();
    document.documentElement.classList.remove('is-diving');
  });

  function tick(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    elapsed += dt;
    marbleUniforms.uTime.value = elapsed;

    const sReal = scrollFraction();
    const ch = currentChapter();
    if (reducedMotion && ch.id !== lastChapter) {
      const first = lastChapter === null;
      const apply = () => {
        override = drone.chapterShot(ch.id);
        const c = getChapters().find((x) => x.id === ch.id);
        rmScroll = c ? (c.start + (c.end - c.start) * 0.7) / Math.max(1, document.documentElement.scrollHeight - innerHeight) : sReal;
      };
      first ? apply() : veil(apply);
    }
    const s = reducedMotion ? rmScroll : sReal;

    // --- la luce sale, il marmo si leviga ---
    atmosphereAt(s);
    const polish = smooth(clamp01((s - anchors.polish[0]) / (anchors.polish[1] - anchors.polish[0])));
    statue.setPolish(polish);

    // --- la statua ruota piano in 03 · El doctor ---
    if (!reducedMotion) {
      const w = ch.id === 'doctor' ? Math.sin(Math.PI * ch.progress) : 0;
      statue.setSpin(deg(DOCTOR_SPIN.degrees * w + Math.sin(elapsed * 0.22) * 2 * w));
    }

    // --- procedure: la zona accesa dipende dallo scroll nel capitolo 04 ---
    procedures.update(ch.id, ch.progress, dt);
    lastChapter = ch.id;

    // --- camera ---
    const idle = ch.id === 'hero' && !diving ? 1 - ch.progress * 0.6 : 0;
    const rmShot = reducedMotion ? (diving ? drone.dive : override) : null;
    const cam = drone.update({ scroll: sReal, dt, time: elapsed, idle, override: testShot || rmShot });
    // quanto la camera è vicina al pelo dell'acqua (0 = lontana, 1 = dentro)
    const waterY = LAYOUT.POOL.water;
    underAmount = clamp01((waterY + 0.6 - cam.position.y) / 0.6);
    temple.setUnderwater(underAmount);

    // --- atmosfera: cielo, acqua, tende, raggi, nebbia, luci ---
    temple.update({
      time: elapsed, sunDir: atm.sunDir, sky: atm, mist: atm.mist, wind: atm.wind, open: atm.open,
      beams: atm.beams, moon: atm.moon, sunColor: atm.sunColor, cameraPos: cam.position,
    });
    stage.applyLights(
      {
        sunDir: atm.sunDir, sunIntensity: atm.sunIntensity, sunColor: atm.sunColor, gobo: atm.gobo,
        goboAz: atm.goboAz, goboEl: atm.goboEl, fill: atm.fill, ambient: atm.ambient, fog: atm.fog, horizon: atm.horizon,
      },
      cam.position,
      elapsed
    );
    refreshEnvironment(s);

    // --- polvere nella luce ---
    const dofAmount = cam.dof;
    dust.update({
      time: elapsed, pxScale, focus: cam.focus, aperture: dofAmount, amount: 0.35 + 0.65 * atm.beams, sunDir: atm.sunDir,
      sun: post.volumetric ? stage.lights.sun : null, cameraPos: cam.position,
    });

    // --- disegno: ombre una volta per frame, poi la scena (con o senza sfocatura) ---
    renderer.shadowMap.needsUpdate = true;
    const viewCam = debug ? debug.camera : camera;
    post.render(scene, viewCam, {
      dof: debug && viewCam !== camera ? 0 : dofAmount,
      focus: cam.focus,
      // raggi di luce: più forti quando il sole è alto e la nebbia si è aperta
      light: { sun: stage.lights.sun, sunDir: atm.sunDir, color: atm.sunColor, amount: atm.beams * Math.min(1, atm.sunIntensity / 2.2) * 0.9 },
      // a pelo d'acqua: l'azzurro dell'acqua prende un po' del colore del sole
      water: underAmount > 0.5 ? { y: waterY, time: elapsed, color: waterColor.copy(waterBase).lerp(atm.sunColor, 0.18).multiplyScalar(0.5 + 0.3 * Math.min(1, atm.sunIntensity / 2.5)) } : null,
    });

    // --- qualità adattiva: prima via la profondità di campo, poi meno pixel ---
    if (ADAPT && !testShot && !diving) {
      fpsMon.warm += dt;
      if (fpsMon.warm > 3) {
        fpsMon.acc += dt;
        fpsMon.frames++;
        if (fpsMon.acc >= ADAPTIVE.sampleSeconds) {
          const fps = fpsMon.frames / fpsMon.acc;
          if (fps < ADAPTIVE.minFps) {
            if (post.dofEnabled && dofAmount > 0.05) post.dofEnabled = false;
            else if (post.volumetric) {
              post.volumetric = false;
              temple.setBeamPlanes(true);
            } else if (pixelRatio > ADAPTIVE.minPixelRatio) {
              pixelRatio = Math.max(ADAPTIVE.minPixelRatio, pixelRatio - 0.25);
              resize();
            }
          }
          fpsMon.acc = 0;
          fpsMon.frames = 0;
        }
      }
    }

    debug?.update(dt, {
      scroll: sReal,
      chapter: ch.id,
      chapterProgress: ch.progress,
      sculpt: atm.sunIntensity,
      polish,
      fragments: 0,
      dofOn: post.dofEnabled && dofAmount > 0.02,
    });
  }

  gsap.ticker.add(tick);
  document.documentElement.classList.add('is-ready');
  await loader.done();
  createTextTriggers();
  ScrollTrigger.refresh();

  // per i test automatici: salto istantaneo a un punto dello scroll
  window.__dda = {
    drone,
    statue,
    stage,
    temple,
    jump(anchor) {
      const y = resolveAnchor(anchor) * (document.documentElement.scrollHeight - innerHeight);
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      drone.initialized = false; // la camera salta subito al punto, senza smorzamento
      ScrollTrigger.update();
    },
    /** apre il "work in progress" con la camera già nell'acqua (senza discesa) */
    dive() {
      document.querySelector('.js-wa')?.click();
      testShot = drone.dive;
    },
    /** prova un'inquadratura: { target, az, el, dist, shift, dof } (null = percorso) */
    shot(s) {
      if (!s) return (testShot = null);
      const r = resolveShot(s, mobileLayout);
      testShot = { pos: r.pos, target: r.target, shift: new THREE.Vector2(...r.shift), dof: r.dof, fov: r.fov };
    },
  };
}
