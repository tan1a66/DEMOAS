// Cartela de cada pieza de la muestra (todo en español): número, nombre, una línea, colores de
// la casa y el enlace a su ficha en neutro.com.mx. Sin fondos: vive de lado, sobre el muro.

import { COLORS } from '../config.js';
import { STOPS } from '../stops.js';

const $ = (id) => document.getElementById(id);

export class PieceUI {
  /**
   * onColor(stopId, color) — el usuario elige un color para la pieza de esa parada.
   * onLink(action) — enlaces internos (p. ej. abrir el catálogo).
   */
  constructor({ onColor, onLink }) {
    this.onColor = onColor;
    this.onLink = onLink;
    this.el = $('piece');
    this.hint = $('pieceHint');
    this.no = $('pieceNo');
    this.kicker = $('pieceKicker');
    this.title = $('pieceTitle');
    this.text = $('pieceText');
    this.colorsBox = $('pieceColors');
    this.nameEl = $('swatchName');
    this.cta = $('cta');
    this.link = $('pieceLink');
    this.note = $('pieceNote');
    this.toastEl = $('toast');
    this.stop = null;
    this.chosen = Object.fromEntries(STOPS.map((s) => [s.id, s.defaultColor || null]));
    this.touched = {};
    this._buildSwatches();
    this._bind();
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
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
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

  _renderSwatches() {
    const id = this.chosen[this.stop.id];
    for (const b of this.buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (!id && b === this.buttons[0]) ? 0 : -1;
    }
    const c = COLORS.find((x) => x.id === id);
    this.nameEl.textContent = c ? c.name : 'Combinación de la casa';
  }

  select(colorId) {
    if (!this.stop || !this.stop.colors) return;
    if (this.chosen[this.stop.id] === colorId) return;
    this.chosen[this.stop.id] = colorId;
    this._renderSwatches();
    this.nameEl.animate?.([{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], {
      duration: 600,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    });
    this.onColor(this.stop.id, COLORS.find((x) => x.id === colorId));
  }

  // Cambia la ficha a la de la parada i (con el título que aparece letra a letra).
  setStop(i) {
    const s = STOPS[i];
    if (this.stop === s) return;
    this.stop = s;
    document.body.dataset.stop = s.id;
    this.no.textContent = s.no;
    this.kicker.textContent = s.kicker;
    this.title.textContent = '';
    this.title.setAttribute('aria-label', s.title);
    // letra a letra, pero sin partir las palabras al cambiar de línea
    let k = 0;
    s.title.split(' ').forEach((word, wi) => {
      if (wi > 0) this.title.appendChild(document.createTextNode(' '));
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of word) {
        const span = document.createElement('span');
        span.textContent = ch;
        span.setAttribute('aria-hidden', 'true');
        span.style.transitionDelay = `${0.18 + k++ * 0.035}s`;
        w.appendChild(span);
      }
      this.title.appendChild(w);
    });
    this.text.textContent = s.text;
    this.hint.textContent = s.hint || '';
    this.hint.classList.toggle('gone', !s.hint || !!this.touched[s.id]);
    this.colorsBox.hidden = !s.colors;
    if (s.colors) this._renderSwatches();
    this.cta.hidden = !s.primary;
    if (s.primary) {
      this.cta.textContent = s.primary.label;
      this.cta.href = s.primary.href;
    }
    this.link.textContent = s.link.label;
    if (s.link.href) {
      this.link.href = s.link.href;
      this.link.target = '_blank';
    } else {
      this.link.removeAttribute('href');
      this.link.removeAttribute('target');
    }
    this.note.textContent = s.note || '';
    // reinicia la animación de entrada
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
  }

  touchedPiece(id) {
    if (this.touched[id]) return;
    this.touched[id] = true;
    if (this.stop && this.stop.id === id) this.hint.classList.add('gone');
  }

  colorName(id) {
    const c = COLORS.find((x) => x.id === this.chosen[id]);
    return c ? c.name : '';
  }

  _bind() {
    this.link.addEventListener('click', (e) => {
      if (this.stop && this.stop.link.action) {
        e.preventDefault();
        this.onLink(this.stop.link.action);
      }
    });
  }

  toast(text) {
    const el = this.toastEl;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove('on'), 4200);
  }
}
