// EXPERIENCIAS: maqueta 3D de la península. Pines clicables, vuelo de la cámara,
// modelo 3D del lugar, ruta punteada desde Mérida y panel con foto, duración y CTA.
// En los Cenotes la cámara baja dentro de un cenote. Incluye "Activaciones".
import { t, L, onLangChange, applyI18n } from '../i18n.js';
import { waLink, motion } from '../config.js';
import { PLACES, MERIDA, ACTIVATIONS } from '../data.js';
import { setImg } from '../util/images.js';
import { backButton, pageFooter } from './index.js';

export async function create({ root, engine, onBack }) {
  const [{ createMap }, { createCenote }] = await Promise.all([import('../scenes/map.js'), import('../scenes/cenote.js')]);
  const el = document.createElement('section');
  el.className = 'page is-glass page-exp';
  el.id = 'page-experiencias';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'title-exp');
  el.innerHTML = `
    <header class="exp-head">
      <p class="kicker" data-i18n="exp.kicker"></p>
      <h1 id="title-exp" class="sec-title" tabindex="-1" data-i18n="exp.title"></h1>
      <p class="exp-hint" data-i18n="exp.hint"></p>
    </header>
    <div class="exp-labels" aria-hidden="false">
      <span class="exp-merida"><i></i><span data-i18n="exp.hotel"></span></span>
      ${PLACES.map((p) => `<button type="button" class="exp-pin" data-place="${p.id}">${L(p.name)}</button>`).join('')}
    </div>
    <aside class="exp-panel">
      <div class="exp-card">
        <div class="exp-scroll">
          <div class="exp-overview">
            <p class="kicker" data-i18n="exp.from"></p>
            <ul class="exp-list">
              ${PLACES.map((p) => `<li><button type="button" data-place="${p.id}"><span class="nm">${L(p.name)}</span><span class="km">${p.km} km</span></button></li>`).join('')}
            </ul>
            <p class="exp-note" data-i18n="exp.indicative"></p>
            <div class="exp-act">
              <h2 data-i18n="exp.act.title"></h2>
              <p data-i18n="exp.act.lead"></p>
              <ul>${ACTIVATIONS.map((a, i) => `<li data-act="${i}">${L(a)}</li>`).join('')}</ul>
            </div>
          </div>
          <article class="exp-place" hidden>
            <button type="button" class="exp-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span data-i18n="exp.back"></span></button>
            <figure class="exp-photo"><img alt="" /></figure>
            <h2 class="exp-name"></h2>
            <p class="exp-text"></p>
            <dl class="exp-data">
              <div><dt data-i18n="exp.duration"></dt><dd class="d-tour"></dd></div>
              <div><dt data-i18n="exp.distance"></dt><dd class="d-dist"></dd></div>
            </dl>
            <a class="cta-brass exp-cta" target="_blank" rel="noopener"><span data-i18n="exp.cta"></span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>
          </article>
        </div>
      </div>
    </aside>`;
  el.prepend(backButton(onBack));
  el.querySelector('.exp-scroll').append(pageFooter());
  root.append(el);
  applyI18n(el);

  const map = await createMap(engine, PLACES, MERIDA);
  let cenote = null;
  let current = null, busy = false, inCenote = false;
  const pinEls = Object.fromEntries([...el.querySelectorAll('.exp-pin')].map((b) => [b.dataset.place, b]));
  const meridaEl = el.querySelector('.exp-merida');
  const placeEl = el.querySelector('.exp-place');
  const overEl = el.querySelector('.exp-overview');

  map.on('labels', (list, mer) => {
    for (const o of list) {
      const b = pinEls[o.id];
      b.style.transform = `translate3d(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      b.classList.toggle('is-hidden', !o.visible || !!current);
      b.classList.toggle('is-current', current === o.id);
    }
    meridaEl.style.transform = `translate3d(${mer.x.toFixed(1)}px, ${mer.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    meridaEl.classList.toggle('is-hidden', !mer.visible || inCenote);
  });
  map.on('pin', (id) => choose(id));
  el.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.place)));
  el.querySelector('.exp-back').addEventListener('click', () => backToMap());

  function fillPlace(p) {
    el.querySelector('.exp-name').textContent = L(p.name);
    el.querySelector('.exp-text').textContent = L(p.text);
    el.querySelector('.d-tour').textContent = L(p.tour);
    el.querySelector('.d-dist').textContent = `${p.km} km · ${L(p.drive)}`;
    el.querySelector('.exp-cta').href = waLink(t('exp.msg', { place: L(p.name) }));
  }

  async function choose(id) {
    if (busy || current === id) return;
    busy = true;
    const p = PLACES.find((x) => x.id === id);
    if (inCenote) await leaveCenote();
    current = id;
    el.classList.add('has-place');
    fillPlace(p);
    const img = el.querySelector('.exp-photo img');
    img.alt = L(p.name);
    setImg(img, p.photo, 1200, 800);
    overEl.hidden = true;
    placeEl.hidden = false;
    placeEl.classList.remove('is-in');
    requestAnimationFrame(() => placeEl.classList.add('is-in'));
    if (p.kind === 'cenote') {
      await map.focus(id);
      await map.diveTarget(id);
      // fundido y descenso dentro del cenote
      el.classList.add('is-diving');
      await new Promise((r) => setTimeout(r, motion.reduced ? 120 : 520));
      cenote ??= createCenote(engine);
      engine.setActive(cenote);
      inCenote = true;
      el.classList.remove('is-diving');
      await cenote.descend();
    } else {
      await map.focus(id);
    }
    busy = false;
  }

  async function leaveCenote() {
    el.classList.add('is-diving');
    await new Promise((r) => setTimeout(r, motion.reduced ? 120 : 520));
    engine.setActive(map);
    inCenote = false;
    el.classList.remove('is-diving');
  }

  async function backToMap() {
    if (busy) return;
    busy = true;
    if (inCenote) await leaveCenote();
    current = null;
    el.classList.remove('has-place');
    placeEl.hidden = true;
    overEl.hidden = false;
    await map.overview();
    busy = false;
    el.querySelector(`.exp-list button`)?.focus({ preventScroll: true });
  }

  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) backToMap(); });

  onLangChange(() => {
    applyI18n(el);
    PLACES.forEach((p) => {
      pinEls[p.id].textContent = L(p.name);
      const li = el.querySelector(`.exp-list [data-place="${p.id}"] .nm`);
      if (li) li.textContent = L(p.name);
    });
    el.querySelectorAll('[data-act]').forEach((li) => { li.textContent = L(ACTIVATIONS[+li.dataset.act]); });
    if (current) fillPlace(PLACES.find((x) => x.id === current));
  });

  return {
    el, theme: 'dark', view: map, ownCredit: true,
    async enter() { map.intro(); },
    exit() {
      if (inCenote) { engine.setActive(map); inCenote = false; }
      current = null; el.classList.remove('has-place'); placeEl.hidden = true; overEl.hidden = false;
      map.overview();
    },
  };
}
