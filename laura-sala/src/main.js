// Velata — la seta come accompagnamento: viva nella brezza, la luce segue il dito o il
// mouse; con il dito la si tira (trascinamento orizzontale) o la si sfiora (tocco).
// Allo scroll il nome sale e si posa al centro della barra; compare la frase.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Silk, SILK_COLORS } from './silk/silk.js';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = coarse || Math.min(innerWidth, innerHeight) < 600;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = params.get('q') || (isMobile ? 'mobile' : 'high');

// ---------- renderer e scena ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(new THREE.Color(SILK_COLORS.ivory));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40);
const silk = new Silk({ quality });
scene.add(silk.mesh);

// ---------- inquadratura ----------
// Telefono: in alto il drappeggio (un filo d'avorio sopra), i lati fuori dallo schermo,
// l'orlo che ondeggia sopra il nome. Desktop: la seta attraversa lo schermo come una fascia,
// bordo alto e lati fuori, l'orlo sopra il nome. La camera segue con molta calma.
const frame = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const follow = { rimY: 0.9, hemY: -0.2, hemLow: -0.3, cx: 0, ready: false };
const page = { p: 0, shown: 0 }; // 0 = nome, 1 = menu
const measureSilk = (dt) => {
  const c = silk.cloth;
  let ry = 0, hy = 0, n = 0, sx = 0, sn = 0, low = Infinity;
  for (let i = Math.round(c.nx * 0.3); i < Math.round(c.nx * 0.7); i++) {
    ry += c.pos[i * 3 + 1];
    hy += c.pos[((c.ny - 1) * c.nx + i) * 3 + 1];
    n++;
  }
  // il punto più basso della seta nella parte inquadrata (orlo e angoli che scendono)
  for (let j = Math.round(c.ny * 0.6); j < c.ny; j++)
    for (let i = Math.round(c.nx * 0.25); i < c.nx * 0.75; i += 2) low = Math.min(low, c.pos[(j * c.nx + i) * 3 + 1]);
  for (let j = 0; j < c.ny; j += 2)
    for (let i = Math.round(c.nx * 0.2); i < c.nx * 0.8; i += 2) {
      sx += c.pos[(j * c.nx + i) * 3];
      sn++;
    }
  const k = follow.ready ? 1 - Math.exp(-dt / 2.8) : 1;
  follow.rimY += (ry / n - follow.rimY) * k;
  follow.hemY += (hy / n - follow.hemY) * k;
  const kl = follow.ready ? 1 - Math.exp(-dt / (low < follow.hemLow ? 0.6 : 2.5)) : 1;
  follow.hemLow += (low - follow.hemLow) * kl;
  follow.cx += (sx / sn - follow.cx) * k;
  follow.ready = true;
};

// Limite sullo schermo: il punto più basso della seta (proiettato, quindi anche quando si
// gonfia verso la camera) non scende oltre questa frazione dell'altezza.
const hemLimit = () => {
  const portrait = innerWidth / innerHeight < 0.85;
  const pg = page.shown;
  return portrait ? 0.58 - 0.25 * pg : 0.56 - 0.27 * pg;
};
const guard = { off: 0 };
const _v = new THREE.Vector3();
const screenGuard = (dt) => {
  const c = silk.cloth;
  let lowest = 2;
  for (let j = Math.round(c.ny * 0.45); j < c.ny; j++)
    for (let i = 0; i < c.nx; i += 2) {
      const k = (j * c.nx + i) * 3;
      _v.set(c.pos[k], c.pos[k + 1], c.pos[k + 2]).project(camera);
      if (_v.x > -1.02 && _v.x < 1.02 && _v.y < lowest) lowest = _v.y;
    }
  const yLimit = 1 - 2 * hemLimit();
  const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.distanceTo(camTarget);
  const err = (lowest - yLimit) * (visH / 2); // < 0: la seta scende troppo
  if (err < 0) guard.off += err * Math.min(1, dt * 5.0);
  else guard.off += Math.min(err, -guard.off) * Math.min(1, dt * 0.35); // rilascio lento
};

