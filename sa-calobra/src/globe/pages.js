// Il menu sotto il logo.
//   Nosotros — la racconta il ciclocomputer: il mondo rientra nello schermo della bici (l'intro al
//              contrario); scorrendo, la camera gira intorno al manubrio e lo schermo cambia come le
//              pagine di un GPS (ride.js). Sotto, gli spazi per le foto dei viaggi (segnati FOTO,
//              in attesa di quelle di Nomads) e i pulsanti. Si esce con il "indietro" del telefono,
//              con il logo o con i pulsanti: il mondo esce di nuovo dallo schermo.
//   Viajes   — leggera e chiara: i capitoli con la batteria; toccandone uno si apre il suo pannello
// (Contacto apre la schermata finale con WhatsApp: story.open)
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';
import { battery } from './story.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

gsap.registerPlugin(SplitText, ScrollTrigger);

const WA = 'https://wa.me/393461758562';

// gli spazi per le foto dei viaggi: dove le metterei, con il soggetto che ci vedrei
const FOTO = ['El grupo en ruta', 'Sa Calobra desde arriba', 'Café de media mañana', 'El coach con el grupo', 'La llegada'];
const ph = (subject, cls = '') => `<figure class="ph ${cls}"><span class="ph__tag">Foto</span><figcaption>${subject}</figcaption></figure>`;

function nosotros() {
  return `
    <div class="pg__track" aria-hidden="true"></div>
    <section class="pg__gallery">
      <p class="pg__label">Fotos de los viajes</p>
      ${ph('El grupo en el paisaje · a toda página', 'ph--wide')}
      <div class="ph__strip">${FOTO.map((f) => ph(f)).join('')}</div>
    </section>
    <footer class="pg__foot">
      <p class="pg__label">Nomads Cycling Club</p>
      <div class="pg__actions">
        <button class="cta" type="button" data-goto="viajes">Ver los viajes <span aria-hidden="true">→</span></button>
        <a class="cta cta--line" href="${WA}" target="_blank" rel="noopener">WhatsApp <span aria-hidden="true">→</span></a>
      </div>
    </footer>`;
}

function viajes() {
  const G = CONFIG.globe;
  return `
    <header class="info__head">
      <p class="kicker">Capítulos</p>
      <h2 class="info__title page__title">Viajes</h2>
    </header>
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

export function createPages({ story, onChapter, onOpen, onClose, onScroll }) {
  const root = document.documentElement;
  // ── Nosotros: una pagina vera, con la testata del sito sopra
  const real = document.createElement('section');
  real.className = 'pg';
  real.id = 'page-nosotros';
  real.setAttribute('aria-hidden', 'true');
  real.innerHTML = `<div class="pg__scroll">${nosotros()}</div>`;
  document.body.appendChild(real);
  // ── Viajes: il pannello chiaro
  const light = document.createElement('section');
  light.className = 'info chapter-panel page';
  light.id = 'page-viajes';
  light.setAttribute('aria-hidden', 'true');
  light.innerHTML = `<div class="chapter-panel__bg" aria-hidden="true"></div>
    <div class="info__scroll">${viajes()}</div>
    <button class="info__close" type="button" aria-label="Cerrar"><span aria-hidden="true">×</span></button>`;
  document.body.appendChild(light);
  const pages = { nosotros: real, viajes: light };
  let current = null, currentId = null, busy = false, closing = false;

  // ── scorrendo la parte della bici si comandano camera e schermate (main.js → ride.js)
  const scroller = real.querySelector('.pg__scroll');
  ScrollTrigger.create({ trigger: real.querySelector('.pg__track'), scroller, start: 'top top', end: 'bottom bottom', onUpdate: (st) => onScroll?.('nosotros', st.progress) });
  // la galleria e il fondo entrano dolcemente; la testata prende un fondo chiaro sulla galleria
  for (const el of real.querySelectorAll('.pg__gallery > *, .pg__foot > *')) {
    gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, scroller, start: 'top 90%' } });
  }
  ScrollTrigger.create({ trigger: real.querySelector('.pg__gallery'), scroller, start: 'top 90px', onEnter: () => root.classList.add('pg-scrolled'), onLeaveBack: () => root.classList.remove('pg-scrolled') });

  /** entra nella pagina: il mondo è già rientrato nello schermo della bici */
  const showReal = () => {
    scroller.scrollTop = 0;
    root.classList.add('in-page');
    real.setAttribute('aria-hidden', 'false');
    gsap.set(real, { visibility: 'visible', opacity: 1 });
    ScrollTrigger.refresh();
    busy = false;
    history.pushState({ nomadsPage: 'nosotros' }, '', '#nosotros');
  };

  const open = (id) => {
    if (busy) return;
    if (current) { if (currentId !== id) close(() => open(id)); return; }
    const el = pages[id];
    current = el;
    currentId = id;
    story.pause();
    menuCurrent(id);
    if (el === real) {
      busy = true;
      // il mondo rientra nello schermo della bici; poi si scorre la pagina
      Promise.resolve(onOpen?.(id)).then(showReal);
      return;
    }
    onOpen?.(id);
    el.setAttribute('aria-hidden', 'false');
    el.querySelector('.info__scroll').scrollTop = 0;
    gsap.set(el, { visibility: 'visible' });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'sine.out' });
    gsap.fromTo(el.querySelectorAll('.info__scroll > *'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out', delay: 0.1 });
  };

  let after = null;
  const finish = () => {
    const el = current;
    if (!el) return;
    const id = currentId;
    closing = true; // da qui il globo torna a disegnarsi: si vede mentre la pagina sfuma
    onClose?.(id);
    menuCurrent(null);
    gsap.to(el, {
      opacity: 0, duration: el === real ? 0.55 : 0.4, ease: 'sine.in',
      onComplete: () => {
        gsap.set(el, { visibility: 'hidden' });
        el.setAttribute('aria-hidden', 'true');
        if (el === real) root.classList.remove('in-page', 'pg-scrolled');
        current = null;
        currentId = null;
        closing = false;
        story.resume();
        const then = after;
        after = null;
        then?.();
      },
    });
  };
  /** chiude la pagina aperta; quella vera passa dalla cronologia, così anche "indietro" funziona */
  const close = (then) => {
    if (!current || busy) return;
    after = then ?? null;
    if (current === real && history.state?.nomadsPage) history.back();
    else finish();
  };
  addEventListener('popstate', () => { if (current === real) finish(); });
  light.querySelector('.info__close').addEventListener('click', () => close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // un capitolo dalla lista: si chiude la pagina e si apre il suo pannello
  light.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (b) close(() => onChapter(b.dataset.trip));
  });
  real.querySelector('[data-goto="viajes"]').addEventListener('click', () => close(() => open('viajes')));
  // il menu indica la pagina in cui si è
  const menuCurrent = (id) => {
    for (const b of document.querySelectorAll('[data-page]')) {
      if (b.dataset.page === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  };
  return {
    open, close,
    get isOpen() { return current !== null; },
    get id() { return currentId; },
    /** una pagina che copre tutto il globo (non serve disegnarlo dietro) */
    get covers() { return current !== null && !busy && !closing; },
  };
}
