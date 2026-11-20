import './styles.css';
import * as THREE from 'three';

import { BRAID, PEGS, QUALITY, IS_TOUCH, REDUCED_MOTION, COLORS, DEFAULT_COLOR, PALETTE, WAVES } from './config.js';
import { bakeTextures } from './gl/textures.js';
import { buildEnvironment } from './gl/environment.js';
import { createDyeUniforms } from './gl/fiberMaterial.js';
import { buildWall } from './scene/wall.js';
import { buildPegs } from './scene/pegs.js';
import { Braid, hungStructure, introStructure } from './scene/braid.js';
import { Tassel } from './scene/tassel.js';
import { Threads } from './scene/threads.js';
import { Rig } from './model/rig.js';
import { clamp, lerp } from './model/spring.js';
import { UI } from './ui/ui.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.earth);
const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.05, 40);

// ---------------------------------------------------------------- luz de tarde
const sun = new THREE.DirectionalLight('#fff3e6', 3.3);
sun.position.set(-1.55, 1.75, 1.45);
sun.target.position.set(0, -0.35, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap);
Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.25, bottom: -1.45, near: 0.2, far: 6 });
sun.shadow.radius = QUALITY.shadowRadius;
sun.shadow.blurSamples = QUALITY.shadowSamples;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#fff6ee', '#6a4c38', 0.36);
scene.add(hemi);
// Luz lateral cálida sólo para la entrada: el hilo brilla sobre el fondo oscuro.
const rim = new THREE.DirectionalLight('#ffcf9a', 0);
rim.position.set(-2, 0.6, 0.5);
scene.add(rim);

const textures = bakeTextures(renderer, { mobile: IS_TOUCH });
scene.environment = buildEnvironment(renderer);
scene.environmentIntensity = 0.6;

// ---------------------------------------------------------------- escena
const wall = buildWall(textures);
scene.add(wall);
const pegX = [-PEGS.spacing, 0, PEGS.spacing];
const pegs = buildPegs(textures, pegX);
scene.add(pegs);

const startColor = COLORS.find((c) => c.id === DEFAULT_COLOR);
const dye = createDyeUniforms(startColor.hex);
setSheen(dye.uSheenOld.value, startColor.hex);
setSheen(dye.uSheenNew.value, startColor.hex);

const braid = new Braid({ radial: QUALITY.radial, dye, textures, envIntensity: 0.9 });
scene.add(braid.mesh);
const tassels = { L: new Tassel(-1, { dye, textures }), R: new Tassel(1, { dye, textures }) };
scene.add(tassels.L.mesh, tassels.R.mesh);
// Entrada: un hilo que se abre en muchísimas hebras, que luego forman los tres cabos.
let threads = new Threads({ perStrand: IS_TOUCH ? 40 : 52, braid, dye });
scene.add(threads.mesh);

// Velo oscuro de la entrada (delante del muro y de los ganchos, detrás del hilo).
const veil = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshBasicMaterial({ color: PALETTE.earth, transparent: true, depthWrite: false, toneMapped: false })
);
veil.position.z = 0.21;
veil.renderOrder = 10;
scene.add(veil);

const rig = new Rig();
const hung = hungStructure(0.4);

function setSheen(target, hex) {
  const c = new THREE.Color(hex);
  target.copy(c).lerp(new THREE.Color('#fff1dc'), 0.42).multiplyScalar(0.95);
}

// ---------------------------------------------------------------- encuadre
const brandEl = $('brand');
const panelEl = $('panel');
const CONTENT = { x0: -0.55, x1: 0.55, y0: -0.93, y1: 0.19 };
const finalCam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), pxpm: 300 };

function computeFinalCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const brandBottom = brandEl.getBoundingClientRect().bottom + 10;
  const pr = panelEl.getBoundingClientRect();
  const sideLayout = pr.width < w * 0.8; // teléfono en horizontal: panel a la derecha
  const area = sideLayout ? { x0: 0, x1: pr.left, y0: brandBottom, y1: h - 8 } : { x0: 0, x1: w, y0: brandBottom, y1: pr.top + 6 };
  const cw = CONTENT.x1 - CONTENT.x0;
  const ch = CONTENT.y1 - CONTENT.y0;
  let pxpm = Math.min(((area.x1 - area.x0) * 0.94) / cw, ((area.y1 - area.y0) * 0.97) / ch);
  pxpm = Math.max(pxpm, 120);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const D = h / (pxpm * 2 * tanH);
  const cx = (CONTENT.x0 + CONTENT.x1) / 2;
  const cy = (CONTENT.y0 + CONTENT.y1) / 2;
  const sx = (area.x0 + area.x1) / 2;
  const sy = (area.y0 + area.y1) / 2;
  const camX = cx - (sx - w / 2) / pxpm;
  const camY = cy + (sy - h / 2) / pxpm;
  finalCam.pos.set(camX, camY, BRAID.z + D);
  finalCam.look.set(camX, camY, 0);
  finalCam.pxpm = pxpm;
}

