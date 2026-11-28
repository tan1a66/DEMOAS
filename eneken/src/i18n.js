// Textos de la interfaz (ES / EN).
const DICT = {
  es: {
    'loader': 'Cargando',
    'nav': 'Secciones',
    'nav.nosotros': 'Nosotros',
    'nav.vision': 'Visión',
    'nav.contacto': 'Contacto',
    'nos.k': 'Nosotros',
    'nos.t': 'Enekén Studio',
    'nos.p': 'Práctica de arquitectura escultórica entre Mérida y la Ciudad de México.',
    'nos.name': 'Miguel Tapia',
    'nos.role': 'Dirección',
    'vis.k': 'Visión',
    'vis.1': 'Tallamos.',
    'vis.2': 'La madera, la piedra, el muro, la luz.',
    'vis.3': 'Lo que el tiempo dejó, lo conservamos.',
    'vis.4': 'Lo que falta, lo esculpimos.',
    'con.k': 'Contacto',
    'con.cities': 'Mérida · CDMX',
    'credit': 'Demo conceptual por Alessia Studio',
    'title': 'Enekén Studio — Arquitectura escultórica. Mérida · CDMX.',
  },
  en: {
    'loader': 'Loading',
    'nav': 'Sections',
    'nav.nosotros': 'About',
    'nav.vision': 'Vision',
    'nav.contacto': 'Contact',
    'nos.k': 'About',
    'nos.t': 'Enekén Studio',
    'nos.p': 'A sculptural architecture practice between Mérida and Mexico City.',
    'nos.name': 'Miguel Tapia',
    'nos.role': 'Director',
    'vis.k': 'Vision',
    'vis.1': 'We carve.',
    'vis.2': 'Wood, stone, wall, light.',
    'vis.3': 'What time left behind, we keep.',
    'vis.4': 'What is missing, we sculpt.',
    'con.k': 'Contact',
    'con.cities': 'Mérida · CDMX',
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
