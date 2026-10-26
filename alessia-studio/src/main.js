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
import { createOverlay, pickLang } from './overlay.js';
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
const path = createCameraPath(camera, { reducedMotion });

// scroll guidato: ogni gesto porta alla sosta successiva (divani, lucernario, terrazza sul mare, il bordo, il fondale, contatti)
let overlay = null, onDemo = null;
const guide = createGuide({
  stops: path.story.stops,
  units: path.story.total,
  setProgress: path.setProgress,
  reducedMotion,
  onChange: (i, moving, last) => overlay?.setStop(i, moving, last),
  // giocando col titolo liquido (dito sopra ALESSIA STUDIO), girando la scultura o trascinando i pesci
  // lo scroll non si muove
  ignoreTouch: (x, y) => !!overlay?.onTitle(x, y) || !!onDemo?.(x, y),
});

// testi e lingua
const overlayRoot = document.getElementById('overlay');
overlay = createOverlay(overlayRoot, path.story.sections, {
  lang: pickLang(),
  onNext: () => guide.next(),
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
  const world = await buildScene({ renderer, lights, quality, loader, art: path.story.art, artCam: path.story.artCam });
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

  // sott'acqua il puntatore scosta le bollicine e i pesci, un tocco libera uno sbuffo (e fa scappare i
  // pesci vicini), trascinare lascia una scia
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const uw = world.underwater;
  const aim = (x, y) => {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray;
  };
  const inWater = () => uw.group.visible;
  let lastTrail = 0, lx = 0, ly = 0;
  const trailAt = (x, y, t) => {
    if (t - lastTrail < 45 || Math.hypot(x - lx, y - ly) < 6) return;
    lastTrail = t;
    lx = x;
    ly = y;
    uw.trail(aim(x, y));
  };
  // la scultura sul fondale: trascinandola (dito o mouse) gira; trascinando altrove il banco di pesci
  // segue il dito (o il mouse col tasto premuto)
  const sc = uw.sculpture, school = uw.school;
  let spin = null, spun = false, herd = false;
  const onArt = (x, y) => overlay.artOn && sc.hit(aim(x, y));
  onDemo = (x, y) => onArt(x, y) || (overlay.artOn && school.hit(aim(x, y)));
  const spinStart = (x, y, t) => {
    herd = overlay.artOn && !onArt(x, y);
    if (!onArt(x, y)) return;
    spin = { x, y, t, moved: 0 };
    canvas.style.cursor = 'grabbing';
  };
  const spinMove = (x, y, t) => {
    if (herd) school.point(aim(x, y), 1.0);
    if (!spin) return false;
    sc.rotateBy(x - spin.x, y - spin.y, Math.max((t - spin.t) / 1000, 1 / 240));
    spin.moved += Math.hypot(x - spin.x, y - spin.y);
    Object.assign(spin, { x, y, t });
    return true;
  };
  const spinEnd = () => {
    herd = false;
    if (!spin) return;
    spun = spin.moved > 6;
    spin = null;
    sc.release();
    canvas.style.cursor = '';
  };
  window.addEventListener('pointerdown', (e) => e.pointerType !== 'touch' && spinStart(e.clientX, e.clientY, e.timeStamp));
  window.addEventListener('pointerup', (e) => e.pointerType !== 'touch' && spinEnd());
  window.addEventListener('pointercancel', (e) => e.pointerType !== 'touch' && spinEnd());
  window.addEventListener('touchstart', (e) => e.touches.length === 1 && spinStart(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp), { passive: true });
  window.addEventListener('touchmove', (e) => e.touches.length === 1 && spinMove(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp), { passive: true });
  window.addEventListener('touchend', spinEnd, { passive: true });
  window.addEventListener('touchcancel', spinEnd, { passive: true });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || spinMove(e.clientX, e.clientY, e.timeStamp)) return;
    if (e.pointerType !== 'mouse') return;
    const overUi = e.target.closest?.('.ui, a, button');
    canvas.style.cursor = !overUi && onArt(e.clientX, e.clientY) ? 'grab' : '';
    if (inWater() && !overUi) {
      uw.setPointer(aim(e.clientX, e.clientY), { hover: true });
      school.avoid(aim(e.clientX, e.clientY));
      trailAt(e.clientX, e.clientY, e.timeStamp);
    } else {
      uw.setPointer(null);
      school.avoid(null);
    }
  });
  document.documentElement.addEventListener('pointerleave', () => {
    uw.setPointer(null);
    school.avoid(null);
  });
  window.addEventListener('touchmove', (e) => {
    if (!inWater() || e.touches.length !== 1) return;
    const t = e.touches[0];
    uw.setPointer(aim(t.clientX, t.clientY), { hold: 0.8 });
    school.avoid(aim(t.clientX, t.clientY));
    trailAt(t.clientX, t.clientY, e.timeStamp);
  }, { passive: true });
  window.addEventListener('touchend', () => school.avoid(null), { passive: true });
  window.addEventListener('click', (e) => {
    // dopo aver girato la scultura il clic non libera bollicine
    if (spun) return void (spun = false);
    if (e.target.closest?.('a, button') || !inWater()) return;
    uw.setPointer(aim(e.clientX, e.clientY), { hold: 0.9 });
    uw.burst(aim(e.clientX, e.clientY));
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
    overlay.update(p);
    world.update(camera, adaptive.dpr, time);
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
  window.__overlay = overlay;
  window.__school = uw.school;
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
  world.loadStatue().then(() => (window.__statue = true)).catch((err) => console.error('statua non caricata', err));
  guide.setEnabled(true);
  parallax.enable(2.5);
  window.__ready = true;
}

start().catch((err) => {
  console.error(err);
  window.__error = String(err && err.stack ? err.stack : err);
});
