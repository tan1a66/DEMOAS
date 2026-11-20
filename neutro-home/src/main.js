import './styles.css';
import * as THREE from 'three';

import { BRAID, PEGS, QUALITY, IS_TOUCH, REDUCED_MOTION, COLORS, DEFAULT_COLOR, PALETTE } from './config.js';
import { bakeTextures } from './gl/textures.js';
import { buildEnvironment } from './gl/environment.js';
import { createDyeUniforms } from './gl/fiberMaterial.js';
import { buildRoom, ROOM } from './scene/room.js';
import { Makech } from './scene/makech.js';
import { XuxFamily } from './scene/xux.js';
import { Turntable } from './scene/fringe.js';
import { Journey, buildPath } from './journey.js';
import { STOPS } from './stops.js';
import { JourneyUI } from './ui/journeyUi.js';
import { buildPegs } from './scene/pegs.js';
import { Braid, hungStructure, introStructure } from './scene/braid.js';
import { Tassel } from './scene/tassel.js';
import { Threads } from './scene/threads.js';
import { Rig } from './model/rig.js';
import { clamp, lerp, smoothstep } from './model/spring.js';
import { PieceUI } from './ui/ui.js';
import { sunlight } from './gl/sunlight.js';

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
const BRAID_FOV = 26; // la trenza se mira como en una foto de producto
const camera = new THREE.PerspectiveCamera(BRAID_FOV, window.innerWidth / window.innerHeight, 0.05, 40);

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
const room = buildRoom(textures);
scene.add(room);
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
let threads = new Threads({ perStrand: IS_TOUCH ? 72 : 90, braid, dye });
scene.add(threads.mesh);

// Las otras piezas de la casa (se descubren al recorrerla).
const makech = new Makech({ position: new THREE.Vector3(6.1, 0.45, 3.25), ceilY: ROOM.ceil });
scene.add(makech.group);
const XUX_POS = [new THREE.Vector3(9.25, 0, 0.5), new THREE.Vector3(9.85, 0, 0.62), new THREE.Vector3(10.45, 0, 0.5)];
const xux = new XuxFamily({ textures, floorY: ROOM.floor, positions: XUX_POS });
scene.add(xux.group);
const fringes = [
  { obj: makech, swing: makech.swing, group: makech.group, hit: makech.hit, stop: 1 },
  ...xux.lamps.map((l) => ({ obj: l, swing: l.swing, group: l.group, hit: l.hit, stop: 2, lamp: true })),
];
// cada pieza gira sobre sí misma (plato giratorio): se ve a 360° y los flecos responden
for (const f of fringes) f.turn = new Turntable(f.group, f.swing);
const demoSpin = {};

const HUNG_PHASE = 0.4;
const rig = new Rig();
const hung = hungStructure(HUNG_PHASE);

function setSheen(target, hex) {
  const c = new THREE.Color(hex);
  target.copy(c).lerp(new THREE.Color('#fff1dc'), 0.42).multiplyScalar(0.95);
}

// ---------------------------------------------------------------- encuadre
const brandEl = $('brand');
const pieceEl = $('piece');

// Zona libre de la pantalla para encuadrar la pieza: entre el logotipo y los colores.
function freeArea() {
  const w = window.innerWidth;
  const top = brandEl.getBoundingClientRect().bottom + 10;
  const pr = pieceEl.getBoundingClientRect();
  return { x0: 36, x1: w - 36, y0: top, y1: pr.top - 8 };
}
const CONTENT = { x0: -0.55, x1: 0.55, y0: -0.93, y1: 0.19 };
const finalCam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), pxpm: 300 };

function computeFinalCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const brandBottom = brandEl.getBoundingClientRect().bottom + 10;
  const area = freeArea();
  const cw = CONTENT.x1 - CONTENT.x0;
  const ch = CONTENT.y1 - CONTENT.y0;
  let pxpm = Math.min(((area.x1 - area.x0) * 0.94) / cw, ((area.y1 - area.y0) * 0.97) / ch);
  pxpm = Math.max(pxpm, 120);
  const tanH = Math.tan(THREE.MathUtils.degToRad(BRAID_FOV / 2));
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

