import gsap from 'gsap';

// Barra superior (sonido + navegación) y menú textual de respaldo.
// El menú repite las voces del sitio actual, centradas y en mayúsculas.
export class Chrome {
  constructor(root, { content, config, sound, onNavigate }) {
    this.content = content;
    this.onNavigate = onNavigate;
    const { ui } = content;

    this.bar = document.createElement('header');
    this.bar.className = 'topbar';
    this.bar.innerHTML = `
      <a class="wordmark" href="#entrada" data-route="entrada">${content.brand}</a>
      <div class="topbar-actions">
        <button class="sound-toggle" type="button" aria-pressed="false" aria-label="${ui.soundOn}">
          <span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="sound-label">${ui.sound}</span>
        </button>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="${ui.openMenu}">
          <span></span><span></span>
        </button>
      </div>`;

    this.nav = document.createElement('nav');
    this.nav.className = 'nav';
    this.nav.id = 'nav';
    this.nav.setAttribute('aria-hidden', 'true');
    this.nav.innerHTML = `
      <ul class="nav-list">
        ${content.nav
          .map(
            (row) =>
              `<li>${row
                .map((it) =>
                  it.external
                    ? `<a href="${config.links.facturacion}" target="_blank" rel="noopener">${it.label}</a>`
                    : `<a href="#${it.id}" data-route="${it.id}">${it.label}</a>`,
                )
                .join('<span class="nav-dot" aria-hidden="true">·</span>')}</li>`,
          )
          .join('')}
      </ul>
      <footer class="nav-foot">
        <a href="${config.links.instagram}" target="_blank" rel="noopener">${content.footer.instagram}</a>
        <p class="credit">${content.footer.credit}</p>
      </footer>`;

    root.append(this.bar, this.nav);
    this.items = [...this.nav.querySelectorAll('li, .nav-foot')];
    this.toggleBtn = this.bar.querySelector('.menu-toggle');
    this.soundBtn = this.bar.querySelector('.sound-toggle');

    this.toggleBtn.addEventListener('click', () => (this.open ? this.close() : this.show()));
    this.soundBtn.addEventListener('click', () => sound.toggle());
    sound.onChange((on) => {
      this.soundBtn.setAttribute('aria-pressed', String(on));
      this.soundBtn.setAttribute('aria-label', on ? ui.soundOff : ui.soundOn);
      this.bar.classList.toggle('sound-on', on);
    });

    root.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-route]');
      if (!a) return;
      e.preventDefault();
      this.close();
      this.onNavigate(a.dataset.route);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    });
    this.open = false;
  }

  // La barra aparece cuando la escena lo decide (en la intro, tras la unión de los círculos).
  reveal(visible = true) {
    this.bar.classList.toggle('visible', visible);
  }

  show() {
    this.open = true;
    this.nav.setAttribute('aria-hidden', 'false');
    this.nav.classList.add('open');
    this.bar.classList.add('nav-open');
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.toggleBtn.setAttribute('aria-label', this.content.ui.closeMenu);
    gsap.fromTo(this.nav, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out', overwrite: true });
    gsap.fromTo(
      this.items,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.05, delay: 0.1, overwrite: true },
    );
    this.nav.querySelector('a')?.focus({ preventScroll: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.nav.setAttribute('aria-hidden', 'true');
    this.bar.classList.remove('nav-open');
    this.toggleBtn.setAttribute('aria-expanded', 'false');
    this.toggleBtn.setAttribute('aria-label', this.content.ui.openMenu);
    gsap.to(this.nav, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => this.nav.classList.remove('open'),
    });
  }
}
