import gsap from 'gsap';
import Lenis from 'lenis';
import { renderSection, renderFooter } from './sections.js';

// Paneles de sección: se abren sobre la sala 3D, que sigue viva detrás,
// desenfocada y oscurecida (PostFX). Scroll suave con Lenis; los bloques
// aparecen al entrar en pantalla; el menú es una carta con atajos por portada.
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

  // side: el panel ocupa un lado (abajo en el teléfono) y la casa sigue a la vista.
  open(id, { back = null, side = false } = {}) {
    if (!this.content.sections[id]) return;
    this.current = id;
    this.el.classList.toggle('side', side);
    this.backLabel.textContent = back ?? this.content.ui.back;
    this.body.dataset.section = id;
    this.body.innerHTML = renderSection(id, this) + renderFooter(this);
    this.body.querySelectorAll('.reveal, .phrase, .text, .meta').forEach((n) => this.io.observe(n));
    if (id === 'menu') this.setupMenu();
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

  // Menú: los atajos de cada portada llevan (con el scroll suave) a su lista.
  setupMenu() {
    this.body.querySelectorAll('.menu-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        const course = this.body.querySelector(`.course[data-course="${b.dataset.course}"]`);
        if (course) this.lenis.scrollTo(course, { offset: -90, duration: 1.2 });
      }),
    );
  }
}
