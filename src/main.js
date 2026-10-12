import * as THREE from 'three';
import gsap from 'gsap';

import { QUALITY, IS_MOBILE } from './config.js';
import { t, applyDom, setLang, getLang, onLangChange } from './i18n/index.js';
import { toVec3, centroid, LAND_TOP } from './geo/projection.js';
import { buildLand } from './scene/land.js';
import { buildSea } from './scene/sea.js';
import { buildSky } from './scene/sky.js';
import { buildClouds } from './scene/clouds.js';
import { CityMarker } from './scene/markers.js';
import { GlowRoute } from './scene/route.js';
import { CameraRig } from './scene/cameraRig.js';
import { ProjectModel } from './scene/buildings.js';
import { DistanceRings } from './scene/distanceRings.js';
import { Labels } from './ui/labels.js';
import { ProjectCard } from './ui/card.js';
import { poiGroupFor } from './data/travel.js';

import geo from './data/yucatan.geo.json';
import places from './data/places.json';
import projectsData from './data/projects.json';

const $ = (id) => document.getElementById(id);
const app = $('app');
const projects = projectsData.proyectos;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---------------------------------------------------------------- Loader
const loader = {
  set(p, stepKey) {
    $('bar-fill').style.width = `${Math.round(p * 100)}%`;
    $('loader-pct').textContent = `${Math.round(p * 100)}%`;
    if (stepKey) $('loader-step').textContent = t(stepKey);
  },
};

applyDom();
document.documentElement.lang = getLang();

// ---------------------------------------------------------------- Renderer / escena
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
// Móvil: sombras simplificadas (PCF sin suavizado y mapa más pequeño).
renderer.shadowMap.type = QUALITY.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0xf0d2b4);
scene.fog = new THREE.Fog(FOG_COLOR, 400, 3000);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 12000);
const resolution = new THREE.Vector2(1, 1);

// Sol de atardecer: bajo, desde el oeste (−X), un poco al sur. Sombras largas hacia el este.
const sunDir = new THREE.Vector3(-0.82, 0.4, 0.2).normalize();

scene.add(new THREE.HemisphereLight(0xfff4e6, 0xd6c3a2, 1.5));
const sun = new THREE.DirectionalLight(0xffd4a8, 2.0);
sun.position.copy(sunDir).multiplyScalar(400);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(QUALITY.shadowMap);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { near: 1, far: 900 });
scene.add(sun, sun.target);

const rig = new CameraRig(camera, canvas);
const labels = new Labels($('labels'));

// ---------------------------------------------------------------- Vistas
const byCity = (id) => projects.filter((p) => p.ciudad === id);
const cityCentroid = (id) => centroid(byCity(id).map((p) => p.coordenadas));
// En pantallas verticales la cámara se aleja para que quepa el ancho necesario.
const aspectBoost = () => Math.pow(Math.max(1, 1.2 / camera.aspect), 0.85);

const VIEWS = {
  peninsula: () => ({ target: toVec3({ lat: camera.aspect < 1 ? 20.25 : 20.5, lng: camera.aspect < 1 ? -88.35 : -88.45 }, 0), distance: 640 * aspectBoost(), polar: 0.88, azimuth: 0 }),
  intro: () => ({ target: toVec3({ lat: 20.35, lng: -88.45 }, 0), distance: 2900, polar: 0.02, azimuth: -0.35 }),
  merida: () => ({ target: cityCentroid('merida'), distance: 27 * aspectBoost(), polar: 0.95, azimuth: 0.35 }),
  playa: () => ({ target: toVec3(byCity('playa')[0].coordenadas), distance: 26 * aspectBoost(), polar: 1.02, azimuth: -1.15 }),
  // Mérida Costa: cámara sobre el mar mirando al sur, inclinada para que el agua quede en primer plano.
  costa: () => {
    const pts = [...byCity('costa').map((p) => p.coordenadas), places.ciudades.find((c) => c.id === 'costa')];
    const c = centroid(pts);
    c.z += 4;
    return { target: c, distance: 68 * aspectBoost(), polar: 1.2, azimuth: Math.PI - 0.15 };
  },
};

// ---------------------------------------------------------------- Construcción (con progreso)
let land, sea, sky, clouds, tren, roadProgreso, coastRoad;
const markers = [];
const cityLabels = [];
const models = new Map(); // id -> ProjectModel
const tags = new Map(); // id -> etiqueta HTML
let rings, card, cardItem, cardAnchor;

