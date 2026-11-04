// Il sito: la Terra vista dallo spazio. La linea arancione parte dalla Ciudad de México e vola
// ai capitoli di Nomads: Mallorca (Capítulo 01, completato: il pannello del viaggio), poi
// marzo 2027 e le Dolomiti (in carica). Nomi di paesi e mari per orientarsi.
//   ?capture   anteprime: la storia si posiziona con window.__globe.seek(p)
import gsap from 'gsap';
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, LoadingManager, Vector3, WebGLRenderTarget, HalfFloatType,
  Mesh, PlaneGeometry, ShaderMaterial,
} from 'three';
import { CONFIG } from '../config.js';
import { loadGlobeData } from '../data/load.js';
import { createGlobe } from './globe.js';
import { ll2v, arcPoints } from './geo.js';
import { makeLine } from '../road/road.js';
import { createGlobeStory } from './story.js';
import { createRide } from './ride.js';
import { createChapterPanel } from './chapter.js';
import { createLoader } from '../ui/loader.js';
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
  const camera = new PerspectiveCamera(45, 1, 0.005, 100);

  const manager = new LoadingManager();
  const loader = CAPTURE ? null : createLoader();
  if (CAPTURE) $('#loader').remove();
  manager.onProgress = (_, loaded, total) => loader?.setProgress((loaded / total) * 0.95);
  const data = await loadGlobeData(manager);

  const globe = createGlobe(data, G);
  scene.add(globe.group);

  // le rotte: Capítulo 01 (Mallorca) e i capitoli in arrivo che hanno già un luogo
  const [ch1] = G.chapters;
  const route = arcPoints(G.origin, ch1, 260, G.arcHeight);
  const line = makeLine(route.flat, CONFIG.line);
  scene.add(line.line);
  const placed = G.chapters.filter((c) => c.status !== 'done' && c.lat != null);
  const nextLines = placed.map((c) => {
    const l = makeLine(arcPoints(G.origin, c, 260, G.arcHeight * 1.15).flat, { ...CONFIG.line, width: CONFIG.line.width * 0.8 });
    scene.add(l.line);
    return l;
  });

  // ── in sella (ride.js): il manubrio all'alba. Lo schermo del ciclocomputer mostra il globo
  // visto da sopra Mallorca (una seconda ripresa in una texture), poi "LLEGASTE" con la distanza
  // vera da Città del Messico (arco di cerchio massimo)
  const R = Math.PI / 180, o = G.origin;
  const km = Math.round(6371 * Math.acos(Math.sin(o.lat * R) * Math.sin(ch1.lat * R) + Math.cos(o.lat * R) * Math.cos(ch1.lat * R) * Math.cos((ch1.lon - o.lon) * R)));
  const ride = createRide({ renderer, km, from: o.name, place: ch1.name, chapter: ch1.n });
  const screenRT = new WebGLRenderTarget(640, 974, { samples: 4 });
  ride.screen.uniforms.tMap.value = screenRT.texture;
  // la ripresa per lo schermo è la stessa del globo alla fine del volo: il passaggio non si vede
  const arrive = G.views[1];
  const mapCam = new PerspectiveCamera(40, 640 / 974, 0.005, 100);
  ll2v(arrive.lat, arrive.lon, arrive.dist, mapCam.position);
  mapCam.lookAt(0, 0, 0);
  mapCam.updateMatrixWorld();
  const mapRight = new Vector3().crossVectors(mapCam.position, new Vector3(0, 1, 0)).normalize();
  const mapLight = new Vector3().copy(mapCam.position).normalize().addScaledVector(new Vector3(0, 1, 0), 0.5).addScaledVector(mapRight, 0.3).normalize();
  // la scena in sella si disegna a parte e si posa sopra il globo con una dissolvenza
  const rideRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const comp = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    uniforms: { tScene: { value: rideRT.texture }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tScene; uniform float uOpacity; varying vec2 vUv;
      vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main() { gl_FragColor = vec4(aces(texture2D(tScene, vUv).rgb * 1.1), uOpacity);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  }));
  comp.frustumCulled = false;
  const compScene = new Scene();
  compScene.add(comp);
  const compCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // pin e nomi: elementi DOM sopra il globo (nitidi, cliccabili), nascosti dietro la Terra
  const pinsEl = $('#pins');
  const veil = $('#veil');
  const root = document.documentElement;
  const marks = [];
  const addMark = (place, cls, html, { tag = 'div', r = 1.003, near = 0, far = 99 } = {}) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (tag === 'button') el.type = 'button';
    el.innerHTML = html;
    pinsEl.appendChild(el);
    const m = { el, pos: ll2v(place.lat, place.lon, r), show: 1, near, far, pin: cls.startsWith('pin') };
    marks.push(m);
    return m;
  };
  for (const l of G.labels) addMark(l, `place${l.sea ? ' place--sea' : ''}`, l.t, { near: 1.25, far: 4.6 });
  const pinOrigin = addMark(G.origin, 'pin pin--origin', `<i aria-hidden="true"></i><span>${G.origin.name}</span>`);
  const pin1 = addMark(ch1, 'pin pin--chapter', `<i aria-hidden="true"></i><span><b>Capítulo ${ch1.n}</b>${ch1.name}</span>`, { tag: 'button' });
  const pinsNext = placed.map((c) => addMark(c, 'pin pin--soon', `<i aria-hidden="true"></i><span><b>Capítulo ${c.n}</b>${c.name}</span>`, { tag: 'button' }));

  // ── dimensioni: sul telefono in verticale il globo sta più in basso, i testi in alto
  let W = 1, H = 1, low = 1;
  const place = () => {
    camera.setViewOffset(W, H, 0, (W < H ? -H * 0.24 : -H * 0.1) * low, W, H);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    W = innerWidth; H = innerHeight;
    camera.aspect = W / H;
    camera.fov = W < H ? 50 : 36;
    place();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    line.setResolution(W, H);
    nextLines.forEach((l) => l.setResolution(W, H));
    const dpr = renderer.getPixelRatio();
    rideRT.setSize(Math.round(W * dpr), Math.round(H * dpr));
    ride.resize(W, H);
    mapCam.fov = 2 * Math.atan(ride.screenFrac * Math.tan((camera.fov * Math.PI) / 360)) * (180 / Math.PI);
    mapCam.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const story = createGlobeStory({ capture: CAPTURE });
  const st = story.state;
  const overlay = createLineOverlay();
  let lineVisible = 1;

  const v = new Vector3(), cam = new Vector3(), right = new Vector3(), up = new Vector3(0, 1, 0), tmp = new Vector3();
  /** la rotta disegnata, proiettata sullo schermo (il pannello di Mallorca ci fa partire la sua linea) */
  const routeOnScreen = () => {
    const b = Math.max(2, Math.round(st.prog * (route.pts.length - 1)));
    return route.pts.slice(0, b + 1).map((p) => { v.copy(p).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; });
  };

  const frame = () => {
    if (st.low !== low) { low = st.low; place(); }
    ll2v(st.lat, st.lon, st.dist, cam);
    camera.position.copy(cam);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // il sole alle spalle di chi guarda, un po' in alto a sinistra: la Terra visibile è illuminata
    right.crossVectors(cam, up).normalize();
    globe.uniforms.uLight.value.copy(cam).normalize().addScaledVector(up, 0.5).addScaledVector(right, 0.3).normalize();
    globe.uniforms.uCamDist.value = st.dist;
    line.setProgress(st.prog);
    line.setOpacity(lineVisible);
    nextLines.forEach((l) => { l.setProgress(st.prog2); l.setOpacity(lineVisible); });
    pin1.show = st.mallorca;
    pinsNext.forEach((p) => { p.show = st.soon; });
    // prima i pin, poi i nomi (che si spengono vicino al bordo della Terra e vicino ai pin)
    for (const m of marks) {
      const facing = tmp.copy(m.pos).normalize().dot(v.copy(cam).sub(m.pos).normalize());
      v.copy(m.pos).project(camera);
      m.x = (v.x * 0.5 + 0.5) * W;
      m.y = (-v.y * 0.5 + 0.5) * H;
      const zoom = m.pin ? 1 : Math.min(Math.max((st.dist - m.near) / 0.25, 0), 1) * Math.min(Math.max((m.far - st.dist) / 0.4, 0), 1);
      const edge = m.pin ? (facing - 0.08) / 0.2 : (facing - 0.3) / 0.25;
      m.o = Math.min(Math.max(edge, 0), 1) * m.show * zoom * lineVisible;
    }
    const shown = marks.filter((m) => m.pin && m.o > 0.3);
    for (const m of marks) {
      let o = m.o;
      if (!m.pin) for (const p of shown) {
        const d = Math.hypot(m.x - p.x - (p.el.classList.contains('pin--left') ? -60 : 60), m.y - p.y);
        o *= Math.min(Math.max((d - 60) / 40, 0), 1);
      }
      m.el.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`;
      m.el.style.opacity = o.toFixed(3);
      if (m.pin) {
        m.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        m.el.classList.toggle('pin--left', m.x > W * 0.6);
      }
    }
    const r = st.ride;
    pinsEl.style.opacity = String(1 - r);
    // in sella niente velo scuro: è lì per leggere i testi sul globo, sul tramonto spegnerebbe la luce
    veil.style.visibility = r > 0.98 ? 'hidden' : '';
    veil.style.filter = r > 0 ? `opacity(${(1 - r).toFixed(3)})` : '';
    root.classList.toggle('is-riding', r > 0.5); // sul cielo chiaro il logo e i pulsanti diventano scuri
    if (r < 1) renderer.render(scene, camera);
    else { renderer.setRenderTarget(null); renderer.clear(); }
    if (r > 0) {
      ride.update(st.rk, performance.now() / 1000);
      ride.screen.uniforms.uMix.value = st.screen;
      if (st.screen < 1) {
        // lo schermo: il globo da sopra Mallorca, con la luce giusta per quella ripresa
        const keep = globe.uniforms.uLight.value.clone(), keepD = globe.uniforms.uCamDist.value;
        globe.uniforms.uLight.value.copy(mapLight);
        globe.uniforms.uCamDist.value = arrive.dist;
        renderer.setRenderTarget(screenRT);
        renderer.render(scene, mapCam);
        globe.uniforms.uLight.value.copy(keep);
        globe.uniforms.uCamDist.value = keepD;
      }
      ride.render(rideRT);
      renderer.setRenderTarget(null);
      comp.material.uniforms.uOpacity.value = r;
      renderer.autoClear = false;
      renderer.render(compScene, compCam);
      renderer.autoClear = true;
    }
  };

  // i pannelli dei capitoli: 01 completo (giorni, livelli, cosa include, sul mare cristallino),
  // 02 e 03 con quello che si sa già
  const info = createInfo({ overlay, story, setLineVisible: (on) => { lineVisible = on ? 1 : 0; }, source: routeOnScreen });
  const panel = createChapterPanel({ story });
  const openChapter = (n) => {
    const ch = G.chapters.find((c) => c.n === n);
    if (ch.status === 'done') info.open(); else panel.open(ch);
  };
  // esplorando, il globo vola alla meta e poi si apre il capitolo (quelli senza luogo si aprono subito)
  let fly = null;
  const goChapter = (n) => {
    const ch = G.chapters.find((c) => c.n === n);
    if (!story.exploring || ch.lat == null) { openChapter(n); return; }
    fly?.kill();
    fly = gsap.to(st, { lat: ch.lat - 1.5, lon: ch.lon, dist: 1.7, duration: 1.5, ease: 'power2.inOut', onComplete: () => openChapter(n) });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chapter]');
    if (b) goChapter(b.dataset.chapter);
  });
  pin1.el.addEventListener('click', () => goChapter(ch1.n));
  pinsNext.forEach((p, i) => p.el.addEventListener('click', () => goChapter(placed[i].n)));

  // ── esplorazione: trascinare gira il mondo (con inerzia), due dita o la rotella avvicinano
  const touches = new Map();
  let drag = null, pinch = null, vlat = 0, vlon = 0;
  const clampLat = (x) => Math.min(Math.max(x, -65), 78);
  const clampDist = (d) => Math.min(Math.max(d, G.zoom[0]), G.zoom[1]);
  canvas.addEventListener('pointerdown', (e) => {
    if (!story.exploring || story.finalOpen) return;
    fly?.kill();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: st.dist };
      drag = null;
    } else drag = { x: e.clientX, y: e.clientY };
    vlat = vlon = 0;
    document.documentElement.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      st.dist = clampDist(pinch.dist0 * pinch.d0 / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1));
      return;
    }
    if (!drag) return;
    const k = (st.dist - 1) * 0.1; // gradi per pixel: da vicino si gira più piano
    vlon = -(e.clientX - drag.x) * k;
    vlat = (e.clientY - drag.y) * k;
    st.lon += vlon;
    st.lat = clampLat(st.lat + vlat);
    drag = { x: e.clientX, y: e.clientY };
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (touches.size === 0) { drag = null; document.documentElement.classList.remove('is-dragging'); }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  addEventListener('wheel', (e) => {
    if (!story.exploring || e.target.closest?.('.info, .final, .dock')) return;
    fly?.kill();
    st.dist = clampDist(st.dist * Math.exp(e.deltaY * 0.0012));
  }, { passive: true });
  gsap.ticker.add(() => {
    if (drag || !story.exploring) return;
    st.lon += vlon; st.lat = clampLat(st.lat + vlat);
    vlon *= 0.9; vlat *= 0.9;
  });

  const audio = createAudio();
  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', () => soundBtn.setAttribute('aria-pressed', String(audio.toggle())));

  window.__globe = { story, camera, frame, info, panel, openChapter };
  if (CAPTURE) {
    window.__globe.seek = (p) => { story.seek(p); frame(); };
    story.intro(true);
    frame();
    document.body.classList.add('ready');
    return;
  }

  gsap.ticker.add(() => { if (!story.finalOpen) frame(); });
  document.body.classList.add('ready');

  // a dati pronti la barra arancione sfuma e si scopre la Terra
  story.pause();
  await loader.done();
  story.resume();
  story.intro();
}

start().catch((e) => {
  console.error(e);
  document.body.classList.add('error');
});