const computeFrame = () => {
  const aspect = innerWidth / innerHeight;
  const dist = 6.1;
  // telefono: la tenda riempie la larghezza; desktop: una colonna di seta al centro
  const visH = aspect < 0.85 ? 1.45 / aspect : 2.45;
  const visW = visH * aspect;
  // il bordo alto resta fuori quadro; l'orlo sopra il nome (poi interviene il limite sullo schermo)
  const topY = follow.hemLow + visH * (aspect < 0.85 ? 0.6 : 0.56);
  const tanV = visW / aspect / 2 / dist;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV));
  const cy = topY - dist * tanV + guard.off;
  frame.target.set(follow.cx * 0.9, cy, 0.2);
  frame.pos.set(follow.cx * 0.9 + 0.75, cy + 0.15, dist);
  camera.updateProjectionMatrix();
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
  computeFrame();
};
addEventListener('resize', resize);
measureSilk(0);
resize();
const camPos = frame.pos.clone();
const camTarget = frame.target.clone();

// ---------- luce: segue il dito / il mouse (±30°), sempre smorzata ----------
const baseLight = new THREE.Vector3(-0.55, 0.38, 0.75).normalize();
const MAX = THREE.MathUtils.degToRad(30);
const light = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
const aimLight = (x, y) => {
  light.tYaw = (x / innerWidth - 0.5) * 2 * MAX;
  light.tPitch = (y / innerHeight - 0.5) * 2 * MAX;
};
addEventListener('pointermove', (e) => aimLight(e.clientX, e.clientY), { passive: true });

// ---------- il dito sulla seta ----------
const ndc = (x, y) => [(x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1];
const grabTarget = new THREE.Vector3();
const grabPlane = new THREE.Plane();
const ray = new THREE.Raycaster();
let touch = null;

canvas.addEventListener('pointerdown', (e) => {
  aimLight(e.clientX, e.clientY);
  if (reduceMotion) return;
  const [nx, ny] = ndc(e.clientX, e.clientY);
  const p = silk.pick(nx, ny, camera, coarse ? 70 : 50, [innerWidth, innerHeight]);
  touch = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t: performance.now(), p, grabbing: false };
});

canvas.addEventListener('pointermove', (e) => {
  if (!touch || touch.id !== e.pointerId || touch.p < 0) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  // con il dito: solo i gesti orizzontali tirano la seta (quelli verticali scorrono la pagina)
  const intent = touch.type === 'mouse' ? Math.hypot(dx, dy) > 6 : Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
  if (!touch.grabbing && intent) {
    const c = silk.cloth;
    const q = new THREE.Vector3(c.pos[touch.p * 3], c.pos[touch.p * 3 + 1], c.pos[touch.p * 3 + 2]);
    grabPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), q);
    touch.origin = q.clone();
    grabTarget.copy(q);
    silk.grab(touch.p, grabTarget);
    touch.grabbing = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-grabbing');
  }
  if (touch.grabbing) {
    const [nx, ny] = ndc(e.clientX, e.clientY);
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const hit = ray.ray.intersectPlane(grabPlane, new THREE.Vector3());
    if (hit) {
      // non oltre ~70 cm dal punto preso: la seta si tira, non si strappa
      const d = hit.sub(touch.origin);
      if (d.length() > 0.7) d.setLength(0.7);
      grabTarget.copy(touch.origin).add(d);
    }
  }
});

