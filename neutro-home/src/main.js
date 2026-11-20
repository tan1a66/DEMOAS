import './styles.css';
import * as THREE from 'three';

import { BRAID, PEGS, QUALITY, IS_TOUCH, REDUCED_MOTION, COLORS, DEFAULT_COLOR, PALETTE } from './config.js';
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
// Luz lateral cálida sólo para la entrada: un brillo más en el hilo.
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
let threads = new Threads({ perStrand: IS_TOUCH ? 54 : 66, braid, dye });
scene.add(threads.mesh);

const HUNG_PHASE = 0.4;
const rig = new Rig();
const hung = hungStructure(HUNG_PHASE);

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
  if (phase === 'intro') computeCloseCamera();
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
// La trenza se forma ya en su sitio (sobre la cola izquierda, colgada en el muro claro):
// un hilo baja → se abre en muchísimas hebras → tres cabos → se trenzan (despacio, con zoom)
// → las puntas se atan en la borla → la cámara se aleja y la pieza ya está colgada.
const introP = {
  cut: 0.8, front: 0.74, scale: 0.13, split: 0, loose: 1, thin: 0.42, core: 0.62, spread: 0, sep: 1.3,
  bloom: 0, tube: 0, tipEnd: 0.085, taper: 0.13, done: 0, phase: HUNG_PHASE,
};
const introSt = introStructure(introP);
const introLine = $('introLine');
const INTRO_END = 10.2;

const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;

let phase = 'loading'; // loading → intro → main
let tau = 0;
let litDone = false;
let uiShown = false;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const closeCam = { x: 0, tipY: 0, A: null, W: null, Z: null };

// Encuadre cercano sobre la cola izquierda (adaptado al formato de pantalla).
function computeCloseCamera() {
  const info = rig.info;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = window.innerWidth / window.innerHeight;
  // altura visible de cada encuadre (en horizontal manda el ancho)
  const fit = (h, w) => Math.min(h, w / aspect);
  const tip = info.endL.y;
  closeCam.x = info.endL.x;
  closeCam.tipY = tip;
  const frame = (H, y) => ({ d: H / (2 * tanH), y });
  const hA = fit(0.56, 0.42);
  const hW = 0.6;
  const hZ = fit(0.36, 0.26);
  closeCam.A = frame(hA, tip + 0.2 * hA); // hilo que baja: la punta a ~70 % de la altura
  // formación completa a la vista, sin llegar al gancho ni a la onda (se descubren al final)
  closeCam.W = frame(hW, Math.min(tip + 0.3 * hW, -0.28 - hW / 2));
  closeCam.Z = frame(hZ, tip + 0.3); // detalle de la trenza ya hecha
}

function updateIntro(dt) {
  tau += dt;
  const t = tau;

  // 1) el hilo baja por la cola  2) se abre en hebras  3) tres cabos  4) se trenzan  5) borla
  introP.cut = 0.8 * (1 - easeOut(seg(t, 0.3, 2.7)));
  const bl = seg(t, 2.5, 4.4);
  const bloom = 0.66 * bl * bl;
  const spray = easeInOut(seg(t, 2.5, 4.0));
  const split = easeInOut(seg(t, 3.9, 4.8));
  const gather = easeInOut(seg(t, 4.2, 5.4));
  introP.bloom = bloom;
  introP.split = split;
  introP.spread = 0.6 * split;
  introP.tube = easeInOut(seg(t, 5.2, 5.8));
  introP.front = lerp(0.74, 0.19, easeInOut(seg(t, 5.0, 7.8)));
  introP.scale = lerp(0.13, 1, easeInOut(seg(t, 3.0, 7.8)));
  introP.done = easeInOut(seg(t, 8.0, 8.9));
  if (threads) {
    threads.mesh.visible = t > 2.4 && introP.done < 1;
    threads.set({
      bloom, spray, gather, time: t, tube: introP.tube, tipEnd: introP.tipEnd, taper: introP.taper,
      front: introP.front, done: introP.done,
    });
    if (introP.done >= 1) disposeThreads();
  }
  braid.update(rig.center, BRAID.z, introSt);
  // la borla izquierda se "ata" al final: crece desde el extremo
  const tie = easeOut(seg(t, 8.0, 9.0));
  tassels.L.mesh.visible = tie > 0.001;
  tassels.L.mesh.scale.setScalar(Math.max(0.001, tie));

  // cámara: cerca del hilo → se abre para ver toda la formación → zoom sobre la trenza
  // terminada (y la borla que se ata) → se aleja: la pieza ya está colgada en el muro
  const { A, W, Z } = closeCam;
  const wide = easeInOut(seg(t, 2.6, 5.8));
  const zoom = easeInOut(seg(t, 7.4, 8.6));
  let d = lerp(lerp(A.d, W.d, wide), Z.d, zoom);
  let y = lerp(lerp(A.y, W.y, wide), Z.y, zoom);
  d *= 1 - 0.04 * seg(t, 0, 2.6); // un respiro casi imperceptible al principio
  camPos.set(closeCam.x, y, BRAID.z + d);
  camLook.set(closeCam.x, y, 0);
  const away = easeInOut(seg(t, 8.9, INTRO_END - 0.1));
  camPos.lerp(finalCam.pos, away);
  camLook.lerp(finalCam.look, away);
  applyCamera(camPos, camLook);

  rim.intensity = 1.6 * (1 - away);
  if (t > 0.8 && t < 4.9) introLine.classList.add('on');
  else introLine.classList.remove('on');
  if (!litDone && t > 9.3) {
    litDone = true;
    document.body.classList.add('lit');
  }
  if (!uiShown && t > INTRO_END - 0.4) showMainUI();
  if (t > INTRO_END) endIntro();
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
  rim.intensity = 0;
  introLine.classList.remove('on');
  document.body.classList.add('lit');
  tassels.L.mesh.visible = tassels.R.mesh.visible = true;
  tassels.L.mesh.scale.setScalar(1);
  rig.active = true; // reconstruye la trenza colgada definitiva
  showMainUI();
  needsRender = true;
}

