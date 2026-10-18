import * as THREE from 'three';
import gsap from 'gsap';

// Caminar por la casa: arrastrar para mirar, rueda / flechas / WASD para
// avanzar, clic o toque en el suelo para ir hasta ahí (un círculo de tiza
// marca el sitio). La cámara se mueve con suavidad de cine: inercia, sin
// saltos ni balanceo, a la altura de los ojos, como en una grúa.
// El suelo caminable son regiones (rectángulos con su altura o rampa).

const EYE = 1.6;

export class Walker {
  constructor(engine, pointer, gyro, { regions, blocks = [], floors, cursor }) {
    this.engine = engine;
    this.pointer = pointer;
    this.gyro = gyro;
    this.regions = regions;
    this.blocks = blocks; // obstáculos: círculos { x, z, r } o rectángulos { x0, x1, z0, z1 }
    this.floors = floors; // mallas sobre las que se puede hacer clic
    this.cursor = cursor;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.yawT = 0;
    this.pitchT = 0;
    this.enabled = false;
    this.keys = new Set();
    this.push = 0;
    this.speed = 0;
    this.ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this.onTap = null;
    this.lastInput = 0;

    pointer.on('down', () => {
      if (!this.enabled || this.blocked?.()) return;
      gyro.enable();
      this.drag = { x: pointer.x, y: pointer.y, lx: pointer.x, ly: pointer.y, t: engine.time, moved: false };
      this.cancelTravel();
    });
    pointer.on('move', () => {
      if (!this.enabled) return;
      const d = this.drag;
      if (d && pointer.down) {
        if (!d.moved && Math.hypot(pointer.x - d.x, pointer.y - d.y) > 6) d.moved = true;
        if (d.moved) {
          // se arrastra la escena (como en Street View): a la derecha → la mirada va a la izquierda
          const k = (Math.PI * 0.55) / engine.view.width;
          this.yawT -= (pointer.x - d.lx) * k;
          this.pitchT = THREE.MathUtils.clamp(this.pitchT + (pointer.y - d.ly) * k, -0.6, 0.5);
          this.lastInput = engine.time;
        }
        d.lx = pointer.x;
        d.ly = pointer.y;
      } else if (pointer.type === 'mouse') this.hover();
    });
    pointer.on('up', () => {
      const d = this.drag;
      this.drag = null;
      if (!this.enabled || !d || d.moved || engine.time - d.t > 0.6) return;
      // Toque o clic sin arrastre: ¿un objeto? ¿el suelo?
      if (this.onTap?.(pointer.x, pointer.y)) return;
      const hit = this.pick(pointer.x, pointer.y);
      if (hit) this.walkTo(hit);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled || this.blocked?.()) return;
        const dy = THREE.MathUtils.clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -140, 140);
        this.cancelTravel();
        // como en una web: bajar = avanzar; el paso se reparte en un deslizamiento suave
        this.push = THREE.MathUtils.clamp(this.push + dy * 0.011, -3, 3);
        this.lastInput = engine.time;
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.blocked?.() || (e.target !== document.body && e.target !== engine.canvas)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        this.cancelTravel();
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Altura del suelo en (x, z) o null si ahí no se puede estar.
  floorAt(x, z) {
    for (const b of this.blocks) {
      if (b.r !== undefined ? (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r : x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return null;
    }
    for (const r of this.regions) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      if (r.ramp) {
        const t = THREE.MathUtils.clamp((r.ramp.axis === 'x' ? x - r.ramp.from : z - r.ramp.from) / r.ramp.len, 0, 1);
        return THREE.MathUtils.lerp(r.ramp.y0, r.ramp.y1, t);
      }
      return r.y ?? 0;
    }
    return null;
  }

  // Lleva el objetivo a una posición caminable (deslizando contra las paredes).
  clampTo(from, to) {
    if (this.floorAt(to.x, to.z) !== null) return to;
    if (this.floorAt(to.x, from.z) !== null) return to.set(to.x, to.y, from.z);
    if (this.floorAt(from.x, to.z) !== null) return to.set(from.x, to.y, to.z);
    return to.copy(from);
  }

  // Avanzar (o retroceder) en la dirección de la mirada.
  step(dist) {
    const f = this._v.set(Math.sin(this.yawT), 0, -Math.cos(this.yawT));
    const next = this._w.copy(this.target).addScaledVector(f, dist);
    // a pasos cortos, para deslizar bien contra mesas y paredes
    const n = Math.ceil(Math.abs(dist) / 0.15);
    const stepV = f.multiplyScalar(dist / n);
    const cur = this.target.clone();
    for (let i = 0; i < n; i++) {
      next.copy(cur).add(stepV);
      this.clampTo(cur, next);
      cur.copy(next);
    }
    this.target.copy(cur);
  }

  pick(x, y) {
    const { width, height } = this.engine.view;
    this.ray.setFromCamera({ x: (x / width) * 2 - 1, y: -(y / height) * 2 + 1 }, this.engine.camera);
    const hit = this.ray.intersectObjects(this.floors, false)[0];
    if (!hit || this.floorAt(hit.point.x, hit.point.z) === null) return null;
    return hit.point;
  }

  hover() {
    if (!this.cursor) return;
    const hit = this.enabled && !this.blocked?.() ? this.pick(this.pointer.x, this.pointer.y) : null;
    this.cursorTarget = hit ? 1 : 0;
    if (hit) this.cursor.position.set(hit.x, hit.y + 0.01, hit.z);
  }

  // Ir andando hasta un punto (clic en el suelo).
  walkTo(p) {
    const to = new THREE.Vector3(p.x, 0, p.z);
    // no pegarse a la pared: se para un poco antes
    const dir = to.clone().sub(this.target).setY(0);
    const len = dir.length();
    if (len < 0.2) return;
    to.copy(this.target).addScaledVector(dir.normalize(), Math.max(0, len - 0.35));
    this.flashCursor(p);
    // si hay una pared en medio, se va por las puertas
    const path = this.planner?.(this.target, to);
    if (path && path.length > 2) {
      const [a, b] = path.slice(-2);
      this.travelPath(path, Math.atan2(b.x - a.x, -(b.z - a.z)), this.pitchT * 0.5, { speed: 1.7, min: 1.4, max: 8 });
      return;
    }
    this.clampTo(this.target, to);
    this.travelTo(to, Math.atan2(dir.x, -dir.z), this.pitchT * 0.5, Math.min(3.5, 0.8 + len * 0.32));
  }

  // Viaje guiado: posición y mirada (yaw, pitch) en `duration` segundos.
  travelTo(to, yaw = this.yawT, pitch = this.pitchT, duration = 2.5, ease = 'power2.inOut') {
    this.cancelTravel();
    this.push = 0;
    // el giro por el camino más corto
    let dy = yaw - this.yawT;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const state = { k: 0 };
    const from = this.target.clone();
    const y0 = this.yawT;
    const p0 = this.pitchT;
    return new Promise((resolve) => {
      this.travel = gsap.to(state, {
        k: 1,
        duration,
        ease,
        onUpdate: () => {
          this.target.lerpVectors(from, to, state.k);
          this.yawT = y0 + dy * state.k;
          this.pitchT = p0 + (pitch - p0) * state.k;
        },
        onComplete: () => {
          this.travel = null;
          resolve();
        },
        onInterrupt: resolve,
      });
    });
  }

  // Recorrido guiado por una línea de puntos (pasa por puertas y escaleras):
  // la mirada sigue el camino un poco por delante y, al final, se vuelve
  // hacia `yaw`/`pitch`. Un arrastre o una tecla lo interrumpen.
  travelPath(points, yaw = this.yawT, pitch = this.pitchT, { speed = 1.4, min = 2, max = 9 } = {}) {
    this.cancelTravel();
    this.push = 0;
    const pts = points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    if (pts.length < 3 || len < 1.2) return this.travelTo(pts.at(-1), yaw, pitch, THREE.MathUtils.clamp(len / speed, 1.2, 3));
    const duration = THREE.MathUtils.clamp(len / speed, min, max);
    // Rumbo del camino (mirando 1,6 m por delante), desenrollado de forma continua.
    const N = 240;
    const ahead = Math.min(0.3, 1.6 / len);
    const head = new Float32Array(N + 1);
    const lift = new Float32Array(N + 1);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let prev = this.yawT;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      curve.getPointAt(Math.min(u, 1 - ahead), a);
      curve.getPointAt(Math.min(u + ahead, 1), b);
      const raw = Math.atan2(b.x - a.x, -(b.z - a.z));
      prev += Math.atan2(Math.sin(raw - prev), Math.cos(raw - prev));
      head[i] = prev;
      // en la escalera la mirada sube con los peldaños
      const ya = this.floorAt(a.x, a.z) ?? 0;
      const yb = this.floorAt(b.x, b.z) ?? ya;
      lift[i] = Math.atan2(yb - ya, Math.max(0.3, a.distanceTo(b))) * 0.7;
    }
    const endYaw = head[N] + Math.atan2(Math.sin(yaw - head[N]), Math.cos(yaw - head[N]));
    const y0 = this.yawT;
    const p0 = this.pitchT;
    const sample = (arr, u) => {
      const f = u * N;
      const i = Math.min(N - 1, Math.floor(f));
      return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
    };
    const smooth = THREE.MathUtils.smoothstep;
    const state = { k: 0 };
    return new Promise((resolve) => {
      this.travel = gsap.to(state, {
        k: 1,
        duration,
        ease: 'sine.inOut',
        onUpdate: () => {
          const u = state.k;
          curve.getPointAt(u, this.target);
          const s0 = smooth(u, 0, 0.16);
          const s1 = smooth(u, 0.7, 1);
          const h = sample(head, u);
          this.yawT = THREE.MathUtils.lerp(THREE.MathUtils.lerp(y0, h, s0), endYaw, s1);
          const walkPitch = 0.03 + sample(lift, u);
          this.pitchT = THREE.MathUtils.lerp(THREE.MathUtils.lerp(p0, walkPitch, s0), pitch, s1);
        },
        onComplete: () => {
          this.travel = null;
          resolve();
        },
        onInterrupt: resolve,
      });
    });
  }

  cancelTravel() {
    this.travel?.kill();
    this.travel = null;
  }

  flashCursor(p) {
    if (!this.cursor) return;
    this.cursor.position.set(p.x, p.y + 0.01, p.z);
    this.cursorPulse = 1;
  }

  place(pos, yaw, pitch = 0) {
    this.cancelTravel();
    this.push = 0;
    this.target.copy(pos);
    this.pos.copy(pos);
    this.yaw = this.yawT = yaw;
    this.pitch = this.pitchT = pitch;
    this.floorY = null;
  }

  update(dt, camera) {
    // teclado
    if (this.enabled && this.keys.size && !this.blocked?.()) {
      const fwd = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
      const turn = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
      if (fwd) this.step(fwd * dt * 1.8);
      this.yawT += turn * dt * 1.2;
      this.lastInput = this.engine.time;
    }
    // rueda: lo que queda por recorrer se consume poco a poco
    if (Math.abs(this.push) > 0.002) {
      const d = this.push * (1 - Math.exp(-dt * 2.6));
      this.push -= d;
      if (!this.blocked?.()) this.step(d);
    } else this.push = 0;
    // suavidad: posición y mirada siguen a su objetivo, como una cámara en grúa
    const prev = this._v.copy(this.pos);
    this.pos.lerp(this.target, 1 - Math.exp(-dt * 3.2));
    this.yaw += (this.yawT - this.yaw) * (1 - Math.exp(-dt * 4.5));
    this.pitch += (this.pitchT - this.pitch) * (1 - Math.exp(-dt * 4.5));
    const v = prev.distanceTo(this.pos) / Math.max(dt, 1e-4);
    this.speed += (v - this.speed) * (1 - Math.exp(-dt * 6));

    const floor = this.floorAt(this.pos.x, this.pos.z) ?? 0;
    this.floorY = THREE.MathUtils.damp(this.floorY ?? floor, floor, 8, dt);
    const g = this.gyro.active ? this.gyro : { x: 0, y: 0 };
    camera.position.set(this.pos.x, this.floorY + EYE, this.pos.z);
    const yaw = this.yaw + g.x * 0.25;
    const pitch = this.pitch - g.y * 0.15;
    const look = this._w.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.up.set(0, 1, 0);
    camera.lookAt(look.add(camera.position));

    // círculo de tiza en el suelo
    if (this.cursor) {
      this.cursorPulse = Math.max(0, (this.cursorPulse ?? 0) - dt * 1.4);
      const show = Math.max(this.cursorTarget ?? 0, this.cursorPulse) * (this.drag ? 0 : 1);
      const mat = this.cursor.material;
      mat.opacity += (show * 0.8 - mat.opacity) * (1 - Math.exp(-dt * 10));
      this.cursor.visible = mat.opacity > 0.01;
      const s = 1 + (1 - this.cursorPulse) * 0 + this.cursorPulse * 0.6;
      this.cursor.scale.setScalar(s);
    }
  }
}
