import * as THREE from 'three';

/*
  Geometria condivisa con i render di Blender (render/villa.py e render/interni.py).
  Coordinate della villa: x verso la strada (est), y quota, z verso sud. Sono destrorse con y in alto,
  quindi in three.js si usano così come sono: le camere qui sotto sono le stesse dei render, e i punti
  (passi, finiture, ingressi) definiti in 3D cadono esattamente sulle immagini.
*/

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Camera del fotogramma (anche frazionario) del giro esterno, come orbit_camera() in villa.py. */
export function orbitCamera(orbit, frame) {
  const [cx, , cz] = orbit.center;
  const a = Math.PI + (2 * Math.PI * frame) / orbit.frames;
  const pos = new THREE.Vector3(cx + Math.cos(a) * orbit.radius, orbit.height, cz - Math.sin(a) * orbit.radius);
  const [w, h] = orbit.size;
  const hfov = 2 * Math.atan(orbit.sensor / 2 / orbit.lens);
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / (w / h));
  const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(vfov), w / h, 0.1, 5000);
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(v3(orbit.target));
  cam.updateMatrixWorld(true);
  return cam;
}

/** Proietta un punto 3D in pixel dell'immagine del giro (w × h); null se dietro la camera. */
export function projectOrbit(cam, point, w, h) {
  const p = v3(point).applyMatrix4(cam.matrixWorldInverse);
  if (p.z > -0.1) return null;
  p.applyMatrix4(cam.projectionMatrix);
  return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
}

/** Il punto è rivolto verso la camera? (ingresso visibile da questo lato della casa) */
export function faces(cam, point, normal) {
  const d = cam.position.clone().sub(v3(point)).normalize();
  return d.dot(v3(normal).normalize()) > 0.15;
}

/**
  Panorama equirettangolare: il centro dell'immagine guarda verso `look` (in orizzontale), la destra
  dell'immagine è la destra dello sguardo. Il rivestimento sferico va ruotato attorno a y di:
*/
export function panoYaw(pano) {
  const fx = pano.look[0] - pano.pos[0];
  const fz = pano.look[2] - pano.pos[2];
  // la sfera di three.js (scale -1 su x) ha il centro dell'immagine verso -X: lo portiamo su (fx, fz)
  return Math.atan2(fz, -fx);
}

/** Direzione (lon, lat) dal centro del panorama verso un punto 3D; lon = atan2(z, x) in coordinate villa. */
export function lonLatTo(pano, point) {
  const dx = point[0] - pano.pos[0];
  const dy = point[1] - pano.pos[1];
  const dz = point[2] - pano.pos[2];
  return { lon: Math.atan2(dz, dx), lat: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** Sguardo iniziale del panorama (verso `look`). */
export function lookLonLat(pano) {
  return { lon: Math.atan2(pano.look[2] - pano.pos[2], pano.look[0] - pano.pos[0]), lat: 0 };
}

export const dirFromLonLat = (lon, lat, out = new THREE.Vector3()) =>
  out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
