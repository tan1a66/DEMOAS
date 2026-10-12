import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Cámara orbital con vuelos GSAP. El estado se expresa en coordenadas esféricas
// alrededor de un objetivo: { target, distance, polar, azimuth }.
export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: false,
      maxPolarAngle: 1.38,
      minDistance: 3,
      maxDistance: 3000,
      rotateSpeed: 0.5,
      zoomSpeed: 0.8,
      panSpeed: 0.8,
    });
    this.state = { tx: 0, ty: 0, tz: 0, distance: 500, polar: 0.8, azimuth: 0 };
    this.flying = false;
    this.tl = null;
  }

  get distance() {
    return this.camera.position.distanceTo(this.controls.target);
  }

  // Lee la posición actual de la cámara como estado esférico.
  syncFromCamera() {
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    const sph = new THREE.Spherical().setFromVector3(off);
    Object.assign(this.state, { tx: t.x, ty: t.y, tz: t.z, distance: sph.radius, polar: sph.phi, azimuth: sph.theta });
  }

  apply() {
    const s = this.state;
    this.controls.target.set(s.tx, s.ty, s.tz);
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(s.distance, s.polar, s.azimuth));
    this.camera.position.copy(this.controls.target).add(off);
    this.camera.lookAt(this.controls.target);
  }

  set(view) {
    this.kill();
    Object.assign(this.state, toState(view));
    this.apply();
    this.controls.update();
  }

  kill() {
    if (this.tl) this.tl.kill();
    this.tl = null;
    this.flying = false;
    this.controls.enabled = true;
  }

  begin() {
    this.kill();
    this.syncFromCamera();
    this.flying = true;
    this.controls.enabled = false;
    const tl = gsap.timeline({
      onUpdate: () => this.apply(),
      onComplete: () => {
        this.flying = false;
        this.controls.enabled = true;
        this.controls.update();
      },
    });
    this.tl = tl;
    return tl;
  }

  // Vuelo directo con un ligero "arco" (se aleja a mitad de camino si el salto es largo).
  flyTo(view, { duration = 2.4, ease = 'power3.inOut', arc = true } = {}) {
    const tl = this.begin();
    const to = toState(view);
    to.azimuth = nearestAngle(this.state.azimuth, to.azimuth);
    const from = { ...this.state };
    const travel = Math.hypot(to.tx - from.tx, to.tz - from.tz);
    const lift = arc ? Math.min(travel * 0.6, 400) : 0;
    const p = { k: 0 };
    tl.to(p, {
      k: 1,
      duration,
      ease,
      onUpdate: () => {
        const k = p.k;
        for (const key of Object.keys(to)) this.state[key] = from[key] + (to[key] - from[key]) * k;
        this.state.distance += Math.sin(Math.PI * k) * lift;
      },
    });
    return tl;
  }

  // Vuelo siguiendo una curva 3D (p.ej. la línea del Tren Maya).
  flyAlong(curve, finalView, { approach = 1.4, duration = 4.5, followDistance = 110, followPolar = 0.95 } = {}) {
    const tl = this.begin();
    const start = curve.getPointAt(0);
    const end = toState(finalView);
    const dirAz = (t) => {
      const a = curve.getPointAt(Math.max(0, t - 0.02));
      const b = curve.getPointAt(Math.min(1, t + 0.02));
      // La cámara se sitúa detrás del sentido de avance.
      return Math.atan2(-(b.x - a.x), -(b.z - a.z));
    };
    const from = { ...this.state };
    const az0 = nearestAngle(from.azimuth, dirAz(0));
    const p1 = { k: 0 };
    tl.to(p1, {
      k: 1,
      duration: approach,
      ease: 'power2.inOut',
      onUpdate: () => {
        const k = p1.k;
        this.state.tx = from.tx + (start.x - from.tx) * k;
        this.state.ty = from.ty + (start.y - from.ty) * k;
        this.state.tz = from.tz + (start.z - from.tz) * k;
        this.state.distance = from.distance + (followDistance - from.distance) * k;
        this.state.polar = from.polar + (followPolar - from.polar) * k;
        this.state.azimuth = from.azimuth + (az0 - from.azimuth) * k;
      },
    });
    const p2 = { t: 0 };
    let lastAz = az0;
    tl.to(p2, {
      t: 1,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        const t = p2.t;
        const pt = curve.getPointAt(t);
        const blend = THREE.MathUtils.smoothstep(t, 0.75, 1);
        this.state.tx = pt.x + (end.tx - pt.x) * blend;
        this.state.ty = pt.y + (end.ty - pt.y) * blend;
        this.state.tz = pt.z + (end.tz - pt.z) * blend;
        const az = nearestAngle(lastAz, dirAz(t));
        lastAz = this.state.azimuth + (az - this.state.azimuth) * 0.08;
        const endAz = nearestAngle(lastAz, end.azimuth);
        this.state.azimuth = lastAz + (endAz - lastAz) * blend;
        this.state.distance = followDistance + (end.distance - followDistance) * THREE.MathUtils.smoothstep(t, 0.55, 1);
        this.state.polar = followPolar + (end.polar - followPolar) * blend;
      },
    });
    return tl;
  }
}

const toState = (v) => ({
  tx: v.target.x,
  ty: v.target.y,
  tz: v.target.z,
  distance: v.distance,
  polar: v.polar,
  azimuth: v.azimuth,
});

const nearestAngle = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};
