// =============================================================================
//  drone.js — la camera che vola attorno alla statua
// =============================================================================
//  - due curve CatmullRom (posizione e punto guardato) costruite dalle tappe di
//    drone-path.js; lo scroll sceglie il punto sulle curve
//  - smorzamento morbido verso il punto desiderato + leggera oscillazione
//  - nel capitolo 04 le tappe possono essere zone della statua (config.js)
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
  /**
   * zones: { id: { center: Vector3 (mondo), cam, mobile } } — le zone di config.js,
   * usate dalle tappe del percorso scritte come { at, zone: 'faciales' }.
   */
  constructor(camera, { mobile, reducedMotion, zones = {} }) {
    this.camera = camera;
    this.mobile = mobile;
    this.reducedMotion = reducedMotion;
    this.zones = zones;
    // stato attuale (smorzato)
    this.cur = { pos: new THREE.Vector3(), target: new THREE.Vector3(), shift: new THREE.Vector2(), dof: 0, fov: 32 };
    this.initialized = false;
    this.build();
  }

  /** Tappa scritta come { zone: 'id' } → inquadratura sulla zona (config.js) */
  zoneShot(s) {
    const z = this.zones[s.zone];
    if (!z) return null;
    const c = z.cam;
    const look = z.center.clone().add(new THREE.Vector3(...(c.look || [0, 0, 0])));
    return { target: look.toArray(), az: c.az, el: c.el, dist: c.dist, shift: c.shift, dof: s.dof ?? 0.6, mobile: z.mobile, rm: s.rm };
  }

  /** (Ri)costruisce le curve: da chiamare se cambia il layout o il dispositivo */
  build() {
    // le tappe con "hold" diventano due punti uguali: lì la camera si ferma un poco
    this.entries = [];
    for (const s of PATH) {
      const shot = s.zone ? this.zoneShot(s) : s;
      if (!shot) continue;
      const [id, p] = s.at.split(':');
      if (s.hold) {
        this.entries.push({ shot, at: `${id}:${Number(p) - s.hold / 2}` }, { shot, at: `${id}:${Number(p) + s.hold / 2}` });
      } else this.entries.push({ shot, at: s.at });
    }
    this.shots = this.entries.map((e) => resolveShot(e.shot, this.mobile));
    this.anchors = this.entries.map((e) => resolveAnchor(e.at));
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
    const idx = this.entries.map((e, i) => [e, i]).filter(([e]) => e.at.startsWith(chapterId + ':'));
    if (!idx.length) return null;
    const marked = idx.find(([e]) => e.shot.rm);
    const [, i] = marked || (chapterId === 'hero' ? idx[0] : idx[idx.length - 1]);
    const s = this.shots[i];
    return { pos: s.pos.clone(), target: s.target.clone(), shift: new THREE.Vector2(...s.shift), dof: s.dof, fov: s.fov };
  }

  // ---------------------------------------------------------------------------
  //  Aggiornamento per frame
  //  scroll: frazione 0..1; idle: peso del movimento lento all'apertura
  //  override: inquadratura forzata (reduced motion), senza smorzamento
  // ---------------------------------------------------------------------------
  update({ scroll, dt, time, idle = 0, override = null }) {
    const want = override || this.sample(scroll);
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
