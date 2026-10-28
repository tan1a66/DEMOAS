import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { buildMeridaScene } from './map/merida.js';
import { buildHotelScene } from './hotel/scene.js';
import { Aura } from './hotel/aura.js';
import { RF, ROOM, H, SLAB, TOP } from './hotel/building.js';
import { polar } from './hotel/geo.js';
import { CUT_OFF, CAP_COLOR, setCaps, cutPlane } from './hotel/materials.js';
import { PISOS, TIPOS, ESTADOS, CONTACTO, resumen, TOTAL_DEPARTAMENTOS } from './data/hotel.js';
import { Ambience } from './audio.js';

const $ = (id) => document.getElementById(id);
const body = document.body;
const params = new URLSearchParams(location.search);
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const QUALITY = IS_MOBILE
  ? { maxPixelRatio: 1.5, shadowMap: 1024, clouds: 0, samples: 2, mobile: true }
  : { maxPixelRatio: 1.5, shadowMap: 2048, clouds: 34, samples: 4, mobile: false };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
if (params.has('debug')) gsap.ticker.lagSmoothing(0);
const wait = (s) => new Promise((r) => gsap.delayedCall(s, r));

// ---------------------------------------------------------------- Renderer + postproceso
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = QUALITY.mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
// Escena estática: el mapa de sombras se recalcula solo cuando cambia algo (ver Atmosphere/setCut).
renderer.shadowMap.autoUpdate = false;
const resolution = new THREE.Vector2(1, 1);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY.samples }));
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 1.1);
composer.addPass(renderPass);
// Oclusión ambiental (solo escritorio): sombras de contacto en esquinas, muebles y aleros.
const gtao = QUALITY.mobile ? null : new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 1, 1);
if (gtao) {
  gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 2, thickness: 1.5, scale: 1.15 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  gtao.normalMaterial.clippingPlanes = [cutPlane];
  // A media resolución: la oclusión es suave y así cuesta la cuarta parte.
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  // En el pase de normales se ocultan vidrio, follaje, brillos y volúmenes invisibles.
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || o.isLineSegments2 || (m && (m.transparent || m.visible === false || m.userData?.noAO))) o.visible = false;
    });
  };
  composer.addPass(gtao);
}
// Antes del bloom: elimina píxeles NaN/infinitos (reflejos del sol en vidrio o agua que
// desbordan el búfer de media precisión). Sin esto el bloom los convierte en cuadros negros.
const sanitize = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    bool bad(vec4 c) { return any(isnan(c)) || any(isinf(c)); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c)) {
        // Se sustituye por el promedio de los vecinos válidos.
        vec2 px = 1.0 / vec2(textureSize(tDiffuse, 0));
        vec4 acc = vec4(0.0);
        float n = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 o = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * px;
          vec4 s = texture2D(tDiffuse, vUv + o);
          if (!bad(s)) { acc += s; n += 1.0; }
        }
        c = n > 0.0 ? acc / n : vec4(0.0, 0.0, 0.0, 1.0);
      }
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 24.0), 1.0);
    }`,
});
composer.addPass(sanitize);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- Rótulos del prólogo
const captions = {
  show(title, kicker, sub, { stat, unit } = {}) {
    const el = $('pre');
    gsap.to(el, {
      opacity: 0,
      y: -8,
      duration: 0.35,
      onComplete: () => {
        $('pre-title').textContent = title;
        $('pre-kicker').textContent = kicker;
        $('pre-sub').textContent = sub;
        el.classList.toggle('has-stat', stat != null);
        if (stat != null) {
          $('pre-unit').textContent = unit;
          const n = { v: 0 };
          gsap.to(n, { v: stat, duration: 2.2, ease: 'power2.out', onUpdate: () => ($('pre-num').textContent = Math.round(n.v)) });
        }
        gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
      },
    });
  },
  hide() {
    gsap.to($('pre'), { opacity: 0, duration: 0.4 });
  },
};

const mist = (to, duration = 1.2) => gsap.to($('mist'), { opacity: to, duration, ease: 'power2.inOut' });

// ---------------------------------------------------------------- Escenas
let map, hotel, aura, hover, levels;
let active = null;

const loader = {
  set(p, text) {
    $('bar-fill').style.width = `${Math.round(p * 100)}%`;
    if (text) $('loader-step').textContent = text;
  },
};

async function build() {
  loader.set(0.05, 'Tipografías');
  await Promise.race([document.fonts?.ready, wait(2.5)]);
  await nextFrame();
  loader.set(0.2, 'Península de Yucatán');
  await nextFrame();
  map = buildMeridaScene({ canvas, resolution, quality: QUALITY, labelsEl: $('labels-map'), captions });
  loader.set(0.55, 'Arquitectura');
  await nextFrame();
  hotel = buildHotelScene({ renderer, canvas, resolution, quality: QUALITY });
  hotel.atmo.bloom = bloom;
  hotel.sky.material.userData.noAO = true;
  if (gtao) Object.assign(gtao, { scene: hotel.scene, camera: hotel.camera });
  levels = hotel.building.levels;
  aura = new Aura(resolution, { strong: true, light: hotel.inner });
  hover = new Aura(resolution, { strong: false });
  hotel.scene.add(aura.group, hover.group);
  loader.set(0.8, 'Jardines y alberca');
  await nextFrame();
  resize();
  buildElevator();
  map.reset();
  hotel.rig.set(V.sky());
  // Precompilar sombreadores (evita tirones en la primera transición).
  renderer.compile(map.scene, map.camera);
  renderer.compile(hotel.scene, hotel.camera);
  renderer.shadowMap.needsUpdate = true;
  loader.set(1, 'Listo');
  await nextFrame();
}

function setActive(name) {
  active = name;
  const s = name === 'map' ? map : hotel;
  renderPass.scene = s.scene;
  renderPass.camera = s.camera;
  if (name === 'map') {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.12;
    bloom.strength = 0.12;
    hotel.rig.controls.enabled = false;
    if (gtao) gtao.enabled = false;
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    hotel.atmo.apply();
    map.stop();
  }
  $('labels-map').hidden = name !== 'map';
}

// ---------------------------------------------------------------- Vistas del hotel
// En pantallas verticales la cámara se aleja para que quepa el edificio.
const boost = () => Math.min(2.2, Math.pow(Math.max(1, 1.3 / hotel.camera.aspect), 0.8));
const V = {
  sky: () => ({ target: new THREE.Vector3(0, 10, -30), distance: 560, polar: 0.42, azimuth: -0.9 }),
  hero: () => ({ target: new THREE.Vector3(IS_MOBILE ? 0 : -8, hotel.camera.aspect < 1 ? -6 : 12, -28), distance: 150 * boost(), polar: 1.2, azimuth: 0.42 }),
  explore: (y = 13, az = 0.12) => ({ target: new THREE.Vector3(0, y, -40), distance: 118 * boost(), polar: 1.4, azimuth: az }),
};

// ---------------------------------------------------------------- Modos
let mode = 'loader';
let floor = null; // nivel enfocado en Explorar
let sel = null; // departamento elegido
let todChoice = 'atardecer';
let run = 0; // invalida secuencias en curso (visita, recorrido)

// La oclusión ambiental solo se nota de cerca: se activa en la visita del departamento.
function syncAO() {
  if (gtao) gtao.enabled = active === 'hotel' && mode === 'visit' && perf.ratio >= 0.9;
}

function setMode(m) {
  mode = m;
  body.dataset.mode = m;
  syncAO();
  const c = hotel.rig.controls;
  c.autoRotate = m === 'home';
  c.autoRotateSpeed = 0.35;
  c.enabled = active === 'hotel' && !hotel.rig.flying;
}

function setInterior(on) {
  const c = hotel.rig.controls;
  const lvl = sel && levels[sel.nivel];
  if (lvl) {
    lvl.mats.glass.opacity = on ? 0.05 : 0.42;
    lvl.mats.rail.opacity = on ? 0.08 : 0.22;
  }
  hotel.camera.near = on ? 0.1 : 0.5;
  hotel.camera.updateProjectionMatrix();
  aura.lightI = on ? 12 : mode === 'visit' ? 30 : 60;
  Object.assign(c, on
    ? { rotateSpeed: -0.32, enableZoom: false, enablePan: false, minDistance: 0.05, maxDistance: 1, minPolarAngle: 0.35, maxPolarAngle: 2.4 }
    : { rotateSpeed: 0.5, enableZoom: true, enablePan: true, minDistance: 6, maxDistance: 420, minPolarAngle: 0, maxPolarAngle: 1.48 });
}

function goHome({ fly = true } = {}) {
  run++;
  leaveExplore();
  setMode('home');
  if (fly) hotel.rig.flyTo(V.hero(), { duration: 2.6, arc: false });
}

// ---------------------------------------------------------------- Explorar (torre apagada)
function buildElevator() {
  const wrap = $('elev-buttons');
  for (const p of [...PISOS].reverse()) {
    const r = resumen(p);
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.nivel = p.nivel;
    b.innerHTML = `<i>${p.corto}</i><span>${r ? `${r.total} deptos` : p.nivel === 0 ? 'Lobby' : 'Rooftop'}</span>`;
    b.addEventListener('click', () => rideTo(p.nivel));
    wrap.appendChild(b);
  }
  $('fact-deptos').textContent = TOTAL_DEPARTAMENTOS;
}

function enterExplore() {
  run++;
  if (mode === 'visit') exitVisit({ fly: false });
  setMode('explore');
  hotel.atmo.go('explorar', 1.8);
  hotel.building.setFocus(null);
  hotel.rig.flyTo(V.explore(), { duration: 2.4, arc: false });
  floor = null;
  updateFloorUI();
  gsap.fromTo('#explore-hint', { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1.2 });
}

function leaveExplore() {
  if (mode !== 'explore' && mode !== 'visit') return;
  selectUnit(null);
  hover.hide(true);
  focusFloor(null);
  hotel.atmo.go(todChoice, 1.6);
}

function focusFloor(nivel) {
  floor = nivel;
  for (const l of levels) {
    const on = l.nivel === nivel;
    gsap.to(l.shell.material.uniforms.uOpacity, { value: on ? 0.55 : 0, duration: 0.6 });
    gsap.to(l.lines.material, { opacity: on ? 0.9 : 0, duration: 0.6 });
    l.focus = on ? 0.3 : 0;
  }
  updateFloorUI();
}

// El ascensor: la cámara sube o baja al piso elegido y el piso se ilumina.
function rideTo(nivel) {
  if (mode !== 'explore') enterExplore();
  const lvl = levels[nivel];
  if (sel && sel.nivel !== nivel) selectUnit(null);
  focusFloor(nivel);
  hotel.rig.syncFromCamera();
  const s = hotel.rig.state;
  const from = s.ty;
  const y = lvl.mid;
  const dist = THREE.MathUtils.clamp(s.distance, 80 * boost(), 150 * boost());
  hotel.rig.flyTo(
    { target: new THREE.Vector3(s.tx * 0.5, y, -40 + (s.tz + 40) * 0.5), distance: dist, polar: 1.4, azimuth: s.azimuth },
    { duration: 0.9 + Math.min(2, Math.abs(y - from) * 0.06), ease: 'power2.inOut', arc: false }
  );
  $('elev-arrow').className = `elev-arrow ${y > from + 0.5 ? 'up' : y < from - 0.5 ? 'down' : ''}`;
}

function updateFloorUI() {
  document.querySelectorAll('#elev-buttons button').forEach((b) => b.classList.toggle('active', Number(b.dataset.nivel) === floor));
  const chip = $('floor-chip');
  const p = PISOS.find((x) => x.nivel === floor);
  if (!p) {
    chip.classList.remove('show');
    return;
  }
  const r = resumen(p);
  chip.innerHTML = r
    ? `<b>${p.nombre}</b><span class="big">${r.total}</span><span>departamentos</span><em>${r.porEstado.disponible} disponibles</em>`
    : `<b>${p.nombre}</b><span>${p.amenidades.join(' · ')}</span>`;
  chip.classList.add('show');
}

// ---------------------------------------------------------------- Selección de departamento
function unitPoint(u, x, y, v) {
  return new THREE.Vector3(x * u.lado, y + 0.03, -v).applyMatrix4(u.frame);
}

function selectUnit(u, { fly = true } = {}) {
  sel = u;
  body.classList.toggle('has-sel', !!u);
  const tag = $('unit-tag');
  if (!u) {
    aura.hide();
    tag.classList.remove('show');
    return;
  }
  aura.show(u);
  hover.hide(true);
  if (floor !== u.nivel) focusFloor(u.nivel);
  const t = TIPOS[u.tipo];
  const e = ESTADOS[u.estado];
  $('ut-id').textContent = `Depto ${u.id}`;
  $('ut-status').querySelector('i').style.background = e.color;
  $('ut-status').querySelector('span').textContent = e.nombre;
  $('ut-m2').textContent = t.m2;
  $('ut-type').textContent = `Tipo ${t.letra}`;
  $('ut-type-sub').textContent = t.nombre;
  $('ut-enter').disabled = false;
  tag.classList.remove('show');
  void tag.offsetWidth;
  tag.classList.add('show');
  $('explore-hint').style.opacity = 0;
  if (fly) {
    hotel.rig.syncFromCamera();
    const s = hotel.rig.state;
    const c = polar(RF, u.am, u.y0 + 1.6);
    hotel.rig.flyTo(
      { target: new THREE.Vector3(s.tx + (c.x - s.tx) * 0.6, c.y, s.tz + (c.z - s.tz) * 0.6), distance: Math.max(62, Math.min(s.distance, 110)) * Math.min(boost(), 1.6), polar: 1.36, azimuth: s.azimuth + (-u.am * 0.7 - s.azimuth) * 0.5 },
      { duration: 1.3, ease: 'power2.inOut', arc: false }
    );
  }
}

// Tarjeta anclada al frente del departamento, siempre dentro de la pantalla.
const tagPos = new THREE.Vector3();
function updateUnitTag() {
  const tag = $('unit-tag');
  if (!sel || mode !== 'explore') return;
  tagPos.copy(unitPoint(sel, 0, H - SLAB + 0.3, -2.4)).project(hotel.camera);
  const w = innerWidth;
  const h = innerHeight;
  const tw = tag.offsetWidth;
  const th = tag.offsetHeight;
  let x = (tagPos.x * 0.5 + 0.5) * w;
  let y = (-tagPos.y * 0.5 + 0.5) * h;
  const ax = x;
  const ay = y;
  x = THREE.MathUtils.clamp(x, tw / 2 + 12, w - tw / 2 - (IS_MOBILE ? 64 : 140));
  y = THREE.MathUtils.clamp(y - 22, th + 70, h - 24);
  tag.style.transform = `translate3d(${(x - tw / 2).toFixed(1)}px, ${(y - th).toFixed(1)}px, 0)`;
  tag.style.setProperty('--stem-x', `${THREE.MathUtils.clamp(ax - (x - tw / 2), 14, tw - 14).toFixed(1)}px`);
  tag.style.setProperty('--stem-h', `${Math.max(0, ay - y).toFixed(1)}px`);
}

// ---------------------------------------------------------------- Visita del departamento
const cut = { y: CUT_OFF };
const cutTo = (y, duration = 1.4) => {
  gsap.killTweensOf(cut);
  if (y == null) {
    // Reaparece el techo "creciendo" desde los muros y luego todo el edificio.
    const lvl = levels[sel?.nivel ?? 1];
    return gsap.to(cut, { y: lvl.y0 + H + 0.4, duration: 0.5, ease: 'power1.in', onUpdate: () => hotel.setCut(cut.y), onComplete: () => hotel.setCut((cut.y = CUT_OFF)) });
  }
  if (cut.y > y + 60) cut.y = y + 60;
  return gsap.to(cut, { y, duration, ease: 'power2.inOut', onUpdate: () => hotel.setCut(cut.y) });
};

// Objetivo: largo para exteriores (arquitectura), angular para interiores.
function lens(fov, duration = 2) {
  gsap.to(hotel.camera, { fov, duration, ease: 'power2.inOut', onUpdate: () => hotel.camera.updateProjectionMatrix() });
}

function lookView(eye, at) {
  const d = at.clone().sub(eye).normalize();
  const target = eye.clone().addScaledVector(d, 0.12);
  const sph = new THREE.Spherical().setFromVector3(eye.clone().sub(target));
  return { target, distance: sph.radius, polar: sph.phi, azimuth: sph.theta };
}

function visitSteps(u) {
  const t = TIPOS[u.tipo];
  const hw = u.w / 2;
  const center = unitPoint(u, 0, 0.5, ROOM / 2 - 1);
  // Punto de vista de la sala: un lugar libre en cada tipología, mirando hacia el ventanal.
  const [ex, ev] = { a: [1.3, 5.0], b: [hw - 0.35, 4.95], c: [0.95, 5.6] }[u.tipo];
  return [
    {
      kicker: `Depto ${u.id} · Nivel ${u.nivel}`,
      title: `Tipo ${t.letra} · ${t.nombre}`,
      sub: `${t.m2} m² · ${t.recamaras ? `${t.recamaras} recámara${t.recamaras > 1 ? 's' : ''}` : 'Estudio'} · ${t.banos} baño${t.banos > 1 ? 's' : ''}. ${t.detalle}.`,
      view: { target: center, distance: 15 + u.w * 1.1, polar: 0.62, azimuth: -u.am + 0.4 },
      cut: true,
    },
    {
      kicker: 'Interior',
      title: 'Sala y vista al patio',
      sub: 'Ventanal de piso a techo con celosía de madera.',
      view: lookView(unitPoint(u, ex, 1.45, ev), unitPoint(u, -hw * 0.25, 1.05, -2.5)),
    },
    {
      kicker: 'Terraza',
      title: 'Jardín privado',
      sub: 'Jardinera perimetral y vista a la alberca.',
      view: lookView(unitPoint(u, u.w / 4, 1.6, -0.7), polar(-70, u.am, u.y0 - 6)),
    },
    {
      kicker: 'Recámara',
      title: u.tipo === 'a' ? 'Zona de descanso' : 'Recámara principal',
      sub: 'Cama king, clóset y baño completo.',
      view: lookView(unitPoint(u, -hw + 2.95, 1.45, 0.55), unitPoint(u, -hw + 0.9, 0.75, 4.1)),
    },
  ];
}

let steps = [];
let step = 0;
let autoplay = null;

function enterVisit(u) {
  if (!u) return;
  run++;
  setMode('visit');
  steps = visitSteps(u);
  aura.chrome = 0;
  setCaps(levels[u.nivel].mats, true);
  hotel.building.setFocus(u.nivel, 1);
  levels[u.nivel].focus = 0;
  levels[u.nivel].lampBoost = 0.8;
  levels[u.nivel].furniture?.children.forEach((m) => (m.castShadow = true));
  renderer.shadowMap.needsUpdate = true;
  hotel.atmo.bloomScale = 0.55;
  hotel.atmo.apply();
  gsap.to(levels[u.nivel].tiles.material, { opacity: 0.55, duration: 1 });
  $('pl-cta').hidden = false;
  renderDots();
  goStep(0);
}

function exitVisit({ fly = true } = {}) {
  run++;
  autoplay?.kill();
  setInterior(false);
  hotel.atmo.bloomScale = 1;
  hotel.atmo.apply();
  lens(34, 1.2);
  for (const l of levels) {
    l.lampBoost = 0;
    l.furniture?.children.forEach((m) => (m.castShadow = false));
    if (l.tiles) gsap.to(l.tiles.material, { opacity: 0, duration: 0.5 });
  }
  if (cut.y < CUT_OFF) cutTo(null);
  if (sel) gsap.delayedCall(0.6, () => mode !== 'visit' && setCaps(levels[sel?.nivel ?? 0].mats, false));
  aura.chrome = 1;
  hotel.building.setFocus(null);
  if (sel) focusFloor(sel.nivel);
  setMode('explore');
  aura.lightI = 60;
  body.classList.remove('inside');
  if (fly && sel) {
    hotel.rig.flyTo({ target: polar(RF, sel.am, sel.y0 + 1.6), distance: 70 * Math.min(boost(), 1.6), polar: 1.36, azimuth: -sel.am * 0.7 }, { duration: 2.2, arc: false });
  }
}

function renderDots() {
  $('pl-dots').innerHTML = steps.map((_, i) => `<button type="button" aria-label="Paso ${i + 1}" data-i="${i}"></button>`).join('');
}

function goStep(i) {
  if (i < 0 || i >= steps.length) return;
  const wasInside = body.classList.contains('inside');
  step = i;
  const s = steps[i];
  const my = ++run;
  autoplay?.kill();
  $('pl-kicker').textContent = s.kicker;
  $('pl-title').textContent = s.title;
  $('pl-sub').textContent = s.sub;
  gsap.fromTo('.pl-text', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
  document.querySelectorAll('#pl-dots button').forEach((b, k) => b.classList.toggle('active', k === i));
  $('pl-prev').disabled = i === 0;
  $('pl-next').disabled = i === steps.length - 1;
  const lvl = levels[sel.nivel];

  if (s.cut) {
    setInterior(false);
    lens(34, 2);
    cutTo(lvl.y0 + 2.45, 1.6);
    gsap.to(lvl.tiles.material, { opacity: 0.55, duration: 0.8 });
    body.classList.remove('inside');
    hotel.rig.flyTo(s.view, { duration: wasInside ? 2.2 : 2.6, ease: 'power2.inOut', arc: false });
  } else {
    const fromOutside = !wasInside;
    gsap.to(lvl.tiles.material, { opacity: 0, duration: 0.6 });
    const dur = fromOutside ? 2.8 : 1.8;
    lens(60, dur);
    const tl = hotel.rig.flyTo(s.view, { duration: dur, ease: 'power2.inOut', arc: false });
    if (fromOutside) gsap.delayedCall(dur * 0.82, () => my === run && cutTo(null));
    tl.eventCallback('onComplete', () => {
      hotel.rig.flying = false;
      setInterior(true);
      hotel.rig.controls.enabled = true;
      hotel.rig.controls.update();
    });
    body.classList.add('inside');
  }
  if (!params.has('debug')) autoplay = gsap.delayedCall(s.cut ? 6 : 6.5, () => my === run && i < steps.length - 1 && goStep(i + 1));
}

// ---------------------------------------------------------------- Recorrido aéreo
const SHOTS = () => [
  { kicker: 'Arquitectura', title: 'Un arco abierto al jardín', sub: 'Seis niveles escalonados abrazan el patio y la alberca.', view: { target: new THREE.Vector3(0, 12, -30), distance: 165 * boost(), polar: 1.18, azimuth: -0.55 }, drift: 0.5 },
  { kicker: 'Fachada', title: 'Jardines colgantes', sub: 'Cada terraza tiene jardinera propia: la fachada es verde todo el año.', view: { target: polar(RF - 2, 0.42, 13), distance: 30, polar: 1.32, azimuth: -0.15 }, drift: -0.25 },
  { kicker: 'Patio', title: 'Alberca y cenote', sub: 'Una alberca curva que sigue la forma del edificio, palmeras y flamboyanes.', view: { target: polar(20, 0, 0), distance: 58, polar: 0.92, azimuth: 0.55 }, drift: -0.4 },
  { kicker: 'Rooftop', title: 'Alberca infinita y sky bar', sub: 'El atardecer de Mérida desde el nivel 7.', view: { target: polar(RF + 3, 0.2, TOP + 1), distance: 38, polar: 1.12, azimuth: -0.05 }, drift: 0.3 },
  { kicker: 'Llegada', title: 'Acceso y estacionamiento', sub: 'Fachada a la calle con celosía de madera y acceso privado.', view: { target: new THREE.Vector3(0, 8, -62), distance: 120 * boost(), polar: 1.2, azimuth: Math.PI - 0.4 }, drift: 0.35 },
];

async function playTour() {
  if (mode === 'visit') exitVisit({ fly: false });
  leaveExplore();
  const my = ++run;
  setMode('tour');
  steps = SHOTS();
  $('pl-cta').hidden = true;
  renderDots();
  for (let i = 0; i < steps.length; i++) {
    if (my !== run) return;
    showShot(i);
    const s = steps[i];
    await hotel.rig.flyTo(s.view, { duration: i === 0 ? 2.6 : 3.2, ease: 'power2.inOut', arc: true });
    if (my !== run) return;
    await hotel.rig.flyTo({ ...s.view, azimuth: s.view.azimuth + s.drift }, { duration: 4.2, ease: 'sine.inOut', arc: false });
  }
  if (my === run) goHome();
}

function showShot(i) {
  const s = steps[i];
  step = i;
  $('pl-kicker').textContent = s.kicker;
  $('pl-title').textContent = s.title;
  $('pl-sub').textContent = s.sub;
  gsap.fromTo('.pl-text', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
  document.querySelectorAll('#pl-dots button').forEach((b, k) => b.classList.toggle('active', k === i));
  $('pl-prev').disabled = true;
  $('pl-next').disabled = true;
}

// ---------------------------------------------------------------- Prólogo (Mérida)
function playPrologue() {
  run++;
  setActive('map');
  setMode('pre');
  mist(0, 1.6);
  map.play({
    onDive: () => mist(1, 1.6),
    onDone: () => arriveHotel(),
  });
}

function arriveHotel() {
  if (mode === 'arrive') return;
  captions.hide();
  setActive('hotel');
  hotel.atmo.go(todChoice, 0.01);
  hotel.rig.set(V.sky());
  setMode('arrive');
  mist(0, 1.8);
  hotel.rig.flyTo(V.hero(), { duration: 3.8, ease: 'power2.inOut', arc: false }).then(() => {
    if (mode === 'arrive') setMode('home');
  });
}

function skipPrologue() {
  if (mode !== 'pre') return;
  map.stop();
  gsap.to($('mist'), {
    opacity: 1,
    duration: 0.6,
    onComplete: () => arriveHotel(),
  });
}

// ---------------------------------------------------------------- Interacción 3D
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickables = () => levels.filter((l) => l.pick).map((l) => l.pick);

function pickUnit(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, hotel.camera);
  const hit = ray.intersectObjects(pickables(), false)[0];
  if (!hit) return null;
  const lvl = levels[hit.object.userData.nivel];
  return lvl.units[hit.instanceId];
}

let down = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || active !== 'hotel') return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return;
  if (mode === 'home') {
    const u = pickUnit(e);
    if (u) {
      enterExplore();
      gsap.delayedCall(0.4, () => selectUnit(u));
    }
    return;
  }
  if (mode !== 'explore') return;
  const u = pickUnit(e);
  if (u) selectUnit(u === sel ? sel : u);
  else if (sel) selectUnit(null);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || active !== 'hotel' || mode !== 'explore' || down) return;
  const u = pickUnit(e);
  canvas.style.cursor = u ? 'pointer' : '';
  if (u && u !== sel) {
    if (hover.unit !== u) hover.show(u);
  } else if (hover.unit) hover.hide();
});

// ---------------------------------------------------------------- Botones
const ambience = new Ambience();
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (!go || mode === 'loader' || mode === 'pre' || mode === 'arrive') return;
  if (go === 'explorar') enterExplore();
  else if (go === 'recorrido') playTour();
  else if (go === 'contacto') openModal();
  else if (go === 'ubicacion') {
    if (mode === 'visit') exitVisit({ fly: false });
    leaveExplore();
    run++;
    mist(1, 1).then(() => playPrologue());
  }
});
$('brand').addEventListener('click', (e) => {
  e.preventDefault();
  if (mode === 'visit') exitVisit({ fly: false });
  if (['explore', 'tour', 'visit'].includes(mode)) goHome();
});
$('back').addEventListener('click', () => {
  if (mode === 'visit') exitVisit();
  else goHome();
});
$('ut-enter').addEventListener('click', () => enterVisit(sel));
$('pl-prev').addEventListener('click', () => goStep(step - 1));
$('pl-next').addEventListener('click', () => goStep(step + 1));
$('pl-dots').addEventListener('click', (e) => {
  const i = e.target.closest('button')?.dataset.i;
  if (i != null && mode === 'visit') goStep(Number(i));
});
$('pl-cta').addEventListener('click', () => openModal(sel));
$('skip').addEventListener('click', skipPrologue);
$('sound').addEventListener('click', () => {
  const on = ambience.toggle();
  $('sound').setAttribute('aria-pressed', String(on));
});
document.querySelectorAll('#tod button').forEach((b) =>
  b.addEventListener('click', () => {
    todChoice = b.dataset.tod;
    document.querySelectorAll('#tod button').forEach((x) => x.classList.toggle('active', x === b));
    hotel.atmo.go(todChoice);
  })
);

let modalUnit = null;
const phoneDigits = CONTACTO.telefono.replace(/[^\d]/g, '');

function openModal(u) {
  modalUnit = u ?? null;
  const m = $('modal');
  m.classList.add('open');
  $('modal-ok').classList.remove('show');
  $('modal-sub').textContent = u
    ? `Depto ${u.id} · Tipo ${TIPOS[u.tipo].letra} · ${TIPOS[u.tipo].m2} m². Un asesor te contactará.`
    : 'Un asesor te contactará para mostrarte el proyecto.';
  if (u) $('form-interes').selectedIndex = ['a', 'b', 'c'].indexOf(u.tipo);
}
$('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('modal').classList.remove('open');
});
$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (phoneDigits && CONTACTO.whatsapp) {
    // Abre WhatsApp con el mensaje ya escrito para el asesor.
    const f = new FormData($('form'));
    const depto = modalUnit ? ` (Depto ${modalUnit.id})` : '';
    const msg = `Hola, soy ${f.get('nombre')}. Me interesa Xelha: ${f.get('interes')}${depto}. Mi WhatsApp: ${f.get('tel')}`;
    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }
  $('modal-ok').classList.add('show');
  gsap.delayedCall(2.6, () => $('modal').classList.remove('open'));
});
if (phoneDigits) {
  $('modal-ok').innerHTML = CONTACTO.whatsapp ? '¡Gracias! Te abrimos WhatsApp para enviar tu mensaje.' : '¡Gracias! Te contactaremos muy pronto.';
  const direct = $('modal-direct');
  direct.hidden = false;
  direct.innerHTML = `o directo: ${CONTACTO.whatsapp ? `<a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">WhatsApp</a> · ` : ''}<a href="tel:+${phoneDigits}">${CONTACTO.telefono}</a>`;
}
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('modal').classList.contains('open')) $('modal').classList.remove('open');
    else if (mode === 'visit') exitVisit();
    else if (mode === 'explore' && sel) selectUnit(null);
  }
  if (mode === 'visit' && e.key === 'ArrowRight') goStep(step + 1);
  if (mode === 'visit' && e.key === 'ArrowLeft') goStep(step - 1);
});

// ---------------------------------------------------------------- Bucle
function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  resolution.set(w, h);
  for (const s of [map, hotel]) {
    if (!s) continue;
    s.camera.aspect = w / h;
    s.camera.updateProjectionMatrix();
  }
}
addEventListener('resize', resize);

// Indicador del ascensor: el número cambia mientras la cámara sube o baja.
function updateElevator() {
  if (mode !== 'explore' && mode !== 'visit') return;
  const y = hotel.rig.flying ? hotel.rig.state.ty : hotel.rig.controls.target.y;
  let cur = levels[0];
  for (const l of levels) if (y >= l.box.y0 - 0.5) cur = l;
  const label = cur.piso.corto;
  if ($('elev-num').textContent !== label) $('elev-num').textContent = label;
  if (!hotel.rig.flying) $('elev-arrow').className = 'elev-arrow';
}

const clock = new THREE.Clock();
// Resolución adaptativa: baja si el equipo no llega a ~45 fps y sube si va sobrado.
const perf = { acc: 0, n: 0, ratio: renderer.getPixelRatio() };
function adapt(dt) {
  perf.acc += dt;
  if (++perf.n < 45) return;
  const avg = perf.acc / perf.n;
  perf.acc = perf.n = 0;
  const max = Math.min(devicePixelRatio, QUALITY.maxPixelRatio);
  let r = perf.ratio;
  if (avg > 1 / 44) r = Math.max(0.65, r - 0.15);
  else if (avg < 1 / 56) r = Math.min(max, r + 0.1);
  if (Math.abs(r - perf.ratio) < 0.01) return;
  perf.ratio = r;
  renderer.setPixelRatio(r);
  resize();
  syncAO();
}

// Mobiliario: solo cerca del edificio o en el piso del departamento elegido.
const BCENTER = new THREE.Vector3(0, 13, -48);
function furnitureLOD() {
  const near = hotel.camera.position.distanceTo(BCENTER) < 95;
  for (const l of levels) {
    if (!l.furniture) continue;
    const on = near || sel?.nivel === l.nivel;
    if (l.furniture.visible !== on) l.furniture.visible = on;
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (mode !== 'loader') adapt(dt);
  if (active === 'map') {
    map.update(t, dt);
    map.labels.update(map.camera, innerWidth, innerHeight);
  } else if (active === 'hotel') {
    hotel.update(t, dt);
    aura.update(t);
    hover.update(t);
    if (!hotel.rig.flying) hotel.rig.controls.update();
    furnitureLOD();
    updateUnitTag();
    updateElevator();
  }
  composer.render(dt);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- Arranque
(async () => {
  resize();
  await build();
  setActive('map');
  requestAnimationFrame(frame);
  body.classList.add('loaded');
  const start = () => {
    ambience.start();
    $('sound').setAttribute('aria-pressed', 'true');
    gsap.to('#loader', { opacity: 0, duration: 1, onComplete: () => ($('loader').hidden = true) });
    if (params.has('skip')) {
      setActive('hotel');
      arriveHotel();
    } else playPrologue();
  };
  $('enter').addEventListener('click', start, { once: true });
  if (params.has('auto')) start();
  if (params.has('debug')) window.__probe = (x, y) => {
    ray.setFromCamera(new THREE.Vector2(x, y), hotel.camera);
    return ray.intersectObjects(hotel.scene.children, true).filter((h) => h.object.material?.visible !== false).slice(0, 4)
      .map((h) => `${h.object.name || h.object.type}:${h.distance.toFixed(2)}:${h.point.toArray().map((v) => v.toFixed(2))}`);
  };
  if (params.has('debug')) window.__x = { sanitize, cap: CAP_COLOR, hotel, map, levels, enterExplore, rideTo, selectUnit, enterVisit, goStep, playTour, goHome };
})();
