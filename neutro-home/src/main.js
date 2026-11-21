import './styles.css';
import * as THREE from 'three';

import { BRAID, PEGS, QUALITY, IS_TOUCH, REDUCED_MOTION, COLORS, DEFAULT_COLOR, PALETTE } from './config.js';
import { bakeTextures } from './gl/textures.js';
import { buildEnvironment } from './gl/environment.js';
import { createDyeUniforms } from './gl/fiberMaterial.js';
import { DyeWaves } from './gl/dyeWaves.js';
import { buildRoom, ROOM, PALM_SPOTS } from './scene/room.js';
import { loadPalms } from './scene/palms.js';
import { Makech } from './scene/makech.js';
import { Turntable } from './scene/fringe.js';
import { Atmosphere } from './scene/atmosphere.js';
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
import { Tapestry } from './scene/tapestry.js';
import { LampPair, LAMP } from './scene/floorLamp.js';
import { ShadowCut } from './scene/cut.js';
import { WipWall } from './scene/wipWall.js';
import { Sound } from './audio.js';

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
const camera = new THREE.PerspectiveCamera(BRAID_FOV, window.innerWidth / window.innerHeight, 0.05, 70);

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
const fringes = [{ obj: makech, swing: makech.swing, group: makech.group, hit: makech.hit, stop: 1 }];
// cada pieza gira sobre sí misma (plato giratorio): se ve a 360° y los flecos responden.
// Además el recorrido las hace girar mientras se pasa por delante (la Makech, media vuelta larga).
for (const f of fringes) f.turn = new Turntable(f.group, f.swing);

// La sala (última estancia, ya de noche): el tapiz de flecos en el muro y, a los lados, dos
// lámparas de pie de trenza. Una luz cenital baña el tapiz y su sombra cae sobre la cal.
const SALA_X = 10.05; // tercer tramo de la galería
const LAMP_Z = 0.8;
const sala = new THREE.Group();
const tapestry = new Tapestry({ position: new THREE.Vector3(SALA_X, 0.62, 0) });
const lampPair = new LampPair({
  textures,
  color: COLORS.find((c) => c.id === DEFAULT_COLOR).hex,
  radial: QUALITY.radial,
  positions: [new THREE.Vector3(SALA_X - 1.12, ROOM.floor, LAMP_Z), new THREE.Vector3(SALA_X + 1.12, ROOM.floor, LAMP_Z)],
});
sala.add(tapestry.group, lampPair.group);
scene.add(sala);
const spot = new THREE.SpotLight('#ffd6a2', 0, 0, 0.52, 0.8, 1.3);
// alta y algo de lado (como un foco en el techo): los flecos dejan su sombra en la cal
spot.position.set(SALA_X - 0.5, 2.3, 0.95);
spot.target.position.set(SALA_X + 0.05, -0.25, 0);
spot.castShadow = true;
spot.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap);
spot.shadow.radius = 3.5;
spot.shadow.blurSamples = QUALITY.shadowSamples;
spot.shadow.bias = -0.0006;
spot.shadow.camera.near = 0.5;
spot.shadow.camera.far = 5;
// la sombra del tapiz sólo se recalcula cuando los hilos se mueven
spot.shadow.autoUpdate = false;
spot.shadow.needsUpdate = true;
scene.add(spot, spot.target);
// El final: en el muro del fondo, pintado con spray fucsia (el foco gira hacia él y se mece).
const WIP = new THREE.Vector3(ROOM.right - 0.004, -0.15, 5.0);
const wip = new WipWall({ position: WIP });
scene.add(wip.mesh);
const SPOT_A = { pos: spot.position.clone(), target: spot.target.position.clone(), i: 13 };
const SPOT_B = { pos: new THREE.Vector3(ROOM.right - 2.2, 2.3, WIP.z), target: WIP.clone().setX(ROOM.right), i: 17 };
// La luz de la Makech se reutiliza en la sala (más una segunda): siempre las mismas luces
// (cambiar su número obliga a recompilar los materiales y da tirones).
scene.updateMatrixWorld(true);
scene.attach(makech.light);
const salaLight = new THREE.PointLight(0xffc583, 0, 2.9, 1.6);
scene.add(salaLight);
const salaLightOff = new THREE.Vector3(0, LAMP.height - LAMP.shadeH * 0.55, 0.02);
const pieceLights = [
  { light: makech.light, home: makech.light.position.clone(), dist: makech.light.distance, decay: makech.light.decay },
  { light: salaLight, home: new THREE.Vector3(SALA_X, -0.2, 1.0), dist: 2.9, decay: 1.6 },
];
fringes[0].scrollSpin = (p) => clamp(p - 1, -1.2, 1.2) * 2.4;

// Aire: polvo en la luz y haces de sol que cruzan cada espacio.
const atmosphere = new Atmosphere({
  bounds: { x0: ROOM.left + 0.3, x1: ROOM.right - 0.5, y0: ROOM.floor + 0.2, y1: 2.3, z0: 0.4, z1: ROOM.front - 0.4 },
  motes: IS_TOUCH ? 620 : 900,
  // haces: el punto donde tocan el suelo, delante de cada pieza (bajan desde arriba, del lado del sol)
  shafts: [
    { x: -1.1, y: ROOM.floor, z: 2.3, len: 4.6, w: 0.3 },
    { x: 0.9, y: ROOM.floor, z: 3.3, len: 4.6, w: 0.2 },
    { x: 4.4, y: ROOM.floor, z: 4.3, len: 4.6, w: 0.34 },
    { x: 5.3, y: ROOM.floor, z: 2.0, len: 4.6, w: 0.22 },
    { x: 8.8, y: ROOM.floor, z: 2.4, len: 4.6, w: 0.32 },
    { x: 10.9, y: ROOM.floor, z: 3.6, len: 4.6, w: 0.22 },
  ],
});
atmosphere.setPixelRatio(renderer.getPixelRatio());
scene.add(atmosphere.group);
const demoSpin = {};
// cada cuántos segundos entra un color nuevo (las ondas son lentas: varias recorren la pieza a la vez)
const AUTO_EVERY = { trenza: 1.35, makech: 1.3, sala: 1.5 };
const autoColor = { idx: -1, last: 0 };

