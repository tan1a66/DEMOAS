// Puntero unificado (ratón, dedo, lápiz) en píxeles CSS.
// Los tiempos usan el reloj del motor (now()), no performance.now(), para que
// el gesto funcione igual en el modo captura.
export class Pointer {
  constructor(surface, now) {
    this.now = now;
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.vx = 0;
    this.vy = 0;
    this.type = 'mouse';
    this.down = false;
    this.inside = false;
    this.lastMove = -Infinity;
    this.handlers = { move: new Set(), down: new Set(), up: new Set() };

    // Los gestos sólo empiezan sobre el lienzo (no sobre botones o paneles).
    surface.addEventListener('pointerdown', (e) => {
      this.type = e.pointerType || 'mouse';
      if (e.button > 0) return;
      this.down = true;
      this.inside = true;
      this.set(e.clientX, e.clientY, true);
      surface.setPointerCapture?.(e.pointerId);
      this.emit('down');
    });
    window.addEventListener('pointermove', (e) => {
      this.type = e.pointerType || 'mouse';
      this.inside = true;
      // Eventos agrupados: trazo más fino en movimientos rápidos.
      const list = e.getCoalescedEvents?.() ?? [];
      if (list.length > 1) for (const c of list) this.set(c.clientX, c.clientY);
      else this.set(e.clientX, e.clientY);
    });
    const up = () => {
      if (!this.down) return;
      this.down = false;
      this.emit('up');
      if (this.type !== 'mouse') this.inside = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('mouseleave', () => (this.inside = false));
    window.addEventListener('blur', () => {
      up();
      this.inside = false;
    });
  }

  on(type, fn) {
    this.handlers[type].add(fn);
    return () => this.handlers[type].delete(fn);
  }

  emit(type) {
    for (const fn of this.handlers[type]) fn(this);
  }

  set(x, y, silent = false) {
    const t = this.now();
    const dt = Math.max(1 / 240, t - this.lastMove);
    if (Number.isFinite(this.lastMove) && dt < 0.25) {
      const k = 0.35;
      this.vx += ((x - this.x) / dt - this.vx) * k;
      this.vy += ((y - this.y) / dt - this.vy) * k;
    }
    this.px = this.x;
    this.py = this.y;
    this.x = x;
    this.y = y;
    this.lastMove = t;
    if (!silent) this.emit('move');
  }

  // Llamar cada fotograma: la velocidad se apaga cuando el puntero se detiene.
  update(dt) {
    const k = Math.exp(-dt * 9);
    this.vx *= k;
    this.vy *= k;
  }

  get idle() {
    return this.now() - this.lastMove;
  }
}
