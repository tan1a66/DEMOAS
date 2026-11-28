import * as THREE from 'three';

// Proyección con frustum explícito: FOV vertical (como tangente) + desplazamiento del
// centro óptico. Permite reproducir exactamente el recorte "cover" de una foto.

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export const setFrustum = (camera, { tanV, aspect, shiftX = 0, shiftY = 0 }) => {
  const n = camera.near;
  const tanH = tanV * aspect;
  const top = n * (tanV + shiftY);
  const bottom = n * (-tanV + shiftY);
  const right = n * (tanH + shiftX);
  const left = n * (-tanH + shiftX);
  camera.projectionMatrix.makePerspective(left, right, top, bottom, n, camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.aspect = aspect;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV));
};

// Recorte "cover" de una foto (FOV vertical completo de la foto, proporción de la foto)
// en una pantalla de proporción screenAspect. focus = punto de la foto que se intenta
// mantener centrado cuando sobra imagen (0–1, y hacia abajo).
export const coverFrustum = (photoFovDeg, photoAspect, screenAspect, focus = [0.5, 0.5]) => {
  const Tv = Math.tan(THREE.MathUtils.degToRad(photoFovDeg) / 2);
  const Th = Tv * photoAspect;
  let tanV;
  let tanH;
  if (screenAspect < photoAspect) {
    tanV = Tv;
    tanH = Tv * screenAspect;
  } else {
    tanH = Th;
    tanV = Th / screenAspect;
  }
  const slackX = Th - tanH;
  const slackY = Tv - tanV;
  return {
    tanV,
    aspect: screenAspect,
    shiftX: clamp((focus[0] - 0.5) * 2 * Th, -slackX, slackX),
    shiftY: clamp((0.5 - focus[1]) * 2 * Tv, -slackY, slackY),
  };
};

// FOV que encaja una caja de mundo (ancho × alto, a una distancia) en cualquier pantalla.
export const fitTan = (width, height, distance, aspect) =>
  Math.max(height / 2, width / 2 / aspect) / distance;
