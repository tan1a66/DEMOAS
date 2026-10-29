import { LANGS, DEFAULT_LANG, BRAND_NAME, CONTACT_LINKS, getText, waLink } from './content.js';
import { createLiquidTitle } from './liquid-title.js';

// Testi sopra il canvas (HTML vero: selezionabile, leggibile dagli screen reader).
// Ogni sezione ha una finestra di avanzamento [da, a] calcolata dal percorso: appare quando la
// telecamera arriva alla sosta e scompare quando riparte. Sempre visibili: lingua, WhatsApp e
// l'invito a scorrere. Sul fondale, sotto la scena 3D, l'invito a provarla.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isLang = (l) => LANGS.some((x) => x.code === l);
const STORE = 'alessia-studio-lang';

// lingua: ?lang=xx, poi l'ultima scelta del visitatore, poi la lingua del suo telefono o computer
// (in pratica quella del paese da cui apre il sito); per le lingue che il sito non ha, l'inglese
export function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (isLang(q)) return q;
  try {
    const s = localStorage.getItem(STORE);
    if (isLang(s)) return s;
  } catch (e) {
    /* storage non disponibile */
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const l of prefs) {
    const code = String(l).toLowerCase().split('-')[0];
    if (isLang(code)) return code;
  }
  return prefs.some(Boolean) ? 'en' : DEFAULT_LANG;
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>';

const waHref = waLink;

export function createOverlay(root, sections, { lang = DEFAULT_LANG, onLang, onNext } = {}) {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const items = [];
  const add = (cls, range, tag = 'section') => {
    const el = document.createElement(tag);
    el.className = `ov ${cls}`;
    el.setAttribute('aria-hidden', 'true');
    root.appendChild(el);
    items.push({ el, range });
    return el;
  };

  // velatura dietro ai testi lunghi (a sinistra su desktop, in basso su telefono): leggibili su
  // qualunque sfondo, anche sul disco bianco del lucernario
  const scrim = document.createElement('div');
  scrim.className = 'ov-scrim';
  root.appendChild(scrim);
  const scrimRanges = [sections.vision, sections.services, sections.contact];

  const brand = add('ov-brand', sections.brand);
  // titolo liquido; l'invito a giocarci (sotto il titolo) resta sempre visibile
  const liquid = createLiquidTitle(brand);
  const vision = add('ov-vision', sections.vision);
  const services = add('ov-services', sections.services);
  const contact = add('ov-contact', sections.contact);
  // sul fondale: invito a girare la statua
  const art = add('ov-demo', sections.art);

  // sempre visibili: lingua (in alto a destra), WhatsApp (in basso a destra), invito a scorrere
  const langNav = document.createElement('nav');
  langNav.className = 'ui ui-lang';
  langNav.innerHTML = LANGS.map((l) => `<button type="button" lang="${l.code}" data-lang="${l.code}" title="${esc(l.name)}">${l.label}</button>`).join('');
  langNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang, true);
  });
  root.appendChild(langNav);

  const wa = document.createElement('a');
  wa.className = 'ui ui-wa';
  wa.target = '_blank';
  wa.rel = 'noopener';
  root.appendChild(wa);

  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'ui ui-scroll';
  hint.addEventListener('click', () => onNext?.());
  root.appendChild(hint);

  function render() {
    const T = getText(lang);
    const origin = `<p class="origin">${T.origin.map((s) => `<span>${esc(s)}</span>`).join('<span class="dot" aria-hidden="true">·</span>')}</p>`;
    brand.innerHTML = `
      <h1 class="brand">${esc(BRAND_NAME)}</h1>
      ${liquid.enabled ? `<p class="liquid-hint" aria-hidden="true"><span class="drop"></span>${esc(canHover ? T.ui.liquidHover : T.ui.liquidTouch)}</p>` : ''}
      <p class="tagline">${esc(T.tagline)}</p>
      ${origin}`;
    liquid.attach(brand.querySelector('.brand'));
    vision.innerHTML = `
      <p class="label">${esc(T.vision.label)}</p>
      <h2 class="title">${esc(T.vision.title)}</h2>
      <p class="lead">${esc(T.vision.text)}</p>
      <p class="world">${esc(T.vision.world)}</p>`;
    services.innerHTML = `
      <p class="label">${esc(T.services.label)}</p>
      <h2 class="title">${esc(T.services.title)}</h2>
      <p class="lead">${esc(T.services.text)}</p>
      <div class="groups">${T.services.groups.map((g) => `
        <div class="group">
          <p class="label">${esc(g.label)}</p>
          <ul class="services">${g.items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>`;
    const links = [
      `<a class="cta primary" href="${esc(waHref(T.ui.whatsappMsg))}" target="_blank" rel="noopener">${WA_ICON}<span>${esc(T.contact.cta)}</span></a>`,
      CONTACT_LINKS.instagram && `<a class="cta" href="https://instagram.com/${esc(CONTACT_LINKS.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram</a>`,
    ].filter(Boolean).join('');
    const pill = (h) => `<p class="hint-pill"><span class="drop"></span>${esc(canHover ? h.hintClick : h.hintTouch)}</p>`;
    art.innerHTML = `
      <p class="label">${esc(T.art.label)}</p>
      <div class="pills">${pill(T.art)}</div>`;
    contact.innerHTML = `
      <p class="label">${esc(T.contact.label)}</p>
      <h2 class="title">${esc(T.contact.title)}</h2>
      <p class="lead">${esc(T.contact.text)}</p>
      <div class="links">${links}</div>
      ${origin}`;
    langNav.setAttribute('aria-label', T.langLabel);
    langNav.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'));
    wa.href = waHref(T.ui.whatsappMsg);
    wa.setAttribute('aria-label', T.ui.whatsapp);
    wa.innerHTML = `${WA_ICON}<span>WhatsApp</span>`;
    hint.innerHTML = `<span class="ui-scroll-line" aria-hidden="true"></span><span class="ui-scroll-text">${esc(T.ui.scroll)}</span>`;
    document.documentElement.lang = lang;
    // titolo e descrizione nella lingua scelta (nell'HTML ci sono quelli in spagnolo, vedi vite.seo.js)
    document.title = T.seo.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${T.seo.description} ${T.origin.join(' · ')}.`);
  }

  function setLang(l, user = false) {
    if (!isLang(l)) return;
    lang = l;
    render();
    if (user) {
      try {
        localStorage.setItem(STORE, l);
      } catch (e) {
        /* storage non disponibile */
      }
    }
    onLang?.(l);
  }

  function update(p) {
    scrim.classList.toggle('on', scrimRanges.some((r) => p >= r[0] && p <= r[1]));
    items.forEach(({ el, range }) => {
      const on = p >= range[0] && p <= range[1];
      if (on !== el.classList.contains('on')) {
        el.classList.toggle('on', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
    liquid.setActive(brand.classList.contains('on'));
  }

  // invito a scorrere: nascosto durante il passaggio tra due soste e all'ultima
  function setStop(index, moving, last) {
    hint.classList.toggle('on', !moving && index < last);
    root.dataset.stop = index;
  }

  render();
  // il punto (px dello schermo) è sul titolo liquido, mentre è visibile?
  function onTitle(x, y) {
    if (!liquid.enabled || !brand.classList.contains('on')) return false;
    const r = brand.querySelector('.brand')?.getBoundingClientRect();
    const m = 24;
    return !!r && x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
  }

  return {
    update, setStop, setLang, onTitle,
    get lang() { return lang; },
    // la sosta del fondale è visibile (si gira la statua)
    get artOn() { return art.classList.contains('on'); },
  };
}
