// ÉIA STUDIO — al posto della seta di Esmaltadas, un vassoio di mirtilli azzurri (con qualche
// ciliegia rosso smaltato) visto dall'alto. All'apertura piovono e si ammucchiano in alto;
// allo scroll il vassoio s'inclina e rotolano verso l'alto; con il mouse si spostano, con un
// tocco saltano. Le lettere del nome salgono nella barra, poi la frase e il menu. Ogni voce del
// menu è un luogo sul mucchio: la camera ci vola, e lì i mirtilli perdono la polvere (lucidi,
// scuri: le scritte bianche si leggono).
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Berries, PALETTE } from './berries/berries.js';
import { createStory } from './story.js';
import { CONTACT, ESTUDIO, mapEmbed, mapLink } from './config.js';
import { createBooking, renderHorario, estadoAhora } from './booking.js';
import './fonts.css';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);
// solo per le prove automatiche (?speed): le animazioni seguono l'orologio anche se i fotogrammi sono lenti
if (new URLSearchParams(location.search).has('speed')) gsap.ticker.lagSmoothing(0);

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = coarse || Math.min(innerWidth, innerHeight) < 600;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = params.get('q') || (isMobile ? 'mobile' : 'high');
const SPEED = +params.get('speed') || 1; // solo per le prove (?speed=3: la fisica va più veloce)

// ---------- renderer e scena ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR_MAX = isMobile ? 2 : 1.75;
renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_MAX));
renderer.setClearColor(new THREE.Color(PALETTE.bg));

const scene = new THREE.Scene();
const FOV = 30;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 60);
camera.up.set(0, 0, -1); // dall'alto: il "su" dello schermo è il fondo del vassoio (-z)
const TILT = THREE.MathUtils.degToRad(24); // la camera guarda giù, appena inclinata
const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------- il vassoio: quanti mirtilli, quanto grandi ----------
// Lo schermo mostra sempre lo stesso numero di mirtilli in larghezza (9 sul telefono, fino a
// ~20 sugli schermi larghi); il mucchio è largo abbastanza da uscire dai lati e profondo
// abbastanza da riempire l'alto dello schermo in ogni pagina.
const R = 0.1;
const acrossFor = (aspect) => (aspect < 0.85 ? 8.6 : Math.min(21, 8.6 + (aspect - 0.85) * 12));
const aspect0 = innerWidth / innerHeight;
const visW0 = acrossFor(aspect0) * 2 * R;
const visH0 = visW0 / aspect0;
const TRAY_W = visW0 * 1.45;
const PILE_D = visH0 * 0.92 + 0.5;
// un po' più di uno strato: il mucchio è fitto, qualche bacca sta sopra le altre
const COUNT = Math.round(((TRAY_W * PILE_D) / (Math.PI * R * R * 0.98)) * 1.2);
const berries = new Berries({ count: COUNT, radius: R, width: TRAY_W, depth: PILE_D, quality });
scene.add(berries.group);
berries.settle(7);

