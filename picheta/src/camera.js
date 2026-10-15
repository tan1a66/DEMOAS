// Cámara: la película de entrada (cocina → cielo → terraza, ver intro.js) y después los ojos de
// una persona sentada en la terraza. Deriva lentísima + paralaje (ratón en escritorio,
// giroscopio en móvil). Con el scroll vuelve a asomarse al patio, hacia el fuego.

import * as THREE from 'three';
import { REDUCED_MOTION } from './config.js';
import { INTRO_KEYS, INTRO_END, SCROLL_KEYS, makePath } from './intro.js';
import { PointerInput } from './pointer.js';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);
    this.input = new THREE.Vector2(); // objetivo del paralaje, -1…1
    this.smooth = new THREE.Vector2(); // paralaje suavizado
    this.scroll = 0; // 0 = hero completo, 1 = sección siguiente
    this.scrollSmooth = 0;
    this.tilt = 0;
    this.introT = INTRO_END; // segundos de película; INTRO_END = ya sentados
    this.target = new THREE.Vector3();
    this.base = new THREE.Vector3();
    this.paths = null;
    this.pointer = new PointerInput();
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
    this.paths = { intro: makePath(INTRO_KEYS, this.tilt), scroll: makePath(SCROLL_KEYS, this.tilt) };
  }

  update(t, dt) {
    this.input.set(this.pointer.x, this.pointer.y);
    if (!REDUCED_MOTION) this.smooth.lerp(this.input, 1 - Math.exp(-dt / 0.9));
    this.scrollSmooth += (this.scroll - this.scrollSmooth) * (1 - Math.exp(-dt / 0.25));
    const s = this.scrollSmooth;

    // Pose base: la película mientras dura; después, la terraza (y el patio con el scroll).
    let pitch;
    let yaw;
    const inIntro = this.introT < INTRO_END;
    if (inIntro) {
      const p = this.paths.intro;
      p.pos.at(this.introT, this.base);
      pitch = p.pitch.at(this.introT);
      yaw = p.yaw.at(this.introT);
    } else {
      const p = this.paths.scroll;
      p.pos.at(s, this.base);
      pitch = p.pitch.at(s);
      yaw = p.yaw.at(s);
    }

    // Deriva y paralaje: entran suavemente al final de la película y se apagan con el scroll.
    const settle = inIntro ? THREE.MathUtils.smoothstep(this.introT, INTRO_END - 1.4, INTRO_END) : 1;
    const w = REDUCED_MOTION ? 0 : settle * (1 - s);
    const dx = Math.sin(t * 0.043) * 0.16 * w;
    const dy = Math.sin(t * 0.031 + 1.0) * 0.035 * w;
    yaw += (Math.sin(t * 0.027 + 0.4) * 0.6 + this.smooth.x * 1.1) * w;
    pitch -= this.smooth.y * 0.6 * w;

    const cam = this.camera;
    cam.position.set(this.base.x + dx + this.smooth.x * 0.2 * w, this.base.y + dy - this.smooth.y * 0.07 * w, this.base.z);
    const yawRad = THREE.MathUtils.degToRad(yaw);
    const pitchRad = THREE.MathUtils.degToRad(pitch);
    this.target.set(
      cam.position.x + Math.sin(yawRad) * Math.cos(pitchRad) * 60,
      cam.position.y + Math.sin(pitchRad) * 60,
      cam.position.z - Math.cos(yawRad) * Math.cos(pitchRad) * 60,
    );
    cam.lookAt(this.target);
  }
}
