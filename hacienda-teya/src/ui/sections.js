// ─────────────────────────────────────────────────────────────────────────────
//  Sezioni HTML: il filo come motivo ricorrente
//  - parole "cucite" (Bodas, Corporativos, Familiares, Trova): la stessa linea
//    centrale del titolo d'apertura, disegnata a punti indietro in SVG e
//    cucita quando la sezione entra nello schermo
//  - sotto ogni titolo un'impuntura che si cuce da sinistra a destra
//  - comparsa morbida dei pannelli, link reali (OpenTable, Instagram) e
//    segnaposto chiari dove mancano i dati (WhatsApp, menù, Teya Viva)
// ─────────────────────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import paths from '../data/thread-paths.json';
import { LINKS, WHATSAPP, INSTAGRAM } from '../config.js';

gsap.registerPlugin(ScrollTrigger);
const NS = 'http://www.w3.org/2000/svg';

// parola cucita: un <path> a punti (tratteggio) rivelato da una maschera che si "disegna"
function stitchedWord(svg) {
  const L = paths.layouts[svg.dataset.word];
  if (!L) return null;
  const [x1, y1, x2, y2] = L.bbox;
  const pad = 0.08;
  const vb = [x1 - pad, -y2 - pad, x2 - x1 + pad * 2, y2 - y1 + pad * 2];
  svg.setAttribute('viewBox', vb.join(' '));
  svg.setAttribute('aria-hidden', 'true');
  const id = `m-${svg.dataset.word}-${Math.random().toString(36).slice(2, 7)}`;
  const defs = document.createElementNS(NS, 'defs');
  const mask = document.createElementNS(NS, 'mask');
  mask.setAttribute('id', id);
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  // regione esplicita: con userSpaceOnUse il default (-10%/120%) parte
  // dall'origine 0,0 e taglierebbe metà parola (le y sono negative)
  ['x', 'y', 'width', 'height'].forEach((k, i) => mask.setAttribute(k, vb[i]));
  defs.appendChild(mask);
  svg.appendChild(defs);
  const shadow = document.createElementNS(NS, 'g');
  shadow.setAttribute('class', 'stitch-shadow');
  const thread = document.createElementNS(NS, 'g');
  thread.setAttribute('class', 'stitch-thread');
  thread.setAttribute('mask', `url(#${id})`);
  shadow.setAttribute('mask', `url(#${id})`);
  const revealers = [];
  for (const st of L.strokes) {
    let d = '';
    if (st.dot) {
      const [x, y] = st.dot;
      d = `M${x - 0.02} ${-y} a0.02 0.02 0 1 0 0.04 0 a0.02 0.02 0 1 0 -0.04 0`;
    } else {
      for (let i = 0; i < st.p.length; i += 3) d += `${i ? 'L' : 'M'}${st.p[i].toFixed(3)} ${(-st.p[i + 1]).toFixed(3)}`;
    }
    for (const g of [shadow, thread]) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      g.appendChild(p);
    }
    const r = document.createElementNS(NS, 'path');
    r.setAttribute('d', d);
    r.setAttribute('class', 'stitch-reveal');
    mask.appendChild(r);
    revealers.push(r);
  }
  svg.append(shadow, thread);
  // lunghezze per l'animazione del "disegno"
  let total = 0;
  for (const r of revealers) {
    const len = r.getTotalLength();
    r.style.strokeDasharray = `${len} ${len}`;
    r.style.strokeDashoffset = `${len}`;
    r.dataset.len = len;
    total += len;
  }
  return { revealers, total };
}

function sewWord(word, duration = 1.6) {
  const tl = gsap.timeline();
  let t = 0;
  for (const r of word.revealers) {
    const len = +r.dataset.len;
    const d = (len / word.total) * duration;
    tl.to(r, { strokeDashoffset: 0, duration: d, ease: 'none' }, t);
    t += d + 0.04;
  }
  return tl;
}

// impuntura sotto i titoli: un'onda leggera a punti che si cuce
function underline(title) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'stitch-line');
  svg.setAttribute('viewBox', '0 0 200 8');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M2 4 C 40 1, 60 7, 100 4 S 160 1, 198 4');
  svg.appendChild(p);
  title.after(svg);
  const len = p.getTotalLength();
  const mask = document.createElementNS(NS, 'clipPath');
  const id = `u-${Math.random().toString(36).slice(2, 7)}`;
  mask.setAttribute('id', id);
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', 0);
  rect.setAttribute('y', 0);
  rect.setAttribute('height', 8);
  rect.setAttribute('width', 0);
  mask.appendChild(rect);
  svg.prepend(mask);
  p.setAttribute('clip-path', `url(#${id})`);
  return { rect, len };
}