// Paradas de las piezas: encuadre que respeta el logotipo y el texto inferior.
const STOP_FRAMES = [
  null, // la trenza usa computeFinalCamera
  { focus: new THREE.Vector3(6.1, -0.1, 3.25), dir: new THREE.Vector3(1, 0, 0), w: 1.05, h: 1.4 },
  { focus: new THREE.Vector3(9.85, -0.95, 0.55), dir: new THREE.Vector3(0, 0, -1), w: 1.8, h: 2.3 },
];
let cameraPath = null;
const up = new THREE.Vector3(0, 1, 0);

function frameStop(f, fov) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const area = freeArea();
  const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pxpm = Math.max(60, Math.min(((area.x1 - area.x0) * 0.92) / f.w, ((area.y1 - area.y0) * 0.96) / f.h));
  const D = h / (pxpm * 2 * tanH);
  const right = new THREE.Vector3().crossVectors(f.dir, up).normalize();
  const sx = (area.x0 + area.x1) / 2 - w / 2;
  const sy = (area.y0 + area.y1) / 2 - h / 2;
  const look = f.focus.clone().addScaledVector(right, -sx / pxpm).addScaledVector(up, sy / pxpm);
  const pos = look.clone().addScaledVector(f.dir, -D);
  // la cámara nunca sale de la casa
  pos.x = clamp(pos.x, ROOM.left + 0.2, ROOM.right - 0.2);
  pos.z = clamp(pos.z, ROOM.back + 0.3, ROOM.front - 0.2);
  return { pos, look: pos.clone().add(f.dir), fov };
}

function computeStops() {
  const portrait = window.innerWidth < window.innerHeight;
  const fov = portrait ? 48 : 38;
  const S0 = { pos: finalCam.pos.clone(), look: finalCam.look.clone(), fov: 26, stop: 0 };
  const S1 = { ...frameStop(STOP_FRAMES[1], fov), stop: 1 };
  const S2 = { ...frameStop(STOP_FRAMES[2], fov), stop: 2 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    S0,
    { pos: V(0.6, -0.35, 3.7), look: V(2.6, -0.3, 3.35), fov: (26 + fov) / 2 },
    { pos: V(1.5, -0.3, 3.28), look: V(6.1, -0.12, 3.25), fov },
    S1,
    { pos: V(6.1, -0.5, 4.65), look: V(8.0, -0.6, 3.2), fov },
    { pos: V(7.2, -0.6, 3.55), look: V(9.5, -0.8, 1.6), fov },
    S2,
  ];
  cameraPath = buildPath(keys);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  computeFinalCamera();
  computeStops();
  if (phase === 'intro') computeCloseCamera();
  if (phase === 'main') placeJourneyCamera();
  needsRender = true;
}
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);

// ---------------------------------------------------------------- cartelas y colores
const piece = new PieceUI({
  onColor: (stopId, c) => {
    if (stopId === 'trenza') requestColor(c.hex);
    else if (stopId === 'makech') makech.setColor(c.hex);
    else if (stopId === 'xux') xux.setColor(c ? c.hex : null);
  },
});

