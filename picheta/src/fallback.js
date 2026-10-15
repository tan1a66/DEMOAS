// Respaldo sin WebGL: el mismo cielo (misma paleta, misma hora de Mérida) como degradado CSS,
// con una silueta plana de la catedral y los edificios.

import { sunPosition } from './sun.js';
import { paletteAt, rgbToCss } from './palette.js';

export function startFallback(clock, ui) {
  document.body.classList.add('no-webgl');
  const sky = document.getElementById('sky-fallback');
  sky.hidden = false;

  const paint = () => {
    const now = clock.now();
    const { altitude, azimuth } = sunPosition(now);
    const p = paletteAt(altitude);
    // Lado del resplandor: el sol se pone a la derecha (oeste), sale a la izquierda (este).
    const side = azimuth > 180 ? 82 : 18;
    sky.style.background = [
      `radial-gradient(120% 55% at ${side}% 100%, ${rgbToCss(p.glow)} 0%, transparent 70%)`,
      `linear-gradient(to top, ${rgbToCss(p.horizon)} 0%, ${rgbToCss(p.mid)} 32%, ${rgbToCss(p.zenith)} 85%)`,
    ].join(', ');
    // La silueta toma el color de la luz ambiental, como la piedra en la versión 3D.
    const k = 0.55 + 0.35 * Math.min(1, p.hemiI);
    const tint = p.hemiSky.map((c, i) => c * k * [0.94, 0.9, 0.84][i]);
    sky.style.setProperty('--silhouette', rgbToCss(tint));
    ui?.setTone(p.day);
    ui?.update();
  };
  paint();
  // Tiempo real: una vez por minuto basta. Timelapse / control horario: cada fotograma.
  const loop = () => {
    paint();
    requestAnimationFrame(loop);
  };
  if (clock.mode === 'timelapse') loop();
  else {
    setInterval(paint, 30_000);
    clock.onChange(paint);
  }
}
