// Giroscopio (móvil): inclinación del teléfono como paralaje / mirada.
// En iOS hay que pedir permiso dentro de un gesto del usuario: enable() se
// llama en el primer toque. x, y ∈ [-1, 1] respecto a la postura inicial.
export class Gyro {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.base = null;
    this.onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (!this.base) this.base = { beta: e.beta, gamma: e.gamma };
      // Recentrado lento: la postura "neutra" sigue al usuario si cambia de posición.
      this.base.beta += (e.beta - this.base.beta) * 0.004;
      this.base.gamma += (e.gamma - this.base.gamma) * 0.004;
      this.tx = clamp((e.gamma - this.base.gamma) / 25);
      this.ty = clamp((e.beta - this.base.beta) / 25);
      this.active = true;
    };
    this.tx = 0;
    this.ty = 0;
  }

  async enable() {
    if (this.requested || typeof DeviceOrientationEvent === 'undefined') return;
    this.requested = true;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return;
      }
      window.addEventListener('deviceorientation', this.onOrient);
    } catch {
      /* sin giroscopio: se usa sólo el dedo */
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 5);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
  }
}

const clamp = (v) => Math.max(-1, Math.min(1, v));