async function build() {
  loader.set(0.05, 'loader.step.fonts');
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  await nextFrame();

  loader.set(0.2, 'loader.step.geo');
  await nextFrame();
  land = buildLand(geo, places, resolution);
  scene.add(land.group);

  loader.set(0.45, 'loader.step.sea');
  await nextFrame();
  sea = buildSea(geo, sunDir, { texSize: IS_MOBILE ? 768 : 1024 });
  scene.add(sea.mesh);
  sky = buildSky(sunDir);
  scene.add(sky);

  loader.set(0.7, 'loader.step.scene');
  await nextFrame();
  clouds = buildClouds(QUALITY.clouds, VIEWS.peninsula().target);
  scene.add(clouds.group);

  tren = new GlowRoute(places.tren_maya_merida_playa, resolution, { width: 2.4, glow: 10 });
  roadProgreso = new GlowRoute(places.carretera_merida_progreso, resolution, {
    color: 0xfff1d6, width: 1.4, glow: 5, flow: false, samples: 60, lift: 0.2,
  });
  coastRoad = new GlowRoute(places.costa_progreso_san_crisanto, resolution, {
    color: 0xfff1d6, width: 1.2, glow: 4, flow: false, samples: 60, lift: 0.2,
  });
  scene.add(tren.group, roadProgreso.group, coastRoad.group);

  for (const city of places.ciudades) {
    const m = new CityMarker(city);
    markers.push(m);
    scene.add(m.group);
    cityLabels.push(makeCityLabel(city, m));
  }
  buildCityNav();

  for (const p of projects) {
    const m = new ProjectModel(p);
    models.set(p.id, m);
    scene.add(m.group);
    tags.set(p.id, makeProjectTag(m));
  }
  rings = new DistanceRings(scene, labels, resolution);
  card = new ProjectCard(openProject);
  if (IS_MOBILE) {
    // En móvil la ficha es una hoja inferior fija (no flota sobre el modelo).
    card.el.classList.add('sheet');
    app.appendChild(card.el);
  } else {
    cardAnchor = document.createElement('div');
    cardAnchor.className = 'card-anchor';
    cardAnchor.appendChild(card.el);
    cardItem = labels.add(cardAnchor, () => models.get(state.cardId)?.anchor() ?? new THREE.Vector3());
    cardItem.visible = false;
  }

  resize();
  rig.set(VIEWS.intro());
  renderer.compile(scene, camera);
  loader.set(1, 'loader.step.scene');
  await nextFrame();
}

function countText(id) {
  const n = byCity(id).length;
  return t(n === 1 ? 'city.project' : 'city.projects', { n });
}

// Mérida y Mérida Costa están muy cerca en la vista general: etiquetas a lados opuestos.
const LABEL_SIDE = { merida: 'right' };

function makeCityLabel(city, marker) {
  const el = document.createElement('button');
  el.className = `city-label side-${LABEL_SIDE[city.id] ?? 'center'}`;
  el.type = 'button';
  el.innerHTML = `<span class="inner"><span class="name">${city.nombre}</span><span class="count"></span></span>`;
  const count = el.querySelector('.count');
  const refresh = () => (count.textContent = countText(city.id));
  refresh();
  onLangChange(refresh);
  el.addEventListener('click', () => selectCity(city.id));
  el.addEventListener('pointerenter', () => (marker.hoverTarget = 1));
  el.addEventListener('pointerleave', () => (marker.hoverTarget = 0));
  // La etiqueta se ancla en lo alto del haz de luz.
  const top = new THREE.Vector3();
  const item = labels.add(el, () => top.copy(marker.anchor).setY(LAND_TOP + marker.group.scale.y * (7 + marker.hover * 3)));
  return { el, item, city, marker };
}

function makeProjectTag(model) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ptag';
  el.textContent = model.project.nombre;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    clickProject(model.id);
  });
  el.addEventListener('pointerenter', () => hoverProject(model.id));
  el.addEventListener('pointerleave', () => hoverProject(null));
  const item = labels.add(el, () => model.anchor());
  item.visible = false;
  return { el, item };
}

