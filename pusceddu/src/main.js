import * as THREE from 'three';
import gsap from 'gsap';

import { QUALITY, REDUCED_MOTION } from './config.js';
import { createEnvironment } from './scene/environment.js';
import { buildWorld, keyframes, introPath } from './scene/world.js';
import { Drone } from './scene/drone.js';
import { Loader } from './ui/loader.js';
import { renderContacts } from './ui/contacts.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const isNarrow = () => window.innerWidth < 900 || window.innerWidth / window.innerHeight < 0.9;

// La foschia non colora: dissolve verso la trasparenza, così ciò che è lontano sfuma
// nel gradiente rosso della pagina (che sta dietro al canvas) senza sagome scure.
// Distanza reale dalla camera (non la profondità): anche ciò che sta ai lati sfuma.
THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = length( mvPosition.xyz );
#endif
`;
THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  gl_FragColor *= 1.0 - fogFactor;
#endif
`;

document.documentElement.classList.add('js');
// Si riparte sempre dall'inizio del percorso (niente scroll ripristinato dal browser).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const body = document.body;
const loader = new Loader();
renderContacts();
paintGrain();

// ---------------------------------------------------------------- Renderer
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('WebGL non disponibile: il sito resta navigabile senza 3D.', err);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 120);
const drone = new Drone(camera);
drone.motion = REDUCED_MOTION ? 0 : 1;
let world = null;
let narrow = isNarrow();

// Luci: chiave calda con ombre, controluce per staccare il marmo dal rosso,
// emisfero crema/rosso (il pavimento rosso "rimbalza" sul marmo).
// Le luci sono orientate rispetto al drone (come un set fotografico che lo segue):
// chiave in alto a sinistra davanti all'opera, controluce dietro a destra.
const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const key = new THREE.DirectionalLight(0xfff6ec, 2.6);
const rim = new THREE.DirectionalLight(0xffe4d8, 1.5);
scene.add(new THREE.HemisphereLight(0xfffaf2, 0x7a2a2c, 0.45), key, key.target, rim, rim.target);
scene.fog = new THREE.Fog(0x9e1b22, 18, 46); // distanze aggiornate dal drone; il colore non conta

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = QUALITY.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  key.castShadow = true;
  key.shadow.mapSize.setScalar(QUALITY.shadowMap);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
}

