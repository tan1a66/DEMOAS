import * as THREE from 'three';
import gsap from 'gsap';

import { CONFIG, QUALITY, IS_MOBILE } from './config.js';
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
import { poiGroupFor, haversineKm, driveMinutes } from './data/travel.js';
import { SearchBar, matches, isActive, EMPTY } from './ui/search.js';
import { ProjectPage } from './ui/projectPage.js';
import { whatsappUrl } from './ui/whatsapp.js';
import { setCurrency, getCurrency, onCurrencyChange } from './ui/format.js';

import geo from './data/yucatan.geo.json';
import places from './data/places.json';
import projectsData from './data/projects.json';
import { attachImages } from './data/images.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const projects = attachImages(projectsData.proyectos);
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
  search: () => state.searchView,
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
let rings, card, cardItem, cardAnchor, search, page;

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
  const cityNames = Object.fromEntries(places.ciudades.map((c) => [c.id, c.nombre]));
  search = new SearchBar($('search-slot'), projects, cityNames, applyFilters);
  page = new ProjectPage($('page'), geo, closePage);
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
  const item = labels.add(el, () => model.anchor(), { avoid: true });
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
const state = {
  view: 'intro', renderNav: () => {}, introTl: null,
  hoverId: null, selectedId: null, cardId: null,
  filters: { ...EMPTY }, matches: null, searchView: null,
  pageId: null, pageShown: false,
};

function hudTexts(view) {
  if (view !== 'search') return [t(`hud.${view}.kicker`), t(`hud.${view}.title`), t(`hud.${view}.sub`)];
  const n = state.matches?.size ?? 0;
  const title = n === 0 ? t('hud.search.title0') : n === 1 ? t('hud.search.title1') : t('hud.search.title', { n });
  return [t('hud.search.kicker'), title, n ? t('hud.search.sub') : t('hud.search.sub0')];
}

let hudTimer;
function setHud(view) {
  const hud = $('hud');
  hud.classList.remove('show');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => {
    const [k, ti, sub] = hudTexts(view);
    $('hud-kicker').textContent = k;
    $('hud-title').textContent = ti;
    $('hud-sub').textContent = sub;
    hud.classList.add('show');
  }, 350);
}

function setView(view) {
  state.view = view;
  app.classList.toggle('searching', view === 'search');
  setHud(view);
  state.renderNav();
  $('back').classList.toggle('is-home', view === 'peninsula');
  for (const l of cityLabels) {
    l.el.classList.toggle('dim', view !== 'peninsula' && l.city.id !== view);
    // En la vista de ciudad, su propio marcador se apaga para dejar ver los proyectos.
    l.el.classList.toggle('current', l.city.id === view);
    gsap.to(l.marker, { appear: l.city.id === view ? 0 : 1, duration: 0.8 });
    if (view === 'search') l.el.classList.add('dim');
  }
  growProjects(view);
}

// Los proyectos de la ciudad activa "crecen" desde el terreno; los demás se recogen.
function growProjects(view) {
  let i = 0;
  for (const m of models.values()) {
    const on = view === 'search' || m.city === view;
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
  resetSearch();
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
  if (state.view === 'peninsula') return resetSearch();
  resetSearch();
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
  for (const m of models.values()) {
    m.highlightTarget = m.id === id || m.id === state.selectedId || (!state.selectedId && state.matches?.has(m.id)) ? 1 : 0;
  }
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
  if (m.city !== state.view && state.view !== 'search') selectCity(m.city);
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
  applyDims();
  showCard(null);
}

// Búsqueda activa: coincidencias iluminadas, el resto atenuado.
function applyDims() {
  for (const m of models.values()) {
    const hit = state.matches?.has(m.id);
    m.highlightTarget = state.matches && hit ? 1 : 0;
    m.dimTarget = state.matches && !hit ? 0.7 : 0;
  }
}

function deselectProject() {
  if (!state.selectedId) return;
  clearSelection();
  if (VIEWS[state.view]) rig.flyTo(VIEWS[state.view](), { duration: 2 });
}

// "Ver proyecto" / segundo clic: la cámara se acerca, el mapa se desvanece y se abre la página.
function openProject(project) {
  if (state.pageId) return;
  state.pageId = project.id;
  gsap.delayedCall(1.5, () => showPage(project));
  zoomToProject(project);
}

function zoomToProject(project) {
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

function poiDistances(project) {
  return places.puntos_clave[poiGroupFor(project.ciudad)]
    .map((poi) => ({
      poi,
      km: haversineKm(project.coordenadas, poi),
      min: driveMinutes(project.id, project.coordenadas, poi),
    }))
    .sort((a, b) => a.km - b.km);
}

function showPage(project) {
  const m = models.get(project.id);
  // Sin fotos oficiales: la galería usa vistas 3D del propio volumen (marcadas como ilustrativas).
  const shots = project.imagenes?.length
    ? project.imagenes.map((src) => ({ src, caption: project.nombre }))
    : captureShots(m);
  showCard(null);
  app.classList.add('page-open');
  page.open(project, { shots, distances: poiDistances(project) });
  // Con la página cubriendo la pantalla se pausa el render 3D (ahorro de batería/GPU).
  setTimeout(() => state.pageId === project.id && (state.pageShown = true), 900);
}

function closePage() {
  const id = state.pageId;
  if (!id) return;
  page.close();
  app.classList.remove('page-open');
  state.pageShown = false;
  state.pageId = null;
  state.selectedId = null;
  selectProject(id);
}

function captureShots(m) {
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = 960;
  out.height = 600;
  const ctx = out.getContext('2d');
  const s = m.scale;
  const base = m.group.position.clone();
  base.y += m.height * s * 0.3;
  const views = [
    ['page.shot.aerial', 6.5 * s, 0.82, 0.7],
    ['page.shot.street', 3.6 * s, 1.34, -0.9],
    ['page.shot.context', 15 * s, 1.05, 2.5],
  ];
  const fog = [scene.fog.near, scene.fog.far];
  const haloVisible = m.halo.visible;
  m.halo.visible = false;
  const shots = views.map(([key, d, polar, az]) => {
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(d, polar, rig.state.azimuth + az));
    camera.position.copy(base).add(off);
    camera.lookAt(base);
    scene.fog.near = d * 0.9;
    scene.fog.far = d * 4.2 + 300;
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    // Recorte 16:10 centrado del lienzo WebGL (en la misma tarea, antes de componer).
    let sw = src.width;
    let sh = sw / 1.6;
    if (sh > src.height) {
      sh = src.height;
      sw = sh * 1.6;
    }
    ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, out.width, out.height);
    return { src: out.toDataURL('image/jpeg', 0.86), caption: t(key), illustrative: true };
  });
  m.halo.visible = haloVisible;
  [scene.fog.near, scene.fog.far] = fog;
  rig.apply();
  return shots;
}