function applyCamera(pos, look) {
  camera.position.copy(pos);
  camera.lookAt(look);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  computeFinalCamera();
  if (phase === 'main') applyCamera(finalCam.pos, finalCam.look);
  needsRender = true;
}
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);

// ---------------------------------------------------------------- color
const ui = new UI({
  onColor: (c, fromUser) => {
    if (!fromUser) return;
    requestColor(c.hex);
  },
  getConfig: () => ({ depths: rig.depth.map((s) => s.target) }),
});

const flow = { active: false, t: 0, queued: null };
function requestColor(hex) {
  if (flow.active) {
    flow.queued = hex;
    return;
  }
  dye.uColNew.value.set(hex);
  setSheen(dye.uSheenNew.value, hex);
  flow.active = true;
  flow.t = 0;
}
function updateFlow(dt) {
  flow.t = Math.min(1, flow.t + dt / 0.85);
  const e = flow.t < 0.5 ? 4 * flow.t ** 3 : 1 - (-2 * flow.t + 2) ** 3 / 2;
  dye.uFront.value = lerp(-0.26, 1.26, e);
  dye.uFlowing.value = Math.sin(Math.PI * flow.t);
  if (flow.t >= 1) {
    dye.uColOld.value.copy(dye.uColNew.value);
    dye.uSheenOld.value.copy(dye.uSheenNew.value);
    dye.uFront.value = 2;
    dye.uFlowing.value = 0;
    flow.active = false;
    if (flow.queued) {
      const q = flow.queued;
      flow.queued = null;
      requestColor(q);
    }
  }
}

// ---------------------------------------------------------------- actualización de la trenza
function syncHung() {
  braid.update(rig.center, BRAID.z, hung);
  const info = rig.info;
  tassels.L.place(info.endL, BRAID.z, rig.tasselLag('L'));
  tassels.R.place(info.endR, BRAID.z, rig.tasselLag('R'));
}

// ---------------------------------------------------------------- entrada
const INTRO_Z = 0.32;
const Y0 = 0.28;
const introCenter = {
  px: new Float32Array(BRAID.samples),
  py: new Float32Array(BRAID.samples),
  tx: new Float32Array(BRAID.samples),
  ty: new Float32Array(BRAID.samples).fill(1),
};
const introP = { front: 0.95, scale: 0.13, split: 0, loose: 0.42, spread: 0, sep: 0.95, bloom: 0, tube: 0, tipEnd: 0.12 };
const introSt = introStructure(introP);
const introLine = $('introLine');

const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x * x;