// ---------------------------------------------------------------- recorrido
// la entrada ocupa 3 unidades de recorrido (≈ 2,5 pantallas deslizadas); luego cada pieza, 1
const INTRO_SPAN = 3;
const journey = new Journey(STOPS.length, INTRO_SPAN);
const jui = new JourneyUI({ onGo: (i) => goStop(i), piece });
function goStop(i) {
  if (phase === 'loading') return;
  journey.go(i);
}
const STOP_FOCUS = [
  new THREE.Vector3(0, -0.35, 0),
  new THREE.Vector3(6.1, -0.25, 3.25),
  new THREE.Vector3(9.85, -1.0, 0.55),
];
const sunOffset = sun.position.clone().sub(sun.target.position);
const shadowFocus = new THREE.Vector3();
function placeJourneyCamera() {
  if (!cameraPath) return;
  const c = cameraPath(journey.p);
  camera.position.copy(c.pos);
  camera.lookAt(c.look);
  if (Math.abs(camera.fov - c.fov) > 1e-3) {
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
  }
  // el sol (y su sombra) acompaña a la zona que se mira
  const p = journey.p;
  const i = Math.min(STOP_FOCUS.length - 2, Math.floor(p));
  shadowFocus.lerpVectors(STOP_FOCUS[i], STOP_FOCUS[i + 1], clamp(p - i, 0, 1));
  sun.target.position.copy(shadowFocus);
  sun.position.copy(shadowFocus).add(sunOffset);
  sun.target.updateMatrixWorld();
}

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
const INTRO_END = 11.4;

const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;

let phase = 'loading'; // loading → intro → main
let uiShown = false;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const closeCam = { x: 0, tipY: 0, A: null, W: null, Z: null };

// Encuadre cercano sobre la cola izquierda (adaptado al formato de pantalla).
function computeCloseCamera() {
  const info = rig.info;
  const tanH = Math.tan(THREE.MathUtils.degToRad(BRAID_FOV / 2));
  const aspect = window.innerWidth / window.innerHeight;
  // altura visible de cada encuadre (en horizontal manda el ancho)
  const fit = (h, w) => Math.min(h, w / aspect);
  const tip = info.endL.y;
  closeCam.x = info.endL.x;
  closeCam.tipY = tip;
  const frame = (H, y) => ({ d: H / (2 * tanH), y });
  const hA = fit(0.56, 0.42);
  const hW = 0.74;
  const hZ = fit(0.36, 0.26);
  closeCam.A = frame(hA, tip + 0.2 * hA); // hilo que baja: la punta a ~70 % de la altura
  // formación completa a la vista, sin llegar al gancho ni a la onda (se descubren al final)
  closeCam.W = frame(hW, Math.min(tip + 0.2 * hW, -0.1 - hW / 2));
  closeCam.Z = frame(hZ, tip + 0.3); // detalle de la trenza ya hecha
}

// La entrada es una función del desplazamiento (t = segundos "de guion", no de reloj).
function setIntro(t) {

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
  // los cabos son haces de hilos: sólo un alma fina les da cuerpo mientras se trenzan; la trenza
  // "sólida" aparece al final, cuando la cámara ya se aleja
  introP.tube = 0.5 * easeInOut(seg(t, 4.9, 5.6)) + 0.5 * easeInOut(seg(t, 10.2, 10.9));
  // trenzado a mano: el frente avanza a golpes, un cruce cada vez (pasa un cabo, pausa…),
  // hasta el final de la cola
  const END = 0.08;
  const NSTEP = 13;
  const STEP = (0.52 - END) / NSTEP;
  const u = seg(t, 5.6, 9.0) * NSTEP;
  const kk = Math.min(NSTEP - 1, Math.floor(u));
  const stepped = 0.52 - STEP * (kk + smoothstep(0.08, 0.72, u - kk));
  introP.front = t < 5.6 ? lerp(0.74, 0.52, easeInOut(seg(t, 5.0, 5.6))) : Math.max(END, stepped);
  introP.scale = lerp(0.13, 1, easeInOut(seg(t, 3.0, 6.0)));
  // cierre (de cerca): las últimas vueltas se recogen en el cuello, que se enrolla, y el fleco cae
  const closing = easeInOut(seg(t, 9.0, 9.8));
  introP.done = closing;
  introP.tipEnd = lerp(0.085, -0.2, closing);
  if (threads) {
    threads.mesh.visible = t > 2.4 && t < 10.95;
    threads.set({
      bloom, spray, gather, time: t, tube: introP.tube, tipEnd: introP.tipEnd, taper: introP.taper,
      front: lerp(introP.front, -0.4, closing), done: 0,
    });
  }
  braid.update(rig.center, BRAID.z, introSt);
  // la borla izquierda: el cuello se enrolla vuelta a vuelta y luego cae el fleco
  const wrap = easeInOut(seg(t, 9.0, 9.9));
  tassels.L.mesh.visible = t > 9.0;
  tassels.L.uniforms.uWrap.value = wrap;
  tassels.L.uniforms.uDrop.value = easeOut(seg(t, 9.5, 10.4));

  // cámara: cerca del hilo → se abre para ver toda la cola → se acerca despacio a los hilos
  // mientras se trenzan → se aleja: la pieza ya está colgada en el muro
  const { A, W } = closeCam;
  const wide = easeInOut(seg(t, 2.6, 5.4));
  const near = easeInOut(seg(t, 5.6, 9.4));
  let d = lerp(A.d, W.d, wide) * (1 - 0.16 * near);
  let y = lerp(A.y, W.y, wide) + (closeCam.tipY + introP.front - W.y) * 0.25 * near;
  d *= 1 - 0.04 * seg(t, 0, 2.6); // un respiro casi imperceptible al principio
  camPos.set(closeCam.x, y, BRAID.z + d);
  camLook.set(closeCam.x, y, 0);
  const away = easeInOut(seg(t, 10.0, INTRO_END - 0.1));
  camPos.lerp(finalCam.pos, away);
  camLook.lerp(finalCam.look, away);
  applyCamera(camPos, camLook);

  rim.intensity = 1.6 * (1 - away);
  if (t > 0.8 && t < 4.9) introLine.classList.add('on');
  else introLine.classList.remove('on');
  document.body.classList.toggle('lit', t > 10.6);
}

