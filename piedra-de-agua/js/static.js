// Versión estática (sin WebGL): los mismos contenidos con fotografías, en una sola página.
import { t, L, onLangChange } from './i18n.js';
import { CONFIG, waLink } from './config.js';
import { ROOMS, SERVICES, PLACES, ACTIVATIONS } from './data.js';
import { setImg } from './util/images.js';
import { centroMapSVG } from './contact.js';
import { henequenSVG } from './sections/nosotros.js';

const img = (names, alt, w = 1200, h = 800, cls = '') => `<img class="${cls}" data-src="${[].concat(names).join('|')}" data-w="${w}" data-h="${h}" alt="${alt}" loading="lazy" />`;

export async function initStatic(root) {
  const render = () => {
    root.innerHTML = `
      <header class="st-hero">
        ${img('patio.jpg', t('nos.scene.patio'), 1800, 1100, 'st-hero-img')}
        <div class="st-hero-text">
          <p class="kicker">${t('home.kicker')}</p>
          <h1>${t('home.title')}</h1>
          <p class="st-sub">${t('home.sub')}</p>
          <a class="cta-brass" href="#st-rooms">${t('door.habitaciones')}</a>
        </div>
      </header>
      <p class="st-note">${t('nowebgl.note')}</p>

      <section class="st-sec st-nos" id="st-nos">
        <div>
          <p class="kicker">${t('nos.kicker')}</p>
          <h2>${t('nos.title')}</h2>
          <p class="st-lead">${t('nos.lead')}</p>
          <p>${t('nos.body')}</p>
          <ol class="st-time">
            ${[1, 2, 3].map((i) => `<li><b>${t(`nos.t${i}.year`)}</b><span>${t(`nos.t${i}.title`)}</span></li>`).join('')}
          </ol>
        </div>
        <div class="st-pair">${img('patio.jpg', t('nos.scene.patio'), 900, 1100)}${img('pasillo.jpg', t('nos.scene.pasillo'), 900, 1100)}</div>
      </section>

      <section class="st-sec" id="st-rooms">
        <p class="kicker">${t('hab.kicker')}</p>
        <h2>${t('hab.choose')}</h2>
        <div class="st-rooms">
          ${[...ROOMS].reverse().map((r) => `
            <article class="st-room">
              ${img(r.photo, L(r.name), 1200, 800)}
              <div>
                <h3>${L(r.name)}</h3>
                <p class="st-meta">${r.m2} m² · ${L(r.beds)} · ${L(r.guests)}</p>
                <p>${L(r.text)}</p>
                <a class="st-link" href="${waLink(t('hab.msg', { room: L(r.name) }))}" target="_blank" rel="noopener">${t('hab.reserve')} →</a>
              </div>
            </article>`).join('')}
        </div>
      </section>

      <section class="st-sec" id="st-ser">
        <p class="kicker">${t('ser.kicker')}</p>
        <h2>${t('ser.title')}</h2>
        <div class="st-services">
          ${SERVICES.map((s) => `
            <article>
              ${img(s.photo, L(s.name), 900, 1100, 'arch-img')}
              <h3>${L(s.name)}</h3>
              <p>${L(s.text)}</p>
              <a class="st-link" href="${waLink(t('ser.msg', { service: L(s.name) }))}" target="_blank" rel="noopener">${t('ser.cta')} →</a>
            </article>`).join('')}
        </div>
      </section>

      <section class="st-sec" id="st-exp">
        <p class="kicker">${t('exp.kicker')}</p>
        <h2>${t('exp.title')}</h2>
        <ul class="st-places">
          ${PLACES.map((p) => `<li><b>${L(p.name)}</b><span>${p.km} km · ${L(p.drive)} · ${L(p.tour)}</span><p>${L(p.text)}</p></li>`).join('')}
        </ul>
        <p class="st-small">${t('exp.indicative')}</p>
        <div class="st-act">
          ${henequenSVG('henequen st-hen', 16)}
          <div><h3>${t('exp.act.title')}</h3><p>${t('exp.act.lead')}</p>
          <ul>${ACTIVATIONS.map((a) => `<li>${L(a)}</li>`).join('')}</ul></div>
        </div>
      </section>

      <section class="st-sec st-contact" id="st-contact">
        <div>
          <p class="kicker">${t('con.kicker')}</p>
          <h2>${t('con.title')}</h2>
          <p>${CONFIG.address}</p>
          <p class="st-lead">${t('con.near')}</p>
          <a class="cta-wa" href="${waLink(t('wa.msg'))}" target="_blank" rel="noopener"><span>${t('con.write')}</span></a>
        </div>
        <div class="st-map">${centroMapSVG()}</div>
      </section>
      <footer class="page-footer"><p>${t('credit')}</p></footer>`;
    root.querySelectorAll('img[data-src]').forEach((el) => setImg(el, el.dataset.src.split('|'), +el.dataset.w, +el.dataset.h));
  };
  render();
  onLangChange(render);
  root.hidden = false;
}