function buildCityNav() {
  const nav = $('cities');
  const order = ['merida', 'costa', 'playa'];
  const render = () => {
    nav.innerHTML = '';
    for (const id of order) {
      const c = places.ciudades.find((x) => x.id === id);
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.city = id;
      b.innerHTML = `${c.nombre}<small>${byCity(id).length}</small>`;
      b.classList.toggle('active', state.view === id);
      b.addEventListener('click', () => selectCity(id));
      nav.appendChild(b);
    }
  };
  render();
  onLangChange(render);
  state.renderNav = render;
}

// ---------------------------------------------------------------- Estado / navegación
const state = { view: 'intro', renderNav: () => {}, introTl: null, hoverId: null, selectedId: null, cardId: null };

function setHud(view) {
  const hud = $('hud');
  hud.classList.remove('show');
  setTimeout(() => {
    $('hud-kicker').textContent = t(`hud.${view}.kicker`);
    $('hud-title').textContent = t(`hud.${view}.title`);
    $('hud-sub').textContent = t(`hud.${view}.sub`);
    hud.classList.add('show');
  }, 350);
}

function setView(view) {
  state.view = view;
  setHud(view);
  state.renderNav();
  $('back').classList.toggle('is-home', view === 'peninsula');
  for (const l of cityLabels) {
    l.el.classList.toggle('dim', view !== 'peninsula' && l.city.id !== view);
    // En la vista de ciudad, su propio marcador se apaga para dejar ver los proyectos.
    l.el.classList.toggle('current', l.city.id === view);
    gsap.to(l.marker, { appear: l.city.id === view ? 0 : 1, duration: 0.8 });
  }
  growProjects(view);
}

// Los proyectos de la ciudad activa "crecen" desde el terreno; los demás se recogen.
function growProjects(view) {
  let i = 0;
  for (const m of models.values()) {
    const on = m.city === view;
    gsap.killTweensOf(m, 'grow');
    if (on) {
      const g = { v: m.grow };
      gsap.to(g, {
        v: 1, duration: 1.6, ease: 'back.out(1.3)', delay: 1.1 + i++ * 0.18,
        onUpdate: () => m.setGrow(g.v),
      });
    } else if (m.grow > 0) {
      const g = { v: m.grow };
      gsap.to(g, { v: 0, duration: 0.5, ease: 'power2.in', onUpdate: () => m.setGrow(g.v) });
    }
  }
}

function selectCity(id) {
  if (state.view === 'intro') finishIntro();
  if (id === state.view) return deselectProject();
  clearSelection();
  const from = state.view;
  setView(id);

  if (id === 'playa') {
    // Vuelo hacia el este siguiendo la línea del Tren Maya.
    rig.flyAlong(tren.curve, VIEWS.playa(), { approach: from === 'merida' ? 0.9 : 1.6, duration: 4.6 });
  } else if (from === 'playa' && id === 'merida') {
    rig.flyAlong(reversedTren(), VIEWS.merida(), { approach: 1.0, duration: 4.2, followPolar: 0.95 });
  } else {
    rig.flyTo(VIEWS[id](), { duration: id === 'costa' ? 3.2 : 2.8 });
  }
}

let _rev;
const reversedTren = () =>
  (_rev ??= new THREE.CatmullRomCurve3(tren.curve.points.slice().reverse(), false, 'centripetal'));

function goHome() {
  if (state.view === 'intro') return finishIntro();
  if (state.view === 'peninsula') return;
  clearSelection();
  setView('peninsula');
  rig.flyTo(VIEWS.peninsula(), { duration: 2.6, arc: false });
}

// ---------------------------------------------------------------- Proyectos: hover, selección, apertura
function showCard(id, pinned) {
  state.cardId = id;
  if (!id) {
    card.el.classList.remove('show');
    if (cardItem) cardItem.visible = false;
    return;
  }
  card.set(models.get(id).project, { pinned });
  if (!IS_MOBILE) {
    // Escritorio: al pasar el cursor la ficha flota sobre el volumen; al seleccionar
    // se acopla a la derecha para no tapar los círculos de distancia.
    const docked = pinned;
    if (docked && card.el.parentNode !== app) app.appendChild(card.el);
    if (!docked && card.el.parentNode !== cardAnchor) cardAnchor.appendChild(card.el);
    card.el.classList.toggle('docked', docked);
    cardItem.visible = !docked;
  }
  requestAnimationFrame(() => card.el.classList.add('show'));
}

