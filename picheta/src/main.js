// Picheta — "El cielo de Mérida, hoy".
// Punto de entrada: reloj de Mérida, interfaz y, si hay WebGL2, la escena 3D.

import './styles.css';
import { Clock, fromMerida, toMerida } from './time.js';
import { sunsetOn } from './sun.js';
import { UI } from './ui.js';
import { startFallback } from './fallback.js';

const clock = new Clock();
// El timelapse va más despacio alrededor de la puesta de sol de hoy (+20 min: hora dorada → azul).
const sunset = toMerida(sunsetOn(fromMerida(new Date(clock.today().getTime() + 12 * 3600e3))));
clock.focusTimelapse(sunset.getUTCHours() * 60 + sunset.getUTCMinutes() + 20);
const ui = new UI(clock);
ui.update(true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Quita el loader y lanza la entrada de los textos (esperando a las fuentes, como mucho 1,2 s). */
let revealed = false;
async function reveal() {
  if (revealed) return;
  revealed = true;
  await Promise.race([document.fonts?.ready, sleep(1200)]);
  document.body.classList.add('is-loaded');
  ui.reveal();
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
  reveal();
};

// ?nogl=1 fuerza el respaldo CSS (para probarlo).
if (!hasWebGL2() || new URLSearchParams(location.search).has('nogl')) {
  fallback();
} else {
  import('./webgl.js')
    .then(({ startWebGL }) =>
      startWebGL({ canvas: document.getElementById('gl'), clock, ui, onFirstFrame: reveal, onFail: fallback }),
    )
    .catch((err) => {
      console.error(err);
      fallback();
    });
}

// Si algo tarda demasiado, nunca dejamos al cliente mirando el loader.
setTimeout(reveal, 6000);
