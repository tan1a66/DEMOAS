import gsap from 'gsap';
import data from '../data/villa.json';
import { getLang, setLang, t, ui } from '../i18n.js';

/*
  Interfaccia fissa e minima:
  - marchio in alto a sinistra: nome del progetto e "DEMO ALESSIA STUDIO";
  - indicatore discreto: livello · stanza;
  - selettore ES/IT;
  - indicatore di caricamento e messaggi brevi.
*/

export class Chrome {
  constructor(root) {
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
      <header class="brand">
        <span class="brand__name"></span>
        <span class="brand__line"></span>
      </header>
      <div class="where" aria-live="polite">
        <span class="where__level"></span>
        <span class="where__room"></span>
      </div>
      <nav class="lang" aria-label="Idioma / Lingua"></nav>
      <div class="loader" aria-hidden="true"><span></span></div>
      <div class="toast" role="status"></div>
    `);
    this.$ = (s) => root.querySelector(s);
    this.$('.brand__name').textContent = data.villa.name;
    this.$('.brand__line').textContent = data.villa.brandline;

    const nav = this.$('.lang');
    data.i18n.langs.forEach((code) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = code.toUpperCase();
      b.dataset.lang = code;
      b.addEventListener('click', () => setLang(code));
      nav.appendChild(b);
    });
    this.scene = null;
    this.refreshLang();
  }

  setScene(scene) {
    this.scene = scene;
    const where = this.$('.where');
    gsap.fromTo(where, { autoAlpha: 0, y: -4 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' });
    this.refreshLang();
  }

  refreshLang() {
    this.root.querySelectorAll('.lang button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.lang === getLang());
      b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
    });
    if (!this.scene) return;
    const level = data.levels.find((l) => l.id === this.scene.level);
    this.$('.where__level').textContent = level ? t(level.name) : '';
    this.$('.where__room').textContent = t(this.scene.name);
  }

  loading(on) {
    this.$('.loader').classList.toggle('is-on', on);
    this.$('.loader').setAttribute('aria-label', on ? ui('loading') : '');
  }

  toast(text, ms = 2200) {
    const el = this.$('.toast');
    el.textContent = text;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    gsap.to(el, { autoAlpha: 0, duration: 0.5, delay: ms / 1000, ease: 'power2.in' });
  }
}