function disposeThreads() {
  if (!threads) return;
  scene.remove(threads.mesh);
  threads.dispose();
  threads = null;
}

// Volver a la entrada desplazándose hacia arriba: la trenza se "deshace" con el gesto.
function enterIntro() {
  phase = 'intro';
  document.body.classList.add('intro');
  jui.setTravelling(true);
  if (drag) {
    drag = null;
    canvas.classList.remove('grabbing');
  }
  rig.setRest();
  rig.step(0.016);
  computeCloseCamera();
}

function endIntro() {
  phase = 'main';
  document.body.classList.remove('intro');
  jui.setTravelling(false);
  prevTravel = false;
  lastP = -1;
  placeJourneyCamera();
  rim.intensity = 0;
  introLine.classList.remove('on');
  document.body.classList.add('lit');
  tassels.L.mesh.visible = tassels.R.mesh.visible = true;
  tassels.L.uniforms.uWrap.value = 1;
  tassels.L.uniforms.uDrop.value = 1;
  rig.active = true; // reconstruye la trenza colgada definitiva
  showMainUI();
  needsRender = true;
}


let nudgeTimer = 0;
let interacted = false;
function showMainUI() {
  if (uiShown) return;
  uiShown = true;
  jui.setStop(0);
  document.body.classList.add('ui-on');
  nudgeTimer = setTimeout(() => {
    if (!interacted && !REDUCED_MOTION && journey.index === 0) rig.nudge(0);
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
  piece.touchedPiece('trenza');
}

// Flecos de las otras piezas: el dedo los aparta y los hace balancear.
const fringePlane = new THREE.Plane();
const fringeN = new THREE.Vector3();
const fringeHit = new THREE.Vector3();
function pickFringe(cx, cy, only) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  for (const f of fringes) {
    if (only ? f !== only : f.stop !== journey.index) continue;
    const o = f.group.position;
    camera.getWorldDirection(fringeN);
    fringeN.y = 0;
    fringeN.normalize().negate();
    fringePlane.setFromNormalAndCoplanarPoint(fringeN, o);
    if (!raycaster.ray.intersectPlane(fringePlane, fringeHit)) continue;
    const rel = fringeHit.clone().sub(o);
    const inside = Math.hypot(rel.x, rel.z) < f.hit.r + 0.06 && rel.y > f.hit.y0 - 0.05 && rel.y < f.hit.y1;
    // el punto del dedo en coordenadas de la pieza (que puede estar girada)
    const local = f.group.worldToLocal(fringeHit.clone());
    if (inside || only) return { f, local, world: fringeHit.clone() };
  }
  return null;
}

let swipe = null;
let fringeTouch = null;
let hoverFringe = null;

// Cursor propio en escritorio: anillo fino que crece sobre lo que se puede tocar.
const cursorEl = $('cursor');
function setGrab(on) {
  canvas.classList.toggle('can-grab', on);
  cursorEl.classList.toggle('big', on || !!drag || !!fringeTouch);
}
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  cursorEl.classList.toggle('on', phase === 'main' && (e.target === canvas || !!drag));
});

