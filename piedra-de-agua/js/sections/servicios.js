// Sección provisional (se completa en la siguiente fase).
import { t } from '../i18n.js';
import { backButton, pageFooter } from './index.js';

export function create({ root, onBack }) {
  const el = document.createElement('section');
  el.className = 'page is-paper';
  el.id = 'page-servicios';
  el.setAttribute('aria-labelledby', 'title-servicios');
  el.innerHTML = `<div style="max-width:720px;margin:0 auto;padding:150px 24px 40px">
    <p class="kicker" style="color:var(--ottone-3)" data-i18n="ser.kicker">${t('ser.kicker')}</p>
    <h1 id="title-servicios" style="font-family:var(--serif);font-weight:400;font-size:clamp(2.4rem,6vw,4rem);margin:.3em 0" data-i18n="ser.title">${t('ser.title')}</h1>
  </div>`;
  el.prepend(backButton(onBack));
  el.append(pageFooter());
  root.append(el);
  return { el, theme: 'paper', view: null, enter() {}, exit() {} };
}
