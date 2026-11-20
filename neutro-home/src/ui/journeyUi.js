// Interfaz del recorrido: texto de cada parada, navegación (historia · catálogo · seguir),
// puntos de progreso y el catálogo (panel sobre la escena).

import { STOPS, CATALOG, CATALOG_ALL } from '../stops.js';

const $ = (id) => document.getElementById(id);
const images = import.meta.glob('../assets/catalogo/*.jpg', { eager: true, query: '?url', import: 'default' });
const imgFor = (name) => images[`../assets/catalogo/${name}.jpg`];

export class JourneyUI {
  constructor({ onGo, piece }) {
    this.onGo = onGo;
    this.piece = piece;
    this.navNext = $('navNext');
    this.current = -1;

    $('journeyNav').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const go = b.dataset.go;
      if (go === 'catalogo') this.openCatalog();
      else if (go === 'historia') onGo(STOPS.findIndex((s) => s.id === 'historia'));
      else if (go === 'next') onGo(this.current >= STOPS.length - 1 ? 0 : this.current + 1);
    });

    const dots = $('dots');
    this.dots = STOPS.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', i === 0 ? 'Trenza Maya' : s.title);
      b.addEventListener('click', () => onGo(i));
      dots.appendChild(b);
      return b;
    });

    this._buildCatalog();
  }

  setStop(i) {
    if (i === this.current) return;
    this.current = i;
    this.dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    this.navNext.textContent = i >= STOPS.length - 1 ? 'Volver al inicio' : 'Continúa el viaje';
    this.piece.setStop(i);
  }

  // mientras la cámara viaja, el texto se retira
  setTravelling(on) {
    document.body.classList.toggle('travelling', on);
  }

  _buildCatalog() {
    const grid = $('catalogGrid');
    for (const item of CATALOG) {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = document.createElement('img');
      img.alt = item.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.dataset.src = imgFor(item.img);
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = item.name;
      const more = document.createElement('span');
      more.className = 'card-more';
      more.textContent = 'Ver pieza';
      a.append(img, name, more);
      grid.appendChild(a);
    }
    $('catalogAll').href = CATALOG_ALL;
    $('catalogClose').addEventListener('click', () => this.closeCatalog());
    $('catalogOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'catalogOverlay') this.closeCatalog();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCatalog();
    });
  }

  get catalogOpen() {
    return !$('catalogOverlay').hidden;
  }

  openCatalog() {
    const ov = $('catalogOverlay');
    for (const img of ov.querySelectorAll('img[data-src]')) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('on'));
    $('catalogClose').focus({ preventScroll: true });
  }

  closeCatalog() {
    const ov = $('catalogOverlay');
    if (ov.hidden) return;
    ov.classList.remove('on');
    setTimeout(() => (ov.hidden = true), 450);
  }
}