// Cerca de una pieza (no hay paradas: el recorrido es continuo) se puede tocar.
const NEAR = 0.12;
function nearPiece() {
  const i = Math.round(journey.p);
  return Math.abs(journey.p - i) < NEAR ? i : -1;
}
// cuánto hay que deslizar para pasar de una pieza a la siguiente
const scrollPx = () => window.innerHeight * 0.85;

canvas.addEventListener('pointerdown', (e) => {
  if (phase === 'loading' || drag) return;
  canvas.setPointerCapture(e.pointerId);
  const near = phase === 'main' ? nearPiece() : -1;
  if (near === 0) {
    const target = pickTarget(e.clientX, e.clientY);
    const p = target && toWorld(e.clientX, e.clientY);
    if (target && p) {
      e.preventDefault();
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
      return;
    }
  }
  if (near > 0) {
    const hit = pickFringe(e.clientX, e.clientY);
    if (hit) {
      fringeTouch = { id: e.pointerId, f: hit.f, last: hit.world, t: performance.now(), x: e.clientX };
      hit.f.swing.touch(hit.local, 0.7);
      hit.f.turn.drag(0, 1 / 60);
      canvas.classList.add('grabbing');
    }
  }
  // el dedo "atrapa" el recorrido donde esté (como al tocar una página que se desliza)
  journey.setTarget(journey.s);
  const now = performance.now();
  swipe = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastY: e.clientY, lastT: now, v: 0, base: journey.s, axis: null };
});

canvas.addEventListener('pointermove', (e) => {
  if (drag) {
    if (e.pointerId !== drag.id) return;
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    if (drag.type === 'wave') rig.dragTo(drag.wave, drag.d0 + (drag.y0 - p.y));
    else rig.dragTail(p.x, p.y);
    return;
  }
  if (swipe && e.pointerId === swipe.id) {
    const dx = e.clientX - swipe.x0;
    const dy = e.clientY - swipe.y0;
    // ¿gesto horizontal (girar la pieza) o vertical (recorrer la casa)?
    if (!swipe.axis && Math.hypot(dx, dy) > 9) swipe.axis = Math.abs(dy) > Math.abs(dx) * 1.15 ? 'y' : 'x';
    if (fringeTouch && swipe.axis === 'y') {
      fringeTouch.f.swing.release();
      fringeTouch.f.turn.release();
      fringeTouch = null;
      canvas.classList.remove('grabbing');
    }
    if (fringeTouch) {
      const hit = pickFringe(e.clientX, e.clientY, fringeTouch.f);
      const now = performance.now();
      const dt = Math.max(8, now - fringeTouch.t) / 1000;
      // arrastrar en horizontal hace girar la pieza; el dedo sigue apartando los hilos
      fringeTouch.f.turn.drag((e.clientX - fringeTouch.x) / 110, dt);
      fringeTouch.x = e.clientX;
      fringeTouch.t = now;
      if (hit) {
        fringeTouch.f.swing.touch(hit.local, 0.7);
        fringeTouch.last = hit.world;
      }
    }
    if (swipe.axis === 'y') {
      journey.setTarget(swipe.base - dy / scrollPx());
      const now = performance.now();
      const dts = Math.max(8, now - swipe.lastT) / 1000;
      const v = -(e.clientY - swipe.lastY) / scrollPx() / dts;
      swipe.v += (v - swipe.v) * 0.4;
      swipe.lastY = e.clientY;
      swipe.lastT = now;
    }
    return;
  }
  // ratón sin pulsar: los flecos se apartan al pasar por encima
  if (phase === 'main' && e.pointerType === 'mouse') {
    const near = nearPiece();
    if (near === 0) {
      setGrab(!!pickTarget(e.clientX, e.clientY));
      return;
    }
    const hit = near > 0 && pickFringe(e.clientX, e.clientY);
    if (hit) {
      if (hoverFringe && hoverFringe.f === hit.f) {
        const dx = hit.world.x - hoverFringe.last.x;
        const dz = hit.world.z - hoverFringe.last.z;
        hit.f.swing.kick(clamp(dx * 4, -0.25, 0.25), clamp(-dz * 4, -0.25, 0.25));
      } else if (hoverFringe) hoverFringe.f.swing.release();
      hit.f.swing.touch(hit.local, 0.55);
      hoverFringe = { f: hit.f, last: hit.world };
    } else if (hoverFringe) {
      hoverFringe.f.swing.release();
      hoverFringe = null;
    }
    setGrab(!!hit);
  }
});

