/**
 * Entrada compartida para la cámara de las fotos 2.5D: ratón en escritorio, giroscopio en móvil.
 * Valores normalizados en [-1, 1] (x: izquierda → derecha, y: arriba → abajo).
 */

const target = { x: 0, y: 0 };
let listening = false;
let gyroBase: { beta: number; gamma: number } | null = null;
let gyroActive = false;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function onPointer(e: PointerEvent) {
  if (gyroActive || e.pointerType === 'touch') return;
  target.x = clamp((e.clientX / window.innerWidth) * 2 - 1);
  target.y = clamp((e.clientY / window.innerHeight) * 2 - 1);
}

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta === null || e.gamma === null) return;
  // La posición en la que se sostiene el teléfono al empezar es el centro.
  if (!gyroBase) gyroBase = { beta: e.beta, gamma: e.gamma };
  gyroActive = true;
  target.x = clamp((e.gamma - gyroBase.gamma) / 22);
  target.y = clamp((e.beta - gyroBase.beta) / 22);
}

export function listenMotion() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('deviceorientation', onOrientation, { passive: true });
}

export function motionTarget(): Readonly<{ x: number; y: number }> {
  return target;
}

type OrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS pide permiso para el giroscopio y solo dentro de un gesto (el toque en ENTRAR).
 * En el resto de navegadores no hace nada. Si se niega, queda la deriva lenta y el desplazamiento.
 */
export function requestMotionPermission() {
  const D = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as OrientationWithPermission | undefined;
  if (D?.requestPermission) {
    D.requestPermission()
      .then((r) => {
        if (r === 'granted') listenMotion();
      })
      .catch(() => {
        /* sin permiso: deriva automática */
      });
  }
}
