// Video demo del recorrido (≈38 s, 16:9) grabado fotograma a fotograma con reloj virtual:
// requestAnimationFrame, timers, performance.now y animaciones CSS avanzan exactamente 1/30 s por
// cuadro, así el video sale fluido aunque el 3D se renderice por software (lento).
//
//   npx vite --port 5199 &
//   node scripts/video.mjs http://localhost:5199/ capturas/video     # cuadros JPEG
//   ffmpeg -framerate 30 -i capturas/video/%05d.jpg -c:v libx264 -preset slow -crf 23 \
//     -pix_fmt yuv420p -movflags +faststart carnal-demo.mp4
//
// Variables: W, H (tamaño, por defecto 1280×720), DESDE/HASTA (segundos, para regrabar un tramo).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`);

const [base = 'http://localhost:5199/', salida = 'capturas/video'] = process.argv.slice(2);
const FPS = 30;
const W = +(process.env.W || 1280);
const H = +(process.env.H || 720);
const DESDE = +(process.env.DESDE || 0);
const HASTA = +(process.env.HASTA || 1e9);
mkdirSync(salida, { recursive: true });

// ───────────── Guion: segundo del video → momento de la historia (escena + avance) ─────────────
const GUION = [
  [0.0, 0.02], // el fuego y la frase
  [2.4, 0.1],
  [4.6, 1.05], // el corte nace de sus vetas; aparece el rótulo
  [5.8, 1.1],
  [7.8, 1.42], // macro del marmoleo: "El marmoleo no se explica. Se siente."
  [8.8, 1.62], // "Los mejores cortes de Mérida…"
  [10.6, 2.1], // se disuelve en vetas → el mapa
  [12.6, 2.34], // Japón
  [13.8, 2.62], // USA
  [15.0, 3.151], // La Colección: Ribeye A5
  [16.4, 3.16],
  [17.6, 3.397], // gira hasta el Tomahawk
  [19.0, 3.4],
  [20.2, 4.16], // El ritual en casa
  [21.2, 4.2],
  [22.4, 4.44], // productos
  [23.4, 4.46],
  [24.8, 5.16], // Visítanos: llegada al portón
  [26.2, 5.58], // dirección y horarios
  [26.8, 5.6],
  [27.8, 6.13], // oscuridad: "Hay un lugar más."
  [28.8, 6.18],
  [31.4, 6.76], // se abre la cortina
  [32.6, 6.93], // la invitación
  [34.0, 8.0], // la mesa servida
  [38.0, 8.0],
];
const DURACION = 38.0;

