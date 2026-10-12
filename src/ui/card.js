import { t, onLangChange } from '../i18n/index.js';
import { formatPrice, onCurrencyChange } from './format.js';

const initials = (name) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Ficha flotante en vidrio esmerilado: foto, nombre, precio desde, estado y tipo.
export class ProjectCard {
  constructor(onOpen) {
    this.el = document.createElement('article');
    this.el.className = 'card';
    this.el.innerHTML = `
      <div class="card-photo"><span class="card-mark"></span><span class="card-state"></span></div>
      <div class="card-body">
        <p class="card-zone"></p>
        <h3 class="card-name"></h3>
        <p class="card-price"><small></small><b></b></p>
        <div class="card-tags"></div>
        <div class="card-actions">
          <button class="card-open" type="button"></button>
          <span class="card-hint"></span>
        </div>
      </div>`;
    this.project = null;
    this.el.querySelector('.card-open').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.project) onOpen(this.project);
    });
    onLangChange(() => this.render());
    onCurrencyChange(() => this.render());
  }

  set(project, { pinned = false } = {}) {
    this.project = project;
    this.pinned = pinned;
    this.render();
  }

  render() {
    const p = this.project;
    if (!p) return;
    const q = (s) => this.el.querySelector(s);
    const photo = q('.card-photo');
    const img = p.imagenes?.[0];
    photo.querySelector('img')?.remove();
    if (img) {
      const el = document.createElement('img');
      el.loading = 'lazy';
      el.decoding = 'async';
      el.alt = p.nombre;
      el.src = img;
      photo.prepend(el);
    }
    photo.classList.toggle('placeholder', !img);
    photo.dataset.id = p.id;
    q('.card-mark').textContent = img ? '' : initials(p.nombre);
    q('.card-state').textContent = p.estado ? t(`estado.${p.estado}`) : t('card.stateTbc');
    q('.card-state').classList.toggle('tbc', !p.estado);
    q('.card-zone').textContent = p.zona;
    q('.card-name').textContent = p.nombre;
    const price = formatPrice(p.precio_desde_mxn);
    q('.card-price small').textContent = price ? t('card.from') : '';
    q('.card-price b').textContent = price ?? t('card.priceTbc');
    q('.card-price').classList.toggle('tbc', !price);
    const tags = [...p.tipo.map((x) => t(`tipo.${x}`))];
    if (p.recamaras?.length) tags.push(t('card.bedrooms', { n: p.recamaras.join('–') }));
    if (p.m2?.min) tags.push(`${p.m2.min}${p.m2.max ? '–' + p.m2.max : '+'} m²`);
    q('.card-tags').innerHTML = tags.map((x) => `<span>${x}</span>`).join('');
    q('.card-open').textContent = t('card.open');
    q('.card-hint').textContent = this.pinned ? t('card.hintPinned') : t('card.hint');
    this.el.classList.toggle('pinned', this.pinned);
  }
}
