// Modo foto (por defecto): fotografías realistas en lugar de la escena 3D (?mode=3d).
//
// Película de entrada: la cámara sube por una foto vertical de la cocina — del fogón, entre los
// portales del patio, hasta el cielo — y se posa en la terraza frente a la catedral.
// La terraza existe en cuatro luces (día, hora dorada, hora azul, noche) que se funden según la
// altura real del sol sobre Mérida; también con ?t=, ?timelapse=1 y el control horario (T).
// Las fotos viven en public/hero/; el encuadre se retoca en FRAME.

import { IS_MOBILE, REDUCED_MOTION } from './config.js';
import { sunPosition } from './sun.js';
import { smoothstep } from './palette.js';
import { PointerInput } from './pointer.js';
import { createIntro } from './film.js';
import { Embers } from './embers.js';

// ---------------------------------------------------------------- fotos
// Cada foto en dos tamaños: -m (móvil) y -d (escritorio).
const SIZE = IS_MOBILE || Math.max(screen.width, screen.height) < 1100 ? 'm' : 'd';
const file = (name) => `/hero/${name}-${SIZE}.webp`;
const KITCHEN = 'cocina';
const PLATES = ['terraza-dia', 'terraza-dorada', 'terraza-azul', 'terraza-noche'];

// Encuadre. x/y = "object-position" (0 izquierda/arriba … 1 derecha/abajo).
// En móvil la terraza (cuadrada) se recorta a los lados: manda x; en escritorio, arriba y abajo: manda y.
export const FRAME = {
  // Móvil: las dos torres de la catedral; escritorio: torres, guirnalda y el pretil.
  terrace: { x: 0.14, y: 0.22 },
  fire: { x: 0.5, y: 0.905, spread: 0.12 }, // el fogón en la foto de la cocina (de aquí salen las brasas)
};

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

