// Versión estática (sin WebGL): las mismas secciones con fotografías.
import { t, applyI18n, onLangChange } from './i18n.js';
import { CONFIG, waLink } from './config.js';
import { imgEl } from './util/images.js';

export async function initStatic(root) {
  const render = () => {
    root.innerHTML = `
      <div class="st-hero">
        <p class="kicker">${t('home.kicker')}</p>
        <h1>${t('home.title')}</h1>
        <p class="st-sub">${t('home.sub')}</p>
        <p class="st-note">${t('nowebgl.note')}</p>
      </div>
      <section class="st-sec"><p class="kicker">${t('nos.kicker')}</p><h2>${t('nos.title')}</h2><p>${t('nos.lead')}</p><p>${t('nos.body')}</p></section>
      <section class="st-sec"><p class="kicker">${t('con.kicker')}</p><h2>${t('con.title')}</h2><p>${CONFIG.address} · ${t('con.near')}</p>
        <p><a href="${waLink(t('wa.msg'))}" target="_blank" rel="noopener">${t('con.write')}</a></p></section>
      <footer class="page-footer"><p>${t('credit')}</p></footer>`;
    root.querySelector('.st-hero').prepend(imgEl('patio.jpg', t('nos.scene.patio'), 1600, 1000, 'st-hero-img'));
  };
  render();
  onLangChange(render);
  root.hidden = false;
}
