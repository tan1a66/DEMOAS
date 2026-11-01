import gsap from 'gsap';
import { asset } from '../asset.js';
import { ui } from '../i18n.js';

/*
  La villa tagliata a metà (render/villa.py --view section): si vedono i due livelli, la doppia altezza,
  la camera e il bagno, la cucina e la piscina in sezione. Su schermi verticali l'immagine si fa scorrere.
*/

export class Section {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'section-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <button type="button" class="panel__close section-view__close" aria-label=""><span></span></button>
      <div class="section-view__scroll"><img alt="" decoding="async" draggable="false" /></div>
      <p class="section-view__title"></p>`;
    root.appendChild(this.el);
    this.img = this.el.querySelector('img');
    this.scroll = this.el.querySelector('.section-view__scroll');
    this.el.querySelector('.section-view__close').addEventListener('click', () => this.close());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    this.isOpen = false;
    this.refreshLang();
  }

  // di mattina la casa tagliata è troppo scura dentro (luci spente): si mostra quella del tramonto
  static src(time) { return asset(`/renders/section/section_${time === 'morning' ? 'sunset' : time}.jpg`); }

  open(time) {
    this.img.src = Section.src(time);
    this.isOpen = true;
    this.el.setAttribute('aria-hidden', 'false');
    gsap.fromTo(this.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(this.img, { scale: 1.06 }, { scale: 1, duration: 1.4, ease: 'power3.out' });
    const center = () => { this.scroll.scrollLeft = (this.scroll.scrollWidth - this.scroll.clientWidth) * 0.45; };
    if (this.img.complete) center(); else this.img.onload = center;
  }

  setTime(time) {
    if (this.isOpen) this.img.src = Section.src(time);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.to(this.el, { autoAlpha: 0, duration: 0.4, onComplete: () => this.el.setAttribute('aria-hidden', 'true') });
    this.onClose?.();
  }

  refreshLang() {
    this.el.querySelector('.section-view__close').setAttribute('aria-label', ui('close'));
    this.el.querySelector('.section-view__title').textContent = ui('sectionTitle');
    this.img.alt = ui('sectionTitle');
  }
}