// ---------- inquadratura ----------
// La camera tiene il bordo del mucchio a una quota fissa dello schermo (66% sotto il nome nella
// prima pagina, ~31% nel menu): il bordo si misura sulle bacche, quindi segue il mucchio vero.
const frame = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const cam = { x: 0, z: 0, H: 6 };
let hold = false;
const page = { p: 0, shown: 0 };
const viewSize = () => {
  const aspect = innerWidth / innerHeight;
  // la larghezza visibile: mai più larga del vassoio (le sponde non si vedono)
  const visW = Math.min(acrossFor(aspect) * 2 * R, TRAY_W / 1.3);
  const visH = visW / aspect;
  return { visW, visH, portrait: aspect < 0.85 };
};
const hemTarget = () => {
  const { portrait } = viewSize();
  return portrait ? 0.62 - 0.33 * page.shown : 0.56 - 0.3 * page.shown;
};
const meas = { edge: null };
const _v = new THREE.Vector3();
const edgeBins = new Float32Array(16);
// il bordo del mucchio: per ogni striscia verticale dello schermo la bacca più avanti (a terra),
// poi la mediana delle strisce
const measureEdge = (src = berries.pos) => {
  const { visW } = viewSize();
  const nb = edgeBins.length;
  edgeBins.fill(-1e9);
  for (let i = 0; i < berries.n; i++) {
    const k = i * 3;
    if (src[k + 1] > R * 2.6) continue;
    const b = Math.floor(((src[k] - (cam.x - visW / 2)) / visW) * nb);
    if (b < 0 || b >= nb) continue;
    if (src[k + 2] > edgeBins[b]) edgeBins[b] = src[k + 2];
  }
  const vals = [...edgeBins].filter((v) => v > -1e8).sort((a, b) => a - b);
  if (vals.length < nb * 0.5) return null;
  return vals[Math.floor(vals.length * 0.5)];
};
const computeFrame = () => {
  const { visH } = viewSize();
  // distanza dal piano per vedere visH di altezza
  const D = visH / (2 * tanHalf);
  cam.H = D;
  frame.target.set(cam.x, 0, cam.z);
  frame.pos.set(cam.x, D * Math.cos(TILT), cam.z + D * Math.sin(TILT));
};
const screenFrame = (dt, src) => {
  if (hold || !(dt > 0)) return;
  const e = measureEdge(src);
  if (e === null) return;
  if (meas.edge === null) meas.edge = e;
  else meas.edge += (e - meas.edge) * (1 - Math.exp(-dt / 0.9));
  const { visH } = viewSize();
  _v.set(cam.x, R, meas.edge).project(camera);
  const yT = 1 - 2 * hemTarget();
  // il bordo troppo in basso → la camera avanza (+z), il mucchio sale sullo schermo
  cam.z += (yT - _v.y) * (visH / 2) * Math.min(1, dt * 2.2);
};

let lastW = 0, lastH = 0;
const resize = () => {
  const w = innerWidth, h = innerHeight;
  // su iPhone la barra di Safari cambia l'altezza di poco: si ignora
  if (w === lastW && Math.abs(h - lastH) < 120 && lastH) return;
  lastW = w;
  lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = FOV;
  camera.updateProjectionMatrix();
  computeFrame();
};
addEventListener('resize', resize);
resize();
const camPos = frame.pos.clone();
const camTarget = frame.target.clone();
const placeCamera = () => {
  camera.position.copy(frame.pos);
  camera.lookAt(frame.target);
  camera.updateMatrixWorld();
};
// l'inquadratura si calcola sul mucchio a riposo, prima del primo fotogramma
placeCamera();
for (let i = 0; i < 160; i++) {
  screenFrame(1 / 20, berries.rest);
  computeFrame();
  placeCamera();
}
camPos.copy(frame.pos);
camTarget.copy(frame.target);
// davanti al mucchio una sponda morbida: spinti oltre, i mirtilli tornano (niente bacche sul nome)
berries.frontLimit = (measureEdge(berries.rest) ?? PILE_D) + R * 2.2;
berries.sync();

// l'apertura: piovono e si posano (la camera resta ferma finché non si sono posati)
if (!reduceMotion && !params.has('still')) {
  // dall'alto, ma sempre sotto la camera
  berries.rain(Math.min(1.6, cam.H * Math.cos(TILT) * 0.45));
  hold = true;
  setTimeout(() => (hold = false), 3200);
}

// ---------- luce: segue il dito / il mouse (±25°), sempre smorzata ----------
const baseLight = new THREE.Vector3(-0.55, 0.78, -0.3).normalize();
const MAX = THREE.MathUtils.degToRad(25);
const light = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
const lightDrift = { on: coarse && !reduceMotion, lastAim: -1e9 };
const aimLight = (x, y) => {
  lightDrift.lastAim = performance.now();
  const amp = MAX * (1 - 0.5 * berries.calm);
  light.tYaw = (x / innerWidth - 0.5) * 2 * amp;
  light.tPitch = (y / innerHeight - 0.5) * 2 * amp;
};

