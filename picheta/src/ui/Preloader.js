import gsap from 'gsap';

// Precarga mínima: una línea de tiza que se llena con el porcentaje. Dura lo
// justo; la primera pantalla es la invitación a dibujar el círculo.
export class Preloader {
  constructor(root, content) {
    this.el = document.createElement('div');
    this.el.className = 'preloader';
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-label', content.ui.loading);
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    this.el.innerHTML = `<span class="preloader-line" aria-hidden="true"><i></i></span>`;
    root.appendChild(this.el);
    this.bar = this.el.querySelector('i');
    this.shown = { v: 0 };
    this.target = 0;
    this.render();
  }

  set(p) {
    this.target = Math.max(this.target, Math.min(1, p));
    gsap.to(this.shown, { v: this.target, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: () => this.render() });
  }

  render() {
    const v = this.shown.v;
    this.bar.style.transform = `scaleX(${v.toFixed(3)})`;
    this.el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }

  // Completa la línea y desaparece.
  finish(minTime = 0.35) {
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to({}, { duration: minTime });
      tl.to(this.shown, { v: 1, duration: 0.35, ease: 'power2.inOut', overwrite: true, onUpdate: () => this.render() }, 0);
      tl.to(this.el, { opacity: 0, duration: 0.45, ease: 'power2.in' });
      tl.set(this.el, { display: 'none' });
    });
  }
}
