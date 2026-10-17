import gsap from 'gsap';
import Lenis from 'lenis';
import { renderSection, renderFooter } from './sections.js';

// Paneles de sección: se abren sobre la sala 3D, que sigue viva detrás,
// desenfocada y oscurecida (PostFX). Scroll suave con Lenis; los bloques
// aparecen al entrar en pantalla; el menú es una baraja de cartas 3D.
export class Panel {
  constructor(root, { content, config, engine, onClose }) {
    this.content = content;
    this.config = config;
    this.onClose = onClose;
    this.el = document.createElement('section');
    this.el.className = 'panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.setAttribute('aria-labelledby', 'panel-title');
    this.el.tabIndex = -1;
    this.el.innerHTML = `
      <div class="panel-scrim"></div>
      <button class="panel-back" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        <span></span>
      </button>
      <div class="panel-scroll"><article class="panel-content"></article></div>`;
    root.appendChild(this.el);
    this.scroller = this.el.querySelector('.panel-scroll');
    this.body = this.el.querySelector('.panel-content');
    this.backLabel = this.el.querySelector('.panel-back span');
    this.el.querySelector('.panel-back').addEventListener('click', () => this.onClose());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.onClose();
    });

    this.lenis = new Lenis({ wrapper: this.scroller, content: this.body, autoRaf: false, lerp: 0.085 });
    engine.onFrame((dt, t) => this.isOpen && this.lenis.raf(t * 1000));

    this.io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { root: this.scroller, threshold: 0.2 },
    );
    this.isOpen = false;
  }

  open(id, { back = null } = {}) {
    if (!this.content.sections[id]) return;
    this.current = id;
    this.backLabel.textContent = back ?? this.content.ui.back;
    this.body.dataset.section = id;
    this.body.innerHTML = renderSection(id, this) + renderFooter(this);
    this.body.querySelectorAll('.reveal, .phrase, .text, .meta').forEach((n) => this.io.observe(n));
    if (id === 'menu') this.setupDeck();
    this.lenis.scrollTo(0, { immediate: true });
    this.lenis.resize();

    const wasOpen = this.isOpen;
    this.isOpen = true;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('open');
    document.documentElement.classList.add('panel-open');
    if (!wasOpen) gsap.fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.9, delay: 0.25, ease: 'power2.out', overwrite: true });
    gsap.fromTo(
      this.body.querySelectorAll('.sec-head > *'),
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.45 },
    );
    // El foco entra en el diálogo (Tab lleva a "Volver" y al contenido).
    this.el.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('panel-open');
    gsap.to(this.el, {
      opacity: 0,
      duration: 0.55,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => this.el.classList.remove('open'),
    });
  }

  // Menú: cartas apiladas en profundidad; se pasan con flechas, teclado o arrastre.
  setupDeck() {
    const deck = this.body.querySelector('.deck');
    const cards = [...deck.querySelectorAll('.dish')];
    const count = deck.querySelector('.deck-count');
    let i = 0;
    const layout = () => {
      cards.forEach((c, k) => {
        const d = k - i;
        const gone = d < 0;
        c.style.transform = gone
          ? `translate3d(-115%, 0, 60px) rotateY(38deg) rotateZ(-4deg)`
          : `translate3d(${d * 18}px, ${d * -10}px, ${-d * 70}px) rotateY(${-d * 4}deg)`;
        c.style.opacity = gone ? '0' : d > 3 ? '0' : String(1 - d * 0.18);
        c.style.zIndex = String(100 - Math.abs(d));
        c.setAttribute('aria-hidden', String(d !== 0));
      });
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    };
    const go = (k) => {
      i = Math.max(0, Math.min(cards.length - 1, k));
      layout();
    };
    deck.querySelector('.deck-prev').addEventListener('click', () => go(i - 1));
    deck.querySelector('.deck-next').addEventListener('click', () => go(i + 1));
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    });
    let sx = null;
    const stage = deck.querySelector('.deck-stage');
    stage.addEventListener('pointerdown', (e) => (sx = e.clientX));
    stage.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      else if (Math.abs(dx) < 6) go(i + 1 < cards.length ? i + 1 : 0);
      sx = null;
    });
    layout();
  }
}