// ---------- il mouse e il dito sui mirtilli ----------
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
const _hit = new THREE.Vector3();
const toPlane = (x, y) => {
  ray.setFromCamera({ x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera);
  return ray.ray.intersectPlane(plane, _hit);
};
const pusher = { last: -1e9, hold: false };
// il dito è più grande del puntatore del mouse
berries.push.R = R * (coarse ? 3.4 : 2.8);
const interactive = () => !current && !reduceMotion;
// mouse: passandoci sopra si apre un varco tra le bacche (solo mentre si muove)
addEventListener(
  'pointermove',
  (e) => {
    aimLight(e.clientX, e.clientY);
    if (e.pointerType !== 'mouse' || !interactive()) return;
    if (!toPlane(e.clientX, e.clientY)) return;
    berries.push.x = _hit.x;
    berries.push.z = _hit.z;
    pusher.last = performance.now();
  },
  { passive: true },
);
// mouse: un clic fa saltare le bacche
canvas.addEventListener('pointerdown', (e) => {
  aimLight(e.clientX, e.clientY);
  if (e.pointerType !== 'mouse' || !interactive()) return;
  if (toPlane(e.clientX, e.clientY)) berries.pop(_hit.x, _hit.z, 1);
});
// dito: le bacche si spostano sotto il dito, sempre (anche mentre la pagina scorre: gli eventi
// touch passivi arrivano anche durante lo scroll); un tocco breve le fa saltare
let touch = null;
const fingerAt = (x, y) => {
  if (!toPlane(x, y)) return;
  berries.push.x = _hit.x;
  berries.push.z = _hit.z;
  pusher.last = performance.now();
};
const onPage = (e) => e.target instanceof Element && e.target.closest('.page, .menu a, .site-head');
addEventListener(
  'touchstart',
  (e) => {
    const t = e.touches[0];
    aimLight(t.clientX, t.clientY);
    if (!interactive() || e.touches.length > 1 || onPage(e)) return;
    touch = { x: t.clientX, y: t.clientY, t: performance.now(), moved: false };
    fingerAt(t.clientX, t.clientY);
    pusher.hold = true;
  },
  { passive: true },
);
addEventListener(
  'touchmove',
  (e) => {
    if (!touch) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 10) touch.moved = true;
    aimLight(t.clientX, t.clientY);
    fingerAt(t.clientX, t.clientY);
  },
  { passive: true },
);
const endTouch = () => {
  if (touch && !touch.moved && performance.now() - touch.t < 400 && toPlane(touch.x, touch.y)) berries.pop(_hit.x, _hit.z, 1.1);
  pusher.hold = false;
  touch = null;
};
addEventListener('touchend', endTouch, { passive: true });
addEventListener('touchcancel', endTouch, { passive: true });

// ---------- scroll come cambio pagina: il nome sale nella barra, compare il menu ----------
const nameEl = document.querySelector('.hero-name');
const menu = document.querySelector('.menu');
const menuItems = menu.querySelectorAll('li');
const menuCta = menu.querySelectorAll('.demo-note');
const hint = document.querySelector('.scroll-hint');
const manifesto = document.querySelector('.manifesto');
const mWords = [];
if (!reduceMotion) {
  for (const p of manifesto.querySelectorAll('p')) {
    const text = p.textContent.replace(/\s+/g, ' ').trim().split(' ');
    p.textContent = '';
    text.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      span.style.opacity = '0.16';
      p.appendChild(span);
      if (i < text.length - 1) p.appendChild(document.createTextNode(' '));
      mWords.push(span);
    });
  }
}
const mReveal = { k: 0 };
const paintWords = () => {
  const n = mWords.length;
  mWords.forEach((w, i) => {
    const a = Math.min(1, Math.max(0, mReveal.k * (n + 6) - i) / 6);
    w.style.opacity = (0.16 + 0.84 * a).toFixed(2);
  });
};
const mono = document.querySelector('.mono');
const social = document.querySelector('.social');
const keeps = [...nameEl.querySelectorAll('.keep')];
const targets = [...mono.querySelectorAll('.m-l')];
const nameSub = nameEl.querySelector('.nl-sub');

