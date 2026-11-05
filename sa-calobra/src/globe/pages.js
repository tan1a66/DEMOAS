// Le pagine interne: la giostra delle bici (ride.js). Il menu (NOSOTROS, VIAJES, CONTACTO) sta nello
// schermo del ciclocomputer, e anche sotto il logo. Toccando una voce il mondo rientra nello schermo
// della bici (l'intro al contrario); il ciclocomputer si sposta di lato (in alto sul telefono) e
// accanto compare il contenuto. Cambiando voce la giostra gira e arriva la bici di quella voce.
//   Nosotros — i testi di Nomads, la crew, il head coach e gli spazi per le foto dei viaggi (FOTO)
//   Viajes   — i capitoli con la batteria; toccandone uno si torna sul globo e si apre il capitolo
//   Contacto — WhatsApp
// Si esce con il "indietro" del telefono, con "Mapa" o con il logo: il mondo esce dallo schermo.
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { battery } from './story.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

const WA = 'https://wa.me/393461758562';
export const SECTIONS = ['nosotros', 'viajes', 'contacto'];

// gli spazi per le foto dei viaggi: dove le metterei, con il soggetto che ci vedrei
const FOTO = ['El grupo en ruta', 'Sa Calobra desde arriba', 'Café de media mañana', 'El coach con el grupo', 'La llegada'];
const ph = (subject, cls = '') => `<figure class="ph ${cls}"><span class="ph__tag">Foto</span><figcaption>${subject}</figcaption></figure>`;

function nosotros() {
  const C = CONFIG.copy;
  return `
    <p class="kicker">Nosotros · Desde México</p>
    <h2 class="bk__title">${C.start.text}</h2>
    <div class="bk__block"><p class="bk__label">${C.b.kicker}</p><p class="bk__text">${C.b.text}</p></div>
    <div class="bk__block"><p class="bk__label">${C.c.kicker}</p><p class="bk__text">${C.c.text}</p></div>
    <figure class="bk__person">
      <img src="${crewImg}" alt="Ciclistas de Nomads en una pausa de café" decoding="async" />
      <figcaption><p class="bk__label">${C.port.kicker}</p><p class="bk__text">${C.port.text}</p><p class="bk__sub">${C.port.sub}</p></figcaption>
    </figure>
    <figure class="bk__person">
      <img src="${coachImg}" alt="Alfredo “Freddy” Cruz revisa la estrategia con un ciclista" decoding="async" />
      <figcaption><p class="bk__label">${C.nus.kicker}</p><p class="bk__text">${C.nus.text}</p><p class="bk__sub">${C.nus.sub}</p></figcaption>
    </figure>
    <div class="bk__block">
      <p class="bk__label">Fotos de los viajes</p>
      ${ph('El grupo en el paisaje · a toda página', 'ph--wide')}
      <div class="ph__strip">${FOTO.map((f) => ph(f)).join('')}</div>
    </div>`;
}

function viajes() {
  const G = CONFIG.globe;
  return `
    <p class="kicker">Capítulos</p>
    <h2 class="bk__title">Viajes</h2>
    <ul class="trips">${G.chapters.map((ch) => `
      <li><button class="trip" type="button" data-trip="${ch.n}">
        <span class="trip__top"><b>Capítulo ${ch.n}</b><i>${battery(ch.status)}</i></span>
        <strong>${ch.name ?? ch.title}</strong>
        <span class="trip__when">${ch.when}</span>
        ${ch.lead ? `<span class="trip__lead">${ch.lead}</span>` : ''}
        <span class="trip__go" aria-hidden="true">→</span>
      </button></li>`).join('')}
    </ul>`;
}

function contacto() {
  return `
    <p class="kicker">Contacto</p>
    <h2 class="bk__title">Esta parte la construimos juntos.</h2>
    <a class="cta" href="${WA}" target="_blank" rel="noopener">WhatsApp <span aria-hidden="true">→</span></a>`;
}

export function createPages({ story, onChapter, onOpen, onSection, onClose }) {
  const root = document.documentElement;
  const el = document.createElement('section');
  el.className = 'pg';
  el.id = 'pages';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <nav class="bk__hits" aria-label="Menú del ciclocomputador">${SECTIONS.map((id) => `<button type="button" data-hit="${id}" aria-label="${id}"></button>`).join('')}</nav>
    <div class="bk__panel">
      <button class="bk__back" type="button"><span aria-hidden="true">←</span> Mapa</button>
      <section class="bk__sec" data-sec="nosotros">${nosotros()}</section>
      <section class="bk__sec" data-sec="viajes">${viajes()}</section>
      <section class="bk__sec" data-sec="contacto">${contacto()}</section>
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
  const textIn = (id, delay = 0) => gsap.fromTo([el.querySelector('.bk__back'), ...secs[id].children], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, ease: 'power3.out', delay });

  /** apre le pagine sulla voce id; se sono già aperte, gira la giostra fino a quella voce */
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
  el.querySelector('.bk__back').addEventListener('click', () => close());
  // le voci del menu toccate sullo schermo del ciclocomputer
  for (const b of el.querySelectorAll('[data-hit]')) b.addEventListener('click', () => open(b.dataset.hit));
  // un capitolo: si torna sul globo e si apre il suo pannello
  secs.viajes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (b) close(() => onChapter(b.dataset.trip));
  });
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
