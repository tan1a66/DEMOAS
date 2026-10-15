// Entrada del paralaje (-1…1): ratón en escritorio, giroscopio en móvil, toque como respaldo.
// La usan la cámara 3D y el modo foto. Sin dependencias (no arrastra three.js).

import { REDUCED_MOTION } from './config.js';

const clamp = (v) => Math.min(1, Math.max(-1, v));

export class PointerInput {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.gyroActive = false;
    this.initPointer();
    this.initGyro();
  }

  initPointer() {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch' && this.gyroActive) return;
        // En táctil el paralaje es más suave (es solo el respaldo del giroscopio).
        const k = e.pointerType === 'touch' ? 0.5 : 1;
        this.x = ((e.clientX / innerWidth) * 2 - 1) * k;
        this.y = ((e.clientY / innerHeight) * 2 - 1) * k;
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => {
      this.x = 0;
      this.y = 0;
    });
  }

  /**
   * Giroscopio: en Android funciona directamente; en iOS hace falta pedir permiso con un gesto.
   * Si no hay permiso, queda el paralaje táctil y la deriva automática.
   */
  initGyro() {
    if (REDUCED_MOTION || typeof DeviceOrientationEvent === 'undefined') return;
    let base = null;
    const onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      this.gyroActive = true;
      let x = e.gamma;
      let y = e.beta;
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      if (angle === 90) [x, y] = [y, -x];
      else if (angle === -90 || angle === 270) [x, y] = [-y, x];
      // La referencia sigue despacio a la postura de la mano: el centro se recoloca solo.
      if (!base) base = { x, y };
      base.x += (x - base.x) * 0.01;
      base.y += (y - base.y) * 0.01;
      this.x = clamp((x - base.x) / 14);
      this.y = clamp((y - base.y) / 14);
    };
    const listen = () => window.addEventListener('deviceorientation', onOrient);
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
      listen();
      return;
    }
    const ask = () => {
      DeviceOrientationEvent.requestPermission()
        .then((r) => r === 'granted' && listen())
        .catch(() => {}); // sin permiso: respaldo táctil
    };
    window.addEventListener('touchend', ask, { once: true, passive: true });
  }
}
