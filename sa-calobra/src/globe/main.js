// Il sito: la Terra vista dallo spazio. La linea arancione parte dalla Ciudad de México e vola
// ai capitoli di Nomads: Mallorca (Capítulo 01, completato: il pannello del viaggio), poi
// marzo 2027 e le Dolomiti (in carica). Nomi di paesi e mari per orientarsi.
//   ?capture   anteprime: la storia si posiziona con window.__globe.seek(p)
import gsap from 'gsap';
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, LoadingManager, Vector2, Vector3, Vector4, WebGLRenderTarget,
  HalfFloatType, Mesh, PlaneGeometry, ShaderMaterial, NoBlending,
} from 'three';
import { CONFIG } from '../config.js';
import { loadGlobeData } from '../data/load.js';
import { createGlobe } from './globe.js';
import { ll2v } from './geo.js';
import { createGlobeStory } from './story.js';
import { createRide } from './ride.js';
import { createChapterPanel } from './chapter.js';
import { createPages } from './pages.js';
import { createPool } from '../ui/pool.js';
import { createLoader } from '../ui/loader.js';
import { createInfo } from '../ui/info.js';
import { createLineOverlay } from '../ui/lineOverlay.js';

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

  const globe = createGlobe(data, G, Math.min(renderer.capabilities.getMaxAnisotropy(), 8));
  scene.add(globe.group);

  // le mete: Capítulo 01 (Mallorca) e i capitoli in arrivo che hanno già un luogo (niente rotte)
  const [ch1] = G.chapters;
  const placed = G.chapters.filter((c) => c.status !== 'done' && c.lat != null);

  // ── in sella (ride.js): il manubrio al tramonto, il ciclocomputer acceso con LLEGASTE. Poi il
  // mondo nasce dentro lo schermo piccolo e si allarga a tutta la pagina, senza stacchi: il globo
  // si disegna a parte e si posa dentro il rettangolo dello schermo, che cresce (st.portal)
  const ride = createRide({ renderer });
  const rideRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const globeRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const comp = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    uniforms: {
      tRide: { value: rideRT.texture }, tGlobe: { value: globeRT.texture },
      uRect: { value: new Vector4(0, 0, 1, 1) }, uView: { value: new Vector2(1, 1) }, uK: { value: 0 }, uRad: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tRide, tGlobe; uniform vec4 uRect; uniform vec2 uView; uniform float uK, uRad;
      varying vec2 vUv;
      vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main() {
        vec4 col = vec4(aces(texture2D(tRide, vUv).rgb * 1.1), 1.0);
        // dentro lo schermo (angoli appena arrotondati): il globo, rimpicciolito per starci dentro
        vec2 p = vUv * uView, a = uRect.xy * uView, b = uRect.zw * uView, c = (a + b) * 0.5, h = (b - a) * 0.5;
        vec2 q = abs(p - c) - h + uRad;
        float inside = clamp(0.5 - (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRad), 0.0, 1.0);
        float s = max(2.0 * h.x / uView.x, 2.0 * h.y / uView.y);
        vec4 g = texture2D(tGlobe, 0.5 + (p - c) / (s * uView));
        gl_FragColor = mix(col, g, inside * uK);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, blending: NoBlending,
  }));
  comp.frustumCulled = false;
  const compScene = new Scene();
  compScene.add(comp);
  const compCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // pin e nomi: elementi DOM sopra il globo (nitidi, cliccabili), nascosti dietro la Terra
  const pinsEl = $('#pins');
  // il pulsante ENTRA del ciclocomputer: un bottone vero (toccabile, accessibile) sopra quello in 3D
  const enterBtn = document.createElement('button');
  enterBtn.type = 'button';
  enterBtn.className = 'enter';
  enterBtn.setAttribute('aria-label', 'Entra');
  document.body.appendChild(enterBtn);
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
  // sulla cartina solo le mete dei viaggi: nessun nome di paese
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
    const dpr = renderer.getPixelRatio();
    rideRT.setSize(Math.round(W * dpr), Math.round(H * dpr));
    globeRT.setSize(Math.round(W * dpr), Math.round(H * dpr));
    comp.material.uniforms.uView.value.set(W * dpr, H * dpr);
    ride.resize(W, H);
  };
  addEventListener('resize', resize);
  resize();

  const story = createGlobeStory({ capture: CAPTURE });
  const st = story.state;
  const overlay = createLineOverlay();
  let lineVisible = 1;

  const v = new Vector3(), cam = new Vector3(), right = new Vector3(), up = new Vector3(0, 1, 0), tmp = new Vector3();
  /** il pin di Mallorca sullo schermo: da lì nasce la linea del tempo del pannello del viaggio */
  const pinOnScreen = () => {
    v.copy(pin1.pos).project(camera);
    const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    return [[x, y], [x, y + 2]];
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
    const r = st.ride, P = st.portal;
    // pin e nomi solo quando il mondo ha riempito la pagina
    pinsEl.style.opacity = String(r > 0 ? Math.min(Math.max((P - 0.85) / 0.15, 0), 1) : 1);
    // in sella niente velo scuro: sul tramonto spegnerebbe la luce
    veil.style.visibility = r > 0 && P < 0.9 ? 'hidden' : '';
    root.classList.toggle('is-riding', r > 0 && P < 0.5); // sul cielo chiaro logo e WhatsApp scuri
    if (r <= 0) { enterBtn.hidden = true; renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    ride.update(st.rk, performance.now() / 1000);
    ride.render(rideRT);
    // il bottone segue il pulsante 3D (almeno 48 px per il dito); si può toccare finché non si entra
    const [bx, by, bw, bh] = ride.buttonRect(W, H);
    const tw = Math.max(bw + 16, 64), th = Math.max(bh + 16, 48);
    enterBtn.hidden = story.step === 2 || P > 0;
    enterBtn.style.transform = `translate3d(${(bx + bw / 2 - tw / 2).toFixed(1)}px, ${(by + bh / 2 - th / 2).toFixed(1)}px, 0)`;
    enterBtn.style.width = `${tw.toFixed(0)}px`;
    enterBtn.style.height = `${th.toFixed(0)}px`;
    const u = comp.material.uniforms;
    u.uK.value = st.portalA;
    if (st.portalA > 0) {
      renderer.setRenderTarget(globeRT);
      renderer.render(scene, camera);
      // il rettangolo: dallo schermo del ciclocomputer a tutta la pagina
      const [x0, y0, x1, y1] = ride.screenRect();
      const e = P * P * (3 - 2 * P);
      u.uRect.value.set(x0 * (1 - e), y0 * (1 - e), x1 + (1 - x1) * e, y1 + (1 - y1) * e);
      u.uRad.value = (1 - e) * 0.08 * Math.min((x1 - x0) * u.uView.value.x, (y1 - y0) * u.uView.value.y);
    }
    renderer.setRenderTarget(null);
    renderer.render(compScene, compCam);
  };

  // i pannelli dei capitoli: 01 completo (giorni, livelli, cosa include, sul mare cristallino),
  // 02 e 03 con quello che si sa già
  const info = createInfo({ overlay, story, setLineVisible: (on) => { lineVisible = on ? 1 : 0; }, source: pinOnScreen });
  const panel = createChapterPanel({ story });
  // Mallorca: sotto il viaggio giorno per giorno, l'acqua cristallina che si muove
  createPool($('#info .info__pool'), $('#info'));
  const seaEl = $('#info .info__pool');
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

  enterBtn.addEventListener('click', () => { ride.press(); story.goTo(2); });

  // il menu sotto il logo: Nosotros e Viajes sono pagine leggere, Contacto la schermata con WhatsApp
  const pages = createPages({ story, onChapter: goChapter });
  for (const b of document.querySelectorAll('[data-page]')) {
    b.addEventListener('click', () => {
      if (info.isOpen) info.close();
      if (panel.isOpen) panel.close();
      if (b.dataset.page === 'contacto') story.open({ currentTarget: b });
      else pages.open(b.dataset.page);
    });
  }
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

  // il logo riporta all'inizio del racconto (senza ricaricare la pagina)
  $('.logo-link').addEventListener('click', (e) => {
    e.preventDefault();
    fly?.kill();
    vlat = vlon = 0;
    if (info.isOpen) info.close();
    if (panel.isOpen) panel.close();
    if (pages.isOpen) pages.close();
    story.home();
  });

  window.__globe = { story, camera, frame, info, panel, openChapter };
  if (CAPTURE) {
    window.__globe.seek = (p) => { story.seek(p); frame(); };
    story.intro(true);
    frame();
    document.body.classList.add('ready');
    return;
  }

  // il globo non si disegna quando è coperto (schermata finale, pagine, pannelli già aperti)
  gsap.ticker.add(() => {
    if (story.finalOpen || pages.isOpen || panel.isOpen || (info.isOpen && seaEl.style.opacity === '1')) return;
    frame();
  });
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