// Il nome diventa il marchio piccolo della barra: le lettere volano in alto e si stringono.
const geo = {};
const centerOf = (el) => {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, fs: parseFloat(getComputedStyle(el).fontSize) };
};
const measureName = () => {
  const p = intro ? intro.progress() : 0;
  if (intro) intro.progress(0);
  keeps.forEach((el, i) => (geo['k' + i] = centerOf(el)));
  targets.forEach((el, i) => (geo['m' + i] = centerOf(el)));
  if (intro) {
    intro.invalidate();
    intro.progress(p);
  }
};
let intro = null;
measureName();
const fly = (from, to) => ({
  x: () => geo[to].x - geo[from].x,
  y: () => geo[to].y - geo[from].y,
  scale: () => geo[to].fs / geo[from].fs,
});

gsap.set(menuItems, { opacity: 0, y: 22 });
gsap.set(menuCta, { opacity: 0, y: 16 });
gsap.set(social.children, { opacity: 0, y: -6 });
gsap.set(targets, { opacity: 0 });
intro = gsap.timeline({
  defaults: { ease: 'sine.inOut' },
  scrollTrigger: {
    start: 0,
    end: () => innerHeight * 2.2,
    scrub: reduceMotion ? true : 0.6,
    invalidateOnRefresh: true,
    onRefresh: () => measureName(),
    onUpdate: (st) => {
      // al primo scroll i mirtilli sussultano, poi rotolano verso l'alto
      if (st.progress > 0.03 && !intro._flicked) {
        intro._flicked = true;
        if (!reduceMotion) berries.jiggle(1.2, 0.5);
      }
      if (st.progress < 0.02) intro._flicked = false;
    },
  },
});
intro
  .to(hint, { opacity: 0, duration: 0.12, ease: 'none' }, 0)
  .to(nameSub, { opacity: 0, y: 10, duration: 0.25, ease: 'sine.in' }, 0);
keeps.forEach((el, i) => intro.to(el, { ...fly('k' + i, 'm' + i), duration: 0.8 }, 0.08 + i * 0.05));
// all'arrivo: le lettere piccole (vere, nitide) prendono il posto di quelle grandi rimpicciolite
intro.to(keeps, { opacity: 0, duration: 0.1, ease: 'none' }, 0.92).to(targets, { opacity: 1, duration: 0.1, ease: 'none' }, 0.92);
intro
  .to(social.children, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'sine.out' }, 0.62)
  .fromTo(manifesto, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.3, ease: 'sine.out' }, 1.0)
  .to(mReveal, { k: 1, duration: 0.75, ease: 'none', onUpdate: paintWords }, 1.1)
  .to(manifesto, { opacity: 0, y: -26, duration: 0.25, ease: 'sine.in' }, 2.0)
  .to(menuItems, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'sine.out' }, 2.2)
  .to(menuCta, { opacity: 1, y: 0, duration: 0.4, ease: 'sine.out' }, 2.45);

