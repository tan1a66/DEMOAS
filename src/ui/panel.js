import gsap from 'gsap';
import { t, ui } from '../i18n.js';
import { asset } from '../asset.js';

/*
  Pannello della finitura: ritaglio ravvicinato ad alta risoluzione, nome del materiale
  e una riga di testo. Dal basso su mobile, laterale su desktop.
*/

const isWide = () => matchMedia('(min-width: 820px)').matches;

export class Panel {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('aside');
    this.el.className = 'panel';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <button type="button" class="panel__close" aria-label=""><span></span></button>
      <figure class="panel__media"><img alt="" decoding="async" /></figure>
      <div class="panel__body">
        <p class="panel__kicker"></p>
        <h2 class="panel__title"></h2>
        <p class="panel__text"></p>
      </div>`;
    this.scrim = document.createElement('div');
    this.scrim.className = 'panel-scrim';
    root.append(this.scrim, this.el);
    this.img = this.el.querySelector('img');
    this.el.querySelector('.panel__close').addEventListener('click', () => this.close());
    this.scrim.addEventListener('click', () => this.close());
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    this.current = null;
    this.isOpen = false;
  }

  open(scene, index) {
    const hs = scene.hotspots[index];
    if (!hs) return;
    this.current = { scene, index };
    this.img.src = asset(`/crops/${scene.id}-${index + 1}.jpg`);
    this.refreshLang();
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('is-open');
    this.scrim.classList.add('is-open');
    const from = isWide() ? { xPercent: 105, yPercent: 0 } : { yPercent: 105, xPercent: 0 };
    gsap.killTweensOf(this.el);
    gsap.fromTo(this.el, { ...from, autoAlpha: this.isOpen ? 1 : 0 }, {
      xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.65, ease: 'power3.out',
    });
    this.isOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.scrim.classList.remove('is-open');
    const to = isWide() ? { xPercent: 105 } : { yPercent: 105 };
    gsap.killTweensOf(this.el);
    gsap.to(this.el, {
      ...to, autoAlpha: 0, duration: 0.45, ease: 'power3.in',
      onComplete: () => {
        this.el.classList.remove('is-open');
        this.el.setAttribute('aria-hidden', 'true');
      },
    });
  }

  refreshLang() {
    this.el.querySelector('.panel__close').setAttribute('aria-label', ui('close'));
    if (!this.current) return;
    const hs = this.current.scene.hotspots[this.current.index];
    this.el.querySelector('.panel__kicker').textContent = ui('finish');
    this.el.querySelector('.panel__title').textContent = t(hs.title);
    this.el.querySelector('.panel__text').textContent = t(hs.text);
    this.img.alt = t(hs.title);
  }
}
