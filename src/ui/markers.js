import { t } from '../i18n.js';

/*
  Marcatori sopra la foto: passi (cerchio discreto con il nome della stanza di arrivo),
  scala (Subir/Bajar) e finiture (punto che pulsa). Restano incollati alla superficie
  della foto anche con la parallasse (la posizione usa la mappa di profondità).
  Il passo del percorso suggerito è evidenziato.
*/

const EDGE = 18;

export class Markers {
  constructor(root, viewer, { onStep, onStairs, onHotspot, route = [] }) {
    this.root = root;
    this.viewer = viewer;
    this.onStep = onStep;
    this.onStairs = onStairs;
    this.onHotspot = onHotspot;
    this.route = route;
    this.items = [];
    this.scene = null;
  }

  nextOf(id) {
    const i = this.route.indexOf(id);
    return i >= 0 && i < this.route.length - 1 ? this.route[i + 1] : null;
  }

  setScene(scene) {
    this.scene = scene;
    this.root.replaceChildren();
    this.items = [];
    const next = this.nextOf(scene.id);
    const name = (id) => t(this.viewer.scenes.get(id)?.name);

    (scene.steps || []).forEach((step) => {
      const el = this.#button('mk mk--step', `<span class="mk__ring"></span><span class="mk__label"></span>`);
      el.dataset.to = step.to;
      if (step.to === next) el.classList.add('is-next');
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onStep(step, scene); });
      this.items.push({ el, x: step.x, y: step.y, label: () => t(step.label) || name(step.to) });
    });

    if (scene.stairs) {
      const st = scene.stairs;
      const arrow = st.dir === 'down' ? '↓' : '↑';
      const el = this.#button('mk mk--stairs', `<span class="mk__arrow">${arrow}</span><span class="mk__label"></span>`);
      el.dataset.to = st.to;
      if (st.to === next) el.classList.add('is-next');
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onStairs(st, scene); });
      this.items.push({ el, x: st.x, y: st.y, label: () => t(st.label) });
    }

    (scene.hotspots || []).forEach((hs, i) => {
      const el = this.#button('mk mk--hotspot', `<span class="mk__dot"></span><span class="mk__label"></span>`);
      el.style.setProperty('--delay', `${(i * 0.7) % 2.4}s`);
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onHotspot(scene, i); });
      this.items.push({ el, x: hs.x, y: hs.y, label: () => t(hs.title) });
    });

    this.refreshLang();
  }

  #button(cls, html) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = cls;
    el.innerHTML = html;
    this.root.appendChild(el);
    return el;
  }

  refreshLang() {
    this.items.forEach((it) => {
      const text = it.label();
      const label = it.el.querySelector('.mk__label');
      label.textContent = text;
      it.el.setAttribute('aria-label', text);
      if (it.el.classList.contains('mk--stairs')) {
        it.el.style.setProperty('--w', `${Math.ceil(label.offsetWidth) + 58}px`);
      }
    });
  }

  setVisible(on) {
    this.root.classList.toggle('is-hidden', !on);
  }

  update() {
    const { w, h } = this.viewer.size;
    for (const it of this.items) {
      const p = this.viewer.project(it.x, it.y);
      if (!p) continue;
      const off = p.x < EDGE || p.x > w - EDGE || p.y < EDGE || p.y > h - EDGE;
      it.el.classList.toggle('is-off', off);
      it.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
  }
}