// ---------------------------------------------------------------- Costruzione
async function build() {
  loader.set(0.04);
  await Promise.race([
    Promise.all([
      document.fonts.load('600 100px "Cormorant Garamond"'),
      document.fonts.load('500 100px "Cormorant Garamond"'),
      document.fonts.load('400 16px "Manrope"'),
    ]),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  loader.set(0.14);
  // Solo le immagini non "lazy" (quelle lazy non si caricano finché non sono visibili).
  const eager = [...document.images].filter((img) => img.loading !== 'lazy');
  await Promise.race([
    Promise.all(eager.map((img) => img.decode?.().catch(() => {}))),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  loader.set(0.22);
  if (!renderer) return;

  await nextFrame();
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = 0.95;
  loader.set(0.3);

  const steps = 6;
  let done = 0;
  world = await buildWorld(scene, async () => {
    done++;
    loader.set(0.3 + (done / steps) * 0.45);
    await nextFrame();
  });

  // Il pavimento taglia la colonna mentre sale nell'intro.
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  for (const m of world.clipMaterials) {
    m.clippingPlanes = [floorPlane];
    m.clipShadows = true;
  }

  drone.setKeyframes(keyframes(narrow));
  drone.update(0, 0);
  updateLights();
  // Compila tutti gli shader ora, per non avere scatti durante il volo.
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  loader.set(0.95);
  renderer.render(scene, camera);
  await nextFrame();
  loader.set(1);
}

// ---------------------------------------------------------------- Scroll → percorso
// Ogni capitolo ha un "punto d'arrivo": il drone raggiunge l'opera quando la scheda
// è al centro dello schermo (su mobile quando entra dal basso). Le tappe `via` stanno
// tra due punti d'arrivo.
let anchors = [0]; // punti d'arrivo dei capitoli (px di scroll)
let kfAnchors = [0]; // punti d'arrivo di tutti i fotogrammi del drone, tappe comprese
const chapters = [...document.querySelectorAll('[data-station]')];

function computeAnchors() {
  const vh = window.innerHeight;
  const maxScroll = document.documentElement.scrollHeight - vh;
  anchors = chapters.map((el, i) => {
    if (i === 0) return 0;
    const panel = el.querySelector('.panel');
    const r = panel.getBoundingClientRect();
    const top = r.top + window.scrollY;
    let a;
    if (narrow) a = top - vh * 0.6;
    else if (r.height < vh * 0.84) a = top + r.height / 2 - vh / 2;
    else a = top - vh * 0.1;
    return Math.min(a, maxScroll);
  });
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);

  if (!drone.kfs) return;
  let si = 0;
  kfAnchors = drone.kfs.map((k) => (k.via ? null : anchors[si++]));
  drone.kfs.forEach((k, i) => {
    if (!k.via) return;
    const prev = kfAnchors[i - 1];
    const next = kfAnchors.slice(i + 1).find((a) => a !== null);
    kfAnchors[i] = prev + (next - prev) * k.at;
  });
}

const easeIn = (f) => f * f;
const easeOut = (f) => 1 - (1 - f) * (1 - f);
const easeInOut = (f) => f * f * (3 - 2 * f);

// Posizione del drone lungo i fotogrammi: rallenta vicino a ogni opera (sosta di
// lettura) e attraversa le tappe senza fermarsi.
function scrollToU(y) {
  const a = kfAnchors;
  if (y <= 0 || a.length < 2) return 0;
  for (let i = 0; i < a.length - 1; i++) {
    if (y < a[i + 1]) {
      const f = (y - a[i]) / (a[i + 1] - a[i]);
      const s0 = !drone.kfs[i].via;
      const s1 = !drone.kfs[i + 1].via;
      const e = s0 && s1 ? easeInOut(f) : s0 ? easeIn(f) : s1 ? easeOut(f) : f;
      return i + 0.2 * f + 0.8 * e;
    }
  }
  return a.length - 1;
}

// Capitolo corrente come numero continuo (0 = apertura … 6 = contatti).
function scrollToStation(y) {
  if (y <= 0) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  }
  return anchors.length - 1;
}

function goTo(index) {
  body.classList.remove('nav-open');
  $('nav-toggle').setAttribute('aria-expanded', 'false');
  const y = index <= 0 ? 0 : anchors[index];
  window.scrollTo({ top: y, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
}

for (const a of document.querySelectorAll('[data-go]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(Number(a.dataset.go));
  });
}
$('nav-toggle').addEventListener('click', () => {
  const open = body.classList.toggle('nav-open');
  $('nav-toggle').setAttribute('aria-expanded', String(open));
});

// Sezione attiva (menu e indice romano a destra)
const navLinks = [...document.querySelectorAll('#nav a')];
const railItems = [...document.querySelectorAll('#rail span')];
let activeSec = -1;
function updateActive(st) {
  const sec = st < 0.5 ? 0 : st < 2.5 ? 1 : st < 4.5 ? 3 : st < 5.5 ? 5 : 6;
  if (sec === activeSec) return;
  activeSec = sec;
  for (const el of [...navLinks, ...railItems]) {
    const n = Number(el.dataset.go ?? el.dataset.sec);
    el.classList.toggle('is-active', n === sec);
  }
}

// Le schede salgono quando entrano nello schermo.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-in');
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.panel').forEach((p) => io.observe(p));

// Puntatore → leggera parallasse del drone
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  drone.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
});

let resizeTimer;
window.addEventListener('resize', () => {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
  }
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const n = isNarrow();
    if (n !== narrow && world) {
      narrow = n;
      drone.setKeyframes(keyframes(narrow));
    }
    computeAnchors();
  }, 120);
});