// ---------------------------------------------------------------- Búsqueda
function applyFilters(f) {
  if (state.view === 'intro') finishIntro();
  if (state.pageId) closePage();
  state.filters = f;
  clearSelection();
  if (!isActive(f)) {
    state.matches = null;
    applyDims();
    if (state.view === 'search') {
      setView('peninsula');
      rig.flyTo(VIEWS.peninsula(), { duration: 2.4, arc: false });
    }
    return;
  }
  const found = projects.filter((p) => matches(p, f));
  state.matches = new Set(found.map((p) => p.id));
  applyDims();
  if (state.view !== 'search') setView('search');
  else setHud('search');
  if (!found.length) return;
  state.searchView = frameProjects(found);
  rig.flyTo(state.searchView, { duration: 2.6 });
}

// Encuadre que contiene todos los proyectos encontrados.
function frameProjects(list) {
  const pts = list.map((p) => toVec3(p.coordenadas));
  const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(pts.length);
  const extent = Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.z - c.z)));
  const minD = Math.max(...list.map((p) => models.get(p.id).scale)) * 16 * aspectBoost();
  // Distancia según el campo de visión horizontal: en vertical (móvil) la cámara se aleja más.
  const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  return { target: c, distance: Math.max(minD, (extent * 1.3) / Math.tan(halfH)), polar: 0.85, azimuth: 0.15 };
}

function resetSearch() {
  if (!state.matches && !isActive(state.filters)) return;
  state.filters = { ...EMPTY };
  state.matches = null;
  search.reset(false);
  applyDims();
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
$('lang').hidden = !CONFIG.showLangToggle;

const fxNote = () => t('currency.note', { rate: CONFIG.exchange.mxnPerUsd });
$('currency').title = fxNote();
document.querySelectorAll('#currency button').forEach((b) => b.addEventListener('click', () => setCurrency(b.dataset.cur)));
onCurrencyChange((c) =>
  document.querySelectorAll('#currency button').forEach((x) => x.classList.toggle('active', x.dataset.cur === c))
);

// WhatsApp: el mensaje incluye el proyecto abierto o seleccionado.
$('wa').addEventListener('click', () => {
  const id = state.pageId ?? state.selectedId ?? state.cardId;
  $('wa').href = whatsappUrl(id ? models.get(id).project : null);
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.pageId) closePage();
  else if (search.open) search.setOpen(false);
  else if (state.selectedId) deselectProject();
  else goHome();
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
  if (state.pageShown) return; // la página cubre el mapa: sin render
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
    tag.item.visible =
      m.grow > 0.6 && id !== state.cardId && !state.selectedId && (!state.matches || state.matches.has(id));
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
window.__urbaz = { gsap, applyFilters, closePage, getCurrency, setCurrency, selectCity, goHome, rig, finishIntro, selectProject, hoverProject, openProject: (id) => openProject(models.get(id).project), introProgress: (p) => state.introTl?.progress(p) };