/** Una foto "a sangre": cubre la pantalla con un zoom y una posición (como object-fit: cover). */
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
  /** Posición (px, py como object-position), zoom ≥ 1 sobre "cubrir" y desplazamiento en píxeles. */
  place(vw, vh, px, py, zoom, dx = 0, dy = 0) {
    const k = Math.max(vw / this.w, vh / this.h) * zoom;
    const W = this.w * k;
    const H = this.h * k;
    this.k = k;
    this.x = Math.min(0, Math.max(vw - W, px * (vw - W) + dx));
    this.y = Math.min(0, Math.max(vh - H, py * (vh - H) + dy));
    this.img.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) scale(${k.toFixed(5)})`;
  }
  /** Punto de la foto (fracciones) → píxeles de pantalla. */
  toScreen(fx, fy) {
    return [this.x + fx * this.w * this.k, this.y + fy * this.h * this.k];
  }
}

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.onload = () => Promise.resolve(img.decode?.()).catch(() => {}).then(() => resolve(img));
    img.onerror = () => reject(new Error(`No se pudo cargar ${img.src}`));
    img.src = file(name);
  });
}

export async function startPhoto({ clock, ui, onFirstFrame, onFail }) {
  const root = document.getElementById('photo');
  const stage = root.parentElement;
  root.hidden = false;
  document.getElementById('gl').hidden = true;
  document.body.classList.add('mode-photo');

  const terraceEl = document.createElement('div');
  terraceEl.className = 'photo-terrace';
  const kitchenEl = document.createElement('div');
  kitchenEl.className = 'photo-kitchen';
  const glow = document.createElement('div');
  glow.className = 'photo-glow';
  const canvas = document.createElement('canvas');
  canvas.className = 'photo-embers';
  kitchenEl.append(glow);
  root.append(terraceEl, kitchenEl, canvas);

  // ---------------------------------------------------------------- qué luz toca ahora
  const weights = new Array(PLATES.length).fill(0);
  const shown = new Array(PLATES.length).fill(0); // pesos suavizados (los que se ven)
  const plates = new Array(PLATES.length).fill(null);
  const target = () => {
    const sp = sunPosition(clock.now());
    plateWeights(sp.altitude, sp.azimuth < 180, weights);
    return sp.altitude;
  };
  target();

  const intro = createIntro({ ui, clock, end: INTRO_END, stages: STAGES, now: () => performance.now() / 1000 });
  if (scrollY > innerHeight * 0.5) intro.skip = true; // ya estaba más abajo: sin película

  // Primero lo imprescindible (la cocina si hay película, la luz de ahora); el resto, después.
  const addPlate = (i) =>
    loadImage(PLATES[i]).then((img) => {
      img.dataset.plate = PLATES[i];
      img.style.opacity = '0';
      // Orden fijo en el DOM (día abajo … noche arriba): el fundido por capas lo necesita.
      const after = plates.slice(i + 1).find(Boolean);
      terraceEl.insertBefore(img, after ? after.img : null);
      plates[i] = new Plate(img);
    });
  let kitchen = null;
  try {
    const needed = PLATES.map((_, i) => i).filter((i) => weights[i] > 0);
    await Promise.all([
      ...needed.map(addPlate),
      intro.skip ? null : loadImage(KITCHEN).then((img) => {
        kitchenEl.prepend(img);
        kitchen = new Plate(img);
      }),
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
  const kitchenReady = kitchen
    ? Promise.resolve()
    : loadImage(KITCHEN)
        .then((img) => {
          kitchenEl.prepend(img);
          kitchen = new Plate(img);
        })
        .catch(() => {});
  const play = intro.play.bind(intro);
  intro.play = () => kitchenReady.then(play);

  // ---------------------------------------------------------------- tamaño, scroll, paralaje
  let vw = 1;
  let vh = 1;
  const embers = new Embers(canvas, { max: IS_MOBILE ? 70 : 110 });
  const resize = () => {
    vw = stage.clientWidth || innerWidth;
    vh = stage.clientHeight || innerHeight;
    embers.resize(vw, vh);
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const hero = document.getElementById('hero');
  let scroll = 0;
  let scrollSmooth = 0;
  let covered = false;
  const onScroll = () => {
    const h = hero.offsetHeight || innerHeight;
    scroll = Math.min(1, Math.max(0, scrollY / h));
    covered = scrollY > h + 80;
    if (scrollY > 60 && intro.running) intro.finish();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const pointer = new PointerInput();
  const par = { x: 0, y: 0 };

  // ---------------------------------------------------------------- bucle
  let last = performance.now() / 1000;
  let uiClock = 0;
  let first = true;
  let prevKy = null;

  const frame = () => {
    requestAnimationFrame(frame);
    const t = performance.now() / 1000;
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

    // Deriva lentísima y paralaje; entran al final de la película, se apagan con el scroll.
    scrollSmooth += (scroll - scrollSmooth) * (1 - Math.exp(-dt / 0.25));
    if (!REDUCED_MOTION) {
      par.x += (pointer.x - par.x) * (1 - Math.exp(-dt / 0.9));
      par.y += (pointer.y - par.y) * (1 - Math.exp(-dt / 0.9));
    }
    const motion = REDUCED_MOTION ? 0 : 1;
    const settle = inIntro ? smoothstep(INTRO_END - 2.5, INTRO_END, it) : 1;
    const w = motion * settle;
    const s = scrollSmooth;
    const m = Math.min(vw, vh);
    const dx = (Math.sin(t * 0.043) * 0.022 * m - par.x * 0.03 * m) * w;
    const dy = (Math.sin(t * 0.031 + 1) * 0.012 * m - par.y * 0.022 * m) * w - s * vh * 0.07;
    let zoom = (1.07 + Math.sin(t * 0.027 + 0.4) * 0.012 * w) * (1 + s * 0.06);
    let py = FRAME.terrace.y;

    // ---- terraza: durante la película "aterriza" desde el cielo (arriba y más cerca).
    let kitchenAlpha = 0;
    if (inIntro) {
      const land = out3(span(it, T.land));
      py = lerp(0, py, land);
      zoom *= lerp(1.28, 1, land);
      kitchenAlpha = 1 - inOut(span(it, T.fade));
    }
    for (const p of plates) if (p) p.place(vw, vh, FRAME.terrace.x, py, zoom, dx, dy);

    // Fundido entre luces: capas en orden; cada una con alfa = peso / suma de pesos hasta ella.
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
      // La luz que toca aún no ha cargado: se muestra la más cercana que sí esté.
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

    // ---- cocina: del fogón al cielo del patio.
    kitchenEl.style.visibility = kitchenAlpha > 0 ? 'visible' : 'hidden';
    let src = null;
    let lift = 0;
    if (kitchenAlpha > 0) {
      const rise = inOut(span(it, T.rise));
      const z0 = vw < vh ? 1.42 : 1.12;
      const z1 = vw < vh ? 1.1 : 1.02;
      const kz = lerp(z0, z1, out3(span(it, [0, T.rise[1]]))) * (1 + 0.14 * inOut(span(it, T.fade)));
      kitchen.place(vw, vh, FRAME.fire.x, 1 - rise, kz);
      kitchenEl.style.opacity = kitchenAlpha.toFixed(3);
      // Velocidad de la "grúa" en pantalla: las brasas la acompañan.
      if (prevKy !== null && dt > 0) lift = Math.max(0, (kitchen.y - prevKy) / dt) * 0.55;
      prevKy = kitchen.y;
      const [fx, fy] = kitchen.toScreen(FRAME.fire.x, FRAME.fire.y);
      src = { x: fx, y: fy, spread: FRAME.fire.spread * kitchen.w * kitchen.k };
      // El resplandor del fuego respira.
      const flicker = 0.72 + 0.16 * Math.sin(t * 7.3) + 0.09 * Math.sin(t * 13.1 + 1.7) + 0.05 * Math.sin(t * 23.7);
      const size = kitchen.w * kitchen.k * 0.9;
      glow.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0) scale(${(size / 200).toFixed(4)})`;
      glow.style.opacity = (flicker * (1 - rise)).toFixed(3);
    } else {
      prevKy = null;
    }

    // ---- brasas: nacen en el fogón y siguen a la cámara hasta el cielo.
    const emberRate = inIntro ? (IS_MOBILE ? 26 : 40) * (1 - span(it, [4.6, 5.8])) : 0;
    if (emberRate > 0 || embers.list.length) embers.update(dt, src, emberRate, lift);
    else if (embers.dirty) embers.clear();

    if (first) {
      first = false;
      // Si el loader ya se había ido solo (fotos lentas, ver main.js), no hay película.
      if (document.body.classList.contains('is-loaded')) intro.skip = true;
      Promise.resolve(onFirstFrame?.()).then(() => {
        // Si el loader ya se había ido solo (fotos lentas), no se repite la entrada.
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
  // Sobre las fotos, siempre tinta crema con velo oscuro (también de día): más fotográfico y legible.
  ui.setTone(0);
  requestAnimationFrame(frame);
  clock.onChange(() => ui.update());

  window.__picheta = { clock, intro, plates, weights, shown, FRAME };
}
