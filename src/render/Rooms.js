import { t, ui } from '../i18n.js';

/*
  Elenco verticale degli ambienti, sempre visibile sul lato sinistro: chi non trova una stanza
  navigando la trova qui. Esterno in alto, le stanze, la casa tagliata in fondo.
*/

export class Rooms {
  constructor(root, panos, { onPick }) {
    this.el = document.createElement('nav');
    this.el.className = 'rooms';
    this.items = [];
    const add = (id, label, cls = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rooms__item ${cls}`;
      b.dataset.id = id;
      b.innerHTML = '<i aria-hidden="true"></i><span></span>';
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(id); });
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.el.appendChild(b);
      this.items.push({ b, label });
    };
    add('exterior', () => ui('exterior'), 'rooms__item--ext');
    for (const p of panos) add(p.id, () => t(p.short || p.name));
    add('section', () => ui('section'), 'rooms__item--section');
    root.appendChild(this.el);
    this.refreshLang();
  }

  refreshLang() {
    this.el.setAttribute('aria-label', ui('rooms'));
    for (const it of this.items) it.b.querySelector('span').textContent = it.label();
  }

  setActive(id) {
    for (const it of this.items) it.b.classList.toggle('is-active', it.b.dataset.id === id);
  }

  setDisabled(on) { this.el.classList.toggle('is-busy', on); }
}
