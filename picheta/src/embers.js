// Brasas que suben del fogón (lienzo 2D sobre la foto, mezcla aditiva). Durante la película la
// cámara "las sigue": mientras sube, las brasas ganan velocidad hacia arriba en pantalla.

const rand = (a, b) => a + Math.random() * (b - a);

/** Sprite de brillo pre-dibujado: núcleo blanco-amarillo, halo naranja. */
function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 246, 214, 1)');
  grad.addColorStop(0.18, 'rgba(255, 196, 102, 0.95)');
  grad.addColorStop(0.45, 'rgba(255, 110, 30, 0.35)');
  grad.addColorStop(1, 'rgba(255, 80, 20, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

export class Embers {
  constructor(canvas, { max = 90 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprite = makeSprite();
    this.max = max;
    this.list = [];
    this.acc = 0;
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.dirty = false;
  }

  resize(w, h) {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  clear() {
    this.list.length = 0;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = false;
  }

  /**
   * @param {number} dt
   * @param {object} src  origen en pantalla { x, y, spread } (el fogón) o null (desde el borde inferior)
   * @param {number} rate brasas por segundo
   * @param {number} lift velocidad extra hacia arriba (px/s): la cámara que sube
   */
  update(dt, src, rate, lift) {
    const s = this.h / 844; // tamaños pensados para un móvil de 844 px de alto
    this.acc += rate * dt;
    while (this.acc >= 1 && this.list.length < this.max) {
      this.acc -= 1;
      const fromFire = src && src.y < this.h + 40;
      this.list.push({
        x: fromFire ? src.x + rand(-1, 1) * src.spread : this.w * (0.5 + rand(-0.42, 0.42)),
        y: fromFire ? src.y + rand(-0.3, 0.2) * src.spread : this.h + rand(0, 30),
        vx: rand(-14, 14) * s,
        vy: -rand(70, 190) * s,
        life: 0,
        ttl: rand(1.6, 3.6),
        size: rand(3, 9) * s,
        phase: rand(0, 6.28),
        wob: rand(0.8, 2.2),
      });
    }
    if (this.acc > 1) this.acc = 1;

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.dirty = true;
    ctx.globalCompositeOperation = 'lighter';
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt;
      if (p.life > p.ttl || p.y < -40) {
        list.splice(i, 1);
        continue;
      }
      // Remolino: deriva lateral que cambia con el tiempo; el aire caliente acelera al subir.
      p.vx += Math.sin(p.life * p.wob * 3 + p.phase) * 60 * s * dt;
      p.vx *= 1 - 0.8 * dt;
      p.x += p.vx * dt;
      p.y += (p.vy - lift) * dt;
      p.vy *= 1 + 0.05 * dt;
      const k = p.life / p.ttl;
      // Se encienden rápido, titilan y se apagan al enfriarse.
      const flick = 0.65 + 0.35 * Math.sin(p.life * 18 + p.phase * 3);
      const a = Math.min(1, p.life * 6) * (1 - k) * (1 - k) * flick;
      if (a <= 0.01) continue;
      const size = p.size * (1 - 0.5 * k);
      // Estela: el sprite se estira con la velocidad (en pantalla).
      const stretch = 1 + Math.min(2.5, Math.abs(p.vy - lift) / (420 * s));
      ctx.globalAlpha = a;
      ctx.drawImage(this.sprite, p.x - size / 2, p.y - (size * stretch) / 2, size, size * stretch);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
