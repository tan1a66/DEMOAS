import gsap from 'gsap';
import Lenis from 'lenis';

// Paneles de sección: se abren sobre la escena 3D (que sigue viva, desenfocada
// y oscurecida detrás). Scroll suave con Lenis, frases que aparecen una a una.
// Versión base: el diseño definitivo de cada sección llega con la terraza.
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
      (entries) => entries.forEach((e) => e.target.classList.toggle('in', e.isIntersecting)),
      { root: this.scroller, threshold: 0.35 },
    );
    this.isOpen = false;
  }

  open(id, { fromTerrace = false } = {}) {
    const s = this.content.sections[id];
    if (!s) return;
    this.current = id;
    this.backLabel.textContent = fromTerrace ? this.content.ui.backTerrace : this.content.ui.back;
    this.body.innerHTML = `
      <header class="panel-head">
        <p class="panel-kicker">${this.content.brand}</p>
        <h2 class="panel-title" id="panel-title">${s.title}</h2>
        <p class="panel-lead">${s.lead}</p>
      </header>
      ${s.blocks.map(block).join('')}
      <footer class="panel-foot">
        <a href="${this.config.links.instagram}" target="_blank" rel="noopener">${this.content.footer.instagram}</a>
        <span aria-hidden="true">·</span>
        <a href="${this.config.links.facturacion}" target="_blank" rel="noopener">${this.content.footer.facturacion}</a>
        <p class="credit">${this.content.footer.credit}</p>
      </footer>`;
    this.body.querySelectorAll('.phrase, .text, .meta, .placeholder').forEach((n) => this.io.observe(n));
    this.lenis.scrollTo(0, { immediate: true });
    this.lenis.resize();

    const wasOpen = this.isOpen;
    this.isOpen = true;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('open');
    document.documentElement.classList.add('panel-open');
    if (!wasOpen) {
      gsap.fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out', overwrite: true });
    }
    gsap.fromTo(
      this.body.querySelectorAll('.panel-head > *'),
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.15 },
    );
    this.el.querySelector('.panel-back').focus({ preventScroll: true });
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
}

function block(b) {
  switch (b.type) {
    case 'phrase':
      return `<p class="phrase">${b.text}</p>`;
    case 'text':
      return `<p class="text">${b.text}</p>`;
    case 'meta':
      return `<p class="meta"><span>${b.label}</span>${b.text}</p>`;
    default:
      return `<p class="placeholder">${b.text}</p>`;
  }
}
