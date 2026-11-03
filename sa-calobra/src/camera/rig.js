// La camera come un drone vero: segue la strada ma tiene la rotta.
// - posizione: tracciato molto lisciato (CatmullRomCurve3) che "taglia" i tornanti, in quota
// - direzione: la media della direzione della strada su qualche centinaio di metri; nei tornanti
//   le svolte a destra e a sinistra si annullano, quindi la camera ruota solo nelle curve grandi,
//   con un limite massimo di rotazione per metro percorso
// - stabilizzatore: un ammortizzatore (come un gimbal) smorza ogni rotazione residua
// Lo stato (`state`) lo anima la timeline dello scroll.
import { CatmullRomCurve3, Vector3, Quaternion, Matrix4, Euler, MathUtils } from 'three';
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

/** {pos, target} → {pos, yaw, pitch} (la camera guarda lungo −Z) */
export function withAngles(pose) {
  const d = pose.target.clone().sub(pose.pos);
  pose.yaw = Math.atan2(-d.x, -d.z);
  pose.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  return pose;
}

/** limita la variazione per campione (avanti e indietro, poi media): nessun punto supera `r` */
function slewLimit(arr, r) {
  const n = arr.length, f = new Float64Array(n), b = new Float64Array(n);
  f[0] = arr[0];
  for (let i = 1; i < n; i++) f[i] = f[i - 1] + MathUtils.clamp(arr[i] - f[i - 1], -r, r);
  b[n - 1] = arr[n - 1];
  for (let i = n - 2; i >= 0; i--) b[i] = b[i + 1] + MathUtils.clamp(arr[i] - b[i + 1], -r, r);
  for (let i = 0; i < n; i++) f[i] = (f[i] + b[i]) / 2;
  return f;
}

