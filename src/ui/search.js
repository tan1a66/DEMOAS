import { t, onLangChange } from '../i18n/index.js';
import { formatPrice, onCurrencyChange } from './format.js';

// Rangos de precio (MXN). El sitio actual usa un slider $500,000 – $10,000,000;
// aquí se ofrecen rangos con el número de resultados de cada opción.
export const PRICE_RANGES = [
  { id: 'p1', min: 0, max: 1_500_000 },
  { id: 'p2', min: 1_500_000, max: 3_000_000 },
  { id: 'p3', min: 3_000_000, max: 6_000_000 },
  { id: 'p4', min: 6_000_000, max: Infinity },
];
const CITIES = ['merida', 'costa', 'playa'];
const TYPES = ['departamentos', 'lotes', 'locales', 'oficinas'];
const BEDROOMS = ['1', '2', '3', '4'];

export const EMPTY = { ciudad: '', tipo: '', precio: '', recamaras: '' };

export const isActive = (f) => Object.values(f).some(Boolean);

// Un proyecto sin dato (precio o recámaras en null) no coincide cuando ese filtro está activo.
export function matches(p, f) {
  if (f.ciudad && p.ciudad !== f.ciudad) return false;
  if (f.tipo && !p.tipo.includes(f.tipo)) return false;
  if (f.precio) {
    const r = PRICE_RANGES.find((x) => x.id === f.precio);
    if (p.precio_desde_mxn == null || p.precio_desde_mxn < r.min || p.precio_desde_mxn >= r.max) return false;
  }
  if (f.recamaras) {
    const n = +f.recamaras;
    if (!p.recamaras?.some((x) => (n === 4 ? x >= 4 : x === n))) return false;
  }
  return true;
}

export class SearchBar {
  constructor(root, projects, cityNames, onChange) {
    this.projects = projects;
    this.cityNames = cityNames;
    this.onChange = onChange;
    this.filters = { ...EMPTY };
    root.innerHTML = `
      <button class="search-toggle" type="button" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <span class="st-label"></span><b class="st-count"></b>
      </button>
      <form class="search" role="search">
        <label class="field"><span data-k="search.city"></span><select name="ciudad"></select></label>
        <label class="field"><span data-k="search.type"></span><select name="tipo"></select></label>
        <label class="field"><span data-k="search.price"></span><select name="precio"></select></label>
        <label class="field"><span data-k="search.bedrooms"></span><select name="recamaras"></select></label>
        <div class="search-end">
          <output class="search-count"></output>
          <button class="search-clear" type="button"></button>
          <button class="search-done" type="button"></button>
        </div>
        <p class="search-note"></p>
      </form>`;
    this.root = root;
    this.form = root.querySelector('form');
    this.toggleBtn = root.querySelector('.search-toggle');
    this.form.addEventListener('change', (e) => {
      this.filters[e.target.name] = e.target.value;
      this.render();
      this.onChange({ ...this.filters });
    });
    this.form.addEventListener('submit', (e) => e.preventDefault());
    root.querySelector('.search-clear').addEventListener('click', () => this.reset(true));
    root.querySelector('.search-done').addEventListener('click', () => this.setOpen(false));
    this.toggleBtn.addEventListener('click', () => this.setOpen(!this.open));
    onLangChange(() => this.render());
    onCurrencyChange(() => this.render());
    this.render();
  }

  setOpen(v) {
    this.open = v;
    this.root.classList.toggle('open', v);
    this.toggleBtn.setAttribute('aria-expanded', String(v));
  }

  reset(notify) {
    this.filters = { ...EMPTY };
    this.render();
    if (notify) this.onChange({ ...this.filters });
  }

  // Número de resultados si se cambiara solo ese filtro (se muestra en cada opción).
  countWith(key, value) {
    const f = { ...this.filters, [key]: value };
    return this.projects.filter((p) => matches(p, f)).length;
  }

  options(key, values, label) {
    const sel = this.form.elements[key];
    const opt = (v, text) => {
      const n = this.countWith(key, v);
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v ? `${text} (${n})` : text;
      o.disabled = !!v && n === 0 && this.filters[key] !== v;
      return o;
    };
    sel.replaceChildren(opt('', t(`search.any.${key}`)), ...values.map((v) => opt(v, label(v))));
    sel.value = this.filters[key];
  }

  render() {
    this.root.querySelectorAll('[data-k]').forEach((el) => (el.textContent = t(el.dataset.k)));
    this.options('ciudad', CITIES, (v) => this.cityNames[v]);
    this.options('tipo', TYPES, (v) => t(`tipo.${v}`));
    this.options('precio', PRICE_RANGES.map((r) => r.id), (id) => {
      const r = PRICE_RANGES.find((x) => x.id === id);
      const short = (v) => formatPrice(v, { compact: true });
      if (r.min === 0) return t('search.upTo', { v: short(r.max) });
      if (r.max === Infinity) return t('search.over', { v: short(r.min) });
      return `${short(r.min)} – ${short(r.max)}`;
    });
    this.options('recamaras', BEDROOMS, (v) => (v === '4' ? '4+' : v));
    const n = this.projects.filter((p) => matches(p, this.filters)).length;
    const active = isActive(this.filters);
    this.root.classList.toggle('active', active);
    this.root.querySelector('.search-count').textContent = active ? t(n === 1 ? 'search.results1' : 'search.results', { n }) : '';
    this.root.querySelector('.search-clear').textContent = t('search.clear');
    this.root.querySelector('.search-done').textContent = t(n === 1 ? 'search.done1' : 'search.done', { n });
    this.root.querySelector('.st-label').textContent = t('search.open');
    this.root.querySelector('.st-count').textContent = active ? n : '';
    this.root.querySelector('.search-note').textContent = this.filters.precio || this.filters.recamaras ? t('search.note') : '';
  }
}