function endPointer(e) {
  if (drag && (!e || e.pointerId === drag.id)) {
    if (drag.type === 'wave') rig.release();
    else rig.releaseTail();
    drag = null;
    canvas.classList.remove('grabbing');
  }
  if (fringeTouch && (!e || e.pointerId === fringeTouch.id)) {
    fringeTouch.f.swing.release();
    fringeTouch.f.turn.release();
    fringeTouch = null;
    canvas.classList.remove('grabbing');
  }
  if (swipe && (!e || e.pointerId === swipe.id)) {
    // inercia: el recorrido sigue un poco al soltar (sin paradas)
    if (swipe.axis === 'y' && performance.now() - swipe.lastT < 90) journey.scrollBy(clamp(swipe.v * 0.3, -1.2, 1.2));
    swipe = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('pointerleave', () => {
  if (hoverFringe) {
    hoverFringe.f.swing.release();
    hoverFringe = null;
  }
});

// Rueda / trackpad: desplazamiento continuo (una pantalla y poco ≈ una pieza).
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (phase === 'loading') return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    journey.scrollBy(d / (window.innerHeight * 1.1));
  },
  { passive: false }
);
window.addEventListener('keydown', (e) => {
  if (phase === 'loading') return;
  if (e.target.closest && e.target.closest('button, a, input')) return;
  if (e.key === 'ArrowDown') journey.scrollBy(0.2);
  else if (e.key === 'ArrowUp') journey.scrollBy(-0.2);
  else if (['PageDown', ' '].includes(e.key)) journey.next();
  else if (e.key === 'PageUp') journey.prev();
  else if (e.key === 'Home') journey.go(0);
  else if (e.key === 'End') journey.go(STOPS.length - 1);
  else return;
  e.preventDefault();
});

canvas.tabIndex = 0;

// ---------------------------------------------------------------- bucle
let needsRender = true;
let last = performance.now();

let lastLeaf = 0;
let introDirty = true;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let dirty = needsRender;
  needsRender = false;
  // las hojas se mecen muy despacio: basta con 30 imágenes por segundo cuando nada más se mueve
  sunlight.uTime.value = now / 1000;
  if (phase !== 'loading' && now - lastLeaf > 33) {
    lastLeaf = now;
    dirty = true;
  }

  if (phase !== 'loading') {
    const wasMoving = journey.moving;
    journey.update(dt);
    if (journey.s < journey.intro - 1e-4) {
      if (phase === 'main') enterIntro();
      if (wasMoving || journey.moving || introDirty) {
        setIntro(journey.introT * INTRO_END);
        introDirty = false;
        dirty = true;
      }
    } else if (phase === 'intro') {
      setIntro(INTRO_END);
      endIntro();
    }
  }
  if (phase === 'main') {
    if (rig.step(dt)) {
      syncHung();
      dirty = true;
    }
    dirty = updateJourney(dt, now / 1000) || dirty;
  }
  if (flow.active) {
    updateFlow(dt);
    dirty = true;
  }
  if (dirty) renderer.render(scene, camera);
}

