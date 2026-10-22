import gsap from 'gsap';

// Schermata di caricamento: fondo crema e barra rossa. Il progresso mostrato non
// supera mai quello reale e dura almeno `minDuration`, così la barra si vede scorrere.
// Alla fine la barra si allarga e invade tutto lo schermo di rosso.

const $ = (id) => document.getElementById(id);

export class Loader {
  constructor({ minDuration = 2600 } = {}) {
    this.real = 0;
    this.shown = 0;
    this.start = performance.now();
    this.min = minDuration;
    this.root = $('loader');
    this.bar = $('loader-bar');
    this.pct = $('loader-pct');
    this.done = new Promise((r) => (this.resolve = r));
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  set(p) {
    this.real = Math.max(this.real, Math.min(1, p));
  }

  tick(now) {
    // Il timestamp di rAF può precedere la creazione del loader: mai tempi negativi.
    const time = Math.min(1, Math.max(0, (now - this.start) / this.min));
    const goal = Math.min(this.real, Math.pow(time, 0.85));
    this.shown += (goal - this.shown) * 0.09;
    if (this.real >= 1 && time >= 1 && this.shown > 0.996) this.shown = 1;
    const p = Math.round(this.shown * 100);
    this.bar.style.transform = `scaleX(${this.shown})`;
    this.pct.textContent = String(p);
    this.root.setAttribute('aria-valuenow', String(p));
    if (this.shown >= 1) {
      this.resolve();
      return;
    }
    requestAnimationFrame(this.tick);
  }

  // La barra diventa sipario: prima a tutta larghezza, poi a tutta altezza.
  async cover() {
    const r = $('loader-track').getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const curtain = $('curtain');
    const inset = (t, rt, b, l) => `inset(${t}px ${rt}px ${b}px ${l}px)`;
    curtain.style.clipPath = inset(r.top, W - r.right, H - r.bottom, r.left);
    curtain.style.visibility = 'visible';
    await gsap.to(curtain, { clipPath: inset(r.top, 0, H - r.bottom, 0), duration: 0.6, ease: 'power3.inOut', delay: 0.15 });
    await gsap.to(curtain, { clipPath: inset(0, 0, 0, 0), duration: 0.85, ease: 'expo.inOut' });
    curtain.style.clipPath = 'none';
    this.root.remove();
    return curtain;
  }
}
