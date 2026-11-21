// =============================================================================
//  drone.js — la camera che vola attorno alla statua
// =============================================================================
//  - due curve CatmullRom (posizione e punto guardato) costruite dalle tappe di
//    drone-path.js; lo scroll sceglie il punto sulle curve
//  - smorzamento morbido verso il punto desiderato + leggera oscillazione
//  - "voli" verso le zone (04): traiettoria curva da dove si è alla zona scelta
//  - con prefers-reduced-motion: inquadrature fisse per capitolo, cambiate
//    sotto una dissolvenza (la gestisce main.js)

import * as THREE from 'three';
import { PATH, DESKTOP, MOBILE, DRIFT, IDLE, DAMPING } from '../drone-path.js';
import { resolveAnchor } from '../core/scroll.js';

const deg = THREE.MathUtils.degToRad;
const smooth = (t) => t * t * (3 - 2 * t);

/** Tappa → posizione della camera (da az/el/dist attorno al target) */
function shotPosition(s) {
  const t = new THREE.Vector3(...s.target);
  if (s.pos) return { pos: new THREE.Vector3(...s.pos), target: t };
  const az = deg(s.az), el = deg(s.el);
  const pos = new THREE.Vector3(
    t.x + Math.cos(el) * Math.sin(az) * s.dist,
    t.y + Math.sin(el) * s.dist,
    t.z + Math.cos(el) * Math.cos(az) * s.dist
  );
  return { pos, target: t };
}

/** Valori di una tappa per il dispositivo attuale */
export function resolveShot(s, mobile) {
  const base = { ...s };
  if (mobile) {
    Object.assign(base, { dist: s.dist * MOBILE.distScale, shift: MOBILE.shift }, s.mobile || {});
  }
  base.fov = base.fov ?? (mobile ? MOBILE.fov : DESKTOP.fov);
  base.shift = base.shift ?? [0, 0];
  base.dof = base.dof ?? 0;
  return { ...base, ...shotPosition(base) };
}

/** Rumore liscio 1D (somma di seni) per la micro-oscillazione */
const wobble = (t, s) => Math.sin(t * 1.0 + s) * 0.6 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.7 + s * 0.3) * 0.1;

export class Drone {
  constructor(camera, { mobile, reducedMotion }) {
    this.camera = camera;
    this.mobile = mobile;
    this.reducedMotion = reducedMotion;
    // stato attuale (smorzato) e desiderato
    this.cur = { pos: new THREE.Vector3(), target: new THREE.Vector3(), shift: new THREE.Vector2(), dof: 0, fov: 32 };
    this.zone = { blend: 0, t: 0, from: null, to: null, ctrl: new THREE.Vector3() };
    this.initialized = false;
    this.build();
  }

  /** (Ri)costruisce le curve: da chiamare se cambia il layout o il dispositivo */
  build() {
    this.shots = PATH.map((s) => resolveShot(s, this.mobile));
    this.anchors = PATH.map((s) => resolveAnchor(s.at));
    this.posCurve = new THREE.CatmullRomCurve3(this.shots.map((s) => s.pos), false, 'centripetal', 0.5);
    this.targetCurve = new THREE.CatmullRomCurve3(this.shots.map((s) => s.target), false, 'centripetal', 0.5);
  }

  /** Frazione dello scroll → parametro sulle curve + valori interpolati */
  sample(scroll) {
    const a = this.anchors;
    const n = a.length;
    let i = 0;
    while (i < n - 2 && scroll > a[i + 1]) i++;
    const span = Math.max(1e-6, a[i + 1] - a[i]);
    const local = THREE.MathUtils.clamp((scroll - a[i]) / span, 0, 1);
    const u = (i + local) / (n - 1);
    const s0 = this.shots[i], s1 = this.shots[i + 1];
    const k = smooth(local);
    return {
      pos: this.posCurve.getPoint(u),
      target: this.targetCurve.getPoint(u),
      shift: new THREE.Vector2(s0.shift[0] + (s1.shift[0] - s0.shift[0]) * k, s0.shift[1] + (s1.shift[1] - s0.shift[1]) * k),
      dof: s0.dof + (s1.dof - s0.dof) * k,
      fov: s0.fov + (s1.fov - s0.fov) * k,
    };
  }

  /** Inquadratura fissa di un capitolo (reduced motion) */
  chapterShot(chapterId) {
    const idx = PATH.map((s, i) => [s, i]).filter(([s]) => s.at.startsWith(chapterId + ':'));
    if (!idx.length) return null;
    const marked = idx.find(([s]) => s.rm);
    const [, i] = marked || (chapterId === 'hero' ? idx[0] : idx[idx.length - 1]);
    const s = this.shots[i];
    return { pos: s.pos.clone(), target: s.target.clone(), shift: new THREE.Vector2(...s.shift), dof: s.dof, fov: s.fov };
  }

  // ---------------------------------------------------------------------------
  //  Voli verso le zone
  // ---------------------------------------------------------------------------
  zoneShot(zone, worldCenter) {
    const c = { ...zone.cam, ...(this.mobile ? zone.mobile : {}) };
    const look = worldCenter.clone().add(new THREE.Vector3(...(c.look || [0, 0, 0])));
    const s = resolveShot({ target: look.toArray(), az: c.az, el: c.el, dist: c.dist, shift: c.shift, dof: 0.7 }, false);
    s.fov = this.mobile ? MOBILE.fov : DESKTOP.fov;
    return s;
  }