function poseFrom(road, p) {
  if (p.pos) return withAngles({ pos: new Vector3(...p.pos), target: new Vector3(...p.target) });
  // posa relativa alla strada: dietro e sopra il punto roadS, guardando roadS + lookS
  const a = road.at(p.roadS, new Vector3());
  const b = road.at(p.roadS + 20, new Vector3());
  const back = a.clone().sub(b).setY(0).normalize().multiplyScalar(p.back);
  return withAngles({ pos: a.clone().add(back).add(new Vector3(0, p.up, 0)), target: road.at(p.lookS, new Vector3()) });
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
      riderOff: CONFIG.camera.riderAhead, // il ciclista è sempre più in basso della camera (verso il mare)
      // inquadratura fissa: posizione + angoli (interpolare gli angoli, non il punto guardato,
      // dà una rotazione uniforme anche tra bersagli vicini e lontani)
      sp: { px: start.pos.x, py: start.pos.y, pz: start.pos.z, yaw: start.yaw, pitch: start.pitch },
    };
    this.look = { yaw: 0, pitch: 0 }; // offset dell'utente (trascinamento / giroscopio)

    this._m = new Matrix4();
    this._e = new Euler(0, 0, 0, 'YXZ');
    this._q1 = new Quaternion();
    this._q2 = new Quaternion();
    this._qy = new Quaternion();
    this._qp = new Quaternion();
    this._qSmooth = new Quaternion();
    this._first = true;
    this._v = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    this._build();
  }

  _build() {
    const { road, hf, L } = this;
    const c = CONFIG.camera;
    const n = Math.floor(L / ds) + 1;
    this.n = n;
    const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
    const p = new Vector3();
    for (let i = 0; i < n; i++) {
      road.at(Math.min(i * ds, L), p);
      xs[i] = p.x; ys[i] = p.y; zs[i] = p.z;
    }
    // oltre le estremità la strada si prolunga in linea retta (lungo la sua direzione finale):
    // così vicino al Coll e al porto la rotta non "ruota" verso un punto fermo
    const endDir = (s0, s1) => road.at(s1, new Vector3()).sub(road.at(s0, new Vector3())).normalize();
    const dEnd = endDir(L - 120, L), dStart = endDir(120, 0);
    const roadAt = (s, out) => {
      if (s > L) return road.at(L, out).addScaledVector(dEnd, s - L);
      if (s < 0) return road.at(0, out).addScaledVector(dStart, -s);
      return road.at(s, out);
    };

    // posizione: tracciato molto lisciato in pianta
    const tx = gauss(xs, c.trackSmoothing / ds), tz = gauss(zs, c.trackSmoothing / ds);
    const ty = gauss(ys, c.altitudeSmoothing / ds);
    const under = new Float64Array(n);
    for (let i = 0; i < n; i++) under[i] = Math.max(ty[i] + c.height, groundMax(hf, tx[i], tz[i], 50) + c.minClearance);

    this.track = {};
    this.yaw = {};
    this.pitch = {};
    this.stats = {};
    const q = new Vector3(), tgt = new Vector3();
    // un solo tracciato, verso il mare: in discesa il drone vola in avanti, in salita vola
    // all'indietro (precede il ciclista e guarda giù verso di lui, la valle e il mare)
    for (const dir of [1]) {
      // direzione: il drone guarda lungo la propria traiettoria lisciata, che passa per il centro
      // dei tornanti (la strada serpeggia attorno a quella linea e resta in vista)
      let hx = new Float64Array(n), hz = new Float64Array(n);
      const ahead = Math.round(c.lookAhead / ds);
      for (let i = 0; i < n; i++) {
        let j = i + dir * ahead, ex = 0, ez = 0;
        if (j > n - 1) { ex = (j - (n - 1)) * ds; j = n - 1; } else if (j < 0) { ex = j * ds; j = 0; }
        // oltre le estremità si prolunga lungo la direzione finale della strada
        const ox = j === n - 1 ? dEnd.x * ex : j === 0 ? dStart.x * -ex : 0;
        const oz = j === n - 1 ? dEnd.z * ex : j === 0 ? dStart.z * -ex : 0;
        const dx = tx[j] + ox - tx[i], dz = tz[j] + oz - tz[i], l = Math.hypot(dx, dz);
        if (l < 1e-3) { hx[i] = i ? hx[i - 1] : 0; hz[i] = i ? hz[i - 1] : -1; continue; }
        hx[i] = dx / l; hz[i] = dz / l;
      }
      let yaw = new Float64Array(n);
      const toYaw = () => {
        for (let i = 0; i < n; i++) {
          // la camera guarda lungo -Z: yaw tale che avanti = (−sin θ, −cos θ)
          let a = Math.atan2(-hx[i], -hz[i]);
          if (i > 0) { // continuità (niente salti di 2π)
            while (a - yaw[i - 1] > Math.PI) a -= 2 * Math.PI;
            while (a - yaw[i - 1] < -Math.PI) a += 2 * Math.PI;
          }
          yaw[i] = a;
        }
      };
      const maxRate = () => {
        let m = 0;
        for (let i = 1; i < n; i++) m = Math.max(m, Math.abs(yaw[i] - yaw[i - 1]));
        return MathUtils.radToDeg(m) * (100 / ds); // gradi ogni 100 m
      };
      // lisciatura ripetuta finché la rotazione resta sotto il limite (gradi per 100 m di strada)
      let it = 0;
      do {
        hx = gauss(hx, c.headingSmoothing / ds);
        hz = gauss(hz, c.headingSmoothing / ds);
        for (let i = 0; i < n; i++) { const l = Math.hypot(hx[i], hz[i]) || 1; hx[i] /= l; hz[i] /= l; }
        toYaw();
      } while (maxRate() > c.maxTurnRate && ++it < 12);
      // dove la strada torna su sé stessa (grandi anelli) la media non basta: limitatore finale
      yaw = gauss(slewLimit(yaw, MathUtils.degToRad(c.maxTurnRate) * (ds / 100)), 4);

      // quota: sopra il terreno e con la vista libera lungo la direzione di volo
      const need = Float64Array.from(under);
      for (let i = 0; i < n; i++) {
        roadAt(i * ds + dir * c.pitchAhead, tgt);
        const fx = -Math.sin(yaw[i]), fz = -Math.cos(yaw[i]);
        const dist = c.pitchAhead * 1.4;
        const end = new Vector3(tx[i] + fx * dist, tgt.y, tz[i] + fz * dist);
        let raise = 0;
        for (let k = 1; k <= 20; k++) {
          const t = (k / 20) * 0.85;
          q.set(tx[i], need[i], tz[i]).lerp(end, t);
          const d = hf.height(q.x, q.z) + 6 - q.y;
          if (d > 0) raise = Math.max(raise, d / (1 - t));
        }
        need[i] += Math.min(raise, c.maxSightRaise); // in salita il pendio può coprire un tratto: va bene
      }
      // inviluppo superiore lisciato: prima si "allargano" i picchi (massimo mobile), poi si liscia,
      // così un ostacolo isolato diventa una salita dolce e non un gradino
      const w = Math.round(c.altitudeSmoothing / ds);
      let y = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let m = -Infinity;
        for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) m = Math.max(m, need[j]);
        y[i] = m;
      }
      for (let k = 0; k < 6; k++) {
        const g = gauss(y, c.altitudeSmoothing / ds);
        for (let i = 0; i < n; i++) y[i] = Math.max(g[i], need[i]);
      }
      y = gauss(y, 3);

      // inclinazione: verso la strada un po' più avanti, lisciata e limitata
      let pitch = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        roadAt(i * ds + dir * c.pitchAhead, tgt);
        pitch[i] = Math.atan2(tgt.y - y[i], Math.hypot(tgt.x - tx[i], tgt.z - tz[i]));
      }
      for (let i = 0; i < n; i++) pitch[i] = MathUtils.clamp(pitch[i], MathUtils.degToRad(c.pitchMin), MathUtils.degToRad(c.pitchMax));
      // anche su e giù: lisciatura ripetuta finché resta sotto il limite
      const maxPitchRate = () => {
        let m = 0;
        for (let i = 1; i < n; i++) m = Math.max(m, Math.abs(pitch[i] - pitch[i - 1]));
        return MathUtils.radToDeg(m) * (100 / ds);
      };
      let ip = 0;
      do pitch = gauss(pitch, c.headingSmoothing / ds); while (maxPitchRate() > c.maxPitchRate && ++ip < 12);
      pitch = gauss(slewLimit(pitch, MathUtils.degToRad(c.maxPitchRate) * (ds / 100)), 4);

      this.track[dir] = new CatmullRomCurve3(Array.from({ length: n }, (_, i) => new Vector3(tx[i], y[i] + 2, tz[i])), false, 'centripetal');
      this.yaw[dir] = yaw;
      this.pitch[dir] = pitch;
      let hMax = 0, hSum = 0;
      for (let i = 0; i < n; i++) { const h = y[i] + 2 - ys[i]; hMax = Math.max(hMax, h); hSum += h; }
      this.stats[dir] = { maxTurnDegPer100m: +maxRate().toFixed(1), smoothingPasses: it + 1, heightAvg: Math.round(hSum / n), heightMax: Math.round(hMax) };
    }
    this.track[-1] = this.track[1];
    this.yaw[-1] = this.yaw[1];
    this.pitch[-1] = this.pitch[1];
  }

  _interp(arr, s) {
    const f = MathUtils.clamp(s / ds, 0, this.n - 1.0001);
    const i = f | 0;
    return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
  }

  /** l'inquadratura esatta del drone in un punto del percorso: serve per entrare e uscire
   *  dalle soste senza nessuna rotazione brusca */
  followPose(dir, s) {
    const camS = MathUtils.clamp(s, 0, this.L);
    const pos = this.track[dir].getPoint(camS / this.L, new Vector3());
    this._e.set(this._interp(this.pitch[dir], camS), this._interp(this.yaw[dir], camS), 0, 'YXZ');
    const fwd = new Vector3(0, 0, -1).applyEuler(this._e);
    return { pos, target: pos.clone().addScaledVector(fwd, 800), yaw: this._e.y, pitch: this._e.x };
  }

  /** posizione sulla strada del "ciclista" (punto arancione) e testa della linea */
  riderS() {
    const s = this.state;
    return MathUtils.clamp(s.camS + s.riderOff, 0, this.L);
  }

  update(dt = 1 / 60) {
    const s = this.state, c = CONFIG.camera, L = this.L;
    const [fp, sp, , tmp] = this._v;
    const camS = MathUtils.clamp(s.camS, 0, L);
    const dir = s.dir < 0 ? -1 : 1;

    // drone che segue la strada
    this.track[dir].getPoint(camS / L, fp);
    this._e.set(this._interp(this.pitch[dir], camS), this._interp(this.yaw[dir], camS), 0, 'YXZ');
    this._q1.setFromEuler(this._e);

    // inquadratura fissa (apertura, soste, cima)
    sp.set(s.sp.px, s.sp.py, s.sp.pz);
    this._q2.setFromEuler(this._e.set(s.sp.pitch, s.sp.yaw, 0, 'YXZ'));

    const d = s.drone;
    const pos = this.camera.position;
    if (d <= 0) pos.copy(fp);
    else if (d >= 1) pos.copy(sp);
    else {
      pos.lerpVectors(fp, sp, d);
      pos.y += Math.sin(Math.PI * d) * Math.min(fp.distanceTo(sp) * 0.12, 120); // arco: mai attraverso il monte
    }
    const g = groundMax(this.hf, pos.x, pos.z, 18) + 12;
    if (pos.y < g) pos.y = g;

    const q = this._qy;
    const target = this._qp.slerpQuaternions(this._q1, this._q2, d);

    // sguardo libero nelle soste
    if (this.look.yaw !== 0 || this.look.pitch !== 0) {
      const fwd = tmp.set(0, 0, -1).applyQuaternion(target);
      const basePitch = Math.asin(MathUtils.clamp(fwd.y, -1, 1));
      const lim = c.look;
      const pitch = MathUtils.clamp(basePitch + this.look.pitch, MathUtils.degToRad(lim.pitchMin), MathUtils.degToRad(lim.pitchMax)) - basePitch;
      q.setFromAxisAngle(UP, this.look.yaw);
      target.premultiply(q);
      q.setFromAxisAngle(tmp.set(1, 0, 0), pitch);
      target.multiply(q);
    }

    // stabilizzatore: la rotazione insegue l'obiettivo con un ritardo morbido
    if (this._first) { this._qSmooth.copy(target); this._first = false; }
    else this._qSmooth.slerp(target, 1 - Math.exp(-dt / c.gimbal));
    this.camera.quaternion.copy(this._qSmooth);
    this.camera.updateMatrixWorld();
  }
}
