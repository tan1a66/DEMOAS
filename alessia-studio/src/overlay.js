import * as THREE from 'three';
import { LANGS, DEFAULT_LANG, BRAND_NAME, PROJECTS, CONTACT_LINKS, getText, projectText } from './content.js';
import { BUBBLE_R } from './camera-path.js';
import { createLiquidTitle } from './liquid-title.js';

// Testi sopra il canvas (HTML vero: selezionabile, leggibile dagli screen reader).
// Ogni sezione ha una finestra di avanzamento [da, a] calcolata dal percorso: appare quando la
// telecamera arriva alla sosta e scompare quando riparte. Sempre visibili: lingua, WhatsApp e
// l'invito a scorrere. Nel viaggio tra le bolle la didascalia segue la bolla davanti alla
// telecamera (numero, categoria, tipo e il pulsante per aprire il progetto).

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isLang = (l) => LANGS.some((x) => x.code === l);
const STORE = 'alessia-studio-lang';

// lingua: ?lang=xx, poi l'ultima scelta, poi lo spagnolo
export function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (isLang(q)) return q;
  try {
    const s = localStorage.getItem(STORE);
    if (isLang(s)) return s;
  } catch (e) {
    /* storage non disponibile */
  }
  return DEFAULT_LANG;
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>';

function waHref(msg) {
  const n = String(CONTACT_LINKS.whatsapp || '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

export function createOverlay(root, sections, { lang = DEFAULT_LANG, onLang, onNext, onOpen } = {}) {
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
  const scrimRanges = [sections.vision, sections.services, sections.projects, sections.contact];

  const brand = add('ov-brand', sections.brand);
  // invito a giocare col titolo liquido: sparisce al primo tocco
  let liquidTouched = false;
  const liquid = createLiquidTitle(brand, {
    onTouch() {
      liquidTouched = true;
      brand.querySelector('.liquid-hint')?.classList.add('gone');
    },
  });
  const vision = add('ov-vision', sections.vision);
  const services = add('ov-services', sections.services);
  const projects = add('ov-projects', sections.projects);
  const contact = add('ov-contact', sections.contact);

  // didascalia della bolla corrente: cambia mentre è nascosta, tra una sosta e l'altra
  let current = -1, shown = -1, hiddenAt = -1e9;
  projects.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]') && shown >= 0) onOpen?.(shown);
  });

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
      ${liquid.enabled ? `<p class="liquid-hint${liquidTouched ? ' gone' : ''}" aria-hidden="true"><span class="drop"></span>${esc(canHover ? T.ui.liquidHover : T.ui.liquidTouch)}</p>` : ''}
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
    renderProject();
    const links = [
      CONTACT_LINKS.email && `<a class="cta primary" href="mailto:${esc(CONTACT_LINKS.email)}">${esc(CONTACT_LINKS.email)}</a>`,
      `<a class="cta" href="${esc(waHref(T.ui.whatsappMsg))}" target="_blank" rel="noopener">WhatsApp</a>`,
      CONTACT_LINKS.instagram && `<a class="cta" href="https://instagram.com/${esc(CONTACT_LINKS.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram</a>`,
    ].filter(Boolean).join('');
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
  }

  function renderProject() {
    if (shown < 0) return;
    const T = getText(lang);
    const [title, kind] = projectText(lang, PROJECTS[shown].id);
    const nn = (k) => String(k).padStart(2, '0');
    projects.innerHTML = `
      <p class="label">${esc(T.projects.label)} <span class="count">${nn(shown + 1)} / ${nn(PROJECTS.length)}</span></p>
      ${shown === 0 ? `<p class="intro">${esc(T.projects.title)}</p>` : ''}
      <h2 class="title">${esc(title)}</h2>
      <p class="kind">${esc(kind)}</p>
      <button type="button" class="cta" data-open>${esc(T.projects.open)} <span aria-hidden="true">→</span></button>
      <p class="hint">${esc(canHover ? T.projects.hintClick : T.projects.hintTouch)}</p>`;
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
    // bolla davanti alla telecamera (-1 tra una sosta e l'altra)
    current = sections.bubbles.findIndex((r) => p >= r[0] && p <= r[1]);
    // il testo cambia solo quando la dissolvenza in uscita è finita
    if (current >= 0 && current !== shown && !projects.classList.contains('on') && performance.now() - hiddenAt > 450) {
      shown = current;
      renderProject();
    }
    items.forEach(({ el, range }) => {
      let on = p >= range[0] && p <= range[1];
      if (el === projects) on = current >= 0 && current === shown;
      if (on !== el.classList.contains('on')) {
        if (el === projects && !on) hiddenAt = performance.now();
        el.classList.toggle('on', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
    liquid.setActive(brand.classList.contains('on'));
    return p >= sections.projects[0] && p <= sections.projects[1];
  }

  // il puntatore sulla bolla della didascalia accende il pulsante
  function setHover(i) {
    projects.classList.toggle('hover', i >= 0 && i === shown);
  }

  // invito a scorrere: nascosto durante il passaggio tra due soste e all'ultima
  function setStop(index, moving, last) {
    hint.classList.toggle('on', !moving && index < last);
    root.dataset.stop = index;
  }

  render();
  return { update, setHover, setStop, setLang, get lang() { return lang; }, get current() { return current; } };
}