  /** Prepara un volo da dove si trova la camera ora verso `shot` */
  flyTo(shot) {
    const from = {
      pos: this.camera.position.clone(),
      target: this.cur.target.clone(),
      shift: this.cur.shift.clone(),
      dof: this.cur.dof,
      fov: this.cur.fov,
    };
    // punto di controllo: a metà strada, spinto lontano dall'asse della statua e
    // un po' in alto → traiettoria curva, mai attraverso la statua
    const mid = from.pos.clone().lerp(shot.pos, 0.5);
    const away = new THREE.Vector3(mid.x, 0, mid.z + 0.35);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.normalize();
    const len = from.pos.distanceTo(shot.pos);
    this.zone.ctrl.copy(mid).addScaledVector(away, len * 0.45).add(new THREE.Vector3(0, len * 0.18, 0));
    this.zone.from = from;
    this.zone.to = { ...shot, shift: new THREE.Vector2(...shot.shift) };
    this.zone.t = 0;
  }

  zoneState() {
    const z = this.zone;
    if (!z.to) return null;
    const t = z.t;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    const a = z.from.pos, b = z.to.pos, c = z.ctrl;
    const it = 1 - e;
    const pos = new THREE.Vector3(
      it * it * a.x + 2 * it * e * c.x + e * e * b.x,
      it * it * a.y + 2 * it * e * c.y + e * e * b.y,
      it * it * a.z + 2 * it * e * c.z + e * e * b.z
    );
    return {
      pos,
      target: z.from.target.clone().lerp(z.to.target, e),
      shift: z.from.shift.clone().lerp(z.to.shift, e),
      dof: THREE.MathUtils.lerp(z.from.dof, z.to.dof, e),
      fov: THREE.MathUtils.lerp(z.from.fov, z.to.fov, e),
    };
  }

  // ---------------------------------------------------------------------------
  //  Aggiornamento per frame
  //  scroll: frazione 0..1; idle: peso del movimento lento all'apertura
  //  override: inquadratura forzata (reduced motion), senza smorzamento
  // ---------------------------------------------------------------------------
  update({ scroll, dt, time, idle = 0, override = null }) {
    let want = override || this.sample(scroll);
    // miscela con il volo verso una zona
    const zs = this.zone.blend > 0 ? this.zoneState() : null;
    if (zs) {
      const b = this.zone.blend;
      want = {
        pos: want.pos.clone().lerp(zs.pos, b),
        target: want.target.clone().lerp(zs.target, b),
        shift: want.shift.clone().lerp(zs.shift, b),
        dof: THREE.MathUtils.lerp(want.dof, zs.dof, b),
        fov: THREE.MathUtils.lerp(want.fov, zs.fov, b),
      };
    }

    const c = this.cur;
    if (!this.initialized || override) {
      c.pos.copy(want.pos);
      c.target.copy(want.target);
      c.shift.copy(want.shift);
      c.dof = want.dof;
      c.fov = want.fov;
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-DAMPING * Math.min(dt, 0.1));
      c.pos.lerp(want.pos, k);
      c.target.lerp(want.target, k);
      c.shift.lerp(want.shift, k);
      c.dof += (want.dof - c.dof) * k;
      c.fov += (want.fov - c.fov) * k;
    }

    // posizione finale: + movimento lento e micro-oscillazione (non con reduced motion)
    const cam = this.camera;
    const pos = c.pos.clone();
    const target = c.target.clone();
    if (!this.reducedMotion) {
      const rel = pos.clone().sub(target);
      const dist = rel.length();
      if (idle > 0) {
        const ts = time * IDLE.speed * Math.PI * 2;
        rel.applyAxisAngle(new THREE.Vector3(0, 1, 0), deg(IDLE.az) * Math.sin(ts) * idle);
        rel.y += dist * deg(IDLE.el) * Math.sin(ts * 0.7 + 1.3) * idle;
        pos.copy(target).add(rel);
      }
      const ts = time * DRIFT.speed;
      pos.x += wobble(ts, 0.0) * dist * DRIFT.position;
      pos.y += wobble(ts, 2.1) * dist * DRIFT.position * 0.7;
      pos.z += wobble(ts, 4.2) * dist * DRIFT.position;
      target.x += wobble(ts * 1.3, 7.7) * dist * DRIFT.target;
      target.y += wobble(ts * 1.3, 9.1) * dist * DRIFT.target;
    }
    cam.position.copy(pos);
    cam.lookAt(target);
    if (Math.abs(cam.fov - c.fov) > 1e-3) cam.fov = c.fov;
    cam.updateProjectionMatrix();
    // spostamento dell'inquadratura (lens shift): la statua si sposta sullo
    // schermo senza girare la camera
    cam.projectionMatrix.elements[8] = -c.shift.x;
    cam.projectionMatrix.elements[9] = -c.shift.y;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this.focus = pos.distanceTo(target);
    return { focus: this.focus, dof: c.dof, target, position: pos };
  }
}
