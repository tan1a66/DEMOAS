// Il menu sotto il logo.
//   Nosotros — una pagina vera: il globo vola su Città del Messico (da dove parte Nomads) e quella
//              vista diventa la copertina della pagina; sotto, chiara come una rivista, i testi del
//              marchio, la crew e il head coach (da config.js → copy). Si esce con il "indietro"
//              del telefono, con il logo o con i pulsanti in fondo.
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

function nosotros() {
  const C = CONFIG.copy;
  return `
    <header class="pg__hero">
      <img class="pg__cover" alt="México visto desde el espacio" />
      <div class="pg__heroText">
        <p class="kicker">${C.start.kicker} · Desde México</p>
        <h1 class="pg__title" data-lines>${C.start.text}</h1>
      </div>
    </header>
    <main class="pg__body">
      <section class="pg__sec" data-reveal>
        <span class="pg__n">01</span>
        <p class="pg__label">${C.b.kicker}</p>
        <p class="pg__big" data-lines>${C.b.text}</p>
      </section>
      <section class="pg__sec" data-reveal>
        <span class="pg__n">02</span>
        <p class="pg__label">${C.c.kicker}</p>
        <p class="pg__big" data-lines>${C.c.text}</p>
      </section>
      <figure class="pg__person" data-reveal>
        <div class="pg__photo"><img src="${crewImg}" alt="Ciclistas de Nomads en una pausa de café" decoding="async" /></div>
        <figcaption>
          <span class="pg__n">03</span>
          <p class="pg__label">${C.port.kicker}</p>
          <p class="pg__big" data-lines>${C.port.text}</p>
          <p class="pg__sub">${C.port.sub}</p>
        </figcaption>
      </figure>
      <figure class="pg__person pg__person--right" data-reveal>
        <div class="pg__photo"><img src="${coachImg}" alt="Alfredo “Freddy” Cruz revisa la estrategia con un ciclista" decoding="async" /></div>
        <figcaption>
          <span class="pg__n">04</span>
          <p class="pg__label">${C.nus.kicker}</p>
          <p class="pg__big" data-lines>${C.nus.text}</p>
          <p class="pg__sub">${C.nus.sub}</p>
        </figcaption>
      </figure>
    </main>
    <footer class="pg__foot" data-reveal>
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

export function createPages({ story, onChapter, onOpen, onClose }) {
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

  // ── le animazioni della pagina: righe che salgono, foto che si aprono mentre si scorre
  const scroller = real.querySelector('.pg__scroll');
  const lines = new Map();
  for (const t of real.querySelectorAll('[data-lines]')) lines.set(t, SplitText.create(t, { type: 'lines', mask: 'lines', linesClass: 'line' }).lines);
  for (const block of real.querySelectorAll('[data-reveal]')) {
    const tl = gsap.timeline({ paused: true });
    const text = [...block.querySelectorAll('[data-lines]')].flatMap((t) => lines.get(t));
    const photo = block.querySelector('.pg__photo');
    if (photo) tl.fromTo(photo, { clipPath: 'inset(20% 0% 20% 0%)', opacity: 0 }, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 1.2, ease: 'power3.out' }, 0);
    tl.fromTo(block.querySelectorAll('.pg__n, .pg__label'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, photo ? 0.25 : 0);
    if (text.length) tl.fromTo(text, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, photo ? 0.35 : 0.1);
    tl.fromTo(block.querySelectorAll('.pg__sub, .cta'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, photo ? 0.6 : 0.3);
    ScrollTrigger.create({ trigger: block, scroller, start: 'top 85%', onEnter: () => tl.play() });
    if (photo) gsap.fromTo(photo.querySelector('img'), { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.04, ease: 'none', scrollTrigger: { trigger: photo, scroller, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  // la copertina si allontana un poco mentre si scorre; la testata diventa chiara sotto la copertina
  gsap.to(real.querySelector('.pg__cover'), { yPercent: 18, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.pg__hero', scroller, start: 'top top', end: 'bottom top', scrub: true } });
  ScrollTrigger.create({ trigger: '.pg__hero', scroller, start: 'bottom 70px', onToggle: (s) => root.classList.toggle('pg-scrolled', s.isActive || s.progress === 1), onLeaveBack: () => root.classList.remove('pg-scrolled'), onEnter: () => root.classList.add('pg-scrolled') });
  // appena si scorre la testata prende un fondo (scuro sulla copertina, chiaro sotto)
  scroller.addEventListener('scroll', () => root.classList.toggle('pg-moved', scroller.scrollTop > 6), { passive: true });
  const heroLines = lines.get(real.querySelector('.pg__title'));

  /** entra nella pagina vera: la copertina è la stessa immagine del globo appena arrivato */
  const showReal = (cover) => {
    real.querySelector('.pg__cover').src = cover;
    scroller.scrollTop = 0;
    root.classList.add('in-page');
    real.setAttribute('aria-hidden', 'false');
    gsap.set(real, { visibility: 'visible', opacity: 1 });
    // la copertina occupa lo schermo come il globo, poi si assesta e lascia vedere la pagina sotto
    gsap.fromTo(real.querySelector('.pg__hero'), { height: '100svh' }, { height: '84svh', duration: 1.1, ease: 'power3.inOut', delay: 0.15 });
    gsap.fromTo(heroLines, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out', delay: 0.35 });
    gsap.fromTo(real.querySelector('.pg__hero .kicker'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.6 });
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
      // il mondo vola sul Messico; arrivato, la sua immagine diventa la copertina
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
        if (el === real) root.classList.remove('in-page', 'pg-scrolled', 'pg-moved');
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
