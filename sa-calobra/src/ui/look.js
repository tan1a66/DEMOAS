// Soste a 360°: trascinando si gira la vista (con inerzia), oppure col giroscopio dell'iPhone.
// Su touch: il gesto orizzontale gira la vista, quello verticale porta alla tappa successiva.
import { MathUtils } from 'three';
import { CONFIG } from '../config.js';

export function createLook(target) {
  const c = CONFIG.camera.look;
  const s = {
    enabled: false,
    dragging: false,
    yaw: 0, pitch: 0, vy: 0, vp: 0,
    gyro: false, gyroRef: null, gYaw: 0, gPitch: 0,
  };
  let lx = 0, ly = 0, id = null, moved = 0;

  const down = (e) => {
    if (!s.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('a, button')) return;
    s.dragging = true; id = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0;
    s.vy = s.vp = 0;
    document.documentElement.classList.add('is-dragging');
  };
  const move = (e) => {
    if (!s.dragging || e.pointerId !== id) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    moved += Math.abs(dx);
    s.vy = dx * c.dragSpeed;
    // col dito il verticale resta alle tappe; col mouse si può guardare anche su e giù
    s.vp = e.pointerType === 'mouse' ? dy * c.dragSpeed : 0;
    s.yaw += s.vy;
    s.pitch += s.vp;
  };
  const up = (e) => {
    if (e.pointerId !== id) return;
    s.dragging = false; id = null;
    document.documentElement.classList.remove('is-dragging');
  };
  addEventListener('pointerdown', down, { passive: true });
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', up, { passive: true });
  addEventListener('pointercancel', up, { passive: true });

  // giroscopio (iOS chiede il permesso dopo un tocco)
  const onOrient = (e) => {
    if (e.alpha == null) return;
    if (!s.gyroRef) s.gyroRef = { a: e.alpha, b: e.beta };
    let da = e.alpha - s.gyroRef.a;
    da = Math.atan2(Math.sin(MathUtils.degToRad(da)), Math.cos(MathUtils.degToRad(da)));
    s.gYaw = da;                                              // girarsi col telefono
    s.gPitch = MathUtils.degToRad(MathUtils.clamp(e.beta - s.gyroRef.b, -40, 40)) * 0.8;
  };
  async function enableGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return false;
      }
      addEventListener('deviceorientation', onOrient);
      s.gyro = true;
      return true;
    } catch {
      return false;
    }
  }

  let wasActive = false;
  return {
    state: s,
    enableGyro,
    gyroAvailable: typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    /** stopW: 0…1 quanto la sosta è attiva. Aggiorna target.yaw / target.pitch */
    update(dt, stopW) {
      const active = stopW > 0.5;
      s.enabled = active;
      if (active && !wasActive) s.gyroRef = null; // il giroscopio riparte da dove si guarda ora
      wasActive = active;
      if (!s.dragging) {
        const k = Math.pow(c.inertia, dt * 60);
        s.yaw += s.vy; s.pitch += s.vp;
        s.vy *= k; s.vp *= k;
      }
      s.pitch = MathUtils.clamp(s.pitch, -1.2, 1.2);
      // fuori dalla sosta la vista torna dolcemente sulla traiettoria (per la via più breve)
      if (!active) {
        s.yaw = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw));
        const back = 1 - Math.exp(-dt * 2.5 * (1 - stopW * 1.6));
        s.yaw += (0 - s.yaw) * back; s.pitch += (0 - s.pitch) * back;
        if (Math.abs(s.yaw) < 1e-4) s.yaw = 0;
        if (Math.abs(s.pitch) < 1e-4) s.pitch = 0;
      }
      const gw = s.gyro ? MathUtils.smoothstep(stopW, 0, 1) : 0;
      target.yaw = s.yaw + s.gYaw * gw;
      target.pitch = s.pitch + s.gPitch * gw;
    },
  };
}
