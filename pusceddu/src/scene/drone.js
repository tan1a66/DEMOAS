import * as THREE from 'three';

// Camera "drone": segue una curva tra i fotogrammi chiave, con inerzia, leggero
// ondeggiamento in volo, inclinazione nelle virate e spostamento ottico (lens shift)
// per lasciare spazio ai testi senza spostare l'opera fuori asse.

const smooth = (t) => t * t * (3 - 2 * t);
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();

export class Drone {
  constructor(camera) {
    this.camera = camera;
    this.u = 0;
    this.roll = 0;
    this.time = 0;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.motion = 1; // 0 con prefers-reduced-motion
    this.override = null; // { position, target, sx, sy, fov } durante l'intro
    this.prevPos = new THREE.Vector3();
    this.current = { position: new THREE.Vector3(), target: new THREE.Vector3(), sx: 0, sy: 0, fov: 34, fog: [20, 40] };
  }

  setKeyframes(kfs) {
    this.kfs = kfs;
    this.posCurve = new THREE.CatmullRomCurve3(kfs.map((k) => k.position), false, 'centripetal');
    this.targetCurve = new THREE.CatmullRomCurve3(kfs.map((k) => k.target), false, 'centripetal');
  }

  get count() {
    return this.kfs.length;
  }

  sample(u, out = this.current) {
    const n = this.kfs.length - 1;
    u = THREE.MathUtils.clamp(u, 0, n);
    const t = u / n;
    this.posCurve.getPoint(t, out.position);
    this.targetCurve.getPoint(t, out.target);
    const i = Math.min(Math.floor(u), n - 1);
    const f = smooth(u - i);
    const a = this.kfs[i];
    const b = this.kfs[i + 1];
    out.sx = a.sx + (b.sx - a.sx) * f;
    out.sy = a.sy + (b.sy - a.sy) * f;
    out.fov = a.fov + (b.fov - a.fov) * f;
    out.fog = [a.fog[0] + (b.fog[0] - a.fog[0]) * f, a.fog[1] + (b.fog[1] - a.fog[1]) * f];
    return out;
  }

  // targetU: posizione desiderata (dallo scroll); dt in secondi.
  update(targetU, dt) {
    this.time += dt;
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 2.6);
    this.u += (targetU - this.u) * k;
    if (Math.abs(targetU - this.u) < 1e-4) this.u = targetU;

    const s = this.override ?? this.sample(this.u);
    cam.position.copy(s.position);

    // Ondeggiamento da drone in hovering (molto lieve) + parallasse del puntatore.
    const m = this.motion;
    const t = this.time;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    cam.position.x += m * (Math.sin(t * 0.63) * 0.012 + Math.sin(t * 1.37) * 0.004);
    cam.position.y += m * (Math.sin(t * 0.81 + 1.1) * 0.01);
    cam.position.z += m * (Math.sin(t * 0.52 + 2.3) * 0.012);
    cam.lookAt(s.target);
    cam.translateX(m * this.pointerSmooth.x * 0.06);
    cam.translateY(m * this.pointerSmooth.y * 0.04);
    cam.lookAt(s.target);

    // Inclinazione nelle virate: proporzionale alla velocità laterale.
    const right = _right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const lateral = dt > 0 ? _delta.subVectors(cam.position, this.prevPos).dot(right) / dt : 0;
    this.prevPos.copy(cam.position);
    const rollTarget = THREE.MathUtils.clamp(-lateral * 0.012, -0.05, 0.05) * m;
    this.roll += (rollTarget - this.roll) * (1 - Math.exp(-dt * 3));
    cam.rotateZ(this.roll);

    if (Math.abs(cam.fov - s.fov) > 1e-3) cam.fov = s.fov;
    cam.updateProjectionMatrix();
    // Lens shift: il punto osservato appare in (sx, sy) in coordinate normalizzate.
    cam.projectionMatrix.elements[8] = -s.sx;
    cam.projectionMatrix.elements[9] = -s.sy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this.current.target.copy(s.target);
    this.current.fog = s.fog;
    return s;
  }
}
