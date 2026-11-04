// Il menu sotto il logo: due pagine leggere, chiare come i pannelli dei capitoli.
//   Nosotros — chi è Nomads: i testi del marchio, la crew e il head coach (da config.js → copy)
//   Viajes   — i capitoli con la batteria; toccandone uno si apre il suo pannello
// (Contacto apre la schermata finale con WhatsApp: story.open)
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { battery } from './story.js';
import crewImg from '../assets/crew.webp';
import coachImg from '../assets/coach.webp';

function nosotros() {
  const C = CONFIG.copy;
  return `
    <header class="info__head">
      <p class="kicker">${C.start.kicker}</p>
      <h2 class="info__title page__title">${C.start.text}</h2>
    </header>
    <div class="page__block"><p class="label">${C.b.kicker}</p><p class="page__text">${C.b.text}</p></div>
    <div class="page__block"><p class="label">${C.c.kicker}</p><p class="page__text">${C.c.text}</p></div>
    <figure class="page__person">
      <img src="${crewImg}" alt="Ciclistas de Nomads en una pausa de café" decoding="async" />
      <figcaption><p class="label">${C.port.kicker}</p><p class="page__text">${C.port.text}</p><p class="page__sub">${C.port.sub}</p></figcaption>
    </figure>
    <figure class="page__person">
      <img src="${coachImg}" alt="Alfredo “Freddy” Cruz revisa la estrategia con un ciclista" decoding="async" />
      <figcaption><p class="label">${C.nus.kicker}</p><p class="page__text">${C.nus.text}</p><p class="page__sub">${C.nus.sub}</p></figcaption>
    </figure>`;
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

export function createPages({ story, onChapter }) {
  const make = (id, html) => {
    const el = document.createElement('section');
    el.className = 'info chapter-panel page';
    el.id = `page-${id}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="chapter-panel__bg" aria-hidden="true"></div>
      <div class="info__scroll">${html}</div>
      <button class="info__close" type="button" aria-label="Cerrar"><span aria-hidden="true">×</span></button>`;
    document.body.appendChild(el);
    return el;
  };
  const pages = { nosotros: make('nosotros', nosotros()), viajes: make('viajes', viajes()) };
  let current = null;

  const open = (id) => {
    if (current) return;
    const el = pages[id];
    current = el;
    story.pause();
    el.setAttribute('aria-hidden', 'false');
    el.querySelector('.info__scroll').scrollTop = 0;
    gsap.set(el, { visibility: 'visible' });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'sine.out' });
    gsap.fromTo(el.querySelectorAll('.info__scroll > *'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out', delay: 0.1 });
  };
  const close = (then) => {
    const el = current;
    if (!el) return;
    gsap.to(el, {
      opacity: 0, duration: 0.4, ease: 'sine.in',
      onComplete: () => {
        gsap.set(el, { visibility: 'hidden' });
        el.setAttribute('aria-hidden', 'true');
        current = null;
        story.resume();
        then?.();
      },
    });
  };
  for (const el of Object.values(pages)) el.querySelector('.info__close').addEventListener('click', () => close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // un capitolo dalla lista: si chiude la pagina e si apre il suo pannello
  pages.viajes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (b) close(() => onChapter(b.dataset.trip));
  });
  return { open, close, get isOpen() { return current !== null; } };
}
