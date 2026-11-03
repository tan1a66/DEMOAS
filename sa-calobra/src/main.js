// Sa Calobra — avvio.
//   (nessun parametro)  la storia guidata dallo scroll
//   ?debug              contatore FPS / draw call / triangoli (+ risoluzione adattiva)
//   ?view=serpentina|meta|porto|nus|tramonto   punti di vista fissi (sviluppo)
//   ?orbit              OrbitControls per esplorare (sviluppo)
//   ?capture            registrazione: la storia si posiziona via window.__story.seek()
import gsap from 'gsap';
import { WebGLRenderer, Scene, PerspectiveCamera, LoadingManager, Vector3, NoToneMapping, Mesh } from 'three';
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
import { createRider } from './scene/rider.js';
import { createPost } from './scene/post.js';
import { createShared } from './scene/shared.js';
import { createDebug } from './debug.js';
import { roadView, ensureClearance } from './camera/clearance.js';
import { CameraRig } from './camera/rig.js';
import { createStory } from './story/story.js';
import { createLook } from './ui/look.js';
import { createAudio } from './ui/audio.js';
import { createIntro } from './ui/intro.js';
import { createInfo } from './ui/info.js';
import { createLineOverlay } from './ui/lineOverlay.js';

const params = new URLSearchParams(location.search);
const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 820;
const CAPTURE = params.has('capture');

async function buildWorld(canvas, manager) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
  renderer.toneMapping = NoToneMapping; // il tone mapping lo fa il post-processing
  renderer.toneMappingExposure = CONFIG.post.exposure;

  const t0 = performance.now();
  const geo = await loadGeoData(manager);
  const hf = new Heightfield(geo.levels);
  const road = new RoadPath(geo.road);
  const shared = createShared();
  const scene = new Scene();
  const camera = new PerspectiveCamera(CONFIG.camera.fovPortrait, 1, CONFIG.camera.near, CONFIG.camera.far);

  // rilievo cotto sulla GPU (normali, ombre, occlusione)
  const heightTex = { hi: heightTexture(geo.levels.hi), base: heightTexture(geo.levels.base), far: heightTexture(geo.levels.far) };
  const lu = levelUniforms(geo.levels, heightTex);
  const rects = Object.fromEntries(Object.entries(lu).filter(([k]) => k.startsWith('uRect') || k.startsWith('uGrid')));
  const bakeTex = new TerrainBake(renderer, geo.levels, heightTex, shared.uSunDir.value, CONFIG.sun.shadowSoftness).textures();

  const sky = createSky(renderer, shared);
  scene.background = sky.texture;
  scene.backgroundIntensity = CONFIG.sky.exposure;
  scene.add(createSun(shared));

  const terrainGeo = buildTerrainGeometry(hf, road, geo.terrainMeta.carve);
  const terrain = new Mesh(terrainGeo, createTerrainMaterial(shared, rects, bakeTex));
  terrain.frustumCulled = false;
  scene.add(terrain);

  const roadObj = createRoad(road, hf, shared, rects, bakeTex);
  scene.add(roadObj.group);
  scene.add(createSea(geo.levels, shared, rects));
  const trees = createTrees(hf, road, shared, rects, bakeTex);
  scene.add(trees.mesh);
  const rider = createRider(shared);
  scene.add(rider.mesh);

  const post = createPost(renderer, scene, camera, isMobile);
  const info = {
    ready_ms: Math.round(performance.now() - t0),
    terrain: terrainGeo.userData,
    trees: trees.count,
    walls: roadObj.stats.walls,
  };
  return { renderer, scene, camera, hf, road, shared, roadObj, rider, post, info };
}

