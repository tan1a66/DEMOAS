// Modo foto (por defecto): fotografías realistas con profundidad en lugar de la escena 3D (?mode=3d).
//
// Película de entrada: la cámara sube por una foto vertical de la cocina — del fogón, entre los
// portales del patio, hasta el cielo — y se posa en la terraza frente a la catedral.
// La terraza existe en cuatro luces (día, hora dorada, hora azul, noche) que se funden según la
// altura real del sol sobre Mérida; también con ?t=, ?timelapse=1 y el control horario (T).
//
// Con WebGL2 (src/depth.js) cada foto lleva su mapa de profundidad: la cámara se mueve dentro de
// la escena (paralaje real), el titular vive entre el cielo y las torres, las bombillas titilan,
// las llamas bailan y cruzan zanates. Sin WebGL2, las mismas fotos con transformaciones CSS.
// Las fotos viven en public/hero/; el encuadre se retoca en FRAME.

import { IS_MOBILE, REDUCED_MOTION } from './config.js';
import { sunPosition } from './sun.js';
import { smoothstep } from './palette.js';
import { PointerInput } from './pointer.js';
import { createIntro } from './film.js';
import { Embers } from './embers.js';
import { DepthRenderer } from './depth.js';

const Q = new URLSearchParams(location.search);
// ?rec: el tiempo solo avanza con window.__rec.step(ms) (para grabar vídeos fotograma a fotograma).
const REC = Q.has('rec');
let recNow = 0;
const nowMs = () => (REC ? recNow : performance.now());

// ---------------------------------------------------------------- fotos
// Cada foto en dos tamaños: -m (móvil) y -d (escritorio). Las profundidades, en uno solo.
const SIZE = IS_MOBILE || Math.max(screen.width, screen.height) < 1100 ? 'm' : 'd';
const asset = (path) => window.__PICHETA_FILES?.[path] ?? path; // versión en un solo archivo (npm run build:single)
const file = (name) => asset(`/hero/${name}-${SIZE}.webp`);
const KITCHEN = 'cocina';
const PLATES = ['terraza-dia', 'terraza-dorada', 'terraza-azul', 'terraza-noche'];

// Encuadre. x/y = "object-position" (0 izquierda/arriba … 1 derecha/abajo).
// En móvil la terraza (cuadrada) se recorta a los lados: manda x; en escritorio, arriba y abajo: manda y.
export const FRAME = {
  // Móvil: las dos torres de la catedral; escritorio: torres, guirnalda y el pretil.
  terrace: { x: 0.14, y: 0.22 },
  fire: { x: 0.5, y: 0.905, spread: 0.12 }, // el fogón en la foto de la cocina (de aquí salen las brasas)
};

// Profundidad (0 cielo … 1 primer plano, ver public/hero/*-depth.png): el plano que queda quieto,
// y el plano del titular (delante de la catedral, detrás de las guirnaldas y el farol, que lo cruzan).
const DEPTH = { focusTerrace: 0.3, focusKitchen: 0.55, title: 0.4 };

// Luminosidad del cielo de cada luz: sobre cielos claros, el titular pasa a tinta oscura.
const SKY_LUM = [0.85, 0.7, 0.3, 0.06];

// Altura del sol (grados) → foto de la terraza (índice en PLATES). Entre dos paradas, fundido.
// Por la tarde: día → dorada → azul → noche. Por la mañana el sol sale por la izquierda (tras la
// catedral) y la foto dorada tiene el sol a la derecha: se pasa de la azul al día directamente.
const EVENING = [[14, 0], [6, 1], [-1.5, 1], [-5.5, 2], [-8.5, 2], [-13, 3]];
const MORNING = [[12, 0], [-2, 2], [-7, 2], [-13, 3]];

function plateWeights(alt, morning, out) {
  const stops = morning ? MORNING : EVENING;
  out.fill(0);
  if (alt >= stops[0][0]) {
    out[stops[0][1]] = 1;
    return out;
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const [a0, p0] = stops[i];
    const [a1, p1] = stops[i + 1];
    if (alt <= a0 && alt >= a1) {
      const t = smoothstep(a0, a1, alt);
      out[p0] += 1 - t;
      out[p1] += t;
      return out;
    }
  }
  out[stops[stops.length - 1][1]] = 1;
  return out;
}