// il nome compare quando il suo carattere è pronto (al massimo dopo 2,5 s)
Promise.race([
  Promise.all(['500 1em "Bodoni Moda"', 'italic 400 1em "Bodoni Moda"', '500 1em "Cormorant Garamond"', '600 1em "Archivo"'].map((f) => document.fonts?.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
])
  .catch(() => {})
  .finally(() => {
    document.documentElement.classList.remove('fonts-wait');
    ScrollTrigger.refresh();
  });
document.fonts?.ready.then(() => ScrollTrigger.refresh());

// ---------- sezioni: ogni voce è un luogo sul mucchio ----------
const html = document.documentElement;
const backBtn = document.querySelector('.back-btn');
const pages = new Map([...document.querySelectorAll('.page')].map((el) => [el.id, el]));
let current = null;

// luoghi: punto sul mucchio (u: da sinistra a destra dello schermo, -0.5..0.5; v: dal bordo
// verso il fondo, 0..1), direzione della camera (y = dall'alto) e quanti mirtilli in larghezza
const STATIONS = {
  servicios: { u: 0.0, v: 0.35, dir: [0.05, 1, 0.45], across: 5.2 },
  cejas: { u: -0.18, v: 0.45, dir: [-0.2, 1, 0.3], across: 4.6 },
  pestanas: { u: 0.22, v: 0.4, dir: [0.35, 1, 0.25], across: 4.6 },
  micro: { u: -0.25, v: 0.6, dir: [-0.3, 1, 0.5], across: 4.6 },
  unas: { u: 0.1, v: 0.7, dir: [0.15, 1, 0.2], across: 4.6 },
  piel: { u: 0.28, v: 0.55, dir: [0.4, 1, 0.45], across: 4.6 },
  reservar: { u: 0.12, v: 0.3, dir: [0.2, 1, 0.55], across: 5.2 },
  estudio: { u: -0.1, v: 0.5, dir: [-0.15, 1, 0.6], across: 5.4 },
};
for (const st of Object.values(STATIONS)) st.d = new THREE.Vector3(...st.dir).normalize();
const trip = { mode: 'menu', to: null, k: 1, A: { pos: new THREE.Vector3(), target: new THREE.Vector3() } };
const B = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
// da "quanti mirtilli in larghezza" alla distanza della camera
const distFor = (across) => {
  const aspect = innerWidth / innerHeight;
  const k = aspect < 0.85 ? 1 : Math.min(2.1, 0.75 + aspect * 0.7);
  return (across * k * 2 * R) / (2 * tanHalf * aspect);
};
const _want = new THREE.Vector3();
const zs = [];
const stationPose = (st, dt, out) => {
  if (!st.p) {
    // il punto si fissa all'arrivo (il mucchio è fermo): al centro del mucchio, spostato appena;
    // la camera non si allontana mai tanto da vedere oltre il bordo (sopra e sotto solo mirtilli)
    const { visW } = viewSize();
    zs.length = 0;
    for (let i = 0; i < berries.n; i++) if (berries.pos[i * 3 + 1] < R * 2.6) zs.push(berries.pos[i * 3 + 2]);
    zs.sort((a, b) => a - b);
    const z0 = zs[Math.floor(zs.length * 0.04)] ?? 0, z1 = zs[Math.floor(zs.length * 0.9)] ?? PILE_D;
    const mid = (z0 + z1) / 2;
    st.p = new THREE.Vector3(cam.x + st.u * visW * 0.45, R, mid + (0.5 - st.v) * 0.2 * (z1 - z0));
    st.room = (z1 - z0) * 0.78; // altezza di mucchio che la vista può occupare
    st.dCur = st.d.clone();
    st.distCur = Math.min(distFor(st.across), distMax(st, st.d));
  }
  const c = trip.mode === 'station' ? storyState(trip.to)?.cam : null;
  const kc = 1 - Math.exp(-dt * 2.2);
  _want.copy(c ? _want.set(c[0], c[1], c[2]).normalize() : st.d);
  st.dCur.lerp(_want, kc).normalize();
  const want = Math.min(distFor(c ? c[3] : st.across), distMax(st, st.dCur));
  st.distCur += (want - st.distCur) * kc;
  out.target.copy(st.p);
  out.pos.copy(st.p).addScaledVector(st.dCur, st.distCur);
};
// la distanza più grande per cui la vista (di sbieco) resta dentro il mucchio
const distMax = (st, d) => {
  const cos = Math.max(0.5, d.y);
  return (st.room * cos) / (2 * tanHalf * (1 + 0.6 * Math.sqrt(1 - cos * cos)));
};
const storyState = (id) => stories.get(id)?.state;
const flyTo = (dest) => {
  trip.A.pos.copy(camPos);
  trip.A.target.copy(camTarget);
  trip.to = dest;
  trip.mode = 'flying';
  hold = true;
  if (dest && STATIONS[dest]) STATIONS[dest].p = null;
  trip.k = 0;
  gsap.to(trip, {
    k: 1,
    duration: reduceMotion ? 0.01 : 2.3,
    ease: 'sine.inOut',
    overwrite: true,
    onComplete: () => {
      if (dest === null) {
        trip.mode = 'menu';
        hold = false;
      } else trip.mode = 'station';
    },
  });
};
const flyPose = (dt) => {
  if (trip.mode === 'menu') return false;
  if (trip.to) stationPose(STATIONS[trip.to], dt, B);
  else {
    B.pos.copy(frame.pos);
    B.target.copy(frame.target);
  }
  const e = trip.k;
  const arc = Math.sin(Math.PI * e);
  camPos.lerpVectors(trip.A.pos, B.pos, e);
  camPos.y += 0.9 * arc; // sale, plana, scende
  camTarget.lerpVectors(trip.A.target, B.target, e);
  return true;
};

const openSection = (id, { push = true } = {}) => {
  const el = pages.get(id);
  if (!el || current === id) return;
  const prevId = current;
  const prev = current ? pages.get(current) : null;
  current = id;
  if (push) history.pushState({ s: id, from: prevId, d: (history.state?.d || 0) + 1 }, '', '#' + id);
  html.classList.add('in-section');
  menu.inert = true;
  backBtn.hidden = false;
  el.hidden = false;
  el.scrollTop = 0;
  const sc = el.querySelector('.story-scroll');
  if (sc) sc.scrollTop = 0;
  requestAnimationFrame(() => stories.get(id)?.measure());
  const letters = titleLetters.get(id);
  if (letters && !reduceMotion) {
    gsap.fromTo(letters, { yPercent: 118 }, { yPercent: 0, duration: 1.3, stagger: 0.055, delay: 1.5, ease: 'power4.out', overwrite: true });
    const sub = el.querySelector('.fac-sub');
    if (sub) gsap.fromTo(sub, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, delay: 2.3, ease: 'power3.out', overwrite: true });
  }
  if (id === 'estudio') loadMap();
  // i mirtilli indicano la via: un sussulto, poi si fermano; la camera vola
  if (!reduceMotion) berries.jiggle(0.8, 0.4);
  flyTo(id);
  gsap.to(berries, { calm: 1, duration: 2.2, delay: 0.9, ease: 'sine.inOut', overwrite: 'auto' });
  gsap.to(menu, { opacity: 0, y: -16, duration: 0.6, ease: 'sine.in', overwrite: true });
  if (prev) gsap.to(prev, { opacity: 0, y: -20, duration: 0.6, ease: 'sine.in', overwrite: true, onComplete: () => (prev.hidden = true) });
  gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.0, delay: reduceMotion ? 0 : 1.5, ease: 'power3.out', overwrite: true });
};

