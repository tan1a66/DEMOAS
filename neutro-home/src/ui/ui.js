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
    this.manual = new Set(); // piezas en las que el visitante ya ha elegido
    this._buildSwatches();
  }

  // Muestrario vivo: mientras el visitante no elige, la pieza cambia sola de color cada pocos
  // segundos; el ovillo correspondiente se "pulsa", así se entiende que los colores se tocan.
  // Cuando el visitante elige un color, esa pieza se queda con el suyo.
  auto(stopId) {
    if (!this.stop || this.stop.id !== stopId || this.manual.has(stopId)) return false;
    const cur = COLORS.findIndex((c) => c.id === this.chosen[stopId]);
    const next = COLORS[(cur + 1 + COLORS.length) % COLORS.length];
    const b = this.buttons.find((x) => x.dataset.id === next.id);
    b.classList.remove('ghost');
    void b.offsetWidth;
    b.classList.add('ghost');
    this.chosen[stopId] = next.id;
    this._render();
    this.onColor(stopId, next);
    return true;
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
    this.manual.add(this.stop.id);
    for (const b of this.buttons) b.classList.remove('ghost');
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
    for (const b of this.buttons) b.classList.remove('ghost');
    this._render();
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
  }

  touchedPiece() {}
}