const HUNG_PHASE = 0.4;
const rig = new Rig();
const hung = hungStructure(HUNG_PHASE);


// ---------------------------------------------------------------- encuadre
const brandEl = $('brand');
const pieceEl = $('piece');

// Zona libre de la pantalla para encuadrar la pieza: entre el logotipo y los colores.
function freeArea() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const top = brandEl.getBoundingClientRect().bottom + 10;
  // los colores van en columna a la izquierda; las marcas de recorrido a la derecha; la flecha abajo
  const pr = pieceEl.getBoundingClientRect();
  return { x0: Math.max(36, pr.right + 16), x1: w - 40, y0: top, y1: h - 58 };
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
  setCameraBase(pos, look);
  camera.position.copy(pos);
  camera.lookAt(look);
}

// Paradas de las piezas: encuadre que respeta el logotipo y el texto inferior.
const STOP_FRAMES = [
  null, // la trenza usa computeFinalCamera
  // de tres cuartos: detrás, el arco y un trozo del portal con la palmera
  { focus: new THREE.Vector3(6.1, -0.1, 3.25), dir: new THREE.Vector3(0.85, 0, 0.53).normalize(), w: 1.05, h: 1.4 },
  // (lift: la cámara sube y mira algo hacia abajo: menos techo, más pieza)
  { focus: new THREE.Vector3(SALA_X, -0.7, 0.4), dir: new THREE.Vector3(0, 0, -1), w: 2.75, h: 2.7, lift: 0.8 },
  { focus: new THREE.Vector3(ROOM.right, -0.15, 5.0), dir: new THREE.Vector3(1, 0, 0), w: 1.7, h: 1.35 },
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
  if (f.lift) {
    const target = pos.clone().addScaledVector(f.dir, D);
    pos.y += f.lift;
    return { pos, look: target, fov };
  }
  return { pos, look: pos.clone().add(f.dir), fov };
}

function computeStops() {
  const portrait = window.innerWidth < window.innerHeight;
  const fov = portrait ? 48 : 38;
  const S0 = { pos: finalCam.pos.clone(), look: finalCam.look.clone(), fov: 26, stop: 0 };
  const S1 = { ...frameStop(STOP_FRAMES[1], fov), stop: 1 };
  // la sala se mira entera (las dos lámparas y el tapiz): en vertical, un objetivo más angular
  const fov3 = portrait ? 56 : 40;
  // en horizontal manda la altura: se baja un poco para que entren las trenzas del suelo
  const f2 = portrait ? STOP_FRAMES[2] : { ...STOP_FRAMES[2], focus: STOP_FRAMES[2].focus.clone().setY(-0.95), h: 3.25 };
  const S2 = { ...frameStop(f2, fov3), stop: 2 };
  const S3 = { ...frameStop(STOP_FRAMES[3], fov3), stop: 3 };
  S3.pos.x = Math.max(S3.pos.x, ROOM.parts[1].x + 0.45); // dentro de la sala
  S3.look.x = S3.pos.x + 1;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // La galería: de una pieza a la siguiente se cruza el arco transversal; el portal y el patio
  // quedan de lado, apenas entrevistos (luz) — nunca se miran de frente.
  // (la pieza siguiente se descubre enmarcada por el arco, antes de cruzarlo)
  const keys = [
    S0,
    { pos: V(0.4, -0.35, 5.9), look: V(6.1, -0.05, 3.4), fov: (26 + fov) / 2 },
    { pos: V(2.7, -0.3, 4.7), look: V(6.0, -0.12, 3.5), fov },
    S1,
    { pos: V(6.6, -0.45, 6.0), look: V(SALA_X, -0.35, 0.6), fov },
    { pos: V(8.2, -0.45, 5.6), look: V(SALA_X, -0.55, 0.6), fov: (fov + fov3) / 2 },
    S2,
    { pos: V(SALA_X - 0.6, -0.3, 5.9), look: V(ROOM.right, -0.25, 4.4), fov: fov3 },
    S3,
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
    sound.note();
    if (stopId === 'trenza') requestColor(c ? c.hex : COLORS.find((x) => x.id === DEFAULT_COLOR).hex);
    else if (stopId === 'makech') makech.setColor(c.hex);
    else if (stopId === 'sala') lampPair.setColor(c ? c.hex : COLORS.find((x) => x.id === DEFAULT_COLOR).hex);
  },
});

// ---------------------------------------------------------------- sonido, final, saltar
const sound = new Sound();
const soundBtn = $('soundBtn');
soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', String(!!on));
});
const toastEl = $('toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
}
// OUR HISTORY · SHOP: todavía sin destino (la demo es un trabajo en curso)
for (const a of document.querySelectorAll('#endLinks a')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    sound.click();
    toast('COMING SOON');
  });
}
const skipBtn = $('skipIntro');
// SKIP: directo al final (el muro pintado, con OUR HISTORY y SHOP)
let skipping = false;
function skipIntro(e) {
  if (e) e.preventDefault();
  if (phase !== 'intro' || skipping) return;
  skipping = true;
  document.body.classList.add('skipping');
  setTimeout(() => {
    journey.jump(STOPS.length - 1);
    setIntro(INTRO_END);
    endIntro();
    needsRender = true;
    skipping = false;
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('skipping')));
  }, 450);
}
skipBtn.addEventListener('pointerup', skipIntro);
skipBtn.addEventListener('click', skipIntro);

