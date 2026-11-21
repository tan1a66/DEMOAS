// Recorrido sin textos: marcas de progreso a la derecha y una flecha que invita a seguir.

import { STOPS } from '../stops.js';

const $ = (id) => document.getElementById(id);
const LABELS = { trenza: 'Trenza Maya', makech: 'Lámpara Makech', sala: 'Tapiz y lámparas Trenza', fin: 'Alessia Studio' };

export class JourneyUI {
  constructor({ onGo, piece }) {
    this.onGo = onGo;
    this.piece = piece;
    this.current = -1;
    const dots = $('dots');
    this.dots = STOPS.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', LABELS[s.id]);
      b.addEventListener('click', () => onGo(i));
      dots.appendChild(b);
      return b;
    });
    this.next = $('nextHint');
    this.next.addEventListener('click', () => onGo(this.current + 1));
  }

  setStop(i) {
    if (i === this.current) return;
    this.current = i;
    this.dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    this.next.hidden = i >= STOPS.length - 1;
    this.piece.setStop(i);
  }

  setTravelling(on) {
    document.body.classList.toggle('travelling', on);
  }

  get catalogOpen() {
    return false;
  }
}
