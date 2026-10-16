// SERVICIOS: galería 3D de cuadros colgados de listones; al tocar uno se abre la
// foto a pantalla completa con texto y WhatsApp. Bodas y Eventos abre la terraza en 3D.
import { t, L, onLangChange, applyI18n } from '../i18n.js?v=2';
import { waLink, motion } from '../config.js?v=2';
import { SERVICES } from '../data.js?v=2';
import { setImg } from '../util/images.js?v=2';
import { backButton } from './index.js?v=2';

export async function create({ root, engine, onBack }) {
  const [{ createGallery }, { createTerrace }] = await Promise.all([import('../scenes/gallery.js?v=2'), import('../scenes/terrace.js?v=2')]);
  const el = document.createElement('section');
  el.className = 'page is-glass page-ser';
  el.id = 'page-servicios';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'title-ser');
  el.innerHTML = `
    <header class="ser-head">
      <p class="kicker" data-i18n="ser.kicker"></p>
      <h1 id="title-ser" class="sec-title" tabindex="-1" data-i18n="ser.title"></h1>
    </header>
    <div class="ser-caption" aria-live="polite">
      <p class="ser-count"><b class="ser-i">01</b> / ${String(SERVICES.length).padStart(2, '0')}</p>
      <h2 class="ser-name"></h2>
      <p class="ser-text"></p>
      <div class="ser-ctrl">
        <button type="button" class="round-btn prev" data-i18n-aria="ser.prev"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button type="button" class="ser-open"><span data-i18n="ser.more"></span></button>
        <button type="button" class="round-btn next" data-i18n-aria="ser.next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <p class="ser-hint" data-i18n="ser.hint"></p>
    </div>
    <div class="ser-detail" role="dialog" aria-modal="true" aria-labelledby="ser-d-name" hidden>
      <img class="ser-photo" alt="" />
      <div class="ser-shade"></div>
      <div class="ser-cartouche">
        <p class="kicker" data-i18n="ser.kicker"></p>
        <h2 id="ser-d-name" class="ser-d-name"></h2>
        <p class="ser-d-text"></p>
        <a class="cta-wa ser-d-cta" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9z"/></svg>
          <span data-i18n="ser.cta"></span>
        </a>
        <button type="button" class="ser-close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg><span data-i18n="ser.close"></span></button>
      </div>
    </div>`;
  el.prepend(backButton(onBack));
  root.append(el);
  applyI18n(el);

  const labels = () => SERVICES.map((s) => L(s.name));
  const gallery = createGallery(engine, SERVICES.map((s) => ({ ...s, label: L(s.name) })));
  let terrace = null;
  const cap = {
    i: el.querySelector('.ser-i'), name: el.querySelector('.ser-name'), text: el.querySelector('.ser-text'),
  };
  const detail = el.querySelector('.ser-detail');
  const photo = detail.querySelector('.ser-photo');
  let current = 0, openIdx = -1;

  function fillCaption(i) {
    const s = SERVICES[i];
    cap.i.textContent = String(i + 1).padStart(2, '0');
    cap.name.textContent = L(s.name);
    cap.text.textContent = L(s.text);
  }
  gallery.on('focus', (i) => {
    current = i;
    el.querySelector('.ser-caption').classList.remove('is-in');
    requestAnimationFrame(() => { fillCaption(i); el.querySelector('.ser-caption').classList.add('is-in'); });
  });
  gallery.on('open', (i) => open(i));
  el.querySelector('.prev').addEventListener('click', () => gallery.prev());
  el.querySelector('.next').addEventListener('click', () => gallery.next());
  el.querySelector('.ser-open').addEventListener('click', () => open(current));
  el.addEventListener('keydown', (e) => {
    if (!detail.hidden) { if (e.key === 'Escape') close(); return; }
    if (e.key === 'ArrowRight') { gallery.next(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { gallery.prev(); e.preventDefault(); }
  });
  detail.querySelector('.ser-close').addEventListener('click', () => close());

  function fillDetail(i) {
    const s = SERVICES[i];
    detail.querySelector('.ser-d-name').textContent = L(s.name);
    detail.querySelector('.ser-d-text').textContent = L(s.text);
    detail.querySelector('.ser-d-cta').href = waLink(t('ser.msg', { service: L(s.name) }));
  }

  async function open(i) {
    const s = SERVICES[i];
    openIdx = i;
    fillDetail(i);
    detail.classList.toggle('is-3d', !!s.scene3d);
    if (s.scene3d) {
      // Bodas: la terraza reconstruida en 3D en lugar de la foto
      terrace ??= createTerrace(engine);
      engine.setActive(terrace);
      photo.removeAttribute('src');
    } else {
      photo.alt = L(s.name);
      await setImg(photo, s.photo, 1600, 1000);
    }
    detail.hidden = false;
    el.classList.add('has-detail');
    document.body.classList.add('detail-open');
    requestAnimationFrame(() => detail.classList.add('is-open'));
    setTimeout(() => detail.querySelector('.ser-close').focus({ preventScroll: true }), 60);
  }

  function close() {
    if (detail.hidden) return;
    detail.classList.remove('is-open');
    el.classList.remove('has-detail');
    document.body.classList.remove('detail-open');
    if (SERVICES[openIdx]?.scene3d) engine.setActive(gallery);
    setTimeout(() => { detail.hidden = true; el.querySelector('.ser-open').focus({ preventScroll: true }); }, motion.reduced ? 100 : 500);
    openIdx = -1;
  }

  onLangChange(() => {
    applyI18n(el);
    gallery.setLabels(labels());
    fillCaption(current);
    if (openIdx >= 0) fillDetail(openIdx);
  });
  fillCaption(0);

  return {
    el, theme: 'dark', view: gallery,
    enter() { el.querySelector('.ser-caption').classList.add('is-in'); },
    exit() {
      document.body.classList.remove('detail-open');
      if (!detail.hidden) { detail.hidden = true; detail.classList.remove('is-open'); el.classList.remove('has-detail'); }
    },
  };
}
