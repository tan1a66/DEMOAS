// La camera: segue la strada su una CatmullRomCurve3 lisciata (sempre in quota, mai radente),
// oppure si fonde con un'inquadratura fissa ("drone", soste, cima). Tutto è guidato da `state`,
// che la timeline dello scroll anima; qui si trasforma lo stato in posizione + orientamento.
import { CatmullRomCurve3, Vector3, Quaternion, Matrix4, MathUtils } from 'three';
import { CONFIG } from '../config.js';
import { groundMax } from './clearance.js';

const UP = new Vector3(0, 1, 0);
const ds = 10; // passo di campionamento del tracciato (m)

function gauss(arr, sigma) {
  if (sigma <= 0) return Float64Array.from(arr);
  const r = Math.ceil(sigma * 3), n = arr.length;
  const k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const w = Math.exp(-0.5 * (i / sigma) ** 2); k.push(w); sum += w; }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let j = -r; j <= r; j++) v += arr[Math.min(Math.max(i + j, 0), n - 1)] * k[j + r];
    out[i] = v / sum;
  }
  return out;
}

function poseFrom(road, p) {
  if (p.pos) return { pos: new Vector3(...p.pos), target: new Vector3(...p.target) };
  // posa relativa alla strada: dietro e sopra il punto roadS, guardando roadS + lookS
  const a = road.at(p.roadS, new Vector3());
  const b = road.at(p.roadS + 20, new Vector3());
  const back = a.clone().sub(b).setY(0).normalize().multiplyScalar(p.back);
  return { pos: a.clone().add(back).add(new Vector3(0, p.up, 0)), target: road.at(p.lookS, new Vector3()) };
}

export class CameraRig {
  constructor(camera, road, hf) {
    this.camera = camera;
    this.road = road;
    this.hf = hf;
    this.L = road.length;
    const c = CONFIG.camera;
    this.poses = Object.fromEntries(Object.entries(c.poses).map(([k, p]) => [k, poseFrom(road, p)]));

    // stato animato dalla timeline
    const start = this.poses.start;
    this.state = {
      camS: 0,        // metri percorsi lungo la strada dalla cima
      dir: 1,         // 1 = si guarda verso il mare (discesa), -1 = verso la cima (salita)
      drone: 1,       // 0 = segue la strada, 1 = inquadratura fissa `sp`
      stop: 0,        // 1 = sosta a 360° attiva
      rider: 0,       // visibilità del punto arancione
      sp: { px: start.pos.x, py: start.pos.y, pz: start.pos.z, tx: start.target.x, ty: start.target.y, tz: start.target.z },
    };
    this.look = { yaw: 0, pitch: 0 }; // offset dell'utente (trascinamento / giroscopio)

    this._build();
    this._m = new Matrix4();
    this._q1 = new Quaternion();
    this._q2 = new Quaternion();
    this._qy = new Quaternion();
    this._qp = new Quaternion();
    this._v = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  }