let phase = 'loading'; // loading → intro → main
let tau = 0;
let dropStarted = false;
let litDone = false;
let uiShown = false;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function updateIntro(dt) {
  tau += dt;
  const t = tau;

  // hilo que baja, luego sigue bajando mientras se trenza, luego se levanta
  let yTip = lerp(Y0 + 0.42, Y0 - 0.02, easeOut(seg(t, 0.25, 1.75)));
  yTip -= 0.3 * easeInOut(seg(t, 2.3, 4.5));
  const lift = Math.max(0, t - 4.45);
  yTip += 4.5 * lift * lift;

  // 1) un hilo  2) se abre en muchísimas hebras  3) se agrupan en tres cabos gruesos  4) se trenzan
  const bl = seg(t, 1.3, 2.65);
  const bloom = 0.95 * bl * bl; // el punto donde se abre sube despacio: se ve la "horquilla"
  const spray = easeInOut(seg(t, 1.3, 2.4));
  const split = easeInOut(seg(t, 2.2, 2.85));
  const gather = easeInOut(seg(t, 2.4, 3.25));
  introP.bloom = bloom;
  introP.split = split;
  introP.spread = 0.6 * split;
  introP.tube = easeInOut(seg(t, 3.05, 3.5));
  introP.front = lerp(0.95, 0.15, easeInOut(seg(t, 2.95, 4.4)));
  introP.scale = lerp(0.13, 1, easeInOut(seg(t, 1.9, 4.4)));
  if (threads) {
    // las puntas siguen siendo hebras hasta que la trenza se cuelga
    threads.mesh.visible = t > 1.3 && t < 5.0;
    threads.set({ bloom, spray, gather, time: t, tube: introP.tube, tipEnd: introP.tipEnd });
    if (t >= 5.0) disposeThreads();
  }

  const N = BRAID.samples;
  const ds = BRAID.length / (N - 1);
  for (let i = 0; i < N; i++) introCenter.py[i] = yTip + i * ds;

  if (t < 5.0) {
    braid.update(introCenter, INTRO_Z, introSt);
  } else if (!dropStarted) {
    dropStarted = true;
    rig.startDrop(1.45);
    tassels.L.mesh.visible = tassels.R.mesh.visible = true;
  }

  // cámara: cerca del hilo → retrocede → encuadre final
  const pull = easeInOut(seg(t, 1.9, 4.6));
  const dist = lerp(1.0, 2.25, pull);
  const ly = lerp(Y0 + 0.02, Y0 - 0.12, pull);
  camPos.set(0, ly, INTRO_Z + dist);
  camLook.set(0, ly, 0);
  const toFinal = easeInOut(seg(t, 4.35, 5.6));
  camPos.lerp(finalCam.pos, toFinal);
  camLook.lerp(finalCam.look, toFinal);
  applyCamera(camPos, camLook);

  // luz: el velo se abre y aparece el muro
  const light = easeInOut(seg(t, 4.3, 5.4));
  veil.material.opacity = 1 - light;
  veil.visible = light < 1;
  scene.environmentIntensity = lerp(0.25, 0.6, light);
  hemi.intensity = lerp(0.15, 0.36, light);
  rim.intensity = 5.5 * (1 - light);
  if (t > 0.7 && t < 3.75) introLine.classList.add('on');
  else introLine.classList.remove('on');
  if (!litDone && t > 4.6) {
    litDone = true;
    document.body.classList.add('lit');
  }
  if (!uiShown && t > 6.5) showMainUI();
  if (t > 6.6) endIntro();
}

function disposeThreads() {
  if (!threads) return;
  scene.remove(threads.mesh);
  threads.dispose();
  threads = null;
}

function endIntro() {
  phase = 'main';
  disposeThreads();
  applyCamera(finalCam.pos, finalCam.look);
  veil.visible = false;
  scene.environmentIntensity = 0.6;
  hemi.intensity = 0.36;
  rim.intensity = 0;
  introLine.classList.remove('on');
  document.body.classList.add('lit');
  tassels.L.mesh.visible = tassels.R.mesh.visible = true;
  if (!dropStarted) {
    dropStarted = true;
    rig.setRest();
  }
  showMainUI();
  needsRender = true;
}

function skipIntro() {
  if (phase !== 'intro') return;
  dropStarted = true;
  rig.setRest();
  endIntro();
}

let nudgeTimer = 0;
let interacted = false;
function showMainUI() {
  if (uiShown) return;
  uiShown = true;
  ui.show();
  nudgeTimer = setTimeout(() => {
    if (!interacted && !REDUCED_MOTION) rig.nudge(0);
  }, 2600);
}

// ---------------------------------------------------------------- interacción
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -BRAID.z);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
const tmpV = new THREE.Vector3();
let drag = null;

function toWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(plane, hitPoint);
}
function toScreen(x, y, z = BRAID.z) {
  tmpV.set(x, y, z).project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight };
}

