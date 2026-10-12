import { CONFIG } from '../config.js';
import es from './es.js';
import en from './en.js';

const DICTS = { es, en };
const listeners = new Set();

const readLang = () => {
  try {
    return localStorage.getItem('urbaz.lang');
  } catch {
    return null;
  }
};

let lang = DICTS[readLang()] ? readLang() : CONFIG.defaultLang;

export const getLang = () => lang;

export function setLang(next) {
  if (!DICTS[next] || next === lang) return;
  lang = next;
  try {
    localStorage.setItem('urbaz.lang', next);
  } catch {
    /* sin almacenamiento: solo dura la sesión */
  }
  document.documentElement.lang = next;
  applyDom();
  listeners.forEach((fn) => fn(next));
}

export const onLangChange = (fn) => listeners.add(fn);

export function t(key, vars) {
  let s = DICTS[lang][key] ?? DICTS.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// Traduce todo elemento con data-i18n="clave".
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