// ---------------------------------------------------------------- recorrido
// la entrada ocupa 3 unidades de recorrido (≈ 2,5 pantallas deslizadas); luego cada pieza, 1
const INTRO_SPAN = 3.0;
const journey = new Journey(STOPS.length, INTRO_SPAN);
const jui = new JourneyUI({ onGo: (i) => goStop(i), piece });
function goStop(i) {
  if (phase === 'loading') return;
  journey.go(i);
}
const STOP_FOCUS = [
  new THREE.Vector3(0, -0.35, 0),
  new THREE.Vector3(6.1, -0.25, 3.25),
  new THREE.Vector3(SALA_X, -0.8, 0.4),
  new THREE.Vector3(ROOM.right - 0.5, -0.4, 5.0),
];
const sunOffset = sun.position.clone().sub(sun.target.position);
const shadowFocus = new THREE.Vector3();
// Juegos de luz: la tarde avanza con el recorrido. El sol baja, se vuelve dorado y luego de
// atardecer; las sombras se alargan y giran; las lámparas cobran protagonismo.
const SUN_KEYS = [
  // hora dorada: sol bajo y cálido, sombras largas, polvo que brilla en los haces
  { dir: new THREE.Vector3(-1.55, 1.6, 1.45), color: new THREE.Color('#ffe0b8'), i: 3.5, hemi: 0.3, env: 0.52, glow: 1.35 },
  { dir: new THREE.Vector3(-1.95, 1.05, 1.2), color: new THREE.Color('#ffcb8e'), i: 3.3, hemi: 0.27, env: 0.48, glow: 1.6 },
  // anochecer: un último sol rasante y anaranjado; mandan las lámparas y la luz sobre el tapiz
  { dir: new THREE.Vector3(-2.4, 0.42, 0.8), color: new THREE.Color('#ff9658'), i: 1.5, hemi: 0.19, env: 0.34, glow: 0.5 },
  { dir: new THREE.Vector3(-2.6, 0.3, 0.7), color: new THREE.Color('#ff8a50'), i: 1.1, hemi: 0.16, env: 0.3, glow: 0.4 },
];
const sunDirTmp = new THREE.Vector3();
function updateSun(p) {
  const i = Math.min(SUN_KEYS.length - 2, Math.floor(p));
  const f = clamp(p - i, 0, 1);
  const e = f * f * (3 - 2 * f);
  const a = SUN_KEYS[i];
  const b = SUN_KEYS[i + 1];
  sunDirTmp.lerpVectors(a.dir, b.dir, e).normalize();
  sunlight.uSunDir.value.copy(sunDirTmp);
  sunOffset.copy(sunDirTmp).multiplyScalar(2.75);
  sun.color.lerpColors(a.color, b.color, e);
  sun.intensity = lerp(a.i, b.i, e);
  hemi.intensity = lerp(a.hemi, b.hemi, e);
  scene.environmentIntensity = lerp(a.env, b.env, e);
  atmosphere.uniforms.uGlow.value = lerp(a.glow, b.glow, e);
  atmosphere.uniforms.uColor.value.copy(sun.color).lerp(new THREE.Color('#ffffff'), 0.25);
  const dusk = clamp(p - 1, 0, 1) + 0.2 * clamp(p - 2, 0, 1);
  sunlight.uLeaf.value = lerp(1, 0.45, dusk);
  sunlight.uArcadeK.value = 1 - 0.5 * dusk;
  room.userData.sky.material.uniforms.uDusk.value = dusk;
}

// Cámara "en mano": respira apenas y, al recorrer, un paso casi imperceptible.
const camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const swayOff = new THREE.Vector3();
const swayR = new THREE.Vector3();
const swayU = new THREE.Vector3();
const swayF = new THREE.Vector3();
function setCameraBase(pos, look) {
  camBase.pos.copy(pos);
  camBase.look.copy(look);
}
function applySway(time) {
  const dist = camBase.pos.distanceTo(camBase.look);
  const amp = Math.min(0.012, 0.0035 * Math.max(0.6, Math.min(3, dist)));
  const v = Math.min(1, Math.abs(journey.spring.v) * 1.4);
  const s = journey.s;
  swayF.subVectors(camBase.look, camBase.pos).normalize();
  swayR.crossVectors(swayF, up).normalize();
  swayU.crossVectors(swayR, swayF);
  const x = Math.sin(time * 0.53) * amp + Math.sin(time * 1.31) * amp * 0.35 + Math.sin(s * Math.PI * 3) * 0.006 * v;
  const y = Math.sin(time * 0.71 + 1.0) * amp * 0.7 + Math.abs(Math.sin(s * Math.PI * 3)) * 0.012 * v;
  swayOff.copy(swayR).multiplyScalar(x).addScaledVector(swayU, y);
  camera.position.copy(camBase.pos).add(swayOff);
  camera.lookAt(swayOff.multiplyScalar(0.35).add(camBase.look));
}

