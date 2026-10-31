import { t, ui } from '../i18n.js';

/*
  Marcatori sopra i render (stesso stile del visore precedente):
  - sul giro esterno: ingressi alle stanze (cerchio con il nome), visibili solo dal lato giusto;
  - nei panorami: passi verso le altre stanze (cerchio), scala (Sali/Scendi), finiture (punto che pulsa).
  Le posizioni sono punti 3D della villa, proiettati a ogni fotogramma dalla vista attiva.
*/

const EDGE = 16;

export class Hud {
  constructor(root) {
    this.root = root;
    this.items = [];
    this.view = null;
  }

  clear() {
    this.root.replaceChildren();
    this.items = [];
  }

  #button(cls, html, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = cls;
    el.innerHTML = html;
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(el);
    return el;
  }

  /** Ingressi sul giro esterno. */
  setOrbit(view, entries, panos, { onEnter, next }) {
    this.clear();
    this.view = view;
    for (const en of entries) {
      const pano = panos.get(en.to);
      const el = this.#button('mk mk--step mk--entry', '<span class="mk__ring"></span><span class="mk__label"></span>', () => onEnter(en));
      if (en.to === next) el.classList.add('is-next');
      this.items.push({ el, point: en.at, normal: en.normal, label: () => t(pano.name) });
    }
    this.refreshLang();
  }

  /** Passi e finiture di un panorama. */
  setPano(view, pano, panos, { onStep, onHotspot, next }) {
    this.clear();
    this.view = view;
    for (const ln of pano.links || []) {
      const to = panos.get(ln.to);
      const stairs = ln.stairs;
      const el = stairs
        ? this.#button('mk mk--stairs', `<span class="mk__arrow">${stairs === 'down' ? '↓' : '↑'}</span><span class="mk__label"></span>`, () => onStep(ln))
        : this.#button('mk mk--step', '<span class="mk__ring"></span><span class="mk__label"></span>', () => onStep(ln));
      if (ln.to === next) el.classList.add('is-next');
      this.items.push({
        el, point: ln.at,
        label: () => (stairs ? `${ui(stairs)} · ${t(to.name)}` : t(to.name)),
        stairs: !!stairs,
      });
    }
    (pano.hotspots || []).forEach((hs, i) => {
      const el = this.#button('mk mk--hotspot', '<span class="mk__dot"></span><span class="mk__label"></span>', () => onHotspot(pano, i));
      el.style.setProperty('--delay', `${(i * 0.7) % 2.4}s`);
      this.items.push({ el, point: hs.at, label: () => t(hs.title) });
    });
    this.refreshLang();
  }

  refreshLang() {
    for (const it of this.items) {
      const text = it.label();
      const label = it.el.querySelector('.mk__label');
      label.textContent = text;
      it.el.setAttribute('aria-label', text);
      if (it.stairs) it.el.style.setProperty('--w', `${Math.ceil(label.offsetWidth) + 58}px`);
    }
  }

  setVisible(on) { this.root.classList.toggle('is-hidden', !on); }

  update() {
    if (!this.view) return;
    const { w, h } = this.view.size;
    for (const it of this.items) {
      const p = this.view.project(it.point, it.normal);
      const off = !p || p.x < EDGE || p.x > w - EDGE || p.y < EDGE || p.y > h - EDGE;
      it.el.classList.toggle('is-off', off);
      if (p) it.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
  }
}