// ---------------------------------------------------------------- película
// Segundos: empuje hacia el fuego · subida por el patio · fundido al cielo · aterrizaje en la terraza.
const T = { rise: [0.35, 5.0], fade: [4.3, 5.6], land: [4.3, 8.0] };
const INTRO_END = 8.0;
const STAGES = { fire: 0.5, sky: 4.9, done: 6.8 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const out3 = (x) => 1 - (1 - x) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const CREAM = [0.937, 0.902, 0.839];
const NEGRO = [0.102, 0.082, 0.071];

/** Una foto "a sangre" en CSS (respaldo sin WebGL2): cubre la pantalla con zoom y posición. */
class Plate {
  constructor(img) {
    this.img = img;
    this.w = img.naturalWidth;
    this.h = img.naturalHeight;
    img.style.width = `${this.w}px`;
    img.style.height = `${this.h}px`;
    this.k = 1;
    this.x = 0;
    this.y = 0;
  }
  place(vw, vh, { px, py, zoom, dx = 0, dy = 0 }) {
    const k = Math.max(vw / this.w, vh / this.h) * zoom;
    const W = this.w * k;
    const H = this.h * k;
    this.k = k;
    this.x = Math.min(0, Math.max(vw - W, px * (vw - W) + dx));
    this.y = Math.min(0, Math.max(vh - H, py * (vh - H) + dy));
    this.img.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) scale(${k.toFixed(5)})`;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.onload = () => Promise.resolve(img.decode?.()).catch(() => {}).then(() => resolve(img));
    img.onerror = () => reject(new Error(`No se pudo cargar ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** Titular en píxeles de pantalla: en el cielo, arriba, centrado. */
function titleLayout(vw, vh, lines) {
  const mobile = vw < 700;
  let size = mobile ? Math.min(80, Math.max(42, vw * 0.148)) : Math.min(150, Math.max(70, vw * 0.083));
  const fonts = (s) => [`340 ${s}px Fraunces, Georgia, serif`, `italic 300 ${s}px Fraunces, Georgia, serif`];
  const g = document.createElement('canvas').getContext('2d');
  const width = (s) =>
    Math.max(
      ...lines.map((text, i) => {
        g.font = fonts(s)[i];
        return g.measureText(text).width;
      }),
    );
  const max = vw * (mobile ? 0.9 : 0.8);
  if (width(size) > max) size *= max / width(size);
  const [f1, f2] = fonts(size);
  const y1 = (mobile ? 0.205 : 0.28) * vh;
  return {
    size,
    lines: [
      { text: lines[0], font: f1, x: vw / 2, y: y1 },
      { text: lines[1], font: f2, x: vw / 2, y: y1 + size * 0.98 },
    ],
  };
}

export async function startPhoto({ clock, ui, onFirstFrame, onFail }) {
  const root = document.getElementById('photo');
  const stage = root.parentElement;
  root.hidden = false;
  document.getElementById('gl').hidden = true;
  document.body.classList.add('mode-photo');

  // ---------------------------------------------------------------- renderer
  let gl = null;
  const glCanvas = document.createElement('canvas');
  glCanvas.className = 'photo-gl';
  if (!Q.has('flat')) {
    try {
      gl = new DepthRenderer(glCanvas, { maxDpr: IS_MOBILE ? 1.75 : 2 });
    } catch (err) {
      console.warn('Fotos sin profundidad:', err.message);
    }
  }
  const terraceEl = document.createElement('div');
  terraceEl.className = 'photo-terrace';
  const kitchenEl = document.createElement('div');
  kitchenEl.className = 'photo-kitchen';
  const glow = document.createElement('div');
  glow.className = 'photo-glow';
  const canvas = document.createElement('canvas');
  canvas.className = 'photo-embers';
  if (gl) {
    root.append(glCanvas, canvas);
  } else {
    kitchenEl.append(glow);
    root.append(terraceEl, kitchenEl, canvas);
  }

  // ---------------------------------------------------------------- qué luz toca ahora
  const weights = new Array(PLATES.length).fill(0);
  const shown = new Array(PLATES.length).fill(0); // pesos suavizados (los que se ven)
  const plates = new Array(PLATES.length).fill(null); // { w, h } (y Plate en CSS)
  const target = () => {
    const sp = sunPosition(clock.now());
    plateWeights(sp.altitude, sp.azimuth < 180, weights);
  };
  target();

  const intro = createIntro({ ui, clock, end: INTRO_END, stages: STAGES, now: () => nowMs() / 1000 });
  if (scrollY > innerHeight * 0.5) intro.skip = true; // ya estaba más abajo: sin película

  // Primero lo imprescindible (la cocina si hay película, la luz de ahora, las profundidades);
  // el resto, después.
  const addPlate = (i) =>
    loadImage(file(PLATES[i])).then((img) => {
      if (gl) {
        gl.setTexture(`uPlate${i}`, img, { mips: true });
        plates[i] = { w: img.naturalWidth, h: img.naturalHeight };
      } else {
        img.style.opacity = '0';
        // Orden fijo en el DOM (día abajo … noche arriba): el fundido por capas lo necesita.
        const after = plates.slice(i + 1).find(Boolean);
        terraceEl.insertBefore(img, after ? after.img : null);
        plates[i] = new Plate(img);
      }
    });
  let kitchen = null;
  const addKitchen = () =>
    Promise.all([loadImage(file(KITCHEN)), gl ? loadImage(asset('/hero/cocina-depth.png')) : null]).then(([img, depth]) => {
      if (gl) {
        gl.setTexture('uKitchen', img, { mips: true });
        gl.setTexture('uDepthK', depth);
        kitchen = { w: img.naturalWidth, h: img.naturalHeight };
      } else {
        kitchenEl.prepend(img);
        kitchen = new Plate(img);
      }
    });
  const fontsReady = Promise.race([
    Promise.all([
      document.fonts?.load('340 64px Fraunces'),
      document.fonts?.load('italic 300 64px Fraunces'),
    ]).catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  try {
    const needed = PLATES.map((_, i) => i).filter((i) => weights[i] > 0);
    await Promise.all([
      ...needed.map(addPlate),
      intro.skip ? null : addKitchen(),
      gl ? loadImage(asset('/hero/terraza-depth.png')).then((d) => gl.setTexture('uDepthT', d)) : null,
      gl ? fontsReady : null,
    ]);
  } catch (err) {
    console.error(err);
    root.hidden = true;
    root.replaceChildren();
    document.body.classList.remove('mode-photo');
    onFail?.(err);
    return;
  }
  PLATES.forEach((_, i) => plates[i] || addPlate(i).catch(() => {}));
  // La cocina hace falta también para repetir la película (R): se carga sin prisa.
  const kitchenReady = kitchen ? Promise.resolve() : addKitchen().catch(() => {});
  const play = intro.play.bind(intro);
  intro.play = () => kitchenReady.then(play);

  // ---------------------------------------------------------------- titular dentro de la escena
  // El <h1> sigue en la página (lectores de pantalla, buscadores); lo que se ve es el de WebGL.
  const titleEl = document.getElementById('title');
  let titleDirty = true;
  if (gl) {
    document.body.classList.add('title-in-scene');
    new MutationObserver(() => (titleDirty = true)).observe(titleEl, { childList: true, subtree: true, characterData: true });
    document.fonts?.addEventListener?.('loadingdone', () => (titleDirty = true));
  }
  const text = { a: [0, 0], y: [22, 22] };

  // ---------------------------------------------------------------- tamaño, scroll, paralaje
  let vw = 1;
  let vh = 1;
  const embers = new Embers(canvas, { max: IS_MOBILE ? 70 : 110 });
  const resize = () => {
    vw = stage.clientWidth || innerWidth;
    vh = stage.clientHeight || innerHeight;
    embers.resize(vw, vh);
    gl?.resize(vw, vh);
    titleDirty = true;
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Con profundidad, después del hero hay un tramo de scroll solo para el vuelo (.flight).
  const hero = document.getElementById('hero');
  const flight = document.getElementById('flight');
  let scroll = 0;
  let scrollSmooth = 0;
  let covered = false;
  const onScroll = () => {
    const h = (hero.offsetHeight || innerHeight) + (flight?.offsetHeight || 0);
    scroll = Math.min(1, Math.max(0, scrollY / h));
    covered = scrollY > h + 80;
    if (scrollY > 60 && intro.running) intro.finish();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const pointer = new PointerInput();
  const par = { x: 0, y: 0 };

  // Zanates: una bandada cruza el cielo de vez en cuando (de día y al atardecer).
  const birds = new Float32Array(7 * 4);
  const flock = Array.from({ length: 7 }, (_, i) => ({
    ox: (i - 3) * 0.055 + (Math.random() - 0.5) * 0.03,
    oy: Math.abs(i - 3) * 0.018 + (Math.random() - 0.5) * 0.02,
    ph: Math.random() * 6.28,
    sp: 7 + Math.random() * 3,
    sz: 0.8 + Math.random() * 0.4,
  }));
  const updateBirds = (t) => {
    const period = 26;
    const k = (t % period) / 13; // 13 s cruzando, 13 s de cielo vacío
    const mobile = vw < 700;
    for (let i = 0; i < flock.length; i++) {
      const b = flock[i];
      const x = (-0.25 + k * 1.5 + b.ox) * vw;
      const y = ((mobile ? 0.36 : 0.12) + b.oy + 0.015 * Math.sin(t * 0.9 + i)) * vh;
      const size = (mobile ? 9 : 11) * b.sz * gl.dpr;
      birds.set([x * gl.dpr, y * gl.dpr, k < 1 ? size : 0, t * b.sp + b.ph], i * 4);
    }
  };

  // ---------------------------------------------------------------- bucle
  let last = nowMs() / 1000;
  let uiClock = 0;
  let first = true;
  let prevRise = 0;
  let prevKy = null;

  const frame = () => {
    if (!REC) requestAnimationFrame(frame);
    const t = nowMs() / 1000;
    const rawDt = Math.min(t - last, 1);
    const dt = Math.min(rawDt, 0.1);
    last = t;

    // Luz: pesos objetivo según el sol, suavizados (en tiempo real todo cambia muy despacio).
    target();
    const tau = { timelapse: 0.12, manual: 0.9, fixed: 1.2, live: 2.5 }[clock.mode];
    const k = first ? 1 : 1 - Math.exp(-rawDt / tau);
    for (let i = 0; i < shown.length; i++) shown[i] += (weights[i] - shown[i]) * k;

    uiClock += dt;
    if (uiClock > (clock.mode === 'timelapse' ? 0.05 : 0.5)) {
      ui.update();
      uiClock = 0;
    }
    if (covered && !first) return;

    intro.stages(t);
    const it = Math.min(intro.time(t), INTRO_END);
    const inIntro = it < INTRO_END && !!kitchen;

    // ---- cámara viva en la terraza: órbita lenta + ratón/giroscopio; se apaga con el scroll.
    scrollSmooth += (scroll - scrollSmooth) * (1 - Math.exp(-dt / 0.25));
    if (!REDUCED_MOTION) {
      par.x += (pointer.x - par.x) * (1 - Math.exp(-dt / 0.7));
      par.y += (pointer.y - par.y) * (1 - Math.exp(-dt / 0.7));
    }
    const motion = REDUCED_MOTION ? 0 : 1;
    const settle = inIntro ? smoothstep(INTRO_END - 3, INTRO_END, it) : 1;
    const w = motion * settle;
    const s = scrollSmooth;
    const m = Math.min(vw, vh);
    // Con el scroll, la cámara vuela: pasa sobre el pretil y avanza hacia la catedral.
    const fly = gl ? inOut(s) : 0;
    const terrace = {
      px: FRAME.terrace.x + fly * 0.06,
      py: FRAME.terrace.y + fly * 0.3,
      zoom: (1.08 + Math.sin(t * 0.027 + 0.4) * 0.012 * w) * (1 + (gl ? fly * 0.7 : s * 0.05)),
      dx: gl ? 0 : (Math.sin(t * 0.043) * 0.022 * m - par.x * 0.03 * m) * w,
      dy: gl ? -s * vh * 0.04 : (Math.sin(t * 0.031 + 1) * 0.012 * m - par.y * 0.022 * m) * w - s * vh * 0.07,
      cam: [
        (0.075 * (0.8 * Math.sin(t * 0.23) + 0.2 * Math.sin(t * 0.61 + 2)) - 0.09 * par.x) * w,
        (0.03 * Math.sin(t * 0.17 + 1.3) - 0.05 * par.y) * w,
      ],
      dolly: (0.05 + 0.06 * Math.sin(t * 0.12)) * w + fly * 0.6,
      focus: DEPTH.focusTerrace,
    };

    // ---- terraza: durante la película "aterriza" desde el cielo (arriba, más cerca, de frente).
    let kitchenAlpha = 0;
    if (inIntro) {
      const land = out3(span(it, T.land));
      terrace.py = lerp(0, terrace.py, land);
      terrace.zoom *= lerp(1.28, 1, land);
      terrace.dolly = lerp(0.55, terrace.dolly, land);
      terrace.cam[1] = lerp(-0.05, terrace.cam[1], land);
      kitchenAlpha = 1 - inOut(span(it, T.fade));
    }

    // ---- cocina: del fogón al cielo del patio, con la cámara que sube y avanza entre los portales.
    let kview = null;
    let fireScreen = null;
    let kitchenY = null;
    let lift = 0;
    if (kitchenAlpha > 0) {
      const rise = inOut(span(it, T.rise));
      const vRise = dt > 0 ? (rise - prevRise) / dt : 0;
      prevRise = rise;
      const z0 = vw < vh ? 1.42 : 1.12;
      const z1 = vw < vh ? 1.1 : 1.02;
      kview = {
        px: FRAME.fire.x,
        py: 1 - rise,
        zoom: lerp(z0, z1, out3(span(it, [0, T.rise[1]]))) * (1 + 0.14 * inOut(span(it, T.fade))),
        cam: [0.012 * Math.sin(t * 1.1) * motion, 0.05 * vRise * motion],
        dolly: (0.04 + 0.16 * rise) * motion,
        focus: DEPTH.focusKitchen,
      };
    } else {
      prevRise = 0;
    }

    // ---- titular: cada línea aparece con la coreografía de ui.stage (clases del body).
    const b = document.body.classList;
    const on = [b.contains('intro-fire') || b.contains('is-in'), b.contains('intro-sky') || b.contains('is-in')];
    for (let i = 0; i < 2; i++) {
      const goal = on[i] ? 1 : 0;
      const kk = 1 - Math.exp(-dt / (goal ? 0.55 : 0.25));
      text.a[i] += (goal - text.a[i]) * kk;
      text.y[i] += ((on[i] ? 0 : 22) - text.y[i]) * (1 - Math.exp(-dt / 0.7));
    }

    if (gl) {
      if (titleDirty) {
        const lines = [...titleEl.querySelectorAll('.line')].map((l) => l.textContent.trim());
        if (lines.length === 2) gl.setTitle(titleLayout(vw, vh, lines));
        titleDirty = false;
      }
      const P = plates.find(Boolean);
      const tv = gl.mapFor(P.w, P.h, terrace);
      // Pesos de las luces que ya están cargadas (si falta alguna, la más cercana).
      const wv = shown.map((x, i) => (plates[i] ? x : 0));
      const sum = wv.reduce((a, x) => a + x, 0);
      if (sum < 0.001) {
        const want = shown.indexOf(Math.max(...shown));
        let best = -1;
        plates.forEach((p, i) => p && (best < 0 || Math.abs(i - want) < Math.abs(best - want)) && (best = i));
        wv.fill(0);
        wv[best] = 1;
      } else {
        for (let i = 0; i < 4; i++) wv[i] /= sum;
      }
      let kv = null;
      if (kview) {
        const m2 = gl.mapFor(kitchen.w, kitchen.h, kview);
        kv = { ...kview, map: m2.map, center: m2.center };
        fireScreen = [m2.x0 + FRAME.fire.x * m2.W, m2.y0 + FRAME.fire.y * m2.H, FRAME.fire.spread * m2.W];
        kitchenY = m2.y0;
      }
      updateBirds(t);
      const skyLum = wv.reduce((a, x, i) => a + x * SKY_LUM[i], 0);
      const night = Math.min(1, wv[2] * 0.75 + wv[3]); // bombillas y farol encendidos
      const inkDark = smoothstep(0.5, 0.68, skyLum) * (1 - kitchenAlpha);
      gl.render({
        time: t,
        weights: wv,
        terrace: { ...terrace, map: tv.map, center: tv.center },
        kitchen: kv,
        kitchenAlpha,
        textAlpha: text.a.map((a) => a * (1 - smoothstep(0.03, 0.25, s))),
        textY: text.y,
        textDepth: DEPTH.title,
        ink: CREAM.map((c, i) => lerp(c, NEGRO[i], inkDark)),
        inkDark,
        night,
        skyFlow: motion * (1 - night), // de noche no hay nubes que mover (y movería los halos)
        birds,
        birdAlpha: motion * (wv[0] + wv[1] + 0.4 * wv[2]) * (1 - kitchenAlpha),
        fade: 0,
      });
    } else {
      cssFrame(terrace, kview, kitchenAlpha, t);
    }

    // ---- brasas: nacen en el fogón y siguen a la cámara hasta el cielo.
    let src = null;
    if (fireScreen) src = { x: fireScreen[0], y: fireScreen[1], spread: fireScreen[2] };
    else if (cssFire) {
      src = cssFire;
      kitchenY = kitchen.y;
    }
    // Velocidad de la "grúa" en pantalla: las brasas la acompañan.
    if (kitchenY !== null && prevKy !== null && dt > 0) lift = Math.max(0, (kitchenY - prevKy) / dt) * 0.55;
    prevKy = kitchenY;
    const emberRate = inIntro && !REDUCED_MOTION ? (IS_MOBILE ? 26 : 40) * (1 - span(it, [4.6, 5.8])) : 0;
    if (emberRate > 0 || embers.list.length) embers.update(dt, src, emberRate, lift);
    else if (embers.dirty) embers.clear();

    if (first) {
      first = false;
      // Si el loader ya se había ido solo (fotos lentas, ver main.js), no hay película.
      if (document.body.classList.contains('is-loaded')) intro.skip = true;
      Promise.resolve(onFirstFrame?.()).then(() => {
        if (intro.skip || !kitchen) {
          intro.skip = true;
          ui.reveal();
          clock.startTimelapse();
        } else {
          intro.play();
        }
      });
    }
  };

  // ---------------------------------------------------------------- respaldo CSS (sin WebGL2)
  let cssFire = null;
  function cssFrame(terrace, kview, kitchenAlpha, t) {
    for (const p of plates) if (p) p.place(vw, vh, terrace);
    let acc = 0;
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i];
      if (!p) continue;
      const wi = shown[i] < 0.002 ? 0 : shown[i];
      acc += wi;
      const a = acc > 0 ? wi / acc : 0;
      p.img.style.opacity = a.toFixed(3);
      p.img.style.visibility = a > 0 && kitchenAlpha < 1 ? 'visible' : 'hidden';
    }
    if (acc === 0) {
      const want = shown.indexOf(Math.max(...shown));
      let best = null;
      plates.forEach((p, i) => {
        if (p && (!best || Math.abs(i - want) < Math.abs(best.i - want))) best = { p, i };
      });
      if (best) {
        best.p.img.style.opacity = '1';
        best.p.img.style.visibility = kitchenAlpha < 1 ? 'visible' : 'hidden';
      }
    }
    kitchenEl.style.visibility = kitchenAlpha > 0 ? 'visible' : 'hidden';
    cssFire = null;
    if (kitchenAlpha > 0 && kview) {
      kitchen.place(vw, vh, kview);
      kitchenEl.style.opacity = kitchenAlpha.toFixed(3);
      const fx = kitchen.x + FRAME.fire.x * kitchen.w * kitchen.k;
      const fy = kitchen.y + FRAME.fire.y * kitchen.h * kitchen.k;
      cssFire = { x: fx, y: fy, spread: FRAME.fire.spread * kitchen.w * kitchen.k };
      const flicker = 0.72 + 0.16 * Math.sin(t * 7.3) + 0.09 * Math.sin(t * 13.1 + 1.7) + 0.05 * Math.sin(t * 23.7);
      const size = kitchen.w * kitchen.k * 0.9;
      glow.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0) scale(${(size / 200).toFixed(4)})`;
      glow.style.opacity = (flicker * kview.py).toFixed(3); // se apaga al subir
    }
  }

  // Sobre las fotos, siempre tinta crema con velo oscuro (también de día): más fotográfico y legible.
  ui.setTone(0);
  if (REC) {
    window.__rec = {
      step(ms) {
        recNow += ms;
        frame();
      },
    };
  } else {
    requestAnimationFrame(frame);
  }
  clock.onChange(() => ui.update());

  window.__picheta = { clock, intro, plates, weights, shown, FRAME, DEPTH, gl };
}