  _build() {
    const { road, hf, L } = this;
    const c = CONFIG.camera;
    const n = Math.floor(L / ds) + 1;
    const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
    const p = new Vector3();
    for (let i = 0; i < n; i++) {
      road.at(Math.min(i * ds, L), p);
      xs[i] = p.x; ys[i] = p.y; zs[i] = p.z;
    }
    // punto di mira: la strada appena lisciata
    const lx = gauss(xs, c.lookSmoothing / ds), lz = gauss(zs, c.lookSmoothing / ds), ly = gauss(ys, 2);
    this.lookCurve = new CatmullRomCurve3(Array.from({ length: n }, (_, i) => new Vector3(lx[i], ly[i] + 3, lz[i])), false, 'centripetal');

    // tracciato della camera: molto lisciato in pianta, in quota sopra strada e terreno
    const tx = gauss(xs, c.trackSmoothing / ds), tz = gauss(zs, c.trackSmoothing / ds), ty = gauss(ys, 40 / ds);
    const target = new Vector3(), pos = new Vector3(), q = new Vector3();
    this.track = {};
    for (const dir of [1, -1]) {
      const need = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let y = Math.max(ty[i] + c.height, groundMax(hf, tx[i], tz[i], 35) + c.minClearance);
        // linea di vista libera verso il punto di mira
        this.lookCurve.getPoint(MathUtils.clamp(i * ds + dir * c.lookAhead, 0, L) / L, target);
        pos.set(tx[i], y, tz[i]);
        let raise = 0;
        for (let k = 1; k <= 24; k++) {
          const t = (k / 24) * 0.85;
          q.lerpVectors(pos, target, t);
          const d = hf.height(q.x, q.z) + 5 - q.y;
          if (d > 0) raise = Math.max(raise, d / (1 - t));
        }
        need[i] = y + raise;
      }
      // inviluppo superiore lisciato: niente sobbalzi, e non scende mai sotto il necessario
      let y = Float64Array.from(need);
      for (let it = 0; it < 5; it++) {
        const g = gauss(y, 60 / ds);
        for (let i = 0; i < n; i++) y[i] = Math.max(g[i], need[i]);
      }
      y = gauss(y, 2);
      const pts = Array.from({ length: n }, (_, i) => new Vector3(tx[i], y[i] + 2, tz[i]));
      this.track[dir] = new CatmullRomCurve3(pts, false, 'centripetal');
    }
  }

  /** posizione sulla strada del "ciclista" (punto arancione) e testa della linea */
  riderS() {
    const s = this.state;
    return MathUtils.clamp(s.camS + s.dir * CONFIG.camera.riderAhead, 0, this.L);
  }

  _lookQuat(pos, target, out) {
    this._m.lookAt(pos, target, UP);
    return out.setFromRotationMatrix(this._m);
  }

  update() {
    const s = this.state, c = CONFIG.camera, L = this.L;
    const [fp, tgt, sp, st, tmp] = this._v;
    const t = MathUtils.clamp(s.camS, 0, L) / L;

    // segui-strada (in discesa e in salita il tracciato può differire: si fondono)
    this.track[1].getPoint(t, fp);
    if (s.dir < 1) {
      this.track[-1].getPoint(t, tmp);
      fp.lerp(tmp, (1 - s.dir) / 2);
    }
    this.lookCurve.getPoint(MathUtils.clamp(s.camS + s.dir * c.lookAhead, 0, L) / L, tgt);
    this._lookQuat(fp, tgt, this._q1);

    // inquadratura fissa
    sp.set(s.sp.px, s.sp.py, s.sp.pz);
    st.set(s.sp.tx, s.sp.ty, s.sp.tz);
    this._lookQuat(sp, st, this._q2);

    const d = s.drone;
    const pos = this.camera.position;
    if (d <= 0) pos.copy(fp);
    else if (d >= 1) pos.copy(sp);
    else {
      pos.lerpVectors(fp, sp, d);
      pos.y += Math.sin(Math.PI * d) * Math.min(fp.distanceTo(sp) * 0.12, 120); // arco: mai attraverso il monte
    }
    // margine minimo sul terreno, sempre
    const g = groundMax(this.hf, pos.x, pos.z, 18) + 10;
    if (pos.y < g) pos.y = g;

    const q = this.camera.quaternion;
    q.slerpQuaternions(this._q1, this._q2, d);

    // sguardo libero nelle soste (yaw attorno alla verticale, pitch attorno all'asse locale x)
    if (this.look.yaw !== 0 || this.look.pitch !== 0) {
      const fwd = tmp.set(0, 0, -1).applyQuaternion(q);
      const basePitch = Math.asin(MathUtils.clamp(fwd.y, -1, 1));
      const lim = c.look;
      const pitch = MathUtils.clamp(basePitch + this.look.pitch, MathUtils.degToRad(lim.pitchMin), MathUtils.degToRad(lim.pitchMax)) - basePitch;
      this._qy.setFromAxisAngle(UP, this.look.yaw);
      this._qp.setFromAxisAngle(tmp.set(1, 0, 0), pitch);
      q.premultiply(this._qy).multiply(this._qp);
    }
    this.camera.updateMatrixWorld();
  }
}
