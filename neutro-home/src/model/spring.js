// Muelle amortiguado (integración semi-implícita, estable con pasos pequeños).
export class Spring {
  constructor(value = 0, omega = 8, zeta = 0.5) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.omega = omega;
    this.zeta = zeta;
  }

  step(dt) {
    const { omega, zeta } = this;
    const a = -omega * omega * (this.x - this.target) - 2 * zeta * omega * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }

  set(value) {
    this.x = this.target = value;
    this.v = 0;
  }

  get resting() {
    // por debajo de esto el movimiento ya no se ve: se deja de renderizar
    return Math.abs(this.v) < 2e-3 && Math.abs(this.x - this.target) < 6e-4;
  }
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Resistencia elástica: crece cada vez menos y nunca supera `max`.
export const rubber = (x, max) => (x <= 0 ? 0 : max * (1 - 1 / (1 + x / max)));