// ---------------------------------------------------------------- recorrido (cada fotograma)
let lastP = -1;
let prevTravel = false;
function updateJourney(dt, time) {
  let dirty = false;
  const p = journey.p;
  const moving = journey.moving;
  if (moving || p !== lastP) {
    placeJourneyCamera();
    dirty = true;
    // el aire que mueve la cámara al pasar
    const speed = Math.abs(p - lastP) / Math.max(dt, 1e-3);
    if (lastP >= 0 && speed > 0.05) {
      for (const f of fringes) {
        const near = 1 - Math.min(1, Math.abs(p - f.stop) / 0.9);
        if (near > 0) f.swing.kick(0.02 * speed * near * Math.sign(p - lastP), 0.012 * speed * near);
      }
    }
    lastP = p;
  }
  const idx = Math.round(p);
  if (Math.abs(p - idx) < NEAR) jui.setStop(idx);
  const travel = Math.abs(p - idx) > NEAR;
  if (travel !== prevTravel) {
    jui.setTravelling(travel);
    prevTravel = travel;
  }
  // luces que se encienden al llegar
  const on = (i) => clamp(1 - Math.abs(p - i) * 1.4, 0, 1);
  makech.setOn(on(1));
  xux.setOn(on(2));
  // sólo se dibuja lo que puede verse
  const showBraid = p < 1.45;
  braid.mesh.visible = pegs.visible = showBraid;
  tassels.L.mesh.visible = tassels.R.mesh.visible = showBraid;
  makech.group.visible = p > 0.25 && p < 2.6;
  xux.group.visible = p > 1.15;
  // al llegar a una pieza por primera vez, media vuelta suave: invita a girarla
  if ((idx === 1 || idx === 2) && Math.abs(p - idx) < 0.05 && Math.abs(journey.spring.v) < 0.2 && !demoSpin[idx]) {
    demoSpin[idx] = true;
    fringes
      .filter((f) => f.stop === idx)
      .forEach((f, k) => setTimeout(() => f.turn.impulse(idx === 1 ? 1.5 : 1.2), 700 + k * 220));
  }
  for (const f of fringes) if (f.turn.step(dt)) dirty = true;
  for (const f of fringes) if (f.swing.step(dt, time)) dirty = true;
  if (makech.dye.step(dt)) dirty = true;
  if (xux.dye.step(dt)) dirty = true;
  return dirty;
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
  computeFinalCamera();
  camera.updateProjectionMatrix();

  // estado inicial (para compilar shaders con todo visible)
  rig.setRest();
  rig.step(0.016);
  syncHung();
  computeCloseCamera();
  applyCamera(finalCam.pos, finalCam.look);
  if (threads) threads.mesh.visible = true; // compilar también su shader antes de empezar
  computeStops();
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
    journey.jump(0);
    endIntro();
  } else {
    phase = 'intro';
    document.body.classList.add('intro');
    jui.setTravelling(true);
    computeCloseCamera();
    journey.jumpS(0);
    setIntro(0);
    // el hilo empieza a bajar solo, despacio, y espera: el resto lo decide el desplazamiento
    journey.goS(0.42, 0.9);
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
  setTau: (t) => {
    journey.jumpS((t / INTRO_END) * INTRO_SPAN);
    introDirty = true;
  },
  pickTarget,
  journey,
  goStop,
  jui,
  jumpStop: (i) => {
    journey.jump(i);
    needsRender = true;
  },
  jumpP: (p) => {
    journey.jumpS(INTRO_SPAN + p);
    needsRender = true;
  },
  requestColor,
  toScreen,
  render: () => renderer.render(scene, camera),
  renderer,
};

start();
