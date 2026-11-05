// Le pagine interne: la giostra delle bici (ride.js). Il menu (NOSOTROS, VIAJES, CONTACTO) sta nello
// schermo del ciclocomputer, e anche sotto il logo. Toccando una voce il mondo rientra nello schermo
// della bici (l'intro al contrario); il ciclocomputer si sposta di lato (in alto sul telefono) e
// accanto compare il contenuto. Cambiando voce la giostra gira e arriva la bici di quella voce.
//   Nosotros — i testi di Nomads, la crew, il head coach e gli spazi per le foto dei viaggi (FOTO)
//   Viajes   — i capitoli con la batteria; toccandone uno si torna sul globo e si apre il capitolo
//   Contacto — WhatsApp
// Si esce con MAPAS sullo schermo, con il "indietro" del telefono o con il logo: il mondo esce dallo
// schermo. Nelle bici il menu sotto il logo si nasconde: c'è già nello schermo.
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

/** Viajes: informazioni, non le schede della mappa. I numeri sono somme delle tappe del PDF di
 *  Nomads (config.js → trip.days); il grafico mostra il dislivello di ogni tappa */
function viajes() {
  const T = CONFIG.trip, G = CONFIG.globe;
  const fmt = (n) => n.toLocaleString('en-US'); // 10,651 come nel PDF
  const stages = T.days.filter((d) => d.stats).map((d) => {
    const [km, hrs, m] = d.stats.split(' · ');
    const [h, min] = hrs.split(' ')[0].split(':').map(Number);
    return { day: d.day, name: d.name, km: parseFloat(km), min: h * 60 + min, m: parseInt(m.replace(/\D/g, ''), 10), level: d.level };
  });
  const km = stages.reduce((a, s) => a + s.km, 0), m = stages.reduce((a, s) => a + s.m, 0);
  const hours = Math.round(stages.reduce((a, s) => a + s.min, 0) / 60);
  const maxM = Math.max(...stages.map((s) => s.m));
  const cols = stages.map((s) => `
      <button class="elev__col" type="button" style="--h:${((s.m / maxM) * 100).toFixed(1)}%" aria-label="Día ${s.day}, ${s.name}: ${fmt(s.m)} m de desnivel, ${s.km} km">
        ${s.m === maxM ? `<em class="elev__val">${fmt(s.m)} m</em>` : ''}<i></i><span class="elev__day">${s.day}</span>
        <span class="elev__tip" role="tooltip"><b>Día ${s.day}</b>${s.name}<br />${fmt(s.m)} m · ${s.km} km · ${s.level}</span>
      </button>`).join('');
  const next = G.chapters.map((ch) => `
      <li><button class="chap" type="button" data-trip="${ch.n}">
        <span class="chap__when">${ch.when}</span>
        <span class="chap__body"><b>Capítulo ${ch.n} · ${ch.name ?? ch.title}</b><span class="chap__status">${battery(ch.status)}</span>${ch.lead ? `<span class="chap__lead">${ch.lead}</span>` : ''}</span>
      </button></li>`).join('');
  return `
    <p class="kicker">Viajes</p>
    <h2 class="bk__title">${T.chapter} · ${T.name}</h2>
    <p class="bk__meta">${battery('done')} · ${T.dates}</p>
    <dl class="stats">
      <div><dt>Etapas</dt><dd>${stages.length}</dd></div>
      <div><dt>Kilómetros</dt><dd>${fmt(Math.round(km))}</dd></div>
      <div><dt>Desnivel</dt><dd>${fmt(m)} m</dd></div>
      <div><dt>Horas en bici</dt><dd>${hours}</dd></div>
    </dl>
    <p class="bk__note">Totales de las ${stages.length} etapas, con la del día 6 (opcional). Tres niveles: ${T.levels.join(', ').toLowerCase()}.</p>
    <figure class="elev">
      <figcaption class="bk__label">Desnivel por etapa</figcaption>
      <div class="elev__plot">${cols}</div>
      <p class="elev__axis">Día</p>
      <table class="sr-only"><caption>Desnivel por etapa, Capítulo 01 · Mallorca</caption><tr><th>Día</th><th>Etapa</th><th>Desnivel</th><th>Km</th></tr>${stages.map((s) => `<tr><td>${s.day}</td><td>${s.name}</td><td>${fmt(s.m)} m</td><td>${s.km}</td></tr>`).join('')}</table>
    </figure>
    <div class="bk__block">
      <p class="bk__label">Lo que incluía</p>
      <ul class="incl-list">${T.includes.map((x) => `<li>${x}</li>`).join('')}</ul>
      <button class="cta" type="button" data-trip="01">El viaje día a día <span aria-hidden="true">→</span></button>
    </div>
    <div class="bk__block">
      <p class="bk__label">Los capítulos</p>
      <ol class="chaps">${next}</ol>
    </div>
    <div class="promise"><p class="label">La promesa Nomads</p><p class="promise__t">${G.copy.promise}</p></div>`;
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
    <nav class="bk__hits" aria-label="Menú del ciclocomputador">${[...SECTIONS, 'mapas'].map((id) => `<button type="button" data-hit="${id}" aria-label="${id}"></button>`).join('')}</nav>
    <div class="bk__panel">
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
  const textIn = (id, delay = 0) => gsap.fromTo(secs[id].children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, ease: 'power3.out', delay });

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
  // le voci del menu toccate sullo schermo del ciclocomputer; MAPAS riporta al globo
  for (const b of el.querySelectorAll('[data-hit]')) b.addEventListener('click', () => (b.dataset.hit === 'mapas' ? close() : open(b.dataset.hit)));
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
