// Registro de secciones (se cargan bajo demanda la primera vez que se abren).
import { t } from '../i18n.js';

export const SECTION_IDS = ['nosotros', 'habitaciones', 'servicios', 'experiencias'];

const loaders = {
  nosotros: () => import('./nosotros.js'),
  habitaciones: () => import('./habitaciones.js'),
  servicios: () => import('./servicios.js'),
  experiencias: () => import('./experiencias.js'),
};

const cache = {};

export async function getSection(id, ctx) {
  if (!cache[id]) {
    cache[id] = loaders[id]().then((m) => m.create(ctx));
  }
  return cache[id];
}

export function backButton(onBack) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'back-btn';
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11a7 7 0 0 1 14 0v9" /><path d="M14 13l-3.5 3.5L14 20" /></svg><span data-i18n="back.patio">${t('back.patio')}</span>`;
  b.addEventListener('click', onBack);
  return b;
}

export function pageFooter() {
  const f = document.createElement('footer');
  f.className = 'page-footer';
  f.innerHTML = `<p data-i18n="credit">${t('credit')}</p>`;
  return f;
}
