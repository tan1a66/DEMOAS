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
import { QUALITY, ADAPTIVE, SCULPT, DOCTOR_SPIN } from './config.js';
import { LIGHTS } from './drone-path.js';
import { applyStaticTexts, setLang, onLangChange } from './i18n.js';
import { initScroll, measure, resolveAnchor, scrollFraction, currentChapter, getChapters, getLenis, gsap, ScrollTrigger } from './core/scroll.js';
import { createStage } from './three/stage.js';
import { loadModel, createStatue } from './three/statue.js';
import { createSculptBlock } from './three/fragments.js';
import { createDust } from './three/dust.js';
import { Drone, resolveShot } from './three/drone.js';
import { DepthOfField } from './three/post.js';
import { marbleUniforms, chipUniforms } from './three/materials.js';
import { renderAllTitles, createLayer } from './ui/text.js';
import { createLoader } from './ui/loader.js';
import { bindWhatsApp } from './ui/whatsapp.js';
import { createProcedures } from './ui/procedures.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const ADAPT = !params.has('noadapt');
const reducedMotion = params.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dispositivo: decide il modello e il numero di frammenti (una volta sola)
const coarse = matchMedia('(pointer: coarse)').matches;
const smallScreen = Math.min(screen.width, screen.height) < 820;
const quality = QUALITY[params.get('quality')] || (coarse && smallScreen ? QUALITY.mobile : QUALITY.desktop);
const lowQuality = quality === QUALITY.mobile;
// Inquadrature "da telefono": dipendono dalla forma della finestra
const portraitLayout = () => window.innerWidth < 820 || window.innerWidth / window.innerHeight < 0.85;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * In che punto dello scolpire (0..1) finisce il capitolo 01: lì deve essere
 * sparito il blocco grezzo e restare la figura sbozzata. Calcolato dalle
 * altezze dei capitoli in CSS, prima che lo scroll sia pronto.
 */
