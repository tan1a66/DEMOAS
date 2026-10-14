// ─────────────────────────────────────────────────────────────────────────────
//  Impaginazione 3D dell'apertura: dove stanno la scritta e la fascia di lino
//  rispetto alla camera (in orizzontale e in verticale).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import paths from '../data/thread-paths.json';
import { THREAD } from '../config.js';

// Punto del piano z = planeZ visto in (ndcX, ndcY) dalla camera
export function ndcToPlane(camera, ndcX, ndcY, planeZ) {
  const p = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = p.sub(camera.position).normalize();
  const t = (planeZ - camera.position.z) / dir.z;
  return camera.position.clone().addScaledVector(dir, t);
}

/**
 * Scala e centro della scritta perché occupi il rettangolo voluto, più il
 * rettangolo della fascia di lino che la contiene.
 * @param camera  camera nella posa finale dell'apertura
 * @param frame   { layout: 'wide'|'tall', centerY (NDC), width (metà larghezza in NDC),
 *                  maxHeight (NDC), bandWidth (metà larghezza della fascia in NDC), marginEm }
 */
export function placeText(camera, frame) {
  const L = paths.layouts[frame.layout];
  const [x1, y1, x2, y2] = L.bbox;
  const planeZ = THREAD.planeZ;
  const left = ndcToPlane(camera, -frame.width, frame.centerY, planeZ);
  const right = ndcToPlane(camera, frame.width, frame.centerY, planeZ);
  const top = ndcToPlane(camera, 0, frame.centerY + frame.maxHeight / 2, planeZ);
  const bottom = ndcToPlane(camera, 0, frame.centerY - frame.maxHeight / 2, planeZ);
  const scale = Math.min((right.x - left.x) / (x2 - x1), (top.y - bottom.y) / (y2 - y1));
  const center = ndcToPlane(camera, 0, frame.centerY, planeZ);
  const cam = camera.clone();

  // fascia di lino: larga quasi quanto lo schermo, alta quanto la scritta + margini
  const bandL = ndcToPlane(camera, -frame.bandWidth, frame.centerY, planeZ);
  const bandR = ndcToPlane(camera, frame.bandWidth, frame.centerY, planeZ);
  const band = {
    width: bandR.x - bandL.x,
    height: (y2 - y1) * scale + 2 * frame.marginEm * scale,
    origin: new THREE.Vector3(center.x, center.y, planeZ), // centro della fascia (= centro della scritta)
  };

  return {
    layout: frame.layout,
    scale, // metri per em
    planeZ,
    band,
    emCenter: [(x1 + x2) / 2, (y1 + y2) / 2],
    // em → coordinate locali della fascia (origine al centro, metri)
    toLocal: (x, y) => new THREE.Vector2((x - (x1 + x2) / 2) * scale, (y - (y1 + y2) / 2) * scale),
    ndcToWorld: (x, y, z) => ndcToPlane(cam, x, y, z),
    toNdc: (v) => v.clone().project(cam),
    bandBottomWorld: new THREE.Vector3(center.x, center.y - band.height / 2, planeZ),
  };
}
