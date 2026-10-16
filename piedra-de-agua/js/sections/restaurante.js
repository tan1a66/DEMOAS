// RESTAURANTE: puerta propia en el patio. La terraza bajo un arco liberty que pasa
// del día a la noche (luces de guirnalda y la Catedral iluminada) y reserva por WhatsApp.
import { t, onLangChange, applyI18n } from '../i18n.js?v=2';
import { waLink, motion } from '../config.js?v=2';
import { setImg } from '../util/images.js?v=2';
import { backButton, pageFooter } from './index.js?v=2';

const SHOTS = { day: ['restaurante.jpg'], night: ['terraza-bodas.jpg'] };

export async function create({ root, onBack }) {
  const el = document.createElement('section');
  el.className = 'page page-res';
  el.id = 'page-restaurante';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'title-res');
  el.innerHTML = `
    <div class="res-wrap">
      <figure class="res-figure">
        <div class="res-arch" data-mode="day">
          <img class="res-img day" alt="" decoding="async" />
          <img class="res-img night" alt="" decoding="async" />
        </div>
        <div class="res-toggle" role="group" data-i18n-aria="res.toggle">
          <button type="button" data-mode="day" aria-pressed="true"><span class="sun" aria-hidden="true"></span><span data-i18n="res.day"></span></button>
          <button type="button" data-mode="night" aria-pressed="false"><span class="moon" aria-hidden="true"></span><span data-i18n="res.night"></span></button>
        </div>
      </figure>
      <div class="res-text">
        <p class="kicker" data-i18n="res.kicker"></p>
        <h1 id="title-res" class="sec-title" tabindex="-1" data-i18n="res.title"></h1>
        <svg class="ornament res-orn" viewBox="0 0 240 24" aria-hidden="true">
          <path d="M2 12h86M152 12h86" />
          <path d="M88 12c10 0 14-9 22-9s10 9 10 9 2-9 10-9 12 9 22 9" />
          <path d="M88 12c10 0 14 9 22 9s10-9 10-9 2 9 10 9 12-9 22-9" />
          <circle cx="120" cy="12" r="2.4" />
        </svg>
        <p class="res-lead" data-i18n="res.lead"></p>
        <ul class="res-points">
          <li><b data-i18n="res.p1.t"></b><span data-i18n="res.p1.d"></span></li>
          <li><b data-i18n="res.p2.t"></b><span data-i18n="res.p2.d"></span></li>
          <li><b data-i18n="res.p3.t"></b><span data-i18n="res.p3.d"></span></li>
        </ul>
        <a class="cta-wa res-cta" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9z"/></svg>
          <span data-i18n="res.cta"></span>
        </a>
        <p class="res-note" data-i18n="res.note"></p>
      </div>
    </div>`;
  el.prepend(backButton(onBack));
  el.append(pageFooter());
  root.append(el);
  applyI18n(el);

  const arch = el.querySelector('.res-arch');
  const imgs = { day: el.querySelector('.res-img.day'), night: el.querySelector('.res-img.night') };
  const buttons = [...el.querySelectorAll('.res-toggle button')];
  const cta = el.querySelector('.res-cta');
  let mode = 'day', loaded = false, auto = null;

  function setAlts() {
    imgs.day.alt = t('res.alt.day');
    imgs.night.alt = t('res.alt.night');
  }
  function setMode(m) {
    mode = m;
    arch.dataset.mode = m;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  }
  buttons.forEach((b) => b.addEventListener('click', () => { stopAuto(); setMode(b.dataset.mode); }));
  // tocar la foto también cambia de hora
  arch.addEventListener('click', () => { stopAuto(); setMode(mode === 'day' ? 'night' : 'day'); });

  // al entrar, el día cae solo hacia la noche una vez (como en una visita al atardecer)
  function playAuto() {
    if (motion.reduced) return;
    stopAuto();
    auto = setTimeout(() => setMode('night'), 4500);
  }
  function stopAuto() { clearTimeout(auto); auto = null; }

  function refresh() {
    applyI18n(el);
    setAlts();
    cta.href = waLink(t('res.msg'));
  }
  onLangChange(refresh);
  refresh();

  return {
    el, theme: 'dark', view: null, ownCredit: true,
    async enter() {
      if (!loaded) {
        loaded = true;
        await Promise.all([setImg(imgs.day, SHOTS.day, 1000, 1330), setImg(imgs.night, SHOTS.night, 1000, 1330)]);
      }
      setMode('day');
      requestAnimationFrame(() => el.classList.add('is-in'));
      playAuto();
    },
    exit() { stopAuto(); el.classList.remove('is-in'); },
  };
}
