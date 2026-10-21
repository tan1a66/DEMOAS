import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createLoader } from './loader.js';
import { createLights } from './lights.js';
import { buildScene } from './scene.js';
import { createCameraPath } from './camera-path.js';
import { createParallax } from './parallax.js';
import { createPost } from './post.js';
import { detectTier, createAdaptiveResolution } from './quality.js';
import { ROOM, CEIL_Y } from './layout.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
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
const path = createCameraPath(camera, { reducedMotion });
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
}
new ResizeObserver(resize).observe(canvas);
resize();

// la telecamera è dentro la stanza? (il mare non si vede: niente riflesso da calcolare)
const inside = (p) => p.x > ROOM.x0 && p.x < ROOM.x1 && p.z > ROOM.z0 + 0.2 && p.z < ROOM.z1 - 0.2 && p.y < CEIL_Y;

// Statistiche per i test (window.__stats): fps medi, draw call, triangoli
const stats = { frames: 0, time: 0, fps: 0, calls: 0, triangles: 0, dpr: adaptive.dpr, tier: quality.tier, gpu: quality.gpu };
window.__stats = stats;

async function start() {
  const world = await buildScene({ renderer, lights, quality, loader });
  const { scene } = world;
  let time = 0;

  const frame = () => {
    const { exposure } = path.update(0, parallax.value);
    lights.uniforms.uExposure.value = exposure;
    world.update(camera, adaptive.dpr);
    world.sea.renderReflection(renderer, scene, camera, !inside(camera.position), quality.reflectionScale);
    const calls0 = renderer.info.render.calls;
    if (post) post.render(scene, camera, time);
    else renderer.render(scene, camera);
    return calls0;
  };

  // prima posizione e compilazione degli shader dietro al loader
  path.setProgress(0);
  path.update(1, parallax.value);
  world.update(camera, adaptive.dpr);
  renderer.setRenderTarget(post ? post.rtScene : null);
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);
  frame();

  // scroll: Lenis (smooth) + ScrollTrigger; con reduced motion scroll nativo e nessuno smorzamento
  let lenis = null;
  if (!reducedMotion) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
    lenis.on('scroll', ScrollTrigger.update);
    lenis.stop();
  }
  ScrollTrigger.create({
    trigger: '#scroll',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => path.setProgress(self.progress),
  });

  renderer.info.autoReset = false;
  let last = performance.now() / 1000;
  const clock0 = last;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((t) => {
    lenis?.raf(t * 1000);
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;
    time = now - clock0;
    renderer.info.reset();
    parallax.update(dt, time);
    const { exposure } = path.update(dt, parallax.value);
    lights.uniforms.uExposure.value = exposure;
    lights.update(time);
    world.update(camera, adaptive.dpr);
    world.sea.renderReflection(renderer, scene, camera, !inside(camera.position), quality.reflectionScale);
    if (post) post.render(scene, camera, time);
    else renderer.render(scene, camera);
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
  });

  // hook di test: salta a un punto del percorso senza smorzamento
  window.__jump = (p) => {
    path.setProgress(p);
    path.state.u = path.state.target;
  };
  // maschera dei cuscini (magenta, senza bloom e grana) per il controllo automatico dei colori
  window.__mask = (on) => {
    world.cushions.material.uniforms.uMask.value = on ? 1 : 0;
    for (const m of Object.values(world.meshes)) m.material.uniforms.uMask.value = on ? 1 : 0;
    world.beam.visible = world.dust.visible = !on;
    if (post) {
      post.uniforms.uBloom.value = on ? 0 : 0.3;
      post.uniforms.uGrain.value = on ? 0 : 0.022;
      post.uniforms.uVignette.value = on ? 0 : 0.16;
    }
  };

  await loader.finish();
  document.documentElement.classList.remove('is-loading');
  lenis?.start();
  ScrollTrigger.refresh();
  parallax.enable(2.5);
  window.__ready = true;
}

start().catch((err) => {
  console.error(err);
  window.__error = String(err && err.stack ? err.stack : err);
});
