// Sólo los colores de la casa (sin textos): una fila de ovillos bajo cada pieza.

import { COLORS } from '../config.js';
import { STOPS } from '../stops.js';

const $ = (id) => document.getElementById(id);

export class PieceUI {
  // onColor(stopId, color) — el usuario elige un color para la pieza de esa parada.
  constructor({ onColor }) {
    this.onColor = onColor;
    this.el = $('piece');
    this.stop = null;
    this.chosen = Object.fromEntries(STOPS.map((s) => [s.id, s.defaultColor || null]));
    this.used = false; // el visitante ya ha elegido algún color
    this.demoTimer = 0;
    this._buildSwatches();
    $('swatches').classList.add('invite');
  }

  // Demostración (una vez por pieza, mientras no se haya tocado ningún color): un ovillo se
  // "pulsa" solo, el color corre por la pieza y vuelve al de antes. Así se entiende sin palabras.
  demo(stopId, colorId) {
    if (this.used || !this.stop || this.stop.id !== stopId) return;
    const before = this.chosen[stopId];
    const b = this.buttons.find((x) => x.dataset.id === colorId);
    if (!b) return;
    b.classList.remove('ghost');
    void b.offsetWidth;
    b.classList.add('ghost');
    this.chosen[stopId] = colorId;
    this._render();
    this.onColor(stopId, COLORS.find((x) => x.id === colorId));
    clearTimeout(this.demoTimer);
    this.demoTimer = setTimeout(() => {
      b.classList.remove('ghost');
      if (this.used || this.chosen[stopId] !== colorId) return;
      this.chosen[stopId] = before;
      if (this.stop && this.stop.id === stopId) this._render();
      this.onColor(stopId, COLORS.find((x) => x.id === before) || null);
    }, 2300);
  }

  _buildSwatches() {
    const box = $('swatches');
    this.buttons = COLORS.map((c, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.name);
      b.setAttribute('aria-checked', 'false');
      b.style.setProperty('--c', c.hex);
      b.dataset.id = c.id;
      b.tabIndex = -1;
      b.addEventListener('click', () => this.select(c.id));
      b.addEventListener('keydown', (e) => {
        const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        e.stopPropagation();
        const next = COLORS[(idx + dir + COLORS.length) % COLORS.length];
        this.select(next.id);
        this.buttons.find((x) => x.dataset.id === next.id).focus();
      });
      box.appendChild(b);
      return b;
    });
  }

  _render() {
    const id = this.chosen[this.stop.id];
    for (const b of this.buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (!id && b === this.buttons[0]) ? 0 : -1;
    }
  }

  select(colorId) {
    if (!this.stop || !this.stop.colors) return;
    if (!this.used) {
      this.used = true;
      clearTimeout(this.demoTimer);
      $('swatches').classList.remove('invite');
      for (const b of this.buttons) b.classList.remove('ghost');
    }
    if (this.chosen[this.stop.id] === colorId) return;
    this.chosen[this.stop.id] = colorId;
    this._render();
    this.onColor(this.stop.id, COLORS.find((x) => x.id === colorId));
  }

  setStop(i) {
    const s = STOPS[i];
    if (this.stop === s) return;
    this.stop = s;
    document.body.dataset.stop = s.id;
    this._render();
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
  }

  touchedPiece() {}
}
