import * as THREE from 'three';
import gsap from 'gsap';
import { createLoader } from './loader.js';
import { createLights } from './lights.js';
import { buildScene } from './scene.js';
import { createCameraPath } from './camera-path.js';
import { createParallax } from './parallax.js';
import { createPost } from './post.js';
import { detectTier, createAdaptiveResolution } from './quality.js';
import { ROOM } from './layout.js';
import { PROJECTS } from './content.js';
import { createOverlay, pickLang } from './overlay.js';
import { createGallery } from './gallery.js';
import { createGuide } from './guide.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('is-loading');

const quality = detectTier();
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !quality.post, // con il post-processing l'MSAA è nel render target
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0xd9a5a0, 1);
quality.gpu = quality.gpu || 'n/d';

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
camera.layers.enable(1);
const loader = createLoader({ reducedMotion });
const lights = createLights({ shadowInt: quality.shadowInt });
const path = createCameraPath(camera, { reducedMotion, projects: PROJECTS.length });

// scroll guidato: ogni gesto porta alla sosta successiva (divani, lucernario, bolle, contatti)
let overlay = null;
const guide = createGuide({
  stops: path.story.stops,
  units: path.story.total,
  setProgress: path.setProgress,
  reducedMotion,
  onChange: (i, moving, last) => overlay?.setStop(i, moving, last),
});

// testi, lingua, galleria dei progetti
const overlayRoot = document.getElementById('overlay');
const lang = pickLang();
const gallery = createGallery(document.body, {
  lang,
  onOpen: () => guide.setEnabled(false),
  onClose: () => guide.setEnabled(true),
});
overlay = createOverlay(overlayRoot, path.story.sections, {
  lang,
  onLang: (l) => gallery.setLang(l),
  onNext: () => guide.next(),
  onOpen: (i) => gallery.open(i),
});
// ?notext: scena senza testi (verifica automatica dei colori del 3D)
const noText = new URLSearchParams(location.search).has('notext');
if (noText) overlayRoot.style.display = 'none';
// ?still: telecamera senza parallasse (test automatici)
const still = new URLSearchParams(location.search).has('still');
const parallax = createParallax({ enabled: !reducedMotion && !still });
const post = quality.post ? createPost(renderer, { samples: quality.msaa, bloom: true, reducedMotion }) : null;
const adaptive = createAdaptiveResolution(renderer, quality, () => resize());

// Campo visivo: in verticale (telefono) si allarga per mantenere un'inquadratura orizzontale minima
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  post?.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  const minHFov = THREE.MathUtils.degToRad(44);
  const vFromH = 2 * Math.atan(Math.tan(minHFov / 2) / camera.aspect);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(THREE.MathUtils.degToRad(46), vFromH)), 46, 78);
  camera.updateProjectionMatrix();
  path.setFraming(camera.fov, camera.aspect, h);
}
new ResizeObserver(resize).observe(canvas);
resize();

// il riflesso dell'edificio sul mare serve solo dalla terrazza (davanti al muro il mare non si vede)
const seaInView = (p) => p.z < ROOM.z0 + 0.2;

// Statistiche per i test (window.__stats): fps medi, draw call, triangoli
const stats = { frames: 0, time: 0, fps: 0, calls: 0, triangles: 0, dpr: adaptive.dpr, tier: quality.tier, gpu: quality.gpu };
window.__stats = stats;

async function start() {
  const world = await buildScene({ renderer, lights, quality, loader, projects: PROJECTS, bubbles: path.story.bubbles });
  const { scene } = world;
  let time = 0;

  const render = () => {
    world.sea.renderReflection(renderer, scene, camera, seaInView(camera.position), quality.reflectionScale);
    if (post) post.render(scene, camera, time);
    else renderer.render(scene, camera);
  };

  // prima posizione e compilazione degli shader dietro al loader (anche quelli sott'acqua)
  path.setProgress(0);
  const first = path.update(1, parallax.value);
  lights.uniforms.uExposure.value = first.exposure;
  world.update(camera, adaptive.dpr);
  renderer.setRenderTarget(post ? post.rtScene : null);
  world.underwater.group.visible = true;
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);
  world.update(camera, adaptive.dpr);
  render();

  // bolle dei progetti: quella sotto il puntatore si accende; un clic (o un tocco) apre la galleria
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let bubblesOn = false, hover = -1;
  const pick = (x, y) => {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(world.underwater.bubbles, false)[0];
    return hit ? world.underwater.bubbles.indexOf(hit.object) : -1;
  };
  const setHover = (i) => {
    if (i === hover) return;
    hover = i;
    overlay.setHover(i);
    canvas.style.cursor = i >= 0 ? 'pointer' : '';
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const overUi = e.target.closest?.('.ui, .gallery, a, button');
    setHover(bubblesOn && !gallery.isOpen && !overUi ? pick(e.clientX, e.clientY) : -1);
  });
  window.addEventListener('click', (e) => {
    if (!bubblesOn || gallery.isOpen || e.target.closest?.('a, button, .gallery')) return;
    const i = pick(e.clientX, e.clientY);
    if (i >= 0) gallery.open(i);
  });

  renderer.info.autoReset = false;
  let last = performance.now() / 1000;
  const clock0 = last;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(() => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;
    time = now - clock0;
    renderer.info.reset();
    parallax.update(dt, time);
    const { exposure, p } = path.update(dt, parallax.value);
    lights.uniforms.uExposure.value = exposure;
    lights.update(time);
    bubblesOn = overlay.update(p);
    if (!bubblesOn && hover >= 0) setHover(-1);
    const focus = gallery.isOpen ? gallery.project : hover;
    world.update(camera, adaptive.dpr, time, focus);
    overlay.placeLabels(camera, world.underwater.bubbles, window.innerWidth, window.innerHeight);
    render();
    adaptive.sample(dt);

    stats.frames++;
    stats.time += dt;
    if (stats.time >= 1) {
      stats.fps = Math.round(stats.frames / stats.time);
      stats.frames = 0;
      stats.time = 0;
    }
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    stats.dpr = adaptive.dpr;
    stats.u = path.state.u;
    stats.p = p;
  });

  window.__sections = path.story.sections;
  // hook di test: salta a un punto del percorso senza smorzamento
  window.__jump = (p) => {
    guide.jump(p);
    path.state.u = path.state.target;
  };
  window.__stops = path.story.stops;
  window.__gallery = gallery;
  window.__overlay = overlay;
  // maschera dei cuscini (magenta, senza bloom e grana) per il controllo automatico dei colori
  window.__mask = (on) => {
    world.cushions.material.uniforms.uMask.value = on ? 1 : 0;
    for (const m of Object.values(world.meshes)) m.material.uniforms.uMask.value = on ? 1 : 0;
    world.beam.userData.maskHidden = world.dust.userData.maskHidden = on;
    if (post) {
      post.uniforms.uBloom.value = on ? 0 : 0.3;
      post.uniforms.uGrain.value = on ? 0 : 0.022;
      post.uniforms.uVignette.value = on ? 0 : 0.16;
    }
  };

  await loader.finish();
  document.documentElement.classList.remove('is-loading');
  guide.setEnabled(true);
  parallax.enable(2.5);
  window.__ready = true;
}

start().catch((err) => {
  console.error(err);
  window.__error = String(err && err.stack ? err.stack : err);
});
