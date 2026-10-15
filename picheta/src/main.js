// Picheta — "El cielo de Mérida, hoy".
// Punto de entrada: reloj de Mérida, interfaz y la escena: fotos (por defecto) o 3D (?mode=3d).

import './styles.css';
import { Clock, fromMerida, toMerida } from './time.js';
import { sunsetOn } from './sun.js';
import { UI } from './ui.js';
import { startFallback } from './fallback.js';

// La página empieza siempre arriba: el hero es una película que arranca en la cocina.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

const clock = new Clock();
// El timelapse va más despacio alrededor de la puesta de sol de hoy (+20 min: hora dorada → azul).
const sunset = toMerida(sunsetOn(fromMerida(new Date(clock.today().getTime() + 12 * 3600e3))));
clock.focusTimelapse(sunset.getUTCHours() * 60 + sunset.getUTCMinutes() + 20);
const ui = new UI(clock);
ui.update(true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Quita el loader (esperando a las fuentes, como mucho 1,2 s). Devuelve una promesa. */
let loaded = null;
function hideLoader() {
  loaded ??= Promise.race([document.fonts?.ready, sleep(1200)]).then(() => {
    document.body.classList.add('is-loaded');
  });
  return loaded;
}

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const fallback = () => {
  document.getElementById('gl').hidden = true;
  startFallback(clock, ui);
  clock.startTimelapse();
  hideLoader().then(() => ui.reveal());
};

// Escena 3D (?mode=3d, o si las fotos no cargan). Sin WebGL2, el degradado CSS.
const start3D = () => {
  if (!hasWebGL2() || params.has('nogl')) {
    fallback();
    return;
  }
  document.getElementById('gl').hidden = false;
  import('./webgl.js')
    .then(({ startWebGL }) =>
      startWebGL({ canvas: document.getElementById('gl'), clock, ui, onFirstFrame: hideLoader, onFail: fallback }),
    )
    .catch((err) => {
      console.error(err);
      fallback();
    });
};

// Por defecto, el modo foto (no necesita WebGL). ?nogl=1 fuerza el respaldo CSS (para probarlo).
const params = new URLSearchParams(location.search);
if (params.get('mode') === '3d' || params.has('nogl')) {
  start3D();
} else {
  import('./photo.js')
    .then(({ startPhoto }) => startPhoto({ clock, ui, onFirstFrame: hideLoader, onFail: start3D }))
    .catch((err) => {
      console.error(err);
      start3D();
    });
}

// Si algo tarda demasiado, nunca dejamos al cliente mirando el loader.
setTimeout(() => {
  if (!document.body.classList.contains('is-loaded')) hideLoader().then(() => ui.reveal());
}, 8000);
