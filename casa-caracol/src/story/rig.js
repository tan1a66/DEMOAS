import * as THREE from 'three';
import { MATCH_CUT } from './matchcut.js';
import { setFrustum, coverFrustum, fitTan } from '../gl/projection.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Recorrido de la cámara: de la vista casi cenital (intro) a la pose del match cut,
//  bajando a la arena y girando alrededor de la concha. La pose final sale SIEMPRE
//  de MATCH_CUT, así lo que se ajusta en ?debug se respeta al milímetro.
// ─────────────────────────────────────────────────────────────────────────────

const DEG = THREE.MathUtils.DEG2RAD;
const UP = new THREE.Vector3(0, 1, 0);

// Vista inicial: casi desde arriba, el mar arriba en pantalla (lado -z).
export const INTRO = {
  target: [0, 0.3, 0.55], // punto mirado (desplazado hacia la playa: la concha queda algo por encima del centro)
  elevation: 76, // grados sobre el horizonte
  azimuth: 0,
  distance: 11,
  fit: [2.7, 3.4], // caja de arena que debe caber en pantalla (ancho, alto)
};

export const PATH = {
  bulge: 0.75, // cuánto se abre el giro a media bajada (evita atravesar la concha)
  push: { zoom: 0.085, roll: -2.2, pitch: 1.4 }, // movimiento continuo durante el corte
};

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutSine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = THREE.MathUtils.lerp;
const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const toCyl = (v) => ({ r: Math.hypot(v.x, v.z), a: Math.atan2(v.x, v.z), y: v.y });

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.aspect = 1;
    this.photoAspect = 4 / 3;
    this.pos0 = new THREE.Vector3();
    this.target0 = new THREE.Vector3();
    this.pos2 = new THREE.Vector3();
    this.target2 = new THREE.Vector3();
    this.quat2 = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._fwd = new THREE.Vector3();
    this._axisX = new THREE.Vector3(1, 0, 0);
    this._axisZ = new THREE.Vector3(0, 0, 1);
    this.invalidate();
  }

  setAspect(aspect) {
    this.aspect = aspect;
    this.invalidate();
  }

  setPhotoAspect(aspect) {
    this.photoAspect = aspect;
    this.invalidate();
  }

  // Recalcula los puntos clave (cambio de pantalla o de valores del match cut).
  invalidate() {
    const I = INTRO;
    this.target0.fromArray(I.target);
    const el = I.elevation * DEG;
    const az = I.azimuth * DEG;
    this.pos0
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .multiplyScalar(I.distance)
      .add(this.target0);
    this.tan0 = fitTan(I.fit[0], I.fit[1], I.distance, this.aspect);

    const c = MATCH_CUT.camera;
    this.pos2.fromArray(c.position);
    this.euler.set(c.rotation[0] * DEG, c.rotation[1] * DEG, c.rotation[2] * DEG, 'YXZ');
    this.quat2.setFromEuler(this.euler);
    this._fwd.set(0, 0, -1).applyQuaternion(this.quat2);
    this.target2.copy(this.pos2).addScaledVector(this._fwd, 1);
    this.crop2 = coverFrustum(c.fov, this.photoAspect, this.aspect, MATCH_CUT.photo.focus);

    this.cyl0 = toCyl(this.pos0);
    this.cyl2 = toCyl(this.pos2);
    this.sweep = wrapPi(this.cyl2.a - this.cyl0.a);
  }

  get photoPose() {
    return { quaternion: this.quat2, fov: MATCH_CUT.camera.fov };
  }

  // descent 0–1, push 0–1, settle 1→0 (aterrizaje tras el loader), lock = pose exacta del corte
  update({ descent = 0, push = 0, settle = 0, time = 0, reduced = false, lock = false }) {
    const cam = this.camera;
    let e = clamp01(descent);
    if (reduced) e = e < 0.5 ? 0 : 1;
    if (lock) {
      e = 1;
      push = 0;
    }

    // ── posición: coordenadas cilíndricas alrededor del eje de la concha ──
    const { cyl0, cyl2 } = this;
    const drift = reduced || lock ? 0 : (1 - smooth(0, 0.15, e));
    const y0 = cyl0.y + settle * 1.8;
    const y = logLerp(y0 + 0.35, cyl2.y + 0.35, easeInOutCubic(e) * 0.82 + e * 0.18) - 0.35;
    const r = lerp(cyl0.r, cyl2.r, smooth(0, 1, e)) + PATH.bulge * Math.sin(Math.PI * e) ** 1.4;
    const a = cyl0.a + this.sweep * easeInOutSine(e) + drift * 0.035 * Math.sin(time * 0.17);
    this._p.set(Math.sin(a) * r, y, Math.cos(a) * r);
    if (drift > 0) this._p.y += drift * 0.06 * Math.sin(time * 0.23 + 1.3);

    // ── orientación: mirar al objetivo y fundirse con la rotación exacta del corte ──
    this._t.lerpVectors(this.target0, this.target2, smooth(0.2, 0.95, e));
    this._m.lookAt(this._p, this._t, UP);
    this._q.setFromRotationMatrix(this._m);
    this._q.slerp(this.quat2, smooth(0.7, 1, e));

    // ── movimiento continuo durante el fundido (zoom + alabeo + inclinación) ──
    // Se aplica igual a la foto (que está "en el infinito"): ambas capas se mueven juntas.
    const pe = easeInOutSine(push);
    if (pe > 0) {
      this._q2.setFromAxisAngle(this._axisX, PATH.push.pitch * DEG * pe);
      this._q.multiply(this._q2);
      this._q2.setFromAxisAngle(this._axisZ, PATH.push.roll * DEG * pe);
      this._q.multiply(this._q2);
    }

    cam.position.copy(this._p);
    cam.quaternion.copy(this._q);
    cam.updateMatrixWorld(true);

    // ── proyección: del encuadre de la intro al recorte "cover" de la foto ──
    const zoom = 1 + PATH.push.zoom * pe;
    const tan0 = this.tan0 * (1 + settle * 0.05);
    const tanV = logLerp(tan0, this.crop2.tanV, smooth(0.1, 0.96, e)) / zoom;
    const sh = smooth(0.7, 1, e);
    this.topRayY = this._fwd.set(0, 0.68 * tanV + this.crop2.shiftY * sh, -1).normalize().applyQuaternion(this._q).y;
    setFrustum(cam, {
      tanV,
      aspect: this.aspect,
      shiftX: this.crop2.shiftX * sh,
      shiftY: this.crop2.shiftY * sh,
    });
  }
}
