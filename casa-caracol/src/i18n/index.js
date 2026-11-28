import { TRANSLATIONS, DEFAULT_LANG } from './translations.js';
import { ENV } from '../core/env.js';

const STORAGE_KEY = 'cc-lang';
const listeners = new Set();

const readStoredLang = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const pickInitialLang = () => {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl && TRANSLATIONS[fromUrl]) return fromUrl;
  const stored = readStoredLang();
  if (stored && TRANSLATIONS[stored]) return stored;
  return DEFAULT_LANG;
};

let current = pickInitialLang();

// Algunas claves tienen variante para escritorio (ratón): "clave" + "Desktop".
const resolveKey = (key) => {
  const desktopKey = `${key}Desktop`;
  if (!ENV.touch && TRANSLATIONS[current][desktopKey]) return desktopKey;
  return key;
};

export const t = (key) => {
  const k = resolveKey(key);
  return TRANSLATIONS[current][k] ?? TRANSLATIONS[DEFAULT_LANG][k] ?? key;
};

export const getLang = () => current;

export const applyTranslations = (root = document) => {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.documentElement.lang = current;
};

export const setLang = (lang) => {
  if (!TRANSLATIONS[lang] || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* almacenamiento no disponible: no pasa nada */
  }
  applyTranslations();
  listeners.forEach((fn) => fn(lang));
};

export const onLangChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
