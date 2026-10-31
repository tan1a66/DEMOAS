import { t } from '../i18n.js';

/*
  Punti delle stanze sul plastico: toccandone uno si entra in quella scena.
  Usano lo stesso stile dei passi sulle foto; quello del percorso suggerito è evidenziato.
*/

export class MapMarkers {
  constructor(root, plastico, { scenes, onPick }) {
    this.root = root;
    this.plastico = plastico;
    this.items = scenes.filter((s) => s.map).map((scene) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mk mk--step mk--map';
      el.innerHTML = '<span class="mk__ring"></span><span class="mk__label"></span>';
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick(scene); });
      root.appendChild(el);
      return { el, scene };
    });
    this.refreshLang();
  }

  setNext(id) {
    this.items.forEach((it) => it.el.classList.toggle('is-next', it.scene.id === id));
  }

  refreshLang() {
    this.items.forEach((it) => {
      const name = t(it.scene.mapName || it.scene.name);
      it.el.querySelector('.mk__label').textContent = name;
      it.el.setAttribute('aria-label', name);
    });
  }

  setVisible(on) { this.root.classList.toggle('is-hidden', !on); }

  update() {
    const { w, h } = this.plastico.size;
    for (const it of this.items) {
      const p = this.plastico.project(it.scene.map);
      const off = !p || p.x < 20 || p.x > w - 20 || p.y < 20 || p.y > h - 20;
      it.el.classList.toggle('is-off', off);
      if (p) it.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
  }
}
