import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createLoader } from './loader.js';
import { createLights } from './lights.js';
import { buildScene } from './scene.js';
import { createCameraPath } from './camera-path.js';
import { createParallax } from './parallax.js';
import { detectTier, createAdaptiveResolution } from './quality.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.documentElement.classList.add('is-loading');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0xd9a5a0, 1);
renderer.autoClear = true;

const quality = detectTier(renderer);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
const loader = createLoader({ reducedMotion });
const lights = createLights({ shadowExt: quality.shadowExt, shadowInt: quality.shadowInt });
const path = createCameraPath(camera, { reducedMotion });
const parallax = createParallax({ enabled: !reducedMotion });
const adaptive = createAdaptiveResolution(renderer, quality);

// Campo visivo: in verticale (telefono) si allarga per mantenere un'inquadratura orizzontale minima
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const minHFov = THREE.MathUtils.degToRad(44);
  const vFromH = 2 * Math.atan(Math.tan(minHFov / 2) / camera.aspect);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(THREE.MathUtils.degToRad(46), vFromH)), 46, 78);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

// Statistiche per i test (window.__stats): fps medi, draw call, triangoli
const stats = { frames: 0, time: 0, fps: 0, calls: 0, triangles: 0, dpr: adaptive.dpr, tier: quality.tier, gpu: quality.gpu };
window.__stats = stats;

async function start() {
  const world = await buildScene({ renderer, lights, quality, loader });
  const { scene } = world;

  // prima posizione e compilazione degli shader dietro al loader
  path.setProgress(0);
  path.update(1, parallax.value);
  world.update(camera, adaptive.dpr);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);

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

  let last = performance.now() / 1000;
  const clock0 = last;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((t) => {
    lenis?.raf(t * 1000);
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;
    const time = now - clock0;
    parallax.update(dt, time);
    const { exposure } = path.update(dt, parallax.value);
    lights.uniforms.uExposure.value = exposure;
    lights.update(time);
    world.update(camera, adaptive.dpr);
    renderer.render(scene, camera);
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
