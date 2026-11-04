// Capítulo 01 · Mallorca: la linea arancione si stacca dalla strada e si raddrizza in verticale,
// diventando la linea del tempo del viaggio con i giorni (dati in config.js → trip).
// Chiudendo, la linea torna a posarsi sulla strada e la storia riprende.
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { resample, projectRoad, lerpPts } from './lineOverlay.js';

const N = 90;

const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// il pannello dal config: capitolo, giorni, livello, cosa include e (se in vendita) il prezzo
function build() {
  const t = CONFIG.trip;
  const past = t.status === 'past';
  for (const id of ['info-open', 'info-open-end']) { const el = document.getElementById(id); if (el) el.textContent = t.button; }
  document.getElementById('info-dates').textContent = `${t.chapter} · ${t.dates}`;
  document.getElementById('info-title').textContent = t.name;
  document.getElementById('info-lead').textContent = past ? 'Así fue el primer capítulo.' : t.price.note;
  document.getElementById('levels').innerHTML = `<p>¿Cuál es tu nivel?</p>` +
    ['Todos', ...t.levels].map((l, i) => `<button type="button" data-level="${i ? norm(l) : ''}" aria-pressed="${i ? 'false' : 'true'}">${l}</button>`).join('');
  const ol = document.getElementById('days');
  ol.innerHTML = t.days.map((d) => `
    <li class="day${d.current ? ' day--current' : ''}" data-level="${d.level ? norm(d.level) : ''}">
      <i class="day__dot" aria-hidden="true"></i>
      <p class="day__n">Día ${d.day}${d.level ? ` · <span>${d.level}</span>` : ''}</p>
      ${d.name ? `<p class="day__name">${d.name}</p>` : ''}
      ${d.text ? `<p class="day__text">${d.text}</p>` : ''}
      ${d.stats ? `<p class="day__stats">${d.stats}</p>` : ''}
    </li>`).join('');
  document.getElementById('incl').innerHTML = `
    <h3>${past ? 'Lo que incluía' : 'Tu viaje incluye'}</h3>
    <ul>${t.includes.map((x) => `<li>${x}</li>`).join('')}</ul>
    ${past ? '' : `<div class="price"><p><b>${t.price.total}</b><span>Inversión total</span></p><p><b>${t.price.deposit}</b><span>Apartado inicial</span></p></div>`}`;
  document.getElementById('cta-info').innerHTML = past
    ? 'Quiero el próximo capítulo <span aria-hidden="true">→</span>'
    : `Aparta tu lugar · ${t.price.deposit} <span aria-hidden="true">→</span>`;
}

// ¿Cuál es tu nivel?: evidenzia i giorni di quel livello
function bindLevels() {
  const box = document.getElementById('levels');
  const days = document.getElementById('days');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const lvl = b.dataset.level;
    for (const x of box.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    days.classList.toggle('is-filtered', !!lvl);
    for (const d of days.children) d.classList.toggle('is-match', !!lvl && d.dataset.level.startsWith(lvl));
  });
}

export function createInfo({ camera, road, rig, overlay, story, setLineVisible, source = null }) {
  build();
  bindLevels();
  const el = document.getElementById('info');
  const scroller = document.getElementById('info-scroll');
  const sea = el.querySelector('.info__sea'); // fondo: il mare cristallino della cala
  const days = document.getElementById('days');
  const items = () => [document.querySelector('.info__head'), ...days.children, document.getElementById('incl'), document.querySelector('.info__next')];
  let isOpen = false, busy = false;

  // la parte di linea visibile adesso: in discesa fin dove è disegnata, poi tutta
  const sourcePts = () => {
    if (source) return resample(source(), N); // il globo: la rotta disegnata
    const st = rig.state;
    const s1 = st.dir > 0 ? Math.max(st.lineS, 60) : road.length;
    return resample(projectRoad(camera, road, 0, s1, N, innerWidth, innerHeight), N);
  };
  // la linea verticale della lista dei giorni, in coordinate dello schermo
  const targetPts = () => {
    const r = days.getBoundingClientRect();
    const x = r.left + 9, y0 = r.top + 6, y1 = innerHeight + 40;
    return resample([[x, y0], [x, y1]], N);
  };

  const s = { t: 0 };
  let from = null, to = null;
  const draw = () => overlay.draw(lerpPts(from, to, s.t), { lineWidth: CONFIG.line.width, lineOpacity: 1 });

  function open() {
    if (isOpen || busy) return;
    isOpen = busy = true;
    story.pause();
    el.setAttribute('aria-hidden', 'false');
    scroller.scrollTop = 0;
    gsap.set(el, { visibility: 'visible' });
    gsap.set(items(), { opacity: 0, y: 14 });
    gsap.set(days, { '--line': 0 });
    from = sourcePts();
    to = targetPts();
    s.t = 0;
    overlay.show();
    draw();
    setLineVisible(false);
    gsap.timeline({ onComplete: () => { busy = false; } })
      .to(sea, { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, 0)
      .to(s, { t: 1, duration: 1.25, ease: 'power3.inOut', onUpdate: draw }, 0.05)
      .add(() => { gsap.set(days, { '--line': 1 }); overlay.hide(); }, 1.3)
      .to(items(), { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, 1.2);
  }

  function close() {
    if (!isOpen || busy) return;
    busy = true;
    const done = () => {
      scroller.scrollTop = 0;
      from = sourcePts();
      to = targetPts();
      s.t = 1;
      overlay.show();
      draw();
      gsap.set(days, { '--line': 0 });
      gsap.timeline({
        onComplete: () => {
          overlay.hide();
          setLineVisible(true);
          gsap.set(el, { visibility: 'hidden' });
          el.setAttribute('aria-hidden', 'true');
          story.resume();
          isOpen = busy = false;
        },
      })
        .to(s, { t: 0, duration: 1.1, ease: 'power3.inOut', onUpdate: draw }, 0)
        .to(sea, { opacity: 0, duration: 0.9, ease: 'sine.inOut' }, 0.2);
    };
    gsap.to(items(), { opacity: 0, y: -10, duration: 0.35, stagger: 0.02, ease: 'power2.in', onComplete: done });
  }

  for (const id of ['info-open', 'info-open-end']) document.getElementById(id)?.addEventListener('click', open);
  document.getElementById('info-close').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.getElementById('cta-info').addEventListener('click', (e) => { close(); setTimeout(() => story.open(e), 1300); });
  return { open, close, get isOpen() { return isOpen; } };
}
