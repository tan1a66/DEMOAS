import gsap from 'gsap';
import data from '../data/villa.json';
import { t, ui } from '../i18n.js';

/*
  Piantina della casa: pulsante in basso a sinistra con la pianta in miniatura; toccandolo si apre grande
  con i due livelli. Ogni ambiente si accende con un'aura dorata quando lo si seleziona; poi "Entrar".
  Coordinate della villa: x verso la strada (destra), z verso sud (in basso). Il mare è a sinistra.
*/

const P = (pts) => pts.map(([x, z]) => `${x},${z}`).join(' ');

// ambienti (poligoni in pianta) per livello; "to" = panorama, null = solo disegno
export const LEVELS = [
  {
    id: 'nivel-mar', view: [-11, -5, 27.5, 20],
    shapes: [
      { to: 'terrazza', pts: [[-9.8, -3.4], [0, -3.4], [0, 14.6], [-9.8, 14.6]] },
      { to: 'soggiorno', pts: [[0, 0], [5, 0], [5, 6.2], [0, 6.2]] },
      { to: 'cucina', pts: [[5, 0], [14.4, 0], [14.4, 10.9], [0.3, 10.9], [0.3, 6.2], [5, 6.2]] },
      { to: 'passaggio', pts: [[4.2, 10.95], [14.7, 10.95], [14.7, 12.45], [4.2, 12.45]] },
    ],
    pool: [[-8.6, 0.8], [-4.4, 0.8], [-4.4, 6], [-2.45, 6], [-2.45, 9.3], [-8.6, 9.3]],
  },
  {
    id: 'nivel-calle', view: [-3.5, -2, 18.5, 14],
    shapes: [
      { to: null, label: () => ui('void'), pts: [[0, 0.2], [4.6, 0.2], [4.6, 5.9], [0, 5.9]], cls: 'is-void' },
      { to: 'ballatoio', pts: [[4.6, 0.2], [6, 0.2], [6, 5.9], [4.6, 5.9]], vertical: true },
      { to: 'camera', pts: [[0, 5.9], [6, 5.9], [6, 8.85], [0, 8.85]] },
      { to: 'bagno', pts: [[6.12, 4.95], [9.5, 4.95], [9.5, 10.9], [6.12, 10.9]] },
      { to: null, label: () => ui('guestRoom'), pts: [[9.62, 6], [13.3, 6], [13.3, 10.9], [9.62, 10.9]], cls: 'is-plain' },
    ],
  },
];

export function svgLevel(level, panos, mini = false) {
  const L = data.levels.find((l) => l.id === level.id);
  const [vx, vz, vw, vh] = level.view;
  const outline = L ? `<polygon class="plan__outline" points="${P(L.outline)}"/>` : '';
  const pool = level.pool ? `<polygon class="plan__pool" points="${P(level.pool)}"/>` : '';
  const shapes = level.shapes.map((s, i) => {
    const name = s.to ? t(panos.get(s.to).short || panos.get(s.to).name) : s.label();
    const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length;
    const cz = s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length;
    return `<g class="plan__room ${s.to ? 'is-link' : ''} ${s.cls || ''}" data-to="${s.to || ''}" data-i="${i}">
      <polygon points="${P(s.pts)}"/>
      ${mini ? '' : `<text x="${cx}" y="${cz}" text-anchor="middle" dominant-baseline="middle"${s.vertical ? ` transform="rotate(-90 ${cx} ${cz})"` : ''}>${name}</text>`}
    </g>`;
  }).join('');
  return `<svg class="plan__svg" viewBox="${vx} ${vz} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">${outline}${pool}${shapes}</svg>`;
}

export class Plan {
  constructor(root, panos, { onEnter }) {
    this.panos = panos;
    this.onEnter = onEnter;
    this.selected = null;
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'plan-btn';
    this.btn.innerHTML = `<span class="plan-btn__mini">${svgLevel(LEVELS[0], panos, true)}</span><span class="plan-btn__label"></span>`;
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); this.open(); });
    this.el = document.createElement('div');
    this.el.className = 'plan';
    this.el.setAttribute('aria-hidden', 'true');
    root.append(this.btn, this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    this.render();
  }

  render() {
    this.el.innerHTML = `
      <button type="button" class="panel__close plan__close" aria-label="${ui('close')}"><span></span></button>
      <p class="plan__title">${ui('plan')}</p>
      <div class="plan__levels">
        ${LEVELS.map((lv) => `<figure class="plan__level"><figcaption>${t(data.levels.find((l) => l.id === lv.id)?.name)}</figcaption>${svgLevel(lv, this.panos)}</figure>`).join('')}
      </div>
      <div class="plan__bar">
        <button type="button" class="plan__ext">${ui('exterior')}</button>
        <span class="plan__sel"></span>
        <button type="button" class="plan__go" disabled>${ui('enter')}</button>
      </div>`;
    this.el.querySelector('.plan__close').addEventListener('click', () => this.close());
    this.el.querySelector('.plan__ext').addEventListener('click', () => { this.close(); this.onEnter('exterior'); });
    this.el.querySelector('.plan__go').addEventListener('click', () => this.#go());
    this.el.querySelectorAll('.plan__room.is-link').forEach((g) => {
      g.addEventListener('click', () => {
        if (this.selected === g.dataset.to) this.#go();
        else this.select(g.dataset.to);
      });
    });
    this.btn.querySelector('.plan-btn__label').textContent = ui('plan');
    this.btn.setAttribute('aria-label', ui('plan'));
    if (this.selected) this.select(this.selected);
  }

  select(id) {
    this.selected = id;
    this.el.querySelectorAll('.plan__room').forEach((g) => g.classList.toggle('is-selected', g.dataset.to === id));
    const p = this.panos.get(id);
    this.el.querySelector('.plan__sel').textContent = p ? t(p.name) : '';
    this.el.querySelector('.plan__go').disabled = !p;
  }

  setCurrent(id) {
    this.current = id;
    this.el.querySelectorAll('.plan__room').forEach((g) => g.classList.toggle('is-current', g.dataset.to === id));
  }

  #go() {
    if (!this.selected) return;
    const id = this.selected;
    this.close();
    this.onEnter(id);
  }

  open() {
    this.isOpen = true;
    this.select(this.current && this.panos.has(this.current) ? this.current : null);
    this.el.setAttribute('aria-hidden', 'false');
    gsap.fromTo(this.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(this.el.querySelectorAll('.plan__level'), { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out' });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.to(this.el, { autoAlpha: 0, duration: 0.35, onComplete: () => this.el.setAttribute('aria-hidden', 'true') });
  }

  refreshLang() { this.render(); this.setCurrent(this.current); }
}
