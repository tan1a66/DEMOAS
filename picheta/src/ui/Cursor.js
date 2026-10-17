// Cursor propio en pantallas con ratón: un punto de tiza que sigue al puntero
// con un poco de inercia y se abre en anillo sobre lo que se puede pulsar.
export class Cursor {
  constructor(root, engine, pointer) {
    if (!matchMedia('(pointer: fine)').matches) return;
    this.el = document.createElement('div');
    this.el.className = 'cursor hidden';
    this.el.setAttribute('aria-hidden', 'true');
    root.appendChild(this.el);
    document.documentElement.classList.add('has-cursor');
    this.x = pointer.x;
    this.y = pointer.y;
    engine.onFrame((dt) => {
      const k = 1 - Math.exp(-dt * 22);
      this.x += (pointer.x - this.x) * k;
      this.y += (pointer.y - this.y) * k;
      this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
      this.el.classList.toggle('hidden', !pointer.inside);
    });
    window.addEventListener('pointerover', (e) => {
      this.el.classList.toggle('hover', !!e.target.closest?.('a, button'));
    });
  }
}