const endTouch = (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  if (touch.grabbing) silk.release();
  else if (e.type === 'pointerup' && touch.p >= 0 && performance.now() - touch.t < 450) {
    // tocco breve: la seta si solleva in un'onda morbida
    const dir = camera.getWorldDirection(new THREE.Vector3());
    dir.y += 0.25;
    silk.poke(touch.p, dir, 1.7);
  }
  canvas.classList.remove('is-grabbing');
  touch = null;
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// ---------- scroll come cambio pagina: il nome sale nella barra, compare il menu ----------
const head = document.querySelector('.site-head');
const nameEl = document.querySelector('.hero-name');
const roleEl = document.querySelector('.hero-role');
const menu = document.querySelector('.menu');
const menuItems = menu.querySelectorAll('li');
const menuCta = menu.querySelectorAll('.menu-cta, .demo-note');
const hint = document.querySelector('.scroll-hint');
const headCenterY = () => {
  const r = head.getBoundingClientRect();
  return r.bottom - parseFloat(getComputedStyle(head).height) / 2;
};
const nameRestCenterY = () => {
  const r = nameEl.getBoundingClientRect();
  return r.top + r.height / 2 - gsap.getProperty(nameEl, 'y');
};
const nameScale = () => 17 / parseFloat(getComputedStyle(nameEl).fontSize);

gsap.set(menuItems, { opacity: 0, y: 22 });
gsap.set(menuCta, { opacity: 0, y: 16 });
const intro = gsap.timeline({
  defaults: { ease: 'sine.inOut' },
  scrollTrigger: {
    start: 0,
    end: () => innerHeight * 0.95,
    // tutto segue lo scroll (nessuno scatto automatico); solo un filo di morbidezza
    scrub: reduceMotion ? true : 0.6,
    invalidateOnRefresh: true,
    onUpdate: (st) => {
      menu.style.visibility = st.progress > 0.02 ? 'visible' : 'hidden';
      if (st.progress > 0.1 && !intro._flicked) {
        intro._flicked = true;
        silk.flick(0.5);
      }
      if (st.progress < 0.02) intro._flicked = false;
    },
  },
});
intro
  .to(nameEl, { y: () => headCenterY() - nameRestCenterY(), scale: nameScale, duration: 1 }, 0)
  .to(hint, { opacity: 0, duration: 0.12, ease: 'none' }, 0)
  .to(roleEl, { opacity: 0, y: -14, duration: 0.3, ease: 'sine.out' }, 0)
  .to(menuItems, { opacity: 1, y: 0, duration: 0.45, stagger: 0.09, ease: 'sine.out' }, 0.42)
  .to(menuCta, { opacity: 1, y: 0, duration: 0.4, ease: 'sine.out' }, 0.6);

document.querySelector('.mono').addEventListener('click', (e) => {
  e.preventDefault();
  scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

// ---------- misura (solo con ?debug) ----------
const fpsEl = document.getElementById('fps');
const debug = params.has('debug');
fpsEl.hidden = !debug;
let frames = 0, acc = 0, simAcc = 0;
// se per 2 secondi si sta sotto i 45 fps, la mesh della seta passa a metà dei segmenti
const perf = { t: 0, n: 0, reduced: false };

// ---------- ciclo ----------
const clock = new THREE.Clock();
const L = new THREE.Vector3();
const AX_Y = new THREE.Vector3(0, 1, 0), AX_X = new THREE.Vector3(1, 0, 0);
const studioM = new THREE.Matrix4(), studioRY = new THREE.Matrix4();
const loop = () => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  silk.update(reduceMotion ? dt * 0.35 : dt);
  measureSilk(dt);
  page.p = intro.progress();
  page.shown += (page.p - page.shown) * (1 - Math.exp(-dt * 6));
  screenGuard(dt);
  computeFrame();

  const kL = 1 - Math.exp(-dt * 2.5);
  light.yaw += (light.tYaw - light.yaw) * kL;
  light.pitch += (light.tPitch - light.pitch) * kL;
  L.copy(baseLight).applyAxisAngle(AX_Y, -light.yaw).applyAxisAngle(AX_X, -light.pitch);
  silk.uniforms.uLightDir.value.copy(L);
  // lo studio riflesso ruota come la luce
  studioM.makeRotationX(light.pitch).multiply(studioRY.makeRotationY(light.yaw));
  silk.uniforms.uStudio.value.setFromMatrix4(studioM);

  // camera smorzata con un piccolissimo respiro
  const kC = 1 - Math.exp(-dt * 2.2);
  const drift = reduceMotion ? 0 : 1;
  camPos.lerp(frame.pos, kC);
  camTarget.lerp(frame.target, kC);
  camera.position.set(
    camPos.x + Math.sin(time * 0.21) * 0.03 * drift,
    camPos.y + Math.sin(time * 0.17 + 1.3) * 0.02 * drift,
    camPos.z,
  );
  camera.lookAt(camTarget);

  renderer.render(scene, camera);

  if (!perf.reduced && dt > 0) {
    perf.t += dt;
    perf.n++;
    if (perf.t >= 2) {
      if (perf.n / perf.t < 45 && clock.elapsedTime > 4) {
        silk.setSegments(silk.segments[0] / 2, silk.segments[1] / 2);
        perf.reduced = true;
      }
      perf.t = perf.n = 0;
    }
  }

  if (debug) {
    frames++;
    acc += dt;
    simAcc += silk.simMs;
    if (acc > 0.5) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps · sim ${(simAcc / frames).toFixed(1)} ms · ${silk.nx}×${silk.ny} · mesh ${silk.segments.join('×')}`;
      frames = acc = simAcc = 0;
    }
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

window.__velata = { silk, camera, renderer, guard, page, follow };