// Al pasar junto a una pieza la cámara la rodea un poco (como caminando a su alrededor).
const MAKECH_AXIS = new THREE.Vector3(6.1, 0, 3.25);
function orbit(v, c, a) {
  const dx = v.x - c.x;
  const dz = v.z - c.z;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  v.x = c.x + dx * cs - dz * sn;
  v.z = c.z + dx * sn + dz * cs;
}
function placeJourneyCamera() {
  if (!cameraPath) return;
  const c = cameraPath(journey.p);
  // al acercarse, la entrada por el arco queda limpia; al alejarse la cámara rodea la pieza
  const o1 = journey.p - 1;
  if (o1 > -0.3 && o1 < 0.5) {
    const a = o1 < 0 ? -0.35 * o1 * (1 - smoothstep(0.12, 0.3, -o1)) : -0.62 * o1 * (1 - smoothstep(0.15, 0.5, o1));
    orbit(c.pos, MAKECH_AXIS, a);
    orbit(c.look, MAKECH_AXIS, a);
  }
  setCameraBase(c.pos, c.look);
  camera.position.copy(c.pos);
  camera.lookAt(c.look);
  updateSun(journey.p);
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

// El color de la trenza entra por la borla izquierda y la recorre en una onda lenta; si llega otro
// color antes de que termine, las ondas conviven.
const braidWaves = new DyeWaves(dye, { duration: 3.3 });
function requestColor(hex) {
  braidWaves.push(hex);
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
// un hilo baja → se abre en muchísimas hebras → tres cabos. Luego la cámara deja los hilos y
// mira el muro: el sol sube y roza la cal, y el trenzado (y el cierre de la borla) se ve sólo
// en sombra, entre las hojas. Al final la sombra se recoge, la cámara se aleja y la pieza ya
// está colgada.
const introP = {
  cut: 0.8, front: 0.74, scale: 0.13, split: 0, loose: 1, thin: 0.42, core: 0.62, spread: 0, sep: 1.3,
  bloom: 0, tube: 0, tipEnd: 0.085, taper: 0.13, done: 0, airy: 0, phase: HUNG_PHASE,
};
const introSt = introStructure(introP);
const introLine = $('introLine');
const INTRO_END = 10.3;

// El sol de la entrada no se mueve (la misma luz de siempre); sólo el mapa de sombras se concentra
// en la zona de la sombra, para que sea más definida.
const SUN_REST = {
  target: sun.target.position.clone(),
  offset: sun.position.clone().sub(sun.target.position), // como al principio de siempre
  frustum: { left: -1.4, right: 1.4, top: 1.25, bottom: -1.45 },
};
const SUN_TIGHT = 0.6; // media anchura del mapa de sombras sobre la zona de la sombra
// La sombra de la trenza larga: justo debajo de los hilos, con el nudo y el corte más abajo.
const SHADOW_AT = { yTop: -0.8, yKnot: -1.38, frameY: -1.42 };
let shadowCut = null; // se construye al arrancar (necesita la trenza colgada en reposo)

const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;

let phase = 'loading'; // loading → intro → main
let uiShown = false;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const closeCam = { x: 0, tipY: 0, A: null, W: null, S: null };

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
  const frame = (H, y, x = info.endL.x) => ({ d: H / (2 * tanH), y, x });
  const hA = fit(0.56, 0.42);
  const hW = 0.74;
  closeCam.A = frame(hA, tip + 0.2 * hA); // hilo que baja: la punta a ~70 % de la altura
  // formación completa a la vista, sin llegar al gancho ni a la onda (se descubren al final)
  closeCam.W = frame(hW, Math.min(tip + 0.2 * hW, -0.1 - hW / 2));
  // subida: la cámara sube por los hilos hasta donde se vuelven trenza, junto al gancho
  const hR = fit(0.62, 0.46);
  closeCam.R = frame(hR, -0.1);
  // la sombra: el nudo arriba, el punto del corte y las hebras largas debajo (en horizontal algo
  // a la izquierda: la otra cola queda fuera de cuadro)
  const hS = fit(0.8, 1.2);
  closeCam.shadowX = info.endL.x + 0.05;
  closeCam.portrait = aspect < 1 ? 1 : 0.4;
  closeCam.S = frame(hS, SHADOW_AT.frameY, closeCam.shadowX - (aspect > 1 ? 0.14 : 0));
}

// Luz de la entrada (sh = 0..1): la sombra se vuelve más definida y algo más contrastada.
const sunTmp = new THREE.Vector3();
function introLight(sh, rimK) {
  const a = SUN_KEYS[0];
  sun.color.copy(a.color);
  sun.intensity = lerp(a.i, 3.5, sh);
  hemi.intensity = lerp(a.hemi, 0.4, sh);
  scene.environmentIntensity = lerp(a.env, 0.66, sh);
  sun.shadow.radius = lerp(QUALITY.shadowRadius, 2.6, sh);
  sunlight.uArcadeK.value = 1;
  sunlight.uLeaf.value = 1;
  atmosphere.uniforms.uGlow.value = a.glow;
  rim.intensity = 1.6 * rimK;
  const S = closeCam.S;
  sun.target.position.copy(SUN_REST.target).lerp(sunTmp.set(S.x, S.y, 0), sh);
  sun.position.copy(sun.target.position).add(SUN_REST.offset);
  sun.target.updateMatrixWorld();
  const c = sun.shadow.camera;
  const f = SUN_REST.frustum;
  c.left = lerp(f.left, -SUN_TIGHT, sh);
  c.right = lerp(f.right, SUN_TIGHT, sh);
  c.top = lerp(f.top, SUN_TIGHT, sh);
  c.bottom = lerp(f.bottom, -SUN_TIGHT, sh);
  c.updateProjectionMatrix();
}
function restoreSunFrustum() {
  sun.shadow.radius = QUALITY.shadowRadius;
  Object.assign(sun.shadow.camera, SUN_REST.frustum);
  sun.shadow.camera.updateProjectionMatrix();
}

// La entrada es una función del desplazamiento (t = segundos "de guion", no de reloj).
let lastIntroT = 0;
function setIntro(t) {
  // 1) el hilo nace: baja por la cola y se abre en muchísimas hebras  2) la cámara baja por el
  // muro y, bajo los hilos, aparece la sombra de la trenza ya hecha, larguísima, con su nudo
  // 3) tijeras de sastre: corte, el sobrante cae; la trenza se levanta  4) la cámara se aleja
  introP.cut = 0.63 * (1 - easeOut(seg(t, 0.05, 3.0)));
  const bl = seg(t, 2.9, 5.0);
  const bloom = 0.66 * bl * bl;
  const spray = easeInOut(seg(t, 2.9, 4.7));
  // la trenza real se completa cuando ya está fuera de cuadro (la cámara mira la sombra)
  const fin = easeInOut(seg(t, 6.1, 6.3));
  introP.bloom = bloom;
  introP.split = fin;
  introP.spread = 0.6 * fin;
  introP.tube = fin;
  introP.front = lerp(0.74, 0.08, fin);
  introP.scale = lerp(0.13, 1, easeInOut(seg(t, 3.2, 5.6)));
  introP.done = fin;
  introP.tipEnd = lerp(0.085, -0.2, fin);
  introP.airy = 0;
  if (threads) {
    threads.mesh.visible = t > 2.4 && t < 6.3;
    threads.set({
      bloom, spray, gather: fin, time: t, tube: introP.tube, tipEnd: introP.tipEnd, taper: introP.taper,
      front: lerp(introP.front, -0.4, fin), done: 0,
    });
  }
  braid.update(rig.center, BRAID.z, introSt);
  tassels.L.place(rig.info.endL, BRAID.z, 0);
  tassels.L.mesh.visible = t > 6.2;
  tassels.L.uniforms.uWrap.value = 1;
  tassels.L.uniforms.uDrop.value = 1;
  tassels.L.uniforms.uLag.value = 0;

  // la sombra larga (sólo sombra): tijeras despacio, corte, el sobrante cae, se levanta
  const CUT_T = 7.9;
  if (lastIntroT < CUT_T - 0.03 && t >= CUT_T - 0.03) sound.snip();
  lastIntroT = t;
  sound.setDusk(0);

  const after = t - CUT_T;
  if (shadowCut) {
    const lift = easeInOut(seg(t, 8.55, 9.15));
    shadowCut.set({
      visible: t > 4.4 && t < 9.15,
      grow: easeInOut(seg(t, 4.4, 5.3)),
      long: 3.3,
      cut: t >= CUT_T,
      fall: Math.max(0, after) * 1.1,
      enter: easeOut(seg(t, 6.9, 7.55)),
      open: 0.62 * (1 - easeInOut(seg(t, 7.62, CUT_T))) + 0.18 * easeOut(seg(t, 8.05, 8.25)),
      away: easeInOut(seg(t, 8.25, 8.7)),
      lift,
      sway: after > 0 ? 0.1 * Math.sin(after * 6.5) * Math.exp(-after * 2.4) : 0,
    });
  }

  // cámara: cerca del hilo que nace → baja despacio por el muro hasta la sombra → se acerca un
  // poco mientras se corta → se aleja: la pieza ya está colgada en el muro
  const { A, S } = closeCam;
  const down = easeInOut(seg(t, 4.7, 6.5));
  // mientras llegan las tijeras el encuadre se abre un poco hacia ellas (se ven enteras)
  const scis = easeInOut(seg(t, 6.6, 7.4)) * (1 - easeInOut(seg(t, 8.3, 8.9)));
  const d = lerp(A.d * (1 - 0.04 * seg(t, 0, 2.6)), S.d * (1 + 0.18 * scis), down);
  const y = lerp(A.y, S.y - 0.06 * scis, down);
  const x = lerp(closeCam.x, S.x + 0.09 * scis * closeCam.portrait, down);
  camPos.set(x, y, BRAID.z + d);
  camLook.set(x, y, 0);
  const away = easeInOut(seg(t, 8.9, INTRO_END - 0.1));
  camPos.lerp(finalCam.pos, away);
  camLook.lerp(finalCam.look, away);
  applyCamera(camPos, camLook);

  const sh = easeInOut(seg(t, 4.8, 6.3)) * (1 - easeInOut(seg(t, 8.9, 9.6)));
  introLight(sh, 1 - away);
  if (t > 0.15 && t < 4.4) introLine.classList.add('on');
  else introLine.classList.remove('on');
  document.body.classList.toggle('lit', t > INTRO_END - 0.8);
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
  skipBtn.classList.add('on');
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
  skipBtn.classList.remove('on');
  document.body.classList.remove('intro');
  jui.setTravelling(false);
  prevTravel = false;
  lastP = -1;
  if (shadowCut) shadowCut.group.visible = false;
  tassels.L.uniforms.uLag.value = 0;
  restoreSunFrustum();
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

// Un dedo "fantasma" enseña el gesto una sola vez: tira de la onda de la trenza; en la Makech,
// la hace girar. Si el visitante toca antes, se aparta.
const ghostEl = $('ghostFinger');
function ghostAnim(dur, frameFn, done) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    if (interacted || phase !== 'main') {
      ghostEl.style.opacity = '0';
      done && done(true);
      return;
    }
    frameFn(k);
    needsRender = true;
    if (k < 1) requestAnimationFrame(step);
    else done && done(false);
  };
  requestAnimationFrame(step);
}
function ghostAt(x, y, a, sc = 1) {
  ghostEl.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
  ghostEl.style.opacity = a.toFixed(3);
}
function ghostBraid() {
  const w = rig.info.waves[0];
  const p0 = toScreen(w.x, w.y);
  const d0 = rig.depth[0].x;
  const pull = 70; // px
  let grabbed = false;
  ghostAnim(
    2600,
    (k) => {
      const appear = smoothstep(0, 0.15, k);
      const press = smoothstep(0.15, 0.25, k);
      const move = smoothstep(0.25, 0.65, k);
      const leave = smoothstep(0.72, 0.95, k);
      if (press > 0.5 && !grabbed) {
        grabbed = true;
        rig.grab(0);
      }
      if (grabbed && k < 0.7) rig.dragTo(0, d0 + (pull * move) / finalCam.pxpm);
      if (k >= 0.7 && rig.dragging === 0) {
        rig.release();
        rig.depth[0].target = d0; // la onda vuelve a su sitio (con su rebote)
        rig.active = true;
      }
      ghostAt(p0.x, p0.y + pull * move - 10 * leave, appear * (1 - leave), 1.15 - 0.15 * press);
    },
    () => {
      if (rig.dragging === 0) rig.release();
      rig.depth[0].target = d0;
      rig.active = true;
      ghostEl.style.opacity = '0';
    }
  );
}
function ghostSpin(f) {
  const c = toScreen(f.group.position.x, f.group.position.y - 0.5, f.group.position.z);
  let last = c.x - 70;
  let t = performance.now();
  ghostAnim(
    2200,
    (k) => {
      const appear = smoothstep(0, 0.15, k);
      const move = smoothstep(0.2, 0.62, k);
      const leave = smoothstep(0.7, 0.95, k);
      const x = c.x - 70 + 140 * move;
      if (k > 0.2 && k < 0.66) {
        const now = performance.now();
        f.turn.drag((x - last) / 110, Math.max(1 / 120, (now - t) / 1000));
        f.swing.touch(new THREE.Vector3(0, -0.5, 0.2), 0.4);
        t = now;
      } else if (k >= 0.66 && f.turn.held) {
        f.turn.release();
        f.swing.release();
      }
      last = x;
      ghostAt(x, c.y, appear * (1 - leave), 1);
    },
    () => {
      if (f.turn.held) f.turn.release();
      f.swing.release();
      ghostEl.style.opacity = '0';
    }
  );
}
function showMainUI() {
  if (uiShown) return;
  uiShown = true;
  jui.setStop(0);
  document.body.classList.add('ui-on');
  nudgeTimer = setTimeout(() => {
    if (!interacted && !REDUCED_MOTION && journey.index === 0 && !journey.moving) ghostBraid();
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

// La sala: las lámparas (un toque las enciende o apaga) y el tapiz (el dedo aparta los hilos).
const tapPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.05);
function setRay(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function tapestryLocal(cx, cy) {
  setRay(cx, cy);
  if (!raycaster.ray.intersectPlane(tapPlane, fringeHit)) return null;
  return tapestry.group.worldToLocal(fringeHit.clone());
}
function pickSala(cx, cy) {
  setRay(cx, cy);
  camera.getWorldDirection(fringeN);
  fringeN.y = 0;
  fringeN.normalize().negate();
  for (const l of lampPair.lamps) {
    const o = l.group.position;
    fringePlane.setFromNormalAndCoplanarPoint(fringeN, o);
    if (!raycaster.ray.intersectPlane(fringePlane, fringeHit)) continue;
    const ry = fringeHit.y - o.y;
    const rr = Math.hypot(fringeHit.x - o.x, fringeHit.z - o.z);
    const maxR = ry > LAMP.height - LAMP.shadeH - 0.03 ? LAMP.shadeR + 0.05 : ry < 0.28 ? 0.36 : 0.16;
    if (rr < maxR && ry > -0.03 && ry < LAMP.height + 0.04) return { kind: 'lamp', lamp: l };
  }
  const local = tapestryLocal(cx, cy);
  if (local && tapestry.contains(local)) return { kind: 'tapestry', local };
  return null;
}

let swipe = null;
let fringeTouch = null;
let hoverFringe = null;
let tapTouch = null;
let hoverTap = false;

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

// Desplazar y tocar con el mismo dedo: el gesto dice la intención.
//  · gesto rápido (aunque empiece sobre una pieza) → recorre la casa;
//  · dedo quieto un instante o movimiento lento sobre una pieza → la agarra (un anillo bajo el
//    dedo lo confirma y, mientras no se suelte, la página no se mueve);
//  · en las lámparas, el gesto horizontal siempre las hace girar;
//  · un toque breve sobre una pieza → la pieza reacciona.
const HOLD_MS = 160;
const FLICK = 0.45; // px/ms: más rápido que esto es desplazarse
const ringEl = $('touchRing');
function ring(on, x, y) {
  if (x !== undefined) ringEl.style.transform = `translate(${x}px, ${y}px)`;
  ringEl.classList.toggle('on', on);
}

function grabNow(sw, x, y) {
  interacted = true;
  const c = sw.pending;
  sw.pending = null;
  clearTimeout(sw.timer);
  if (!c) return;
  sw.grabbed = true;
  if (c.kind === 'braid') {
    const p0 = toWorld(sw.x0, sw.y0);
    if (!p0) return;
    if (c.target.type === 'wave') {
      drag = { id: sw.id, type: 'wave', wave: c.target.i, y0: p0.y, d0: rig.depth[c.target.i].x };
      rig.grab(c.target.i);
      const p = toWorld(x, y);
      if (p) rig.dragTo(drag.wave, drag.d0 + (drag.y0 - p.y));
    } else {
      drag = { id: sw.id, type: 'tail', side: c.target.side };
      rig.grabTail(c.target.side, c.target.grab);
      const p = toWorld(x, y);
      if (p) rig.dragTail(p.x, p.y);
    }
    markInteracted();
  } else if (c.kind === 'tapestry') {
    tapTouch = { id: sw.id, last: c.hit.local.clone() };
    tapestry.swing.touch(c.hit.local, 1);
  } else {
    const hit = c.hit;
    fringeTouch = { id: sw.id, f: hit.f, last: hit.world, t: performance.now(), x: sw.x0 };
    hit.f.swing.touch(hit.local, 0.7);
    hit.f.turn.drag(0, 1 / 60);
  }
  canvas.classList.add('grabbing');
  if (sw.touch) ring(true, x, y);
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase === 'loading' || drag || swipe) return;
  canvas.setPointerCapture(e.pointerId);
  const near = phase === 'main' ? nearPiece() : -1;
  let candidate = null;
  if (near === 0) {
    const target = pickTarget(e.clientX, e.clientY);
    if (target) candidate = { kind: 'braid', target };
  } else if (near >= 0 && STOPS[near].id === 'sala') {
    const hit = pickSala(e.clientX, e.clientY);
    if (hit) candidate = { kind: hit.kind, hit };
  } else if (near > 0) {
    const hit = pickFringe(e.clientX, e.clientY);
    if (hit) candidate = { kind: 'fringe', hit };
  }
  // el dedo "atrapa" el recorrido donde esté (como al tocar una página que se desliza)
  journey.setTarget(journey.s);
  const now = performance.now();
  swipe = {
    id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, lastY: e.clientY, lastT: now, v: 0,
    base: journey.s, axis: null, pending: candidate, grabbed: false, touch: e.pointerType !== 'mouse',
    cx: e.clientX, cy: e.clientY, stamp: e.timeStamp,
  };
  if (!candidate) return;
  e.preventDefault();
  if (candidate.kind === 'lamp') {
    // la lámpara no se agarra: un toque la enciende o la apaga
  } else if (e.pointerType === 'mouse') {
    grabNow(swipe, e.clientX, e.clientY); // con ratón no hay conflicto: la rueda desplaza
  } else {
    // dedo quieto: se "arma" (aparece el anillo); la pieza se agarra al moverse despacio
    const sw = swipe;
    sw.timer = setTimeout(() => {
      if (swipe === sw && sw.pending && !sw.axis) ring(true, sw.cx, sw.cy);
    }, HOLD_MS);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (swipe && e.pointerId === swipe.id) {
    swipe.cx = e.clientX;
    swipe.cy = e.clientY;
  }
  if (drag) {
    if (e.pointerId !== drag.id) return;
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    if (drag.type === 'wave') rig.dragTo(drag.wave, drag.d0 + (drag.y0 - p.y));
    else rig.dragTail(p.x, p.y);
    ring(true, e.clientX, e.clientY);
    return;
  }
  if (swipe && e.pointerId === swipe.id) {
    const dx = e.clientX - swipe.x0;
    const dy = e.clientY - swipe.y0;
    const dist = Math.hypot(dx, dy);
    // decidir la intención en cuanto el dedo se mueve un poco
    if (swipe.pending && dist > 10) {
      // tiempos del propio gesto (no de cuándo se procesa: el teléfono puede ir ocupado)
      const elapsed = Math.max(1, e.timeStamp - swipe.stamp);
      const speed = dist / elapsed;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
      if (swipe.pending.kind === 'lamp') {
        swipe.pending = null;
        clearTimeout(swipe.timer);
        ring(false);
        swipe.axis = horizontal ? 'x' : 'y';
      } else if ((swipe.pending.kind === 'fringe' || swipe.pending.kind === 'tapestry') && horizontal) {
        swipe.axis = 'x';
        grabNow(swipe, e.clientX, e.clientY);
      } else if (!horizontal && (speed > FLICK || elapsed < HOLD_MS * 0.6)) {
        swipe.pending = null;
        clearTimeout(swipe.timer);
        ring(false);
        swipe.axis = 'y';
      } else {
        grabNow(swipe, e.clientX, e.clientY);
        if (drag) return;
      }
    }
    if (!swipe.axis && !swipe.grabbed && dist > 9) swipe.axis = Math.abs(dy) > Math.abs(dx) * 1.15 ? 'y' : 'x';
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
      if (swipe.touch) ring(true, e.clientX, e.clientY);
      return;
    }
    if (tapTouch) {
      const local = tapestryLocal(e.clientX, e.clientY);
      if (local) {
        tapestry.swing.move(local.x - tapTouch.last.x, local.y - tapTouch.last.y);
        tapestry.swing.touch(local, 1);
        tapTouch.last.copy(local);
      }
      if (swipe.touch) ring(true, e.clientX, e.clientY);
      return;
    }
    if (swipe.axis === 'y' && !swipe.grabbed && !swipe.pending) {
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
    if (near >= 0 && STOPS[near].id === 'sala') {
      const hit = pickSala(e.clientX, e.clientY);
      if (hit && hit.kind === 'tapestry') {
        if (hoverTap) tapestry.swing.move(hit.local.x - hoverTap.x, hit.local.y - hoverTap.y);
        tapestry.swing.touch(hit.local, 0.6);
        hoverTap = hit.local;
      } else if (hoverTap) {
        tapestry.swing.release();
        hoverTap = false;
      }
      setGrab(!!hit);
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
  const sw = swipe && (!e || e.pointerId === swipe.id) ? swipe : null;
  // toque breve sobre una pieza: reacciona sin agarrarla
  if (sw && sw.pending) {
    clearTimeout(sw.timer);
    const c = sw.pending;
    if (c.kind === 'braid') {
      if (c.target.type === 'wave') rig.nudge(c.target.i);
      else rig.tails[c.target.side].tassel.v += c.target.side === 'L' ? -0.9 : 0.9;
      rig.active = true;
      markInteracted();
    } else if (c.kind === 'lamp') {
      c.hit.lamp.toggle();
      sound.click();
    } else if (c.kind === 'tapestry') {
      tapestry.swing.pluck(c.hit.local);
    } else {
      c.hit.f.turn.impulse(0.9);
      c.hit.f.swing.kick(0.12, 0.06);
    }
  }
  if (drag && (!e || e.pointerId === drag.id)) {
    if (drag.type === 'wave') rig.release();
    else rig.releaseTail();
    drag = null;
    canvas.classList.remove('grabbing');
  }
  if (tapTouch && (!e || e.pointerId === tapTouch.id)) {
    tapestry.swing.release();
    tapTouch = null;
    canvas.classList.remove('grabbing');
  }
  if (fringeTouch && (!e || e.pointerId === fringeTouch.id)) {
    fringeTouch.f.swing.release();
    fringeTouch.f.turn.release();
    fringeTouch = null;
    canvas.classList.remove('grabbing');
  }
  if (sw) {
    // inercia: el recorrido sigue un poco al soltar (sin paradas)
    if (sw.axis === 'y' && !sw.grabbed) {
      const v = performance.now() - sw.lastT < 90 ? clamp(sw.v * 0.3, -1.2, 1.2) : 0;
      journey.settle(journey.target + v);
    }
    swipe = null;
  }
  ring(false);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('pointerleave', () => {
  if (hoverTap) {
    tapestry.swing.release();
    hoverTap = false;
  }
  if (hoverFringe) {
    hoverFringe.f.swing.release();
    hoverFringe = null;
  }
});

// Rueda / trackpad: desplazamiento continuo (una pantalla y poco ≈ una pieza).
let wheelTimer = 0;
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (phase === 'loading') return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    journey.scrollBy(d / (window.innerHeight * 1.1));
    // al parar la rueda, se posa en la pieza más cercana (si está cerca)
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (journey.target >= journey.intro - 0.05) journey.settle(journey.target);
    }, 220);
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
  // (el primer fotograma puede llegar con una marca de tiempo anterior: nunca un paso negativo)
  const dt = clamp((now - last) / 1000, 0, 0.05);
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
  if (braidWaves.step(dt)) dirty = true;
  if (dirty) {
    if (phase !== 'loading') applySway(now / 1000);
    renderer.render(scene, camera);
    adaptResolution(now);
  }
}

// Resolución adaptable: si el teléfono no llega a ~45 imágenes por segundo, se baja un poco la
// resolución interna (y se recupera cuando sobra); la imagen sigue nítida y el movimiento fluido.
const res = { max: renderer.getPixelRatio(), pr: renderer.getPixelRatio(), ema: 16.7, prev: 0, since: 0 };
function adaptResolution(now) {
  const dtMs = now - res.prev;
  res.prev = now;
  if (dtMs <= 0 || dtMs > 120 || phase === 'loading') return; // sólo cuenta con imágenes seguidas
  res.ema += (dtMs - res.ema) * 0.06;
  if (now - res.since < 1800) return;
  let next = res.pr;
  if (res.ema > 22 && res.pr > 1) next = Math.max(1, res.pr - 0.25);
  else if (res.ema < 14.5 && res.pr < res.max) next = Math.min(res.max, res.pr + 0.25);
  if (next !== res.pr) {
    res.pr = next;
    res.since = now;
    renderer.setPixelRatio(next);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    atmosphere.setPixelRatio(next);
  } else if (now - res.since > 4000) res.since = now - 1800;
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
  // la sala: anochece; se encienden las lámparas y la luz sobre el tapiz
  const night = smoothstep(1.45, 1.95, p);
  if (lampPair.step(dt, night)) dirty = true;
  const lit = smoothstep(1.72, 1.95, p);
  pieceLights.forEach((pl, i) => {
    if (p > 1.72) {
      const l = lampPair.lamps[i];
      pl.light.position.copy(l.group.position).add(salaLightOff);
      pl.light.distance = 2.9;
      pl.light.decay = 1.6;
      pl.light.intensity = 2.1 * l.on * lit;
    } else {
      pl.light.position.copy(pl.home);
      pl.light.distance = pl.dist;
      pl.light.decay = pl.decay;
      if (i > 0) pl.light.intensity = 0;
    }
  });
  // el foco: sobre el tapiz; al final gira hacia el muro pintado y allí se mece un poco
  const spotK = smoothstep(1.55, 2.0, p);
  const toWip = smoothstep(2.1, 2.85, p);
  const sway = smoothstep(2.6, 3.0, p);
  spot.position.lerpVectors(SPOT_A.pos, SPOT_B.pos, toWip);
  spot.target.position.lerpVectors(SPOT_A.target, SPOT_B.target, toWip);
  if (sway > 0) {
    spot.target.position.y += sway * (Math.sin(time * 0.41) * 0.07 + Math.sin(time * 0.93 + 1.2) * 0.025);
    spot.target.position.z += sway * (Math.sin(time * 0.33 + 0.4) * 0.16 + Math.sin(time * 0.77) * 0.04);
    dirty = true;
  }
  spot.target.updateMatrixWorld();
  const spotI = lerp(SPOT_A.i, SPOT_B.i, toWip) * spotK;
  if (Math.abs(spot.intensity - spotI) > 1e-4) dirty = true;
  spot.intensity = spotI;
  if (journey.moving && p > 2 && p < 2.95) spot.shadow.needsUpdate = true;
  // sólo se dibuja lo que puede verse
  const showBraid = p < 1.45;
  braid.mesh.visible = pegs.visible = showBraid;
  tassels.L.mesh.visible = tassels.R.mesh.visible = showBraid;
  makech.group.visible = p > 0.25 && p < 1.9;
  const showSala = p > 1.1;
  if (showSala && !sala.visible) spot.shadow.needsUpdate = true;
  sala.visible = showSala;
  wip.mesh.visible = p > 2.0; // el final no se ve antes (los arcos están alineados)
  sound.setDusk(clamp(p - 1, 0, 1));
  // muestrario vivo: delante de una pieza, cambia sola de color cada pocos segundos (hasta que el
  // visitante elige uno); mientras se toca la pieza, espera
  const st = STOPS[idx];
  const still = Math.abs(p - idx) < 0.06 && Math.abs(journey.spring.v) < 0.25;
  if (still && st.colors && !drag && !fringeTouch && !tapTouch) {
    // (con el reloj real: si el teléfono va lento, el ritmo no cambia)
    if (autoColor.idx !== idx) {
      autoColor.idx = idx;
      autoColor.last = time + (idx === 0 ? 1.2 : 0);
    }
    if (time - autoColor.last >= (AUTO_EVERY[st.id] || 2)) {
      // frases: cuatro colores seguidos y un respiro
      autoColor.n = (autoColor.n || 0) + 1;
      autoColor.last = time + (autoColor.n % 4 === 0 ? 2.8 : 0);
      piece.auto(st.id);
    }
  } else if (!still) autoColor.idx = -1;
  // al llegar a una pieza por primera vez, media vuelta suave: invita a girarla
  if (idx === 1 && Math.abs(p - idx) < 0.05 && Math.abs(journey.spring.v) < 0.2 && !demoSpin[idx]) {
    demoSpin[idx] = true;
    const f = fringes.find((x) => x.stop === idx);
    setTimeout(() => {
      if (!interacted && journey.index === idx && !journey.moving) ghostSpin(f);
      else f.turn.impulse(1.5);
    }, 900);
  }
  for (const f of fringes) if (f.turn.step(dt, f.scrollSpin(p))) dirty = true;
  for (const f of fringes) if (f.swing.step(dt, time)) dirty = true;
  makech.syncSolids();
  if (makech.dye.step(dt)) dirty = true;
  if (sala.visible && tapestry.swing.step(dt, time)) {
    dirty = true;
    spot.shadow.needsUpdate = true; // los hilos se mueven: su sombra también
  }
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
  // palmeras del patio (modelo 3D): antes de compilar, para que no haya tirones al verlas
  try {
    room.add(await loadPalms(PALM_SPOTS, ROOM.floor - 0.12));
  } catch {
    /* sin palmeras: el patio sigue siendo luz */
  }
  computeFinalCamera();
  camera.updateProjectionMatrix();

  // estado inicial (para compilar shaders con todo visible)
  rig.setRest();
  rig.step(0.016);
  syncHung();
  computeCloseCamera();
  shadowCut = new ShadowCut({
    dye,
    textures,
    shadow: { x: closeCam.shadowX, yTop: SHADOW_AT.yTop, yKnot: SHADOW_AT.yKnot },
    sunDir: SUN_REST.offset,
  });
  scene.add(shadowCut.group);
  shadowCut.group.visible = true; // compilar también sus materiales
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
  sala.visible = false; // se muestra al llegar (updateJourney)

  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  await fontsReady;
  wip.draw(); // con las tipografías ya cargadas

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
    updateSun(0);
    setIntro(0);
    // el hilo empieza a bajar solo, despacio, y espera: el resto lo decide el desplazamiento
    journey.goS(0.42, 0.9);
  }
  renderer.render(scene, camera);
  $('loader').classList.add('out');
  document.body.classList.add('ready');
  if (phase === 'intro') skipBtn.classList.add('on');
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
    journey.jumpS(journey.sOf(p));
    needsRender = true;
  },
  requestColor,
  toScreen,
  tapestry,
  lampPair,
  makech,
  fringes,
  pickSala,
  render: () => renderer.render(scene, camera),
  setCam: (p, l) => {
    setCameraBase(new THREE.Vector3(...p), new THREE.Vector3(...l));
    needsRender = true;
  },
  renderer,
};

start();
