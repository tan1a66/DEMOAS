// Cámara a la altura de los ojos de una persona sentada en la terraza.
// Deriva lentísima + paralaje (ratón en escritorio, giroscopio en móvil) + bajada con el scroll.

import * as THREE from 'three';
import { REDUCED_MOTION } from './config.js';

const EYE = new THREE.Vector3(0, 1.22, 1.0);

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);
    this.input = new THREE.Vector2(); // objetivo del paralaje, -1…1
    this.smooth = new THREE.Vector2(); // paralaje suavizado
    this.scroll = 0; // 0 = hero completo, 1 = sección siguiente
    this.scrollSmooth = 0;
    this.tilt = 0;
    this.target = new THREE.Vector3();
    this.initPointer();
    this.initGyro();
  }

  /** Encuadre según la proporción: en vertical se abre el campo para que quepan catedral y torre. */
  resize(width, height) {
    const aspect = width / height;
    const cam = this.camera;
    cam.aspect = aspect;
    if (aspect >= 1.5) {
      cam.fov = 46;
    } else if (aspect >= 1) {
      cam.fov = THREE.MathUtils.lerp(56, 46, (aspect - 1) / 0.5);
    } else {
      // Retrato: asegura ~37° de campo horizontal sin pasar de 74° en vertical.
      const v = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(18.5)) / aspect));
      cam.fov = THREE.MathUtils.clamp(v, 56, 74);
    }
    // Inclinación hacia arriba: más cielo en vertical (el cielo es el protagonista).
    this.tilt = aspect < 1 ? 3.5 : 2.2;
    cam.updateProjectionMatrix();
  }

  initPointer() {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch' && this.gyroActive) return;
        this.input.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
        // En táctil el paralaje es más suave (es solo el respaldo del giroscopio).
        if (e.pointerType === 'touch') this.input.multiplyScalar(0.5);
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => this.input.set(0, 0));
  }

  /**
   * Giroscopio: en Android funciona directamente; en iOS hace falta pedir permiso con un gesto.
   * Si no hay permiso, queda el paralaje táctil y la deriva automática.
   */
  initGyro() {
    if (REDUCED_MOTION || typeof DeviceOrientationEvent === 'undefined') return;
    this.base = null;
    const onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      this.gyroActive = true;
      let x = e.gamma;
      let y = e.beta;
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      if (angle === 90) [x, y] = [y, -x];
      else if (angle === -90 || angle === 270) [x, y] = [-y, x];
      // La referencia sigue despacio a la postura de la mano: el centro se recoloca solo.
      if (!this.base) this.base = { x, y };
      this.base.x += (x - this.base.x) * 0.01;
      this.base.y += (y - this.base.y) * 0.01;
      this.input.set(
        THREE.MathUtils.clamp((x - this.base.x) / 14, -1, 1),
        THREE.MathUtils.clamp((y - this.base.y) / 14, -1, 1),
      );
    };
    const listen = () => window.addEventListener('deviceorientation', onOrient);
    const needsPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!needsPermission) {
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

  update(t, dt) {
    if (!REDUCED_MOTION) this.smooth.lerp(this.input, 1 - Math.exp(-dt / 0.9));
    this.scrollSmooth += (this.scroll - this.scrollSmooth) * (1 - Math.exp(-dt / 0.25));

    // Deriva continua, lentísima (se apaga con prefers-reduced-motion).
    const drift = REDUCED_MOTION ? 0 : 1;
    const dx = Math.sin(t * 0.043) * 0.16 * drift;
    const dy = Math.sin(t * 0.031 + 1.0) * 0.035 * drift;
    const yaw = Math.sin(t * 0.027 + 0.4) * 0.6 * drift;

    const cam = this.camera;
    const s = this.scrollSmooth;
    cam.position.set(
      EYE.x + dx + this.smooth.x * 0.2,
      EYE.y + dy - this.smooth.y * 0.07 - s * 0.62, // el scroll baja la cámara tras la balaustrada
      EYE.z,
    );
    const yawRad = THREE.MathUtils.degToRad(yaw + this.smooth.x * 1.1);
    const pitch = THREE.MathUtils.degToRad(this.tilt - this.smooth.y * 0.6 - s * 3.5);
    this.target.set(
      cam.position.x + Math.sin(yawRad) * 60,
      cam.position.y + Math.tan(pitch) * 60,
      cam.position.z - Math.cos(yawRad) * 60,
    );
    cam.lookAt(this.target);
  }
}