function skipIntro() {
  if (phase !== 'intro') return;
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
// Se puede agarrar la trenza por las ondas (cambian su caída) o por las colas y las borlas
// (se tira de un extremo: la trenza se desliza sobre los ganchos; de lado, la cola se balancea).
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

function pickTarget(cx, cy) {
  const info = rig.info;
  if (!info) return null;
  let best = null;
  const take = (cand) => {
    if (!best || cand.d < best.d) best = cand;
  };
  // ondas: el punto más bajo o cualquier punto entre sus ganchos cerca de la curva
  const waveR = IS_TOUCH ? 70 : 56;
  for (let i = 0; i < 2; i++) {
    const w = info.waves[i];
    const p = toScreen(w.x, w.y);
    const a = toScreen(pegX[i], PEGS.y).x;
    const b = toScreen(pegX[i + 1], PEGS.y).x;
    const d = Math.hypot(cx - p.x, cy - p.y);
    const inSpan = cx > a + 6 && cx < b - 6 && Math.abs(cy - p.y) < (IS_TOUCH ? 84 : 64) && cy > toScreen(0, PEGS.y + 0.02).y;
    if (d < waveR || inSpan) take({ type: 'wave', i, d });
  }
  // colas y borlas
  const N = BRAID.samples;
  const ds = BRAID.length / (N - 1);
  const lineR = IS_TOUCH ? 40 : 28;
  const tasselR = IS_TOUCH ? 66 : 48;
  for (const side of ['L', 'R']) {
    const tl = side === 'L' ? info.tailL : info.tailR;
    const i0 = side === 'L' ? 0 : Math.ceil((BRAID.length - tl) / ds);
    const i1 = side === 'L' ? Math.floor(tl / ds) : N - 1;
    for (let i = i0; i <= i1; i += 4) {
      const p = toScreen(rig.center.px[i], rig.center.py[i]);
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < lineR) {
        const sAlong = side === 'L' ? tl - i * ds : i * ds - (BRAID.length - tl);
        take({ type: 'tail', side, grab: Math.max(0.05, sAlong), d });
      }
    }
    const e = side === 'L' ? info.endL : info.endR;
    const tp = toScreen(e.x + e.dx * 0.11, e.y + e.dy * 0.11);
    const d = Math.hypot(cx - tp.x, cy - tp.y);
    if (d < tasselR) take({ type: 'tail', side, grab: tl + 0.11, d: d * 0.8 });
  }
  return best;
}

function markInteracted() {
  if (interacted) return;
  interacted = true;
  clearTimeout(nudgeTimer);
  ui.hideHint();
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase === 'intro') {
    skipIntro();
    return;
  }
  if (phase !== 'main' || drag) return;
  const target = pickTarget(e.clientX, e.clientY);
  if (!target) return;
  const p = toWorld(e.clientX, e.clientY);
  if (!p) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  if (target.type === 'wave') {
    drag = { id: e.pointerId, type: 'wave', wave: target.i, y0: p.y, d0: rig.depth[target.i].x };
    rig.grab(target.i);
  } else {
    drag = { id: e.pointerId, type: 'tail', side: target.side };
    rig.grabTail(target.side, target.grab);
    rig.dragTail(p.x, p.y);
  }
  canvas.classList.add('grabbing');
  markInteracted();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (phase === 'main' && e.pointerType === 'mouse') canvas.classList.toggle('can-grab', !!pickTarget(e.clientX, e.clientY));
    return;
  }
  if (e.pointerId !== drag.id) return;
  const p = toWorld(e.clientX, e.clientY);
  if (!p) return;
  if (drag.type === 'wave') rig.dragTo(drag.wave, drag.d0 + (drag.y0 - p.y));
  else rig.dragTail(p.x, p.y);
});

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  if (drag.type === 'wave') rig.release();
  else rig.releaseTail();
  drag = null;
  canvas.classList.remove('grabbing');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
// Tocar el texto de la entrada también la salta.
document.addEventListener('pointerdown', (e) => {
  if (phase === 'intro' && e.target !== canvas) skipIntro();
});
canvas.tabIndex = 0;
canvas.addEventListener('keydown', () => {
  if (phase === 'intro') skipIntro();
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
  if (phase === 'main') {
    if (rig.step(dt)) {
      syncHung();
      dirty = true;
    }
  }
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
  computeCloseCamera();
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
    endIntro();
  } else {
    phase = 'intro';
    tau = 0;
    computeCloseCamera();
    tassels.L.mesh.visible = false;
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
  get threads() {
    return threads;
  },
  scene,
  camera,
  skipIntro,
  setTau: (t) => {
    tau = t;
  },
  pickTarget,
  requestColor,
  toScreen,
  render: () => renderer.render(scene, camera),
  renderer,
};

start();
