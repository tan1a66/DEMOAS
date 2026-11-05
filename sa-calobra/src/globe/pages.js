// Le pagine interne: la bici (ride.js). Il menu (NOSOTROS, VIAJES, CONTACTO, MAPAS) sta nello
// schermo del ciclocomputer, e anche sotto il logo. Toccando una voce il mondo rientra nello schermo
// della bici (l'intro al contrario); il ciclocomputer si sposta di lato (in alto sul telefono) e
// accanto compare il contenuto. Cambiando voce lo schermo scorre alla voce nuova, come un GPS.
//   Per ora ogni voce mostra i lavori in corso, firmati Alessia Studio.
// Si esce con MAPAS sullo schermo, con il "indietro" del telefono o con il logo: il mondo esce dallo
// schermo. Nelle bici il menu sotto il logo si nasconde: c'è già nello schermo.
import gsap from 'gsap';
import { battery } from './story.js';

export const SECTIONS = ['nosotros', 'viajes', 'contacto'];
const LABEL = { nosotros: 'Nosotros', viajes: 'Viajes', contacto: 'Contacto' };

/** per ora ogni voce mostra i lavori in corso, firmati Alessia Studio */
const wip = (id) => `
    <p class="kicker">${LABEL[id]}</p>
    <h2 class="bk__title">En construcción</h2>
    <p class="bk__meta">${battery('loading')}</p>
    <p class="bk__wip">Alessia Studio está diseñando esta sección.</p>
    <p class="bk__sign">Alessia Studio — 3D web experience<br /><a href="https://www.alessia.studio" target="_blank" rel="noopener">www.alessia.studio</a></p>`;

export function createPages({ story, onOpen, onSection, onClose }) {
  const root = document.documentElement;
  const el = document.createElement('section');
  el.className = 'pg';
  el.id = 'pages';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <nav class="bk__hits" aria-label="Menú del ciclocomputador">${['mapas', ...SECTIONS].map((id) => `<button type="button" data-hit="${id}" aria-label="${id}"></button>`).join('')}</nav>
    <div class="bk__panel">
      ${SECTIONS.map((id) => `<section class="bk__sec" data-sec="${id}">${wip(id)}</section>`).join('')}
    </div>`;
  document.body.appendChild(el);
  const panel = el.querySelector('.bk__panel');
  const secs = Object.fromEntries([...el.querySelectorAll('.bk__sec')].map((s) => [s.dataset.sec, s]));
  let current = null, busy = false;

  const menuCurrent = (id) => {
    for (const b of document.querySelectorAll('[data-page]')) {
      if (b.dataset.page === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  };
  const showSection = (id) => {
    for (const [k, s] of Object.entries(secs)) s.hidden = k !== id;
    panel.scrollTop = 0;
  };
  const textIn = (id, delay = 0) => gsap.fromTo(secs[id].children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, ease: 'power3.out', delay });

  /** apre le pagine sulla voce id; se sono già aperte, lo schermo passa a quella voce */
  const open = (id) => {
    if (busy || id === current) return;
    menuCurrent(id);
    if (current) {
      busy = true;
      const from = current;
      current = id;
      history.replaceState({ nomadsPage: id }, '', `#${id}`);
      gsap.to(panel, { opacity: 0, duration: 0.3, ease: 'power2.in' });
      Promise.resolve(onSection?.(from, id)).then(() => {
        showSection(id);
        gsap.set(panel, { opacity: 1 });
        textIn(id);
        busy = false;
      });
      return;
    }
    busy = true;
    current = id;
    story.pause();
    showSection(id);
    gsap.set(panel, { opacity: 0 });
    el.setAttribute('aria-hidden', 'false');
    gsap.set(el, { visibility: 'visible', opacity: 1 });
    root.classList.add('in-page');
    history.pushState({ nomadsPage: id }, '', `#${id}`);
    // il mondo rientra nello schermo della bici; poi il ciclocomputer va di lato e arriva il testo
    Promise.resolve(onOpen?.(id)).then(() => {
      gsap.set(panel, { opacity: 1 });
      textIn(id);
      busy = false;
    });
  };

  let after = null;
  const finish = () => {
    if (!current) return;
    const id = current;
    menuCurrent(null);
    busy = true;
    gsap.to(panel, { opacity: 0, duration: 0.35, ease: 'sine.in' });
    Promise.resolve(onClose?.(id)).then(() => {
      gsap.set(el, { visibility: 'hidden' });
      el.setAttribute('aria-hidden', 'true');
      root.classList.remove('in-page');
      current = null;
      busy = false;
      story.resume();
      const then = after;
      after = null;
      then?.();
    });
  };
  /** chiude le pagine; passano dalla cronologia, così anche "indietro" del telefono funziona */
  const close = (then) => {
    if (!current || busy) return;
    after = then ?? null;
    if (history.state?.nomadsPage) history.back();
    else finish();
  };
  addEventListener('popstate', () => { if (current && !busy) finish(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // le voci del menu toccate sullo schermo del ciclocomputer; MAPAS riporta al globo
  for (const b of el.querySelectorAll('[data-hit]')) b.addEventListener('click', () => (b.dataset.hit === 'mapas' ? close() : open(b.dataset.hit)));
  /** chiude subito, senza animazioni (il logo: sotto la dissolvenza si torna all'intro) */
  const reset = () => {
    menuCurrent(null);
    gsap.set(el, { visibility: 'hidden' });
    el.setAttribute('aria-hidden', 'true');
    root.classList.remove('in-page');
    current = null; busy = false; after = null;
    if (history.state?.nomadsPage) history.replaceState(null, '', location.pathname + location.search);
  };
  return {
    open, close, reset,
    get isOpen() { return current !== null; },
    get id() { return current; },
    get busy() { return busy; },
    hits: [...el.querySelectorAll('[data-hit]')],
    covers: false,
  };
}