/** Interpolación cúbica monótona (Fritsch–Carlson): velocidad continua, sin pasarse en las pausas. */
function interpolador(puntos) {
  const x = puntos.map((p) => p[0]);
  const y = puntos.map((p) => p[1]);
  const n = x.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const s = (t - x[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const historia = interpolador(GUION);
const suave = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ───────────── Reloj virtual (se inyecta antes de que cargue la página) ─────────────
const RELOJ_VIRTUAL = () => {
  let ahora = 0;
  const t0 = 1792000000000;
  const raf = new Map();
  let idRaf = 0;
  const timers = new Map();
  let idT = 0;
  window.requestAnimationFrame = (cb) => (raf.set(++idRaf, cb), idRaf);
  window.cancelAnimationFrame = (id) => raf.delete(id);
  window.setTimeout = (cb, ms = 0, ...a) => (timers.set(++idT, { en: ahora + (+ms || 0), cb, a }), idT);
  window.clearTimeout = (id) => timers.delete(id);
  window.setInterval = (cb, ms = 0) => {
    const id = ++idT;
    const programa = () => timers.set(id, { en: ahora + Math.max(1, +ms || 0), cb: () => (cb(), programa()), a: [] });
    programa();
    return id;
  };
  window.clearInterval = (id) => timers.delete(id);
  performance.now = () => ahora;
  Date.now = () => t0 + ahora;
  const sincronizarAnimaciones = () => {
    for (const an of document.getAnimations()) {
      if (an.__inicio === undefined) {
        an.__inicio = ahora;
        an.pause();
      }
      an.currentTime = Math.max(0, ahora - an.__inicio);
    }
  };
  window.__reloj = {
    avanzar(ms) {
      ahora += ms;
      for (let g = 0; g < 1000; g++) {
        let sig = null;
        for (const [id, t] of timers) if (t.en <= ahora && (!sig || t.en < sig[1].en)) sig = [id, t];
        if (!sig) break;
        timers.delete(sig[0]);
        try {
          sig[1].cb(...sig[1].a);
        } catch (e) {
          console.error(e);
        }
      }
      const cola = [...raf.values()];
      raf.clear();
      for (const cb of cola) {
        try {
          cb(ahora);
        } catch (e) {
          console.error(e);
        }
      }
      sincronizarAnimaciones();
    },
  };
};

const CURSOR_CSS = `
  #vcursor { position: fixed; z-index: 100; width: 22px; height: 22px; margin: -3px 0 0 -4px; pointer-events: none;
    opacity: 0; transition: none; filter: drop-shadow(0 2px 6px rgb(0 0 0 / .6)); }
  #vcursor svg { width: 100%; height: 100%; }
  #vcursor.on { opacity: 1; }
  .vripple { position: fixed; z-index: 99; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
    border: 1.5px solid #EDE4D3; pointer-events: none; animation: vripple .6s ease-out forwards; }
  @keyframes vripple { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.4); opacity: 0; } }
  .interfaz__avance { display: none !important; }
`;

const navegador = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
pagina.on('pageerror', (e) => console.log('[pageerror]', e.message));
pagina.on('console', (m) => m.type() === 'error' && console.log('[error]', m.text().slice(0, 200)));
await pagina.addInitScript(RELOJ_VIRTUAL);
await pagina.goto(`${base}?rapido&calidad=alta&video`);
await pagina.addStyleTag({ content: CURSOR_CSS });
await pagina.evaluate(() => {
  const c = document.createElement('div');
  c.id = 'vcursor';
  c.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.3L9.6 20z" fill="#EDE4D3" stroke="#0E0C0B" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
});

// Carga: avanzar el reloj (sin capturar) hasta que el umbral esté listo, más 3 s para la frase y el fuego.
const paso = (ms) => pagina.evaluate((ms) => window.__reloj.avanzar(ms), ms);
for (let i = 0; i < 3000; i++) {
  await paso(1000 / FPS);
  await pagina.waitForTimeout(15);
  if (await pagina.evaluate(() => !!document.querySelector('.interfaz--visible') && !!window.carnal)) break;
}
for (let i = 0; i < 3 * FPS; i++) {
  await pagina.evaluate((h) => window.carnal.fijar(h), GUION[0][1]);
  await paso(1000 / FPS);
}
console.log('listo, grabando…');

// ───────────── Cursor y clics (final: "Reservar" y la opción del privado) ─────────────
const cursor = { x: W * 0.72, y: H * 0.9, on: false };
let trayecto = null; // { desde, hasta, t0, t1 }
const mover = (hacia, t0, dur) => (trayecto = { desde: { ...cursor }, hacia, t0, t1: t0 + dur });

const total = Math.round(DURACION * FPS);
let reservaAbierta = false;
let privadoMarcado = false;
for (let n = 0; n < total; n++) {
  const t = n / FPS;
  const h = historia(t);

  // Guion del cursor en la carta final
  if (t >= 34.3 && !cursor.on) {
    cursor.on = true;
    const r = await pagina.evaluate(() => {
      const el = [...document.querySelectorAll('.carta__accion')].find((b) => /Reservar/.test(b.textContent));
      const q = el.getBoundingClientRect();
      return { x: q.left + 70, y: q.top + q.height / 2 };
    });
    mover(r, 34.3, 0.8);
  }
  if (t >= 35.25 && !reservaAbierta) {
    reservaAbierta = true;
    await pagina.evaluate(([x, y]) => {
      const r = document.createElement('div');
      r.className = 'vripple';
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
      [...document.querySelectorAll('.carta__accion')].find((b) => /Reservar/.test(b.textContent)).click();
    }, [cursor.x, cursor.y]);
  }
  if (t >= 35.9 && reservaAbierta && !privadoMarcado && (!trayecto || trayecto.t1 < 35.9)) {
    const r = await pagina.evaluate(() => {
      const q = document.querySelector('.opcion-privado__interruptor').getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    });
    mover(r, 35.9, 0.7);
    privadoMarcado = 'yendo';
  }
  if (t >= 36.7 && privadoMarcado === 'yendo') {
    privadoMarcado = true;
    await pagina.evaluate(([x, y]) => {
      const r = document.createElement('div');
      r.className = 'vripple';
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
      document.querySelector('.opcion-privado').click();
    }, [cursor.x, cursor.y]);
  }
  if (trayecto) {
    const k = suave((t - trayecto.t0) / (trayecto.t1 - trayecto.t0));
    cursor.x = trayecto.desde.x + (trayecto.hacia.x - trayecto.desde.x) * k;
    cursor.y = trayecto.desde.y + (trayecto.hacia.y - trayecto.desde.y) * k;
  }
  // Fundido final a negro
  const fundido = t >= 37.2;

  await pagina.evaluate(
    ([h, ms, c, fundido, dialogo]) => {
      if (!dialogo) window.carnal.fijar(h);
      document.querySelector('.velo').classList.toggle('velo--activo', fundido);
      window.__reloj.avanzar(ms);
      const el = document.getElementById('vcursor');
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
      el.classList.toggle('on', c.on);
    },
    [h, 1000 / FPS, cursor, fundido, reservaAbierta],
  );
  if (t > HASTA) break;
  if (t < DESDE) continue;
  await pagina.screenshot({ path: path.join(salida, String(n).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90, timeout: 0 });
  if (n % 30 === 0) console.log(`${t.toFixed(1)} s · historia ${h.toFixed(3)}`);
}
await navegador.close();
console.log('fin');