function sculptFractionAtEndOfValoracion() {
  const h = (id) => document.querySelector(`[data-chapter="${id}"]`).offsetHeight;
  const at = (a) => {
    const [id, p] = a.split(':');
    const order = [...document.querySelectorAll('[data-chapter]')].map((el) => el.dataset.chapter);
    let y = 0;
    for (const c of order) {
      if (c === id) return y + h(c) * Number(p);
      y += h(c);
    }
    return y;
  };
  const start = at(SCULPT.start), end = at(SCULPT.end), mid = at('valoracion:1');
  return Math.min(0.8, Math.max(0.2, (mid - start) / (end - start)));
}
const smooth = (t) => t * t * (3 - 2 * t);

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

  const gltf = await loadModel(quality.model, (p) => loader.set(p * 0.62));
  const statue = createStatue(gltf, { physical: quality.physical, lowQuality });
  scene.add(statue.object);
  // macchia d'ombra sotto la statua (gira con lei)
  stage.contact.scale.set(statue.footprint.x, statue.footprint.z, 1);
  stage.contact.position.set(statue.footprint.cx, 0.002, statue.footprint.cz);
  statue.root.add(stage.contact);

  // scroll e drone servono già al blocco (i frammenti "eroi" volano verso la camera)
  initScroll({ smooth: !reducedMotion });
  let mobileLayout = portraitLayout();
  const drone = new Drone(camera, { mobile: mobileLayout, reducedMotion });
  const sculptSpan = [resolveAnchor(SCULPT.start), resolveAnchor(SCULPT.end)];

  // blocco da scolpire + polvere
  chipUniforms.uFall.value = SCULPT.fallDuration;
  const block = await createSculptBlock({
    // dove si trova il drone a un certo avanzamento dello scolpire
    cameraAt: (p) => drone.sample(sculptSpan[0] + p * (sculptSpan[1] - sculptSpan[0])),
    figure: statue.figure,
    meta: statue.meta,
    count: quality.fragments,
    detail: quality.fragmentDetail,
    margin: SCULPT.margin,
    coarseEnd: sculptFractionAtEndOfValoracion(),
    onProgress: (p) => loader.set(0.62 + p * 0.28),
  });
  statue.root.add(block.group);
  const dust = createDust({ chips: block.chips, perFragment: quality.dustPerFragment, fall: SCULPT.fallDuration, motes: quality.motes });
  statue.root.add(dust.group);

  // ---------------------------------------------------------------- scroll + drone
  const dof = new DepthOfField(renderer, { samples: lowQuality ? 0 : 4, taps: lowQuality ? 12 : 20 });
  dof.enabled = quality.dof;

  // punti dello scroll di scolpire e luci (ricalcolati se cambia il layout)
  let anchors;
  function computeAnchors() {
    anchors = {
      sculpt: [resolveAnchor(SCULPT.start), resolveAnchor(SCULPT.end)],
      polish: [resolveAnchor(SCULPT.polishStart), resolveAnchor(SCULPT.polishEnd)],
      lights: LIGHTS.map((l) => ({
        s: resolveAnchor(l.at),
        keyAz: l.key.az,
        keyEl: l.key.el,
        keyIntensity: l.key.intensity,
        keyColor: new THREE.Color(l.key.color),
        rim: l.rim.intensity,
        ambient: l.ambient,
        backdrop: l.backdrop,
        shadow: l.shadow ?? 0.3,
      })),
    };
  }
  computeAnchors();

  const lightState = { keyAz: 0, keyEl: 0, keyIntensity: 0, keyColor: new THREE.Color(), rim: 0, ambient: 0, backdrop: 0, shadow: 0.3 };
  function lightsAt(s) {
    const L = anchors.lights;
    let i = 0;
    while (i < L.length - 2 && s > L[i + 1].s) i++;
    const a = L[i], b = L[Math.min(i + 1, L.length - 1)];
    const k = smooth(clamp01((s - a.s) / Math.max(1e-6, b.s - a.s)));
    const lerp = (x, y) => x + (y - x) * k;
    const dAz = ((b.keyAz - a.keyAz + 540) % 360) - 180; // l'angolo più breve
    lightState.keyAz = a.keyAz + dAz * k;
    lightState.keyEl = lerp(a.keyEl, b.keyEl);
    lightState.keyIntensity = lerp(a.keyIntensity, b.keyIntensity);
    lightState.keyColor.copy(a.keyColor).lerp(b.keyColor, k);
    lightState.rim = lerp(a.rim, b.rim);
    lightState.ambient = lerp(a.ambient, b.ambient);
    lightState.backdrop = lerp(a.backdrop, b.backdrop);
    lightState.shadow = lerp(a.shadow, b.shadow);
    return lightState;
  }

  let debug = null; // pannello ?debug (creato più sotto)

  // ---------------------------------------------------------------- dimensioni
  const size = { w: 1, h: 1 };
  let pxScale = 800;
  function resize() {
    size.w = canvas.clientWidth || window.innerWidth;
    size.h = canvas.clientHeight || window.innerHeight;
    stage.setSize(size.w, size.h, pixelRatio);
    camera.aspect = size.w / size.h;
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    dof.setSize(db.x, db.y);
    pxScale = db.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
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
  const procedures = createProcedures({ statue, drone, reducedMotion, veil });
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

  // ---------------------------------------------------------------- shader pronti prima di mostrare
  loader.set(0.93);
  drone.update({ scroll: 0, dt: 0, time: 0 });
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }

  // ---------------------------------------------------------------- frame
  let elapsed = 0;
  let lastChapter = null;
  let override = null; // inquadratura fissa (reduced motion)
  let rmSculpt = 0;
  let testShot = null; // inquadratura forzata dai test automatici
  const fpsMon = { acc: 0, frames: 0, warm: 0 };
  const target = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  function tick(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    elapsed += dt;
    marbleUniforms.uTime.value = elapsed;
    stage.bgUniforms.uTime.value = elapsed;

    const s = scrollFraction();
    const ch = currentChapter();

    // --- scolpire e levigare ---
    const sculptRaw = (s - anchors.sculpt[0]) / (anchors.sculpt[1] - anchors.sculpt[0]);
    let sculpt = clamp01(sculptRaw);
    let polish = smooth(clamp01((s - anchors.polish[0]) / (anchors.polish[1] - anchors.polish[0])));
    if (reducedMotion) {
      // nessun volo: inquadratura e stato fissi per capitolo, cambiati sotto una dissolvenza
      if (ch.id !== lastChapter) {
        const first = lastChapter === null;
        const apply = () => {
          override = drone.chapterShot(ch.id);
          rmSculpt = { hero: 0, valoracion: 0.42 }[ch.id] ?? 1;
        };
        first ? apply() : veil(apply);
      }
      sculpt = rmSculpt;
      polish = rmSculpt >= 1 ? 1 : 0;
    }
    block.setProgress(sculpt);
    statue.setPolish(polish);

    // --- la statua finita ruota piano in 03 · El doctor ---
    if (!reducedMotion) {
      const w = ch.id === 'doctor' ? Math.sin(Math.PI * ch.progress) : 0;
      statue.setSpin(THREE.MathUtils.degToRad(DOCTOR_SPIN.degrees * w + Math.sin(elapsed * 0.22) * 2.5 * w));
    }

    // --- procedure: punti cliccabili e voli solo nel capitolo 04 ---
    procedures.setEnabled(ch.id === 'procedimientos' && ch.progress > 0.06);
    lastChapter = ch.id;

    // --- camera ---
    const idle = ch.id === 'hero' ? 1 - ch.progress * 0.6 : 0;
    const cam = drone.update({ scroll: s, dt, time: elapsed, idle, override: testShot || (reducedMotion ? override : null) });

    // --- luci e sfondo ---
    stage.applyLights(lightsAt(s), cam.position);
    target.copy(cam.target);
    ndc.copy(target).project(camera);
    stage.bgUniforms.uCenter.value.set(ndc.x, ndc.y);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    stage.bgUniforms.uRadius.value = THREE.MathUtils.clamp(1.35 / (cam.focus * tanHalf), 0.62, 1.55);

    // --- polvere ---
    const dofAmount = cam.dof;
    const motes = 0.45 + 0.55 * (ch.id === 'hero' ? 1 - ch.progress : 0) + (ch.id === 'final' ? 0.35 : 0);
    // la polvere usa l'avanzamento non limitato: gli ultimi sbuffi si posano davvero
    dust.update({ time: elapsed, progress: reducedMotion ? sculpt * 1.5 : Math.max(sculptRaw, 0), pxScale, focus: cam.focus, aperture: dofAmount, motesAmount: motes });

    procedures.update(camera, size.w, size.h);

    // --- disegno ---
    const viewCam = debug ? debug.camera : camera;
    dof.render(scene, viewCam, debug && viewCam !== camera ? 0 : dofAmount, cam.focus);

    // --- qualità adattiva: prima via la profondità di campo, poi meno pixel ---
    if (ADAPT && !debug?.overview) {
      fpsMon.warm += dt;
      if (fpsMon.warm > 3) {
        fpsMon.acc += dt;
        fpsMon.frames++;
        if (fpsMon.acc >= ADAPTIVE.sampleSeconds) {
          const fps = fpsMon.frames / fpsMon.acc;
          if (fps < ADAPTIVE.minFps) {
            if (dof.enabled && dofAmount > 0.05) dof.enabled = false;
            else if (pixelRatio > ADAPTIVE.minPixelRatio) {
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
      scroll: s,
      chapter: ch.id,
      chapterProgress: ch.progress,
      sculpt,
      polish,
      fragments: block.count,
      dofOn: dof.enabled && dofAmount > 0.02,
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
    block,
    stage,
    jump(anchor) {
      const y = resolveAnchor(anchor) * (document.documentElement.scrollHeight - innerHeight);
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      drone.initialized = false; // la camera salta subito al punto, senza smorzamento
      ScrollTrigger.update();
    },
    /** prova un'inquadratura: { target, az, el, dist, shift, dof } (null = percorso) */
    shot(s) {
      if (!s) return (testShot = null);
      const r = resolveShot(s, mobileLayout);
      testShot = { pos: r.pos, target: r.target, shift: new THREE.Vector2(...r.shift), dof: r.dof, fov: r.fov };
    },
  };
}