function setLinks() {
  const set = (sel, href, todo) => {
    document.querySelectorAll(sel).forEach((a) => {
      if (href && href !== '#') {
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
      } else {
        a.href = '#';
        a.classList.add('is-placeholder');
        a.title = todo;
        a.addEventListener('click', (e) => e.preventDefault());
      }
    });
  };
  const wa = (n, text) => (n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null);
  set('[data-link="reservar"]', LINKS.reservarHacienda);
  set('[data-link="reservarHacienda"]', LINKS.reservarHacienda);
  set('[data-link="reservarSantaLucia"]', LINKS.reservarSantaLucia);
  set('[data-link="reservarViva"]', LINKS.reservarViva, 'Enlace de reservación por confirmar');
  set('[data-link="menu"]', LINKS.menu, 'Menú por publicar');
  set('[data-link="waHacienda"]', wa(WHATSAPP.hacienda, 'Hola, quiero reservar en Hacienda Teya'), 'WhatsApp por confirmar');
  set('[data-link="waViva"]', wa(WHATSAPP.viva, 'Hola, quiero reservar en Teya Viva'), 'WhatsApp por confirmar');
  set('[data-link="waSantaLucia"]', wa(WHATSAPP.santaLucia, 'Hola, quiero reservar en Teya Santa Lucía'), 'WhatsApp por confirmar');
  set('[data-link="cotizar"]', wa(WHATSAPP.eventos, 'Hola, quiero cotizar un evento en Hacienda Teya'), 'WhatsApp de eventos por confirmar');
  set('[data-link="igHacienda"]', INSTAGRAM.hacienda);
  set('[data-link="igViva"]', INSTAGRAM.viva);
  set('[data-link="igSantaLucia"]', INSTAGRAM.santaLucia);
}

// linea del tempo di "Nuestra historia": la tappa attiva segue lo scroll del
// capitolo (lo stesso avanzamento che guida l'epoca del 3D in main.js)
function initTimeline(scrollTo) {
  const chapter = document.querySelector('#historia');
  const line = chapter && chapter.querySelector('.timeline');
  if (!line) return;
  const knots = [...line.querySelectorAll('li')];
  const stops = [...chapter.querySelectorAll('.stop')];
  const n = stops.length;
  let active = -1;
  const set = (p, instant = false) => {
    // il filo arriva al nodo quando la sua tappa è a metà
    line.style.setProperty('--p', Math.min(1, Math.max(0, (p * n - 0.5) / (n - 1))).toFixed(4));
    const i = Math.min(n - 1, Math.floor(p * n));
    if (i === active) return;
    const prev = stops[active];
    active = i;
    knots.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-done', k < i);
    });
    stops.forEach((el, k) => el.classList.toggle('is-active', k === i));
    if (instant) {
      gsap.set(stops, { autoAlpha: 0, y: 10 });
      gsap.set(stops[i], { autoAlpha: 1, y: 0 });
      return;
    }
    if (prev) gsap.to(prev, { autoAlpha: 0, y: -8, duration: 0.4, ease: 'power2.in', overwrite: true });
    gsap.fromTo(stops[i], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.15, ease: 'power2.out', overwrite: true });
  };
  set(0, true);
  ScrollTrigger.create({
    trigger: chapter,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => set(self.progress),
    onRefresh: (self) => set(self.progress, true),
  });
  // clic su una data: si scorre fino al centro di quella tappa
  line.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      const k = Number(b.dataset.stop);
      scrollTo(chapter.offsetTop + ((k + 0.5) / n) * (chapter.offsetHeight - innerHeight));
    }),
  );
}

export function initSections({ scrollTo = (y) => window.scrollTo({ top: y, behavior: 'smooth' }) } = {}) {
  setLinks();
  initTimeline(scrollTo);

  // parole cucite: si cuciono quando entrano nello schermo
  document.querySelectorAll('svg.stitched').forEach((svg) => {
    const word = stitchedWord(svg);
    if (!word) return;
    ScrollTrigger.create({
      trigger: svg,
      start: 'top 82%',
      once: true,
      onEnter: () => sewWord(word, svg.classList.contains('stitched--big') ? 1.8 : 1.3),
    });
  });

  // impunture sotto i titoli
  document.querySelectorAll('.chapter .title').forEach((title) => {
    const u = underline(title);
    ScrollTrigger.create({
      trigger: title,
      start: 'top 80%',
      once: true,
      onEnter: () => gsap.to(u.rect, { attr: { width: 200 }, duration: 1.1, ease: 'power2.inOut' }),
    });
  });

  // pannelli e card: comparsa morbida
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 26 },
      {
        opacity: 1,
        y: 0,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
      },
    );
  });

  // didascalie dei passaggi: entrano e escono col capitolo
  document.querySelectorAll('.pass-caption').forEach((el) => {
    gsap
      .timeline({ scrollTrigger: { trigger: el.parentElement, start: 'top 60%', end: 'bottom 40%', scrub: true } })
      .fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 })
      .to(el, { opacity: 1, duration: 0.4 })
      .to(el, { opacity: 0, y: -30, duration: 0.3 });
  });
}
