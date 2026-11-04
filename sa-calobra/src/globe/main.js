// La home: un globo. La linea arancione parte dalla Ciudad de México e vola ai capitoli di
// Nomads: Mallorca (Capítulo 01, con il pannello del viaggio e la Sa Calobra in 3D), poi i
// prossimi (con il luogo solo se è deciso).
//   ?capture   anteprime: la storia si posiziona con window.__globe.seek(p)
import gsap from 'gsap';
import { WebGLRenderer, Scene, PerspectiveCamera, LoadingManager, Vector3 } from 'three';
import { CONFIG } from '../config.js';
import { loadGlobeData } from '../data/load.js';
import { createGlobe } from './globe.js';
import { ll2v, arcPoints } from './geo.js';
import { makeLine } from '../road/road.js';
import { createGlobeStory } from './story.js';
import { createIntro } from '../ui/intro.js';
import { createInfo } from '../ui/info.js';
import { createLineOverlay } from '../ui/lineOverlay.js';
import { createAudio } from '../ui/audio.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const $ = (s) => document.querySelector(s);

async function start() {
  const G = CONFIG.globe;
  const canvas = $('#globe');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.005, 50);

  const manager = new LoadingManager();
  const intro = CAPTURE ? null : createIntro();
  if (CAPTURE) $('#intro').remove();
  manager.onProgress = (_, loaded, total) => intro?.setProgress((loaded / total) * 0.9);
  const data = await loadGlobeData(manager);

  const globe = createGlobe(data, G.colors);
  scene.add(globe.group);

  // le rotte: Capítulo 01 (Mallorca) e i prossimi capitoli con un luogo
  const mall = G.chapters.find((c) => c.open);
  const route = arcPoints(G.origin, mall, 260, G.arcHeight);
  const line = makeLine(route.flat, CONFIG.line);
  scene.add(line.line);
  const nextPlaces = G.chapters.filter((c) => !c.open && c.lat != null);
  const nextLines = nextPlaces.map((c) => {
    const r = arcPoints(G.origin, c, 260, G.arcHeight * 1.15);
    const l = makeLine(r.flat, { ...CONFIG.line, width: CONFIG.line.width * 0.75, glow: CONFIG.line.glow * 0.75 });
    scene.add(l.line);
    return l;
  });

  // i pin: segnaposto DOM sopra il globo (nitidi, cliccabili)
  const pinsEl = $('#pins');
  const pins = [];
  const addPin = (place, cls, html, tag = 'div') => {
    const el = document.createElement(tag);
    el.className = `pin ${cls}`;
    if (tag === 'button') el.type = 'button';
    el.innerHTML = `<i aria-hidden="true"></i><span>${html}</span>`;
    pinsEl.appendChild(el);
    const p = { el, pos: ll2v(place.lat, place.lon, 1.003), show: 1 };
    pins.push(p);
    return p;
  };
  addPin(G.origin, 'pin--origin', G.origin.name);
  const pinMall = addPin(mall, 'pin--chapter', `<b>Capítulo ${mall.n}</b>${mall.name}`, 'button');
  const pinsNext = nextPlaces.map((c) => addPin(c, 'pin--soon', `<b>Capítulo ${c.n}</b>${c.name} · ${c.when}`));

  // ── dimensioni: sul telefono in verticale il globo sta più in basso, i testi in alto
  let W = 1, H = 1;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    camera.aspect = W / H;
    camera.fov = W < H ? 50 : 36;
    camera.setViewOffset(W, H, 0, W < H ? -H * 0.24 : -H * 0.1, W, H); // il globo in basso, i testi in alto
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    line.setResolution(W, H);
    nextLines.forEach((l) => l.setResolution(W, H));
  };
  addEventListener('resize', resize);
  resize();

  const story = createGlobeStory({ capture: CAPTURE });
  const st = story.state;
  const overlay = createLineOverlay();
  let lineVisible = CAPTURE ? 1 : 0;

  const v = new Vector3(), cam = new Vector3(), right = new Vector3(), up = new Vector3(0, 1, 0);
  /** punti della rotta disegnata, proiettati sullo schermo (per l'intro e per il pannello) */
  const routeOnScreen = (from = 0, to = st.prog) => {
    const a = Math.floor(from * (route.pts.length - 1)), b = Math.max(a + 2, Math.round(to * (route.pts.length - 1)));
    return route.pts.slice(a, b + 1).map((p) => { v.copy(p).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; });
  };

  const frame = () => {
    // camera: guarda il centro del globo dal punto (lat, lon), alla distanza data
    ll2v(st.lat, st.lon, st.dist, cam);
    camera.position.copy(cam);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // luce dall'alto a sinistra rispetto a chi guarda: il lato visibile è sempre illuminato
    right.crossVectors(cam, up).normalize();
    globe.uniforms.uLight.value.copy(cam).normalize().addScaledVector(up, 0.55).addScaledVector(right, 0.35).normalize();
    line.setProgress(st.prog);
    line.setOpacity(lineVisible);
    nextLines.forEach((l) => { l.setProgress(st.prog2); l.setOpacity(0.85 * lineVisible); });
    pinMall.show = st.mallorca;
    pinsNext.forEach((p) => { p.show = st.soon; });
    for (const p of pins) {
      // nascosti dietro il globo
      const facing = v.copy(p.pos).normalize().dot(cam.clone().sub(p.pos).normalize());
      v.copy(p.pos).project(camera);
      const o = Math.min(Math.max((facing - 0.05) / 0.2, 0), 1) * p.show * lineVisible;
      const px = (v.x * 0.5 + 0.5) * W;
      p.el.style.transform = `translate3d(${px.toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H).toFixed(1)}px, 0)`;
      p.el.classList.toggle('pin--left', px > W * 0.6); // vicino al bordo destro l'etichetta va a sinistra
      p.el.style.opacity = o.toFixed(3);
      p.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
    renderer.render(scene, camera);
  };

  // il pannello del Capítulo 01 (giorni, livelli, cosa include, sul mare cristallino)
  const info = createInfo({ overlay, story, setLineVisible: (on) => { lineVisible = on ? 1 : 0; }, source: () => routeOnScreen() });
  $('#see-chapter').addEventListener('click', () => info.open());
  pinMall.el.addEventListener('click', () => info.open());

  const audio = createAudio();
  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', () => soundBtn.setAttribute('aria-pressed', String(audio.toggle())));

  window.__globe = { story, camera, frame, info };
  if (CAPTURE) {
    window.__globe.seek = (p) => { story.seek(p); frame(); };
    story.intro(true);
    frame();
    document.body.classList.add('ready');
    return;
  }

  let drawn = 0;
  gsap.ticker.add(() => {
    if (story.finalOpen) return;
    if (intro?.covering && drawn > 3) return;
    drawn++;
    frame();
  });
  document.body.classList.add('ready');

  // ENTRAR: la M del logo si posa sulla rotta che lascia il Messico
  story.pause();
  intro.setProgress(1);
  await intro.ready();
  audio.unlock();
  frame();
  await intro.play({ camera, overlay, target: routeOnScreen(0, G.progress[0]), onReveal: () => { lineVisible = 1; }, onShift: () => audio.shift() });
  story.resume();
  story.intro();
}

start().catch((e) => {
  console.error(e);
  document.body.classList.add('error');
});
