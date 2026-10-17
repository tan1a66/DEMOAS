import gsap from 'gsap';
import { mulberry32 } from '../scenes/intro/LogoParticles.js';

// Precarga: un único círculo trazado a mano que se dibuja con el porcentaje.
export class Preloader {
  constructor(root, content) {
    this.el = document.createElement('div');
    this.el.className = 'preloader';
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-label', content.ui.loading);
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    this.el.innerHTML = `
      <svg viewBox="-60 -60 120 120" aria-hidden="true"><path d="${scribblePath()}" pathLength="1" /></svg>
      <span class="preloader-pct">000</span>`;
    root.appendChild(this.el);
    this.path = this.el.querySelector('path');
    this.pct = this.el.querySelector('.preloader-pct');
    this.shown = { v: 0 };
    this.target = 0;
    this.render();
  }

  set(p) {
    this.target = Math.max(this.target, Math.min(1, p));
    gsap.to(this.shown, { v: this.target, duration: 0.7, ease: 'power2.out', overwrite: true, onUpdate: () => this.render() });
  }

  render() {
    const v = this.shown.v;
    this.path.style.strokeDashoffset = String(1 - v);
    this.pct.textContent = String(Math.round(v * 100)).padStart(3, '0');
    this.el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }

  // Completa el trazo (mínimo ~1,4 s en pantalla para que se lea el gesto) y desaparece.
  finish(minTime = 1.4) {
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to({}, { duration: minTime });
      tl.to(this.shown, { v: 1, duration: 0.6, ease: 'power2.inOut', overwrite: true, onUpdate: () => this.render() }, 0);
      tl.to(this.pct, { opacity: 0, duration: 0.4 });
      tl.to(this.el.querySelector('svg'), { scale: 1.12, opacity: 0, duration: 0.8, ease: 'power3.in' }, '<');
      tl.set(this.el, { display: 'none' });
    });
  }
}

// Óvalo irregular de algo más de una vuelta, como el trazo del logo.
function scribblePath() {
  const r = mulberry32(501);
  const ph = [r() * 6, r() * 6];
  const pts = [];
  const turns = 1.08;
  const n = 160;
  const a0 = -Math.PI * 0.62;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + u * turns * Math.PI * 2;
    const k = 1 + 0.025 * Math.sin(2 * a + ph[0]) + 0.018 * Math.sin(3 * a + ph[1]) + 0.04 * u;
    pts.push(`${(Math.cos(a) * 40 * k).toFixed(2)},${(Math.sin(a) * 46 * k).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
}
