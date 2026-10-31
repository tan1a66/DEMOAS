/*
  Ingressi per la parallasse e lo sguardo:
  - mouse: la posizione del puntatore sposta la "testa";
  - dito: trascinare sposta l'inquadratura (guardarsi intorno, con inerzia) e muove un po' la testa;
  - giroscopio: inclinare il telefono sposta la testa. Su iOS il permesso va chiesto
    dentro un gesto dell'utente: enableGyro() va chiamata da un click/tap.
  head = [-1..1, -1..1]; x positivo = testa a destra, y positivo = testa in alto.
*/

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GYRO_RANGE = 16; // gradi di inclinazione per arrivare al massimo
const IDLE_MS = 2500;

export class Motion {
  constructor(target) {
    this.target = target;
    this.mouse = { x: 0, y: 0, active: false };
    this.drag = { id: null, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0, vx: 0, vy: 0, t: 0 };
    this.panPx = { x: 0, y: 0 };
    this.inertia = { x: 0, y: 0 };
    this.gyro = { on: false, x: 0, y: 0, x0: null, y0: null, raw: null, hx: 0, hy: 0 };
    this.lastInput = performance.now();
    this.enabled = true;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onOrientation = this.onOrientation.bind(this);

    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    target.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse.active = false; });
  }

  get gyroAvailable() {
    return typeof window.DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  /** Da chiamare dentro un gesto dell'utente (click/tap). */
  async enableGyro() {
    if (this.gyro.on || !this.gyroAvailable) return this.gyro.on;
    try {
      const DOE = window.DeviceOrientationEvent;
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return false;
      }
      window.addEventListener('deviceorientation', this.onOrientation);
      this.gyro.on = true;
    } catch {
      return false;
    }
    return true;
  }

  touch() { this.lastInput = performance.now(); }

  get idle() { return performance.now() - this.lastInput > IDLE_MS; }

  onPointerMove(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      const r = this.target.getBoundingClientRect();
      this.mouse.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      this.mouse.y = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
      this.mouse.active = true;
      this.touch();
    }
    if (this.drag.id === e.pointerId) {
      const now = performance.now();
      const ddx = e.clientX - this.drag.x;
      const ddy = e.clientY - this.drag.y;
      const dt = Math.max(1, now - this.drag.t) / 1000;
      this.drag.vx = this.drag.vx * 0.6 + (ddx / dt) * 0.4;
      this.drag.vy = this.drag.vy * 0.6 + (ddy / dt) * 0.4;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.t = now;
      this.drag.dx = e.clientX - this.drag.startX;
      this.drag.dy = e.clientY - this.drag.startY;
      this.panPx.x += ddx;
      this.panPx.y += ddy;
      this.touch();
    }
  }

  onPointerDown(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    this.drag.id = e.pointerId;
    this.drag.x = this.drag.startX = e.clientX;
    this.drag.y = this.drag.startY = e.clientY;
    this.drag.dx = this.drag.dy = this.drag.vx = this.drag.vy = 0;
    this.drag.t = performance.now();
    this.inertia.x = this.inertia.y = 0;
    this.touch();
  }

  onPointerUp(e) {
    if (this.drag.id !== e.pointerId) return;
    this.drag.id = null;
    // Inerzia solo se il dito si muoveva ancora al rilascio.
    if (performance.now() - this.drag.t < 80) {
      this.inertia.x = clamp(this.drag.vx, -2500, 2500);
      this.inertia.y = clamp(this.drag.vy, -2500, 2500);
    }
    this.drag.dx = this.drag.dy = 0;
  }

  onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    let x;
    let y;
    switch ((angle + 360) % 360) {
      case 90: x = e.beta; y = -e.gamma; break;
      case 270: x = -e.beta; y = e.gamma; break;
      case 180: x = -e.gamma; y = -e.beta; break;
      default: x = e.gamma; y = e.beta;
    }
    this.gyro.raw = { x, y };
  }

  /** Avanza di dt secondi e restituisce testa e spostamento dell'inquadratura in px. */
  update(dt) {
    const out = { headX: 0, headY: 0, panX: 0, panY: 0 };

    // Trascinamento + inerzia (in pixel dello schermo).
    out.panX = this.panPx.x;
    out.panY = this.panPx.y;
    this.panPx.x = this.panPx.y = 0;
    if (this.drag.id == null && (Math.abs(this.inertia.x) > 1 || Math.abs(this.inertia.y) > 1)) {
      out.panX += this.inertia.x * dt;
      out.panY += this.inertia.y * dt;
      const decay = Math.exp(-dt * 4.5);
      this.inertia.x *= decay;
      this.inertia.y *= decay;
    }

    // Giroscopio, con lo zero che segue lentamente la posizione in cui si tiene il telefono.
    const g = this.gyro;
    if (g.on && g.raw) {
      if (g.x0 == null) { g.x0 = g.raw.x; g.y0 = g.raw.y; }
      const follow = Math.min(1, dt * 0.25);
      g.x0 += (g.raw.x - g.x0) * follow;
      g.y0 += (g.raw.y - g.y0) * follow;
      const hx = clamp((g.raw.x - g.x0) / GYRO_RANGE, -1, 1);
      const hy = clamp(-(g.raw.y - g.y0) / GYRO_RANGE, -1, 1);
      if (Math.abs(hx - g.hx) + Math.abs(hy - g.hy) > 0.015) this.touch();
      g.hx = hx;
      g.hy = hy;
      out.headX = hx;
      out.headY = hy;
    } else if (this.mouse.active) {
      out.headX = this.mouse.x;
      out.headY = this.mouse.y;
    }

    // Durante il trascinamento la testa segue un poco il dito.
    if (this.drag.id != null) {
      const s = Math.min(innerWidth, innerHeight) * 0.6;
      out.headX = clamp(out.headX - this.drag.dx / s, -1, 1);
      out.headY = clamp(out.headY + this.drag.dy / s, -1, 1);
    }
    return out;
  }
}
