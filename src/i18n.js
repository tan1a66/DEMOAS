import data from './data/villa.json';

const KEY = 'pedramar-lang';
const listeners = new Set();
let lang = pick();

function pick() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const stored = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
  const candidate = fromUrl || stored || data.i18n.default;
  return data.i18n.langs.includes(candidate) ? candidate : data.i18n.default;
}

/** Testo nella lingua attiva: accetta una stringa semplice o un oggetto { es, it }. */
export function t(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value[data.i18n.default] ?? '';
}

/** Testo dell'interfaccia da villa.json → ui. */
export const ui = (key) => t(data.ui[key]);

export const getLang = () => lang;

export function setLang(next) {
  if (!data.i18n.langs.includes(next) || next === lang) return;
  lang = next;
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* modalità privata */ }
  listeners.forEach((fn) => fn(lang));
}

export const onLang = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

document.documentElement.lang = lang;