// ---------------------------------------------------------------- Luci che seguono il drone
let shadowSize = 0;
function updateLights() {
  const t = drone.current.target;
  _fwd.subVectors(t, camera.position).setY(0);
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.crossVectors(_fwd, UP);
  key.target.position.copy(t);
  key.position.copy(t).addScaledVector(_right, -3.4).addScaledVector(_fwd, -4.4).addScaledVector(UP, 7.5);
  rim.target.position.copy(t);
  rim.position.copy(t).addScaledVector(_right, 3).addScaledVector(_fwd, 6).addScaledVector(UP, 3.2);
  const d = camera.position.distanceTo(t);
  scene.fog.near = drone.current.fog[0];
  scene.fog.far = drone.current.fog[1];
  const size = THREE.MathUtils.clamp(d * 0.62, 2.4, 17);
  if (Math.abs(size - shadowSize) > 0.02) {
    shadowSize = size;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -size;
    sc.right = sc.top = size;
    sc.far = 12 + size * 1.5;
    sc.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- Intro
let introRunning = false;

function showUi() {
  body.classList.add('is-ready');
  const items = ['.hero-text > *', '.hero-index', '.scroll-cue'];
  gsap.to(items, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out', stagger: 0.12 });
}

function intro(curtain) {
  body.classList.remove('is-loading');
  body.classList.add('is-intro');
  window.scrollTo(0, 0);

  if (!world) {
    gsap.to(curtain, { opacity: 0, duration: 0.9, onComplete: () => curtain.remove() });
    body.classList.remove('is-intro');
    showUi();
    return;
  }

  const heroKf = drone.kfs[0];
  const path = introPath(world, heroKf);
  const pc = new THREE.CatmullRomCurve3(path.positions, false, 'centripetal');
  const tc = new THREE.CatmullRomCurve3(path.targets, false, 'centripetal');
  const ov = { position: new THREE.Vector3(), target: new THREE.Vector3(), sx: 0, sy: 0, fov: 34, fog: [80, 120] };
  const st = { p: REDUCED_MOTION ? 1 : 0, rise: REDUCED_MOTION ? 1 : 0 };
  const heroRoot = world.hero.root.parent;
  const apply = () => {
    pc.getPoint(st.p, ov.position);
    tc.getPoint(st.p, ov.target);
    const k = smoothstep(0.72, 1, st.p);
    ov.sx = heroKf.sx * k;
    ov.sy = heroKf.sy * k;
    ov.fog = [80 + (heroKf.fog[0] - 80) * k, 120 + (heroKf.fog[1] - 120) * k];
    heroRoot.position.y = -3.6 * (1 - st.rise);
  };
  apply();
  drone.override = ov;
  introRunning = true;
  // Nell'intro si vede solo la colonnina: le altre opere compaiono a volo finito.
  for (const g of world.works) g.visible = false;
  if (!REDUCED_MOTION) world.hero.justice.setAngle(0.2);

  const finish = () => {
    introRunning = false;
    drone.override = null;
    drone.u = 0;
    heroRoot.position.y = 0;
    for (const g of world.works) g.visible = true;
    body.classList.remove('is-intro');
    computeAnchors();
    curtain.remove();
    removeEventListener('wheel', hurry);
    removeEventListener('touchstart', hurry);
    removeEventListener('keydown', hurry);
  };

  if (REDUCED_MOTION) {
    gsap.to(curtain, { opacity: 0, duration: 0.8, onComplete: finish });
    showUi();
    return;
  }

  const tl = gsap.timeline({ onUpdate: apply, onComplete: finish });
  tl.to(curtain, { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0)
    .to(st, { rise: 1, duration: 2.8, ease: 'power3.out' }, 0.2)
    .to(st, { p: 1, duration: 6.4, ease: 'power2.inOut' }, 0.1)
    .add(showUi, 5.0);
  // Chi ha fretta può accelerare l'intro con la rotella, il tocco o la tastiera.
  function hurry() {
    tl.timeScale(4);
  }
  addEventListener('wheel', hurry, { passive: true });
  addEventListener('touchstart', hurry, { passive: true });
  addEventListener('keydown', hurry);
}

// ---------------------------------------------------------------- Ciclo
let last = performance.now();
let lastY = window.scrollY;
let scrollVel = 0;
let knotM = 0;
let knotDir = -1;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const y = window.scrollY;
  const st = introRunning ? 0 : scrollToStation(y);
  const u = introRunning ? 0 : scrollToU(y);
  scrollVel += ((dt > 0 ? (y - lastY) / dt : 0) - scrollVel) * 0.2;
  lastY = y;

  if (world) {
    drone.update(u, dt);
    updateLights();

    // La bilancia "sente" lo scroll e poi ritrova l'equilibrio.
    const nearHero = 1 - smoothstep(0.3, 0.9, st);
    world.hero.justice.update(dt, THREE.MathUtils.clamp(scrollVel * 0.00012, -0.5, 0.5) * nearHero * drone.motion);
    world.dante.update(dt, drone.motion);

    // Il nodo si scioglie appena si arriva al Legal Design (e si riannoda tornando indietro);
    // le pagine del libro si girano scorrendo le Pubblicazioni.
    if (st > 3.7) knotDir = 1;
    else if (st < 3.3) knotDir = -1;
    knotM = clamp01(knotM + (knotDir * dt) / (REDUCED_MOTION ? 0.4 : 2.6));
    world.knot.set(knotM);
    world.knot.mesh.rotation.y = 0.35 * Math.sin(now * 0.00028) * drone.motion;
    world.book.setProgress(clamp01((st - 4.55) / 0.9));
    world.book.update(dt);

    renderer.render(scene, camera);
  }
  updateActive(st);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- Grana
function paintGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---------------------------------------------------------------- Avvio
(async () => {
  try {
    await build();
  } catch (err) {
    console.error(err);
    world = null;
  }
  if (!world) body.classList.add('no-webgl');
  loader.set(1);
  computeAnchors();
  requestAnimationFrame(frame);
  await loader.done;
  const curtain = await loader.cover();
  intro(curtain);
})();

// Solo in sviluppo: accesso alla scena dalla console per i controlli visivi.
if (import.meta.env.DEV) {
  window.__debug = {
    scene,
    camera,
    drone,
    get world() {
      return world;
    },
    get anchors() {
      return anchors;
    },
    get kfAnchors() {
      return kfAnchors;
    },
    // Porta subito il drone (e le pagine del libro) dove lo vuole lo scroll.
    snap() {
      drone.u = scrollToU(window.scrollY);
      knotM = knotDir > 0 ? 1 : 0;
      for (const p of world.book.pages) {
        p.a = p.target;
        p.dirty = true;
      }
    },
  };
}
