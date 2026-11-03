// La camera: un drone in hovering. Passa lentamente da un'inquadratura all'altra (le anima la
// timeline dello scroll); nelle soste si può guardare attorno. Le inquadrature si interpolano
// per angoli (rotta e inclinazione), non per punto guardato: la rotazione resta uniforme.
// Uno stabilizzatore (come un gimbal) smorza ogni rotazione residua.
import { Vector3, Quaternion, Euler, MathUtils } from 'three';
import { CONFIG } from '../config.js';
import { groundMax } from './clearance.js';

const UP = new Vector3(0, 1, 0);

/** {pos, target} → {pos, target, yaw, pitch} (la camera guarda lungo −Z) */
export function withAngles(pose) {
  const d = pose.target.clone().sub(pose.pos);
  pose.yaw = Math.atan2(-d.x, -d.z);
  pose.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  return pose;
}

function poseFrom(road, p) {
  if (p.pos) return withAngles({ pos: new Vector3(...p.pos), target: new Vector3(...p.target) });
  // posa relativa alla strada: dietro e sopra il punto roadS, guardando roadS + lookS
  const a = road.at(p.roadS, new Vector3());
  const b = road.at(p.roadS + 20, new Vector3());
  const back = a.clone().sub(b).setY(0).normalize().multiplyScalar(p.back);
  return withAngles({ pos: a.clone().add(back).add(new Vector3(0, p.up, 0)), target: road.at(p.lookS, new Vector3()) });
}

/** la stessa inquadratura, appena più vicina al soggetto (il lento avanzare del drone) */
export function drifted(pose, k = CONFIG.camera.drift) {
  return withAngles({ pos: pose.pos.clone().lerp(pose.target, k), target: pose.target.clone() });
}

export class CameraRig {
  constructor(camera, road, hf) {
    this.camera = camera;
    this.road = road;
    this.hf = hf;
    this.L = road.length;
    this.poses = Object.fromEntries(Object.entries(CONFIG.camera.poses).map(([k, p]) => [k, poseFrom(road, p)]));

    const start = this.poses.start;
    // stato animato dalla timeline
    this.state = {
      sp: { px: start.pos.x, py: start.pos.y, pz: start.pos.z, yaw: start.yaw, pitch: start.pitch },
      stop: 0,        // 1 = sosta a 360° attiva
      dir: 1,         // 1 = discesa, -1 = salita
      lineS: CONFIG.story.introLine, // discesa: fin dove è disegnata la linea (m dal Coll)
      climbS: this.L, // salita: fin dove è arrivato il ciclista (m dal Coll; parte dal porto)
      dim: 0,         // in salita la linea della discesa si attenua (0…1)
      rider: 0,       // visibilità del punto arancione
    };
    this.look = { yaw: 0, pitch: 0 }; // offset dell'utente (trascinamento / giroscopio)

    this._e = new Euler(0, 0, 0, 'YXZ');
    this._q = new Quaternion();
    this._qa = new Quaternion();
    this._qSmooth = new Quaternion();
    this._v = new Vector3();
    this._first = true;
  }

  /** dov'è il punto arancione: in testa alla linea in discesa, al ciclista in salita */
  riderS() {
    const s = this.state;
    return MathUtils.clamp(s.dir > 0 ? s.lineS : s.climbS, 0, this.L);
  }

  update(dt = 1 / 60) {
    const s = this.state, c = CONFIG.camera;
    const pos = this.camera.position.set(s.sp.px, s.sp.py, s.sp.pz);
    const g = groundMax(this.hf, pos.x, pos.z, 18) + 12; // mai dentro il monte
    if (pos.y < g) pos.y = g;

    const q = this._q.setFromEuler(this._e.set(s.sp.pitch, s.sp.yaw, 0, 'YXZ'));
    // sguardo libero nelle soste (yaw attorno alla verticale, pitch attorno all'asse locale x)
    if (this.look.yaw !== 0 || this.look.pitch !== 0) {
      const lim = c.look;
      const pitch = MathUtils.clamp(s.sp.pitch + this.look.pitch, MathUtils.degToRad(lim.pitchMin), MathUtils.degToRad(lim.pitchMax)) - s.sp.pitch;
      q.premultiply(this._qa.setFromAxisAngle(UP, this.look.yaw));
      q.multiply(this._qa.setFromAxisAngle(this._v.set(1, 0, 0), pitch));
    }
    if (this._first) { this._qSmooth.copy(q); this._first = false; }
    else this._qSmooth.slerp(q, 1 - Math.exp(-dt / c.gimbal));
    this.camera.quaternion.copy(this._qSmooth);
    this.camera.updateMatrixWorld();
  }
}
