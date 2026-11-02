// Sa Calobra — avvio della scena (Fase 2).
//   ?debug          contatore FPS, draw call e triangoli
//   ?view=serpentina|meta|porto   punti di vista di prova
//   ?orbit          OrbitControls per esplorare liberamente (solo sviluppo)
import { WebGLRenderer, Scene, PerspectiveCamera, LoadingManager, Vector3, Timer, NoToneMapping, Mesh } from 'three';
import { CONFIG } from './config.js';
import { loadGeoData } from './data/load.js';
import { Heightfield } from './terrain/heightfield.js';
import { RoadPath } from './road/roadPath.js';
import { buildTerrainGeometry } from './terrain/buildMesh.js';
import { heightTexture, levelUniforms, TerrainBake } from './terrain/bake.js';
import { createTerrainMaterial } from './terrain/terrainMaterial.js';
import { createRoad } from './road/road.js';
import { createSea } from './scene/sea.js';
import { createSky, createSun } from './scene/sky.js';
import { createTrees } from './scene/trees.js';
import { createPost } from './scene/post.js';
import { createShared } from './scene/shared.js';
import { createDebug } from './debug.js';
import { roadView, ensureClearance } from './camera/clearance.js';

const params = new URLSearchParams(location.search);
const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 820;

async function start() {
  const canvas = document.getElementById('gl');
  const renderer = new WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio, CONFIG.perf.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = NoToneMapping; // il tone mapping lo fa il post-processing (AgX)
  renderer.toneMappingExposure = CONFIG.post.exposure;

  const manager = new LoadingManager();
  const t0 = performance.now();
  const geo = await loadGeoData(manager);
  const tLoad = performance.now();

  const hf = new Heightfield(geo.levels);
  const road = new RoadPath(geo.road);
  const shared = createShared();
  const scene = new Scene();
  const camera = new PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, CONFIG.camera.near, CONFIG.camera.far);

  // rilievo cotto sulla GPU (normali, ombre, occlusione)
  const heightTex = { hi: heightTexture(geo.levels.hi), base: heightTexture(geo.levels.base), far: heightTexture(geo.levels.far) };
  const lu = levelUniforms(geo.levels, heightTex);
  const rects = Object.fromEntries(Object.entries(lu).filter(([k]) => k.startsWith('uRect') || k.startsWith('uGrid')));
  const bake = new TerrainBake(renderer, geo.levels, heightTex, shared.uSunDir.value, CONFIG.sun.shadowSoftness);
  const bakeTex = bake.textures();

  const sky = createSky(renderer, shared);
  scene.background = sky.texture;
  scene.backgroundIntensity = CONFIG.sky.exposure;
  scene.add(createSun(shared));

  const tMesh0 = performance.now();
  const terrainGeo = buildTerrainGeometry(hf, road, geo.terrainMeta.carve);
  const tMesh = performance.now();
  const terrain = new Mesh(terrainGeo, createTerrainMaterial(shared, rects, bakeTex));
  terrain.frustumCulled = false;
  scene.add(terrain);

  const roadObj = createRoad(road, hf, shared, rects, bakeTex);
  scene.add(roadObj.group);

  scene.add(createSea(geo.levels, shared, rects));

  const trees = createTrees(hf, road, shared, rects, bakeTex);
  scene.add(trees.mesh);

  const post = createPost(renderer, scene, camera, isMobile);

  // ── punti di vista di prova
  const views = makeViews(road, hf);
  // ?view=road&i=3100&up=80&back=150&ahead=400&side=0 → vista libera sopra la strada (sviluppo)
  if (params.get('view') === 'road') {
    const n = (k, d) => Number(params.get(k) ?? d);
    views.road = roadView(road, hf, n('i', 2500), { up: n('up', 60), back: n('back', 80), ahead: n('ahead', 300), side: n('side', 0) });
  }
  if (params.has('pos')) {
    const v = (k) => new Vector3(...params.get(k).split(',').map(Number));
    views.custom = { pos: v('pos'), target: v('target') };
  }
  const view = views[params.has('pos') ? 'custom' : params.get('view')] || views.serpentina;
  camera.position.copy(view.pos);
  camera.lookAt(view.target);

  let controls = null;
  if (params.has('orbit')) {
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    controls = new OrbitControls(camera, canvas);
    controls.target.copy(view.target);
    controls.update();
  }

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    post.composer.setSize(w, h, false);
    roadObj.line.setResolution(w, h);
  };
  addEventListener('resize', resize);
  resize();

  const debug = params.has('debug') ? createDebug(renderer) : null;
  const info = {
    load_ms: Math.round(tLoad - t0),
    mesh_ms: Math.round(tMesh - tMesh0),
    ready_ms: Math.round(performance.now() - t0),
    terrain: terrainGeo.userData,
    walls: roadObj.stats.walls,
    trees: trees.count,
    treeTris: trees.count * trees.trisPerTree,
    pixelRatio,
  };
  window.__scene = { info, camera, views, renderer, scene, road, hf, roadObj, post };
  console.log('[sa-calobra]', JSON.stringify(info));

  const timer = new Timer();
  renderer.info.autoReset = false; // il post-processing fa più passate: azzeriamo a mano a ogni fotogramma
  // ?shot: per gli screenshot automatici rende qualche fotogramma e poi si ferma
  const shotFrames = params.has('shot') ? Number(params.get('frames') || 12) : Infinity;
  let frame = 0;
  renderer.setAnimationLoop((now) => {
    if (++frame > shotFrames) {
      renderer.setAnimationLoop(null);
      document.body.classList.add('shot-done');
      return;
    }
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    renderer.info.reset();
    shared.uTime.value += dt;
    controls?.update();
    post.composer.render(dt);
    if (debug) {
      const r = debug.frame(dt);
      // risoluzione adattiva: se per 2 s si sta sotto i 50 fps, scende un gradino
      if (CONFIG.perf.adaptive && !params.has('shot') && r.lowFor > 2 && pixelRatio > CONFIG.perf.minPixelRatio) {
        pixelRatio = Math.max(CONFIG.perf.minPixelRatio, pixelRatio - 0.25);
        resize();
        r.reset();
      }
    }
  });
  document.body.classList.add('ready');
}

function makeViews(road, hf) {
  const P = (i) => new Vector3(road.x(i), road.y(i), road.z(i));
  const last = road.count - 1;
  // il porto, la costa e la foce del Torrent de Pareis (a est), con il sole alle spalle
  const portTarget = new Vector3(-120, 10, -1120);
  return {
    // alto sopra la serpentina vicino al Coll, verso il mare
    serpentina: { pos: new Vector3(1250, 1180, 2350), target: new Vector3(250, 250, -400) },
    // metà strada (km 6,3), sopra la strada guardando avanti verso il mare
    meta: roadView(road, hf, 3150, { back: 160, up: 90, ahead: 420 }),
    // porto: sopra la fine della strada, verso la cala
    porto: { pos: ensureClearance(hf, P(last).add(new Vector3(-110, 50, 150)), portTarget), target: portTarget },
    // il Nus de sa Corbata da vicino
    nus: { pos: new Vector3(930, 745, 1300), target: new Vector3(845, 668, 1195) },
    // controluce verso il sole dal Coll dels Reis
    tramonto: { pos: new Vector3(1100, 950, 1750), target: new Vector3(-1850, 450, 2630) },
  };
}

start().catch((e) => {
  console.error(e);
  document.body.classList.add('error');
});