function hoverProject(id) {
  if (id === state.hoverId) return;
  state.hoverId = id;
  for (const m of models.values()) m.highlightTarget = m.id === id || m.id === state.selectedId ? 1 : 0;
  // Con un proyecto seleccionado, la ficha fija no cambia al pasar sobre otros.
  if (!state.selectedId) showCard(id, false);
}

function clickProject(id) {
  if (state.selectedId === id) return openProject(models.get(id).project);
  selectProject(id);
}

// Primer clic: ficha fija + círculos de distancia con minutos en auto.
function selectProject(id) {
  const m = models.get(id);
  if (!m) return;
  if (m.city !== state.view) selectCity(m.city);
  state.selectedId = id;
  for (const x of models.values()) {
    x.highlightTarget = x.id === id ? 1 : 0;
    x.dimTarget = x.id === id ? 0 : 0.55;
  }
  showCard(id, true);
  const pois = places.puntos_clave[poiGroupFor(m.city)];
  rings.show(m.project, pois, t);
  $('poi-legend').classList.add('show');
  const target = m.group.position.clone();
  rig.flyTo(
    { target, distance: THREE.MathUtils.clamp(rings.maxRadius * 3.1, 18, 220) * aspectBoost(), polar: 0.5, azimuth: rig.state.azimuth },
    { duration: 2.2 }
  );
}

function clearSelection() {
  state.selectedId = null;
  rings?.clear();
  $('poi-legend').classList.remove('show');
  for (const m of models.values()) {
    m.highlightTarget = 0;
    m.dimTarget = 0;
  }
  showCard(null);
}

function deselectProject() {
  if (!state.selectedId) return;
  clearSelection();
  if (VIEWS[state.view]) rig.flyTo(VIEWS[state.view](), { duration: 2 });
}

// "Ver proyecto" / segundo clic: la cámara se acerca al volumen.
// (La página del proyecto con galería, datos y CTA llega en la Fase 3.)
function openProject(project) {
  const m = models.get(project.id);
  rings.clear();
  $('poi-legend').classList.remove('show');
  const target = m.group.position.clone();
  target.y += m.height * m.scale * 0.35;
  rig.flyTo(
    { target, distance: 5.5 * m.scale * aspectBoost(), polar: 1.08, azimuth: rig.state.azimuth + 0.5 },
    { duration: 2.2, arc: false }
  );
}

// ---------------------------------------------------------------- Intro cinematográfica
function startIntro() {
  app.classList.add('ready', 'intro');
  $('loader').classList.add('hide');

  const tl = gsap.timeline({ onComplete: endIntro });
  state.introTl = tl;
  tl.to('#mist', { opacity: 0, duration: 2.6, ease: 'power2.out' }, 0.2);
  tl.add(rig.flyTo(VIEWS.peninsula(), { duration: 7.2, ease: 'power2.inOut', arc: false }), 0);
  const r = { p: 0 };
  tl.to(r, { p: 1, duration: 2.8, ease: 'power2.inOut', onUpdate: () => tren.setProgress(r.p) }, 4.6);
  const r2 = { p: 0 };
  tl.to(r2, {
    p: 1, duration: 1.6, ease: 'power1.out',
    onUpdate: () => { roadProgreso.setProgress(r2.p); coastRoad.setProgress(r2.p); },
  }, 5.6);
  markers.forEach((m, i) => {
    tl.to(m, { appear: 1, duration: 1.2, ease: 'power2.out' }, 5.4 + i * 0.25);
    tl.call(() => cityLabels[i].el.classList.add('show'), null, 5.8 + i * 0.25);
  });
  tl.call(() => {
    setHud('peninsula');
    $('cities').classList.add('show');
    $('legend').classList.add('show');
  }, null, 6.4);
}

function finishIntro() {
  if (state.introTl) state.introTl.progress(1);
}

function endIntro() {
  if (state.view !== 'intro') return;
  app.classList.remove('intro');
  state.introTl = null;
  setView('peninsula');
  rig.kill();
  rig.syncFromCamera();
}

// ---------------------------------------------------------------- Interacción 3D (hover / click en marcadores)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function setPointer(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

function pickMarker() {
  const live = markers.filter((m) => m.appear > 0.5);
  const hits = raycaster.intersectObjects(live.map((m) => m.hit), false);
  return hits.length ? live.find((m) => m.hit === hits[0].object) : null;
}

