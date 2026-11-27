// Textos de la interfaz (ES / EN).
const DICT = {
  es: {
    'loader': 'Cargando',
    'hint': 'desliza',
    'intro.k': 'Arquitectura escultórica',
    'intro.v': 'Mérida · CDMX',
    'place.k': 'Casa Skoura',
    'place.v': 'Mérida, Yucatán',
    'touch': 'Toca el agua',
    'credit': 'Demo conceptual por Alessia Studio',
    'title': 'Enekén Studio — Arquitectura escultórica. Mérida · CDMX.',
  },
  en: {
    'loader': 'Loading',
    'hint': 'scroll',
    'intro.k': 'Sculptural architecture',
    'intro.v': 'Mérida · CDMX',
    'place.k': 'Casa Skoura',
    'place.v': 'Mérida, Yucatán',
    'touch': 'Touch the water',
    'credit': 'Conceptual demo by Alessia Studio',
    'title': 'Enekén Studio — Sculptural architecture. Mérida · CDMX.',
  },
};

let lang = 'es';
try { const saved = localStorage.getItem('nkn-lang'); if (saved && DICT[saved]) lang = saved; } catch (e) { /* sin almacenamiento */ }

export const t = (k) => DICT[lang][k] ?? k;
export const getLang = () => lang;

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try { localStorage.setItem('nkn-lang', l); } catch (e) { /* sin almacenamiento */ }
  applyI18n();
}