async function start() {
  const canvas = document.getElementById('gl');
  const manager = new LoadingManager();
  // l'intro compare subito; la linea sotto il logo segue il caricamento
  const dev = CAPTURE || params.has('view') || params.has('pos') || params.has('orbit');
  const intro = dev ? null : createIntro();
  if (dev) document.getElementById('intro').remove();
  manager.onProgress = (_, loaded, total) => intro?.setProgress((loaded / total) * 0.75);
  const w = await buildWorld(canvas, manager);
  intro?.setProgress(0.9);
  const { renderer, camera, hf, road, shared, roadObj, rider, post } = w;

  // ── dimensioni: il canvas è alto 100lvh, quindi la barra di Safari non lo ridimensiona
  let pixelRatio = Math.min(devicePixelRatio, CONFIG.perf.maxPixelRatio);
  let cw = 0, ch = 0;
  const resize = (force) => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!force && W === cw && H === ch) return;
    cw = W; ch = H;
    const aspect = W / H;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? CONFIG.camera.fovPortrait : CONFIG.camera.fovLandscape;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(W, H, false);
    post.composer.setSize(W, H, false);
    roadObj.line.setResolution(W, H);
    roadObj.climb.setResolution(W, H);
    rider.setViewport(W, H);
  };
  addEventListener('resize', () => resize(false));
  resize(true);

  const debug = params.has('debug') ? createDebug(renderer) : null;
  renderer.info.autoReset = false;

  // ── modalità sviluppo: punti di vista fissi (Fase 2)
  if (params.has('view') || params.has('pos') || params.has('orbit')) {
    return startStaticView(w, resize, debug);
  }

  // ── la storia
  const rig = new CameraRig(camera, road, hf);
  const look = createLook(rig.look);
  const audio = createAudio();
  const story = createStory({ rig, road, capture: CAPTURE });
  const st = rig.state;
  const overlay = createLineOverlay();
  let lineVisible = dev ? 1 : 0; // la linea 3D compare quando la "M" dell'intro si posa sulla strada
  const info = createInfo({ camera, road, rig, overlay, story, setLineVisible: (v) => { lineVisible = v ? 1 : 0; } });
  window.__story = { story, rig, w, info };

  // pulsanti: suono e giroscopio
  const soundBtn = document.getElementById('sound');
  soundBtn.addEventListener('click', () => soundBtn.setAttribute('aria-pressed', String(audio.toggle())));
  const gyroBtn = document.getElementById('gyro');
  if (look.gyroAvailable) {
    gyroBtn.hidden = false;
    gyroBtn.addEventListener('click', async () => { if (await look.enableGyro()) gyroBtn.classList.add('on'); });
  }

  let lastS = st.lineS;
  const frame = (dt) => {
    renderer.info.reset();
    shared.uTime.value += dt;
    look.update(dt, st.stop);
    document.documentElement.classList.toggle('can-look', st.stop > 0.5);
    rig.update(dt);
    // la linea della discesa si disegna fino al punto arancione; in salita si attenua e
    // la salita si accende dal porto verso la cima
    const L = road.length;
    roadObj.line.setProgress(st.lineS / L);
    roadObj.line.setOpacity((1 - 0.6 * st.dim) * lineVisible);
    roadObj.climb.setOpacity(lineVisible);
    roadObj.climb.setProgress((L - st.climbS) / L);
    const rs = rig.riderS();
    rider.update(road, rs, st.rider);
    story.updateCounter();
    // audio: il ticchettio della ruota libera segue la velocità con cui scende la linea
    const speed = (st.lineS - lastS) / Math.max(dt, 1e-3);
    lastS = st.lineS;
    audio.update(speed, st.dir > 0 && speed > 0);
    post.composer.render(dt);
  };

  if (CAPTURE) {
    // registrazione fotogramma per fotogramma: seek(p, dt, yaw) rende un fotogramma
    window.__story.seek = (p, dt = 1 / 24, yaw = null) => {
      story.seek(p);
      if (yaw !== null) { look.state.yaw = yaw; look.state.vy = 0; }
      frame(dt);
    };
    // misura del movimento (senza disegnare): posizione e orientamento della camera a p
    window.__story.probe = (p, dt = 1 / 24) => {
      story.seek(p);
      look.update(dt, st.stop);
      rig.update(dt);
      const q = camera.quaternion, c = camera.position;
      return [q.x, q.y, q.z, q.w, c.x, c.y, c.z];
    };
    story.intro(true);
    document.body.classList.add('ready');
    return;
  }

  gsap.ticker.add((time, deltaMs) => {
    if (story.finalOpen) return; // la schermata finale copre tutto: niente 3D
    const dt = Math.min(deltaMs / 1000, 0.1);
    frame(dt);
    if (debug) {
      const r = debug.frame(dt);
      if (CONFIG.perf.adaptive && r.lowFor > 2 && pixelRatio > CONFIG.perf.minPixelRatio) {
        pixelRatio = Math.max(CONFIG.perf.minPixelRatio, pixelRatio - 0.25);
        resize(true);
        r.reset();
      }
    }
  });
  console.log('[sa-calobra]', JSON.stringify(w.info));
  document.body.classList.add('ready');

  // ── ENTRAR: sblocca audio e giroscopio (serve un gesto), poi lo zoom nella M
  story.pause();
  await intro.ready();
  audio.unlock();
  if (look.gyroAvailable) look.enableGyro().then((ok) => ok && gyroBtn.classList.add('on'));
  await intro.play({ camera, road, overlay, lineS: st.lineS, onReveal: () => { lineVisible = 1; } });
  story.resume();
  story.intro();
}

// ── punti di vista fissi (sviluppo / screenshot della Fase 2) ─────────────────
async function startStaticView(w, resize, debug) {
  const { renderer, camera, hf, road, shared, roadObj, rider, post } = w;
  const views = makeViews(road, hf);
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
  roadObj.line.setProgress(1);
  rider.update(road, 0, 0);
  let controls = null;
  if (params.has('orbit')) {
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(view.target);
    controls.update();
  }
  const shotFrames = params.has('shot') ? Number(params.get('frames') || 12) : Infinity;
  let frame = 0;
  renderer.setAnimationLoop(() => {
    if (++frame > shotFrames) {
      renderer.setAnimationLoop(null);
      document.body.classList.add('shot-done');
      return;
    }
    renderer.info.reset();
    shared.uTime.value += 1 / 60;
    controls?.update();
    post.composer.render(1 / 60);
    debug?.frame(1 / 60);
  });
  console.log('[sa-calobra]', JSON.stringify(w.info));
  document.body.classList.add('ready', 'static-view');
}

function makeViews(road, hf) {
  const P = (i) => new Vector3(road.x(i), road.y(i), road.z(i));
  const last = road.count - 1;
  const portTarget = new Vector3(-120, 10, -1120);
  return {
    serpentina: { pos: new Vector3(1250, 1180, 2350), target: new Vector3(250, 250, -400) },
    meta: roadView(road, hf, 3150, { back: 160, up: 90, ahead: 420 }),
    porto: { pos: ensureClearance(hf, P(last).add(new Vector3(-110, 50, 150)), portTarget), target: portTarget },
    nus: { pos: new Vector3(930, 745, 1300), target: new Vector3(845, 668, 1195) },
    tramonto: { pos: new Vector3(1100, 950, 1750), target: new Vector3(-1850, 450, 2630) },
  };
}

start().catch((e) => {
  console.error(e);
  document.body.classList.add('error');
});