function pickWave(clientX, clientY) {
  if (!rig.info) return -1;
  let best = -1;
  let bestD = Infinity;
  const minR = IS_TOUCH ? 70 : 56;
  for (let i = 0; i < 2; i++) {
    const w = rig.info.waves[i];
    const p = toScreen(w.x, w.y);
    const a = toScreen(pegX[i], PEGS.y).x;
    const b = toScreen(pegX[i + 1], PEGS.y).x;
    const d = Math.hypot(clientX - p.x, clientY - p.y);
    const inSpan = clientX > a + 6 && clientX < b - 6 && Math.abs(clientY - p.y) < (IS_TOUCH ? 84 : 64) && clientY > toScreen(0, PEGS.y + 0.02).y;
    if ((d < minR || inSpan) && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

function measureFor(i) {
  return { depth: rig.depth[i].x, tail: rig.info ? rig.info.tail : 0 };
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase === 'intro') {
    skipIntro();
    return;
  }
  if (phase !== 'main' || drag) return;
  const i = pickWave(e.clientX, e.clientY);
  if (i < 0) return;
  const p = toWorld(e.clientX, e.clientY);
  if (!p) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, wave: i, y0: p.y, d0: rig.depth[i].x, x: e.clientX, y: e.clientY };
  rig.grab(i);
  canvas.classList.add('grabbing');
  if (!interacted) {
    interacted = true;
    clearTimeout(nudgeTimer);
    ui.hideHint();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (phase === 'main' && e.pointerType === 'mouse') canvas.classList.toggle('can-grab', pickWave(e.clientX, e.clientY) >= 0);
    return;
  }
  if (e.pointerId !== drag.id) return;
  const p = toWorld(e.clientX, e.clientY);
  if (!p) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  rig.dragTo(drag.wave, drag.d0 + (drag.y0 - p.y));
});

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  rig.release();
  drag = null;
  canvas.classList.remove('grabbing');
  ui.hideMeasure();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
// Tocar el texto de la entrada también la salta.
document.addEventListener('pointerdown', (e) => {
  if (phase === 'intro' && e.target !== canvas) skipIntro();
});

// Teclado: ← → eligen la onda, ↑ ↓ la acortan o alargan.
canvas.tabIndex = 0;
let keyWave = 0;
let keyTimer = 0;
canvas.addEventListener('keydown', (e) => {
  if (phase === 'intro') {
    skipIntro();
    return;
  }
  if (phase !== 'main') return;
  if (e.key === 'ArrowLeft') keyWave = 0;
  else if (e.key === 'ArrowRight') keyWave = 1;
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const s = rig.depth[keyWave];
    const next = clamp(s.target + (e.key === 'ArrowDown' ? 0.025 : -0.025), WAVES.depthMin, rig.maxDepth(keyWave));
    s.target = next;
    s.omega = 9;
    s.zeta = 0.5;
    rig.active = true;
  } else return;
  e.preventDefault();
  ui.showMeasure({ depth: rig.depth[keyWave].target, tail: rig.info.tail });
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => ui.hideMeasure(), 1400);
});

// ---------------------------------------------------------------- bucle
let needsRender = true;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let dirty = needsRender;
  needsRender = false;

  if (phase === 'intro') {
    updateIntro(dt);
    dirty = true;
  }
  if (phase !== 'loading' && dropStarted) {
    if (rig.step(dt)) {
      syncHung();
      dirty = true;
    }
  }
  if (drag && rig.info) ui.showMeasure(measureFor(drag.wave));
  if (flow.active) {
    updateFlow(dt);
    dirty = true;
  }
  if (dirty) renderer.render(scene, camera);
}

// ---------------------------------------------------------------- grano
(function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

// ---------------------------------------------------------------- arranque
async function start() {
  ui.select(DEFAULT_COLOR, false);
  computeFinalCamera();
  camera.updateProjectionMatrix();

  // estado inicial (para compilar shaders con todo visible)
  rig.setRest();
  rig.step(0.016);
  syncHung();
  applyCamera(finalCam.pos, finalCam.look);
  if (threads) threads.mesh.visible = true; // compilar también su shader antes de empezar
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* sin compilación paralela: se compila al primer render */
  }
  renderer.render(scene, camera);
  if (threads) threads.mesh.visible = false;

  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  await fontsReady;

  const skip = REDUCED_MOTION || params.has('skip');
  if (skip) {
    // Sin entrada: aparece la escena final con un fundido.
    phase = 'main';
    dropStarted = true;
    disposeThreads();
    rig.setRest();
    veil.visible = false;
    document.body.classList.add('lit');
    showMainUI();
  } else {
    phase = 'intro';
    tau = 0;
    tassels.L.mesh.visible = tassels.R.mesh.visible = false;
    veil.visible = true;
    veil.material.opacity = 1;
    scene.environmentIntensity = 0.25;
    hemi.intensity = 0.15;
    updateIntro(0);
  }
  renderer.render(scene, camera);
  $('loader').classList.add('out');
  last = performance.now();
  requestAnimationFrame(frame);
}

// Ganchos para pruebas automáticas (capturas).
window.__trenza = {
  get phase() {
    return phase;
  },
  rig,
  braid,
  scene,
  camera,
  skipIntro,
  setTau: (t) => {
    tau = t;
  },
  requestColor,
  toScreen,
  render: () => renderer.render(scene, camera),
  renderer,
};

start();