function pickProject() {
  const live = [...models.values()].filter((m) => m.grow > 0.5);
  const hits = raycaster.intersectObjects(live.map((m) => m.hit), false);
  return hits.length ? hits[0].object.userData.projectId : null;
}

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || rig.flying || state.view === 'intro') return;
  setPointer(e);
  const pid = pickProject();
  hoverProject(pid);
  const hit = pid ? null : pickMarker();
  markers.forEach((m) => (m.hoverTarget = m === hit ? 1 : 0));
  cityLabels.forEach((l) => l.el.classList.toggle('hover', l.marker === hit));
  canvas.style.cursor = hit || pid ? 'pointer' : '';
});
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  if (state.view === 'intro') return;
  setPointer(e);
  const pid = pickProject();
  if (pid) return clickProject(pid);
  const hit = pickMarker();
  if (hit) return selectCity(hit.city.id);
  // Clic en el vacío: se cierra la selección.
  if (state.selectedId) deselectProject();
});

$('back').addEventListener('click', goHome);
$('logo').addEventListener('click', (e) => {
  e.preventDefault();
  goHome();
});
$('skip').addEventListener('click', finishIntro);
$('enter').addEventListener('click', startIntro);
document.querySelectorAll('.lang button').forEach((b) =>
  b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    document.querySelectorAll('.lang button').forEach((x) => x.classList.toggle('active', x === b));
    if (state.view !== 'intro') setHud(state.view);
  })
);
document.querySelectorAll('.lang button').forEach((x) => x.classList.toggle('active', x.dataset.lang === getLang()));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') (state.selectedId ? deselectProject() : goHome());
});

// ---------------------------------------------------------------- Bucle
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // LineMaterial copia la resolución: hay que actualizar cada material de línea.
  resolution.set(w, h);
  scene.traverse((o) => o.material?.isLineMaterial && o.material.resolution.copy(resolution));
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (!rig.flying) rig.controls.update();
  const dist = rig.distance;

  // Niebla y detalles dependientes del zoom.
  scene.fog.near = dist * 0.9;
  scene.fog.far = dist * 4.2 + 300;
  sky.position.copy(camera.position);
  sea.uniforms.uTime.value = elapsed;
  land.setFocus(1 - THREE.MathUtils.smoothstep(dist, 45, 160));

  // El sol sigue al objetivo: el mapa de sombras cubre solo la zona visible (sombras nítidas).
  sun.target.position.copy(rig.controls.target);
  sun.position.copy(rig.controls.target).addScaledVector(sunDir, 400);
  const half = THREE.MathUtils.clamp(dist * 0.85, 6, 220);
  const sc = sun.shadow.camera;
  if (Math.abs(sc.right - half) > half * 0.05) {
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half });
    sc.updateProjectionMatrix();
  }

  for (const m of models.values()) m.update(elapsed, dt);
  rings.update(elapsed, dist);
  for (const [id, tag] of tags) {
    const m = models.get(id);
    // Con una selección activa solo queda su etiqueta (las de los puntos clave no se pisan).
    tag.item.visible = m.grow > 0.6 && id !== state.cardId && !state.selectedId;
  }

  clouds.update(camera, dt);
  tren.update(elapsed, dist);
  for (const m of markers) m.update(elapsed, dist, dt);

  renderer.render(scene, camera);
  labels.update(camera, window.innerWidth, window.innerHeight);

  // La ficha flotante se abre hacia abajo si no cabe por encima del proyecto.
  if (cardItem?.visible && state.cardId) {
    _v.copy(models.get(state.cardId).anchor()).project(camera);
    const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    card.el.classList.toggle('below', y < 380);
  }
}
const _v = new THREE.Vector3();

// ---------------------------------------------------------------- Arranque
build()
  .then(() => {
    renderer.setAnimationLoop(frame);
    $('enter').classList.add('show');
    // Atajo para presentaciones: ?auto inicia la intro sin pulsar.
    if (new URLSearchParams(location.search).has('auto')) startIntro();
  })
  .catch((err) => {
    console.error(err);
    $('loader-step').textContent = 'Error: ' + err.message;
  });

// Acceso de depuración desde la consola del navegador.
window.__urbaz = { gsap, selectCity, goHome, rig, finishIntro, selectProject, hoverProject, openProject: (id) => openProject(models.get(id).project), introProgress: (p) => state.introTl?.progress(p) };