const closeSection = () => {
  if (!current) return;
  const el = pages.get(current);
  current = null;
  html.classList.remove('in-section');
  menu.inert = false;
  backBtn.hidden = true;
  gsap.to(berries, { calm: 0, duration: 1.6, ease: 'sine.inOut', overwrite: 'auto' });
  if (!reduceMotion) setTimeout(() => berries.jiggle(0.7, 0.35), 900);
  flyTo(null);
  gsap.to(el, { opacity: 0, y: 20, duration: 0.6, ease: 'sine.in', overwrite: true, onComplete: () => (el.hidden = true) });
  gsap.fromTo(menu, { y: 16 }, { y: 0, opacity: 1, duration: 1.0, delay: reduceMotion ? 0 : 1.6, ease: 'power3.out', overwrite: true });
};

const booking = createBooking(pages.get('reservar'));
document.querySelectorAll('[data-section]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    // "Reserva tu laminado": si arriva a Reservar con il servizio già scelto
    if (a.dataset.section === 'reservar') booking.preselect(a.dataset.servicio);
    openSection(a.dataset.section);
  }),
);
const toMenu = () => {
  const d = history.state?.d || 0;
  if (d > 0) history.go(-d);
  else closeSection();
};
backBtn.addEventListener('click', toMenu);
document.querySelectorAll('[data-up]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (history.state?.from === a.dataset.up) history.back();
    else openSection(a.dataset.up);
  }),
);
addEventListener('popstate', (e) => (e.state?.s ? openSection(e.state.s, { push: false }) : closeSection()));

