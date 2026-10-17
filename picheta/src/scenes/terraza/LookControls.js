import * as THREE from 'three';

// Mirada desde la terraza: arrastrar (ratón o dedo) gira la cabeza con
// inercia, limitada a 240°; en móvil el giroscopio suma un poco de giro.
// Un toque sin arrastre se entrega como "tap" (selección de objetos).
export class LookControls {
  constructor(engine, pointer, gyro, { yawLimit = (120 * Math.PI) / 180 } = {}) {
    this.engine = engine;
    this.pointer = pointer;
    this.gyro = gyro;
    this.yawLimit = yawLimit;
    this.yaw = 0;
    this.pitch = -0.1;
    this.vYaw = 0;
    this.vPitch = 0;
    this.enabled = false;
    this.onTap = () => {};
    this.dir = new THREE.Vector3();
    this.down = null;

    pointer.on('down', () => {
      if (!this.enabled) return;
      gyro.enable();
      this.down = { x: pointer.x, y: pointer.y, t: engine.time, lx: pointer.x, ly: pointer.y, drag: false };
      this.vYaw = this.vPitch = 0;
    });
    pointer.on('move', () => {
      const d = this.down;
      if (!this.enabled || !d || !pointer.down) return;
      if (!d.drag && Math.hypot(pointer.x - d.x, pointer.y - d.y) > 7) d.drag = true;
      if (!d.drag) return;
      const k = (Math.PI * 0.9) / engine.view.width; // media pantalla ≈ 80°
      const dx = (pointer.x - d.lx) * k;
      const dy = (pointer.y - d.ly) * k;
      this.yaw += dx;
      this.pitch += dy;
      const dt = Math.max(1 / 120, engine.time - (d.lt ?? engine.time - 1 / 60));
      this.vYaw = dx / dt;
      this.vPitch = dy / dt;
      d.lx = pointer.x;
      d.ly = pointer.y;
      d.lt = engine.time;
    });
    pointer.on('up', () => {
      const d = this.down;
      this.down = null;
      if (!this.enabled || !d) return;
      if (!d.drag && engine.time - d.t < 0.6) this.onTap(pointer.x, pointer.y);
      if (engine.time - (d.lt ?? 0) > 0.08) this.vYaw = this.vPitch = 0;
    });
  }

  update(dt) {
    if (!this.down) {
      const k = Math.exp(-dt * 4);
      this.yaw += this.vYaw * dt;
      this.pitch += this.vPitch * dt;
      this.vYaw *= k;
      this.vPitch *= k;
    }
    // Límites suaves: al pasarse, vuelve con un resorte.
    const over = Math.max(0, Math.abs(this.yaw) - this.yawLimit);
    if (over > 0) this.yaw -= Math.sign(this.yaw) * over * Math.min(1, dt * 8);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.55, 0.32);
  }

  // Dirección de la mirada (incluye el giroscopio).
  direction(target = this.dir) {
    const yaw = this.yaw + (this.gyro.active ? this.gyro.x * 0.45 : 0);
    const pitch = this.pitch - (this.gyro.active ? this.gyro.y * 0.3 : 0);
    return target.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }
}
