import * as THREE from 'three';
import gsap from 'gsap';

// La cámara va por un raíl: el recorrido de la casa es una curva y el scroll
// (rueda, deslizar el dedo arriba/abajo, flechas) avanza o retrocede por ella
// con inercia, como una página. En cada sala la mirada se posa en su
// encuadre; entre una y otra mira hacia donde se va. Arrastrar gira la
// mirada (como en Street View) y, al seguir avanzando, vuelve sola al camino.

const EYE = 1.6;
const SAMPLES = 3000;
const LOOK_AHEAD = 1.8; // metros por delante a los que se mira al andar
const STOP_RADIUS = 3.5; // distancia a la que la mirada empieza a posarse en el encuadre de la sala

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Rail {
  // route: [[x, z], …]; regions: suelos (rectángulos con su altura o rampa)
  constructor(engine, pointer, { route, regions }) {
    this.engine = engine;
    this.pointer = pointer;
    this.regions = regions;
    this.enabled = false;
    this.lastInput = 0;
    this.s = 0; // posición en el camino (metros)
    this.sT = 0; // a dónde se va
    this.fling = 0;
    this.speed = 0;
    this.yawOff = 0; // lo que el visitante ha girado la mirada
    this.pitchOff = 0;
    this.drift = 0; // panorámica lenta de la visita automática
    this.focusAmt = 0; // 0 = en el camino, 1 = en el encuadre de `focusPose`
    this.focusPose = null;
    this.pos = new THREE.Vector3();
    this._look = new THREE.Vector3();

    // Tabla del camino: posición y largo acumulado, rumbo y pendiente.
    const pts = route.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const xs = new Float32Array(SAMPLES + 1);
    const zs = new Float32Array(SAMPLES + 1);
    const len = new Float32Array(SAMPLES + 1);
    const p = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      curve.getPoint(i / SAMPLES, p);
      xs[i] = p.x;
      zs[i] = p.z;
      if (i) len[i] = len[i - 1] + Math.hypot(p.x - xs[i - 1], p.z - zs[i - 1]);
    }
    Object.assign(this, { xs, zs, len, length: len[SAMPLES] });
    // cada punto de la ruta, en metros del camino
    this.pointS = route.map((_, k) => len[Math.round((k / (route.length - 1)) * SAMPLES)]);
    const head = new Float32Array(SAMPLES + 1);
    const lift = new Float32Array(SAMPLES + 1);
    let prev = 0;
    for (let i = 0, j = 0; i <= SAMPLES; i++) {
      while (j < SAMPLES && len[j] < len[i] + LOOK_AHEAD) j++;
      const a = j > i ? i : Math.max(0, i - 1);
      const b = j > i ? j : i;
      const raw = Math.atan2(xs[b] - xs[a], -(zs[b] - zs[a]));
      prev = i ? prev + wrap(raw - prev) : raw;
      head[i] = prev;
      const ya = this.floorAt(xs[a], zs[a]) ?? 0;
      const yb = this.floorAt(xs[b], zs[b]) ?? ya;
      lift[i] = Math.atan2(yb - ya, Math.max(0.3, len[b] - len[a])) * 0.7;
    }
    Object.assign(this, { head, lift });
    this.stops = [];

    pointer.on('down', () => {
      if (!this.enabled) return;
      this.lastInput = engine.time;
      if (this.blocked?.()) return;
      this.drag = { lx: pointer.x, ly: pointer.y, x: pointer.x, y: pointer.y, mode: null, v: 0, t: engine.time };
      this.fling = 0;
      this.stopTween();
    });
    pointer.on('move', () => {
      const d = this.drag;
      if (!d || !pointer.down || !this.enabled) return;
      const dx = pointer.x - d.lx;
      const dy = pointer.y - d.ly;
      if (!d.mode && Math.hypot(pointer.x - d.x, pointer.y - d.y) > 7) {
        // en pantallas táctiles: arriba/abajo recorre la casa, a los lados mira
        d.mode = pointer.type !== 'mouse' && Math.abs(pointer.y - d.y) > Math.abs(pointer.x - d.x) ? 'scroll' : 'look';
      }
      if (d.mode === 'look') {
        const k = (Math.PI * 0.55) / engine.view.width;
        this.yawOff -= dx * k; // se arrastra la escena: a la derecha → la mirada va a la izquierda
        if (pointer.type === 'mouse') this.pitchOff = THREE.MathUtils.clamp(this.pitchOff + dy * k, -0.55, 0.5);
      } else if (d.mode === 'scroll') {
        const ds = -dy * 0.014;
        this.sT = THREE.MathUtils.clamp(this.sT + ds, 0, this.length);
        const dt = Math.max(1 / 120, engine.time - d.t);
        d.v += (ds / dt - d.v) * 0.4;
        d.t = engine.time;
      }
      if (d.mode) this.lastInput = engine.time;
      d.lx = pointer.x;
      d.ly = pointer.y;
    });
    pointer.on('up', () => {
      const d = this.drag;
      this.drag = null;
      // al soltar, el deslizamiento sigue un poco (inercia)
      if (d?.mode === 'scroll') this.fling = THREE.MathUtils.clamp(d.v, -7, 7);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled || this.blocked?.()) return;
        const dy = THREE.MathUtils.clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -140, 140);
        this.stopTween();
        this.fling = 0;
        this.sT = THREE.MathUtils.clamp(this.sT + dy * 0.014, 0, this.length);
        this.lastInput = engine.time;
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.blocked?.() || (e.target !== document.body && e.target !== engine.canvas)) return;
      const step = { ArrowDown: 2, PageDown: 5, ' ': 5, ArrowUp: -2, PageUp: -5 }[e.key];
      const turn = { ArrowLeft: 0.2, ArrowRight: -0.2 }[e.key];
      if (!step && !turn) return;
      e.preventDefault();
      this.stopTween();
      if (step) this.sT = THREE.MathUtils.clamp(this.sT + step, 0, this.length);
      if (turn) this.yawOff += turn;
      this.lastInput = engine.time;
    });
  }

  // Encuadre de cada sala: { s, yaw, pitch } (s en metros del camino).
  setStops(stops) {
    this.stops = stops;
  }

  floorAt(x, z) {
    for (const r of this.regions) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      if (r.ramp) {
        const t = THREE.MathUtils.clamp((z - r.ramp.from) / r.ramp.len, 0, 1);
        return THREE.MathUtils.lerp(r.ramp.y0, r.ramp.y1, t);
      }
      return r.y ?? 0;
    }
    return null;
  }

  // Punto del camino más cercano a (x, z), en metros.
  nearest(x, z) {
    let best = Infinity;
    let k = 0;
    for (let i = 0; i <= SAMPLES; i += 2) {
      const d = (this.xs[i] - x) ** 2 + (this.zs[i] - z) ** 2;
      if (d < best) {
        best = d;
        k = i;
      }
    }
    return this.len[k];
  }

  // Pose de la cámara en el metro s: posición y mirada (camino + encuadre de sala).
  pose(s, out = {}) {
    const len = this.len;
    let lo = 0;
    let hi = SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (len[mid] < s) lo = mid;
      else hi = mid;
    }
    const f = THREE.MathUtils.clamp((s - len[lo]) / Math.max(1e-6, len[hi] - len[lo]), 0, 1);
    const mix = (a) => a[lo] + (a[hi] - a[lo]) * f;
    out.x = mix(this.xs);
    out.z = mix(this.zs);
    let yaw = mix(this.head);
    let pitch = 0.03 + mix(this.lift);
    for (const st of this.stops) {
      const w = 1 - THREE.MathUtils.smoothstep(Math.abs(s - st.s), STOP_RADIUS * 0.2, STOP_RADIUS);
      if (w <= 0) continue;
      yaw += wrap(st.yaw - yaw) * w;
      pitch += (st.pitch - pitch) * w;
    }
    out.yaw = yaw;
    out.pitch = pitch;
    return out;
  }

  // Recorrido animado hasta el metro s (botones, visita automática, secciones).
  goTo(s, duration, ease = 'sine.inOut') {
    this.stopTween();
    this.fling = 0;
    const proxy = { s: this.s };
    return new Promise((resolve) => {
      this.tween = gsap.to(proxy, {
        s: THREE.MathUtils.clamp(s, 0, this.length),
        duration,
        ease,
        onUpdate: () => {
          this.s = this.sT = proxy.s;
        },
        onComplete: () => {
          this.tween = null;
          resolve();
        },
        onInterrupt: resolve,
      });
    });
  }

  stopTween() {
    this.tween?.kill();
    this.tween = null;
  }

  // Salir del camino hacia un encuadre (una sección, la llegada) y volver.
  focusTo(pose, duration = 1.4) {
    this.focusPose = pose;
    gsap.killTweensOf(this, 'focusAmt');
    return new Promise((resolve) => gsap.to(this, { focusAmt: 1, duration, ease: 'power2.inOut', onComplete: resolve, onInterrupt: resolve }));
  }

  unfocus(duration = 1.2) {
    gsap.killTweensOf(this, 'focusAmt');
    return new Promise((resolve) => gsap.to(this, { focusAmt: 0, duration, ease: 'power2.inOut', onComplete: resolve, onInterrupt: resolve }));
  }

  place(s) {
    this.stopTween();
    this.s = this.sT = THREE.MathUtils.clamp(s, 0, this.length);
    this.fling = 0;
    this.yawOff = this.pitchOff = 0;
    this.floorY = null;
  }

  update(dt, camera) {
    if (this.fling) {
      this.sT = THREE.MathUtils.clamp(this.sT + this.fling * dt, 0, this.length);
      this.fling *= Math.exp(-dt * 2.2);
      if (Math.abs(this.fling) < 0.05) this.fling = 0;
    }
    const prev = this.s;
    if (!this.tween) this.s += (this.sT - this.s) * (1 - Math.exp(-dt * 2.6));
    const v = Math.abs(this.s - prev) / Math.max(dt, 1e-4);
    this.speed += (v - this.speed) * (1 - Math.exp(-dt * 6));
    // al avanzar, la mirada vuelve sola al camino
    if (this.speed > 0.3 && !this.drag) {
      const k = Math.exp(-dt * 1.4);
      this.yawOff *= k;
      this.pitchOff *= k;
    }

    const p = this.pose(this.s, this._pose ?? (this._pose = {}));
    let { x, z } = p;
    let yaw = p.yaw + this.yawOff + this.drift;
    let pitch = THREE.MathUtils.clamp(p.pitch + this.pitchOff, -0.7, 0.6);
    const floor = this.floorAt(x, z) ?? this.floorY ?? 0;
    this.floorY = this.floorY == null ? floor : THREE.MathUtils.damp(this.floorY, floor, 10, dt);
    let y = this.floorY + EYE;
    // fuera del camino hacia un encuadre
    const f = this.focusAmt;
    if (f > 0 && this.focusPose) {
      const q = this.focusPose;
      x += (q.x - x) * f;
      y += (q.y - y) * f;
      z += (q.z - z) * f;
      yaw += wrap(q.yaw - yaw) * f;
      pitch += (q.pitch - pitch) * f;
    }
    this.pos.set(x, y - EYE, z);
    camera.position.set(x, y, z);
    const look = this._look.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.up.set(0, 1, 0);
    camera.lookAt(look.add(camera.position));
  }
}