mono.addEventListener('click', (e) => {
  e.preventDefault();
  if (current) toMenu();
  else scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

// ---------- nelle sezioni: gli stessi mirtilli, calmi, sotto un velo azzurro ----------
const look = { veil: 0 };
let lookName = 'abierto';
const setLook = (name) => {
  if (lookName === name) return;
  lookName = name;
  gsap.to(look, { veil: name === 'velo' ? 0.5 : 0, duration: reduceMotion ? 0.01 : 1.6, ease: 'sine.inOut', overwrite: true });
};

// ---------- Estudio: indirizzo, orari, mappa (si carica solo quando serve) ----------
const estPage = document.getElementById('estudio');
const estMap = estPage.querySelector('iframe');
const loadMap = () => {
  if (!estMap.getAttribute('src')) estMap.src = mapEmbed(ESTUDIO.mapa);
};
estPage.querySelector('.suc-go').href = mapLink(ESTUDIO.mapa);
renderHorario(estPage.querySelector('.horario-est'));
const paintEstado = () => {
  const e = estadoAhora();
  const el = estPage.querySelector('.estado-est');
  el.textContent = e.texto;
  el.classList.toggle('is-open', e.abierto);
};
paintEstado();
setInterval(paintEstado, 60000);

// ---------- le sezioni come storie a capitoli ----------
const stories = new Map();
for (const [id, el] of pages) {
  const sc = el.querySelector('.story-scroll');
  if (!sc || !sc.querySelector('.ch')) continue;
  const st = STATIONS[id];
  const story = createStory(sc, reduceMotion, { home: st ? [...st.dir, st.across] : null });
  stories.set(id, story);
  sc.addEventListener('scroll', () => story.update(), { passive: true });
}
const remeasure = () => current && stories.get(current)?.measure();
addEventListener('resize', remeasure);
document.fonts?.ready.then(remeasure);

const titleLetters = new Map();
for (const t of document.querySelectorAll('.reveal-title')) {
  const text = t.textContent.trim();
  t.textContent = '';
  t.setAttribute('aria-label', text);
  const letters = [...text].map((ch) => {
    const mask = document.createElement('span');
    mask.className = 'rt-mask';
    mask.setAttribute('aria-hidden', 'true');
    const l = document.createElement('span');
    l.className = 'rt-l';
    l.textContent = ch;
    mask.appendChild(l);
    t.appendChild(mask);
    return l;
  });
  titleLetters.set(t.closest('.page').id, letters);
}

// Instagram e Booksy (in config.js)
document.querySelectorAll('[data-ig]').forEach((a) => (a.href = CONTACT.instagram));
document.querySelectorAll('[data-booksy]').forEach((a) => (a.href = CONTACT.booksy));

// link diretto a una sezione (#cejas…): si parte dal menu e si entra
const startHash = location.hash.slice(1);
if (pages.has(startHash)) {
  history.replaceState({}, '', location.pathname + location.search);
  scrollTo(0, innerHeight * 2.3);
  setTimeout(() => openSection(startHash), 400);
}

// ---------- misura (solo con ?debug) ----------
const fpsEl = document.getElementById('fps');
const debug = params.has('debug');
fpsEl.hidden = !debug;
let frames = 0, acc = 0, simAcc = 0;
const perf = { t: 0, n: 0, step: 0 };

// ---------- ciclo ----------
const clock = new THREE.Clock();
const L = new THREE.Vector3();
const AX_Y = new THREE.Vector3(0, 1, 0), AX_X = new THREE.Vector3(1, 0, 0);
const studioM = new THREE.Matrix4(), studioRY = new THREE.Matrix4();
const U = berries.uniforms;
const loop = () => {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const time = clock.elapsedTime;

  // il vassoio s'inclina con lo scroll: i mirtilli rotolano verso l'alto
  berries.tilt = 0.12 + 0.3 * page.shown;
  // il varco del mouse: solo mentre si muove; quello del dito finché si trascina
  const pushOn = interactive() && (pusher.hold || performance.now() - pusher.last < 280);
  berries.push.a += ((pushOn ? 1 : 0) - berries.push.a) * (1 - Math.exp(-dt * (pushOn ? 10 : 3)));
  berries.update((reduceMotion ? dt * 0.4 : dt) * SPEED);

  page.p = Math.min(1, intro.time() / 1.0);
  {
    const t = intro.time();
    const vis = (el, on) => {
      const v = on ? 'visible' : 'hidden';
      if (el.style.visibility !== v) el.style.visibility = v;
    };
    vis(menu, t > 2.12);
    vis(manifesto, t > 0.95 && t < 2.35);
    vis(mono, t > 0.9);
    vis(social, t > 0.55);
  }
  page.shown += (page.p - page.shown) * (1 - Math.exp(-dt * 6));
  screenFrame(dt);
  computeFrame();

  // nelle sezioni il velo azzurro (le scritte si leggono), nel menu i mirtilli pieni
  setLook(current ? 'velo' : 'abierto');
  U.uVeil.value = look.veil;

  // Cejas, capitolo "El acabado": il lucido si spegne e torna mentre la luce passa
  const sst = current ? storyState(current) : null;
  U.uGloss.value += ((sst ? sst.gloss : 1) - U.uGloss.value) * (1 - Math.exp(-dt * 4));
  if (sst && sst.light !== null && !reduceMotion) {
    light.tYaw = MAX * 1.4 * sst.light;
    light.tPitch = -MAX * 0.2;
    lightDrift.lastAim = performance.now();
  }
  if (lightDrift.on && performance.now() - lightDrift.lastAim > 3000) {
    const amp = MAX * (0.55 - 0.25 * berries.calm);
    light.tYaw = amp * Math.sin(time * 0.21);
    light.tPitch = amp * 0.6 * Math.sin(time * 0.16 + 1.1);
  }
  const kL = 1 - Math.exp(-dt * 2.5);
  light.yaw += (light.tYaw - light.yaw) * kL;
  light.pitch += (light.tPitch - light.pitch) * kL;
  L.copy(baseLight).applyAxisAngle(AX_Y, -light.yaw).applyAxisAngle(AX_X, -light.pitch);
  U.uLightDir.value.copy(L);
  studioM.makeRotationX(light.pitch).multiply(studioRY.makeRotationY(light.yaw));
  U.uStudio.value.setFromMatrix4(studioM);

  const drift = reduceMotion ? 0 : 1;
  if (!flyPose(dt)) {
    camPos.copy(frame.pos);
    camTarget.copy(frame.target);
  }
  camera.position.set(camPos.x + Math.sin(time * 0.21) * 0.01 * drift, camPos.y, camPos.z + Math.sin(time * 0.17 + 1.3) * 0.008 * drift);
  camera.lookAt(camTarget);

  renderer.render(scene, camera);

  // qualità automatica: sotto i 48 fps per 2 secondi, la risoluzione scende
  if (perf.step < 2 && dt > 0 && !document.hidden) {
    perf.t += dt;
    perf.n++;
    if (perf.t >= 2) {
      if (perf.n / perf.t < 48 && clock.elapsedTime > 3.5 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
        lastW = 0;
        resize();
        perf.step++;
      }
      perf.t = perf.n = 0;
    }
  }

  if (debug) {
    frames++;
    acc += rawDt;
    simAcc += berries.simMs;
    if (acc > 0.5) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps · sim ${(simAcc / frames).toFixed(1)} ms · ${berries.n} bacche · dpr ${renderer.getPixelRatio()}`;
      frames = acc = simAcc = 0;
    }
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

window.__eia = { berries, camera, renderer, cam, page, gsap, trip, light, intro, meas };
