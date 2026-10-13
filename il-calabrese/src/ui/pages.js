// Contenido HTML de las tres páginas que se abren desde los platos.
import { PIZZAS, CATEGORIES } from '../data/pizzas.js';
import { drawPizza, drawMap } from '../textures.js';
import { CONFIG, ARTIFACT } from '../config.js';

const EMBED_MAP = !ARTIFACT;

const money = (n) => `$${n.toLocaleString('es-MX')}`;
const TAG = { vegetariana: 'Vegetariana', vegana: 'Vegana', picante: 'Picante 🌶', firma: 'De la casa', postre: 'Postre' };

const closeBtn = `<button class="page-close" type="button" data-close aria-label="Volver a la mesa">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Volver a la mesa</span></button>`;

export function renderMenu(el) {
  const items = PIZZAS.map((p, i) => {
    const tags = (p.tags || []).map((t) => `<span class="tag tag-${t}">${TAG[t]}</span>`).join('');
    return `<article class="pizza" data-cat="${p.cat}" style="--i:${i}">
      <div class="pizza-text">
        <p class="pizza-num">${String(i + 1).padStart(2, '0')}</p>
        <h3 class="pizza-name">${p.name}</h3>
        <p class="pizza-it">${p.it}</p>
        <p class="pizza-ing">${p.ingredients}</p>
        <div class="pizza-foot"><b class="pizza-price">${money(p.price)}</b>${tags}</div>
      </div>
      <figure class="pizza-photo">
        <div class="pizza-photo-in" data-photo="${i}">
          ${ARTIFACT ? '' : `<img alt="Pizza ${p.name}" loading="lazy" decoding="async" src="${p.photo}" />`}
        </div>
      </figure>
    </article>`;
  }).join('');

  el.innerHTML = `${closeBtn}
  <div class="page-scroll menu-scroll">
    <header class="menu-head">
      <p class="eyebrow">Horno de leña · Masa de 48 horas</p>
      <h2>La Carta</h2>
      <p class="menu-lead">Pizza napoletana con ingredientes traídos de Calabria y lo mejor del mercado de Mérida.</p>
      <nav class="menu-tabs" role="tablist">
        <button class="active" data-cat="all" type="button">Todas</button>
        ${CATEGORIES.map((c) => `<button data-cat="${c.id}" type="button">${c.label}</button>`).join('')}
      </nav>
    </header>
    <div class="menu-list">${items}</div>
    <footer class="menu-foot">
      <p>Precios en pesos mexicanos, IVA incluido. Precios y fotografías de demostración.</p>
      <button class="btn btn-red" type="button" data-goto="reservar">Reservar una mesa</button>
    </footer>
  </div>
  <div class="menu-progress"><i></i></div>`;

  // Si una foto no carga (o no hay fotos externas), se dibuja la pizza: siempre hay imagen.
  if (ARTIFACT) {
    el.querySelectorAll('.pizza-photo-in').forEach((box) => {
      const i = +box.dataset.photo;
      const c = drawPizza(PIZZAS[i], 700, i + 3);
      c.className = 'pizza-canvas';
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', `Pizza ${PIZZAS[i].name}`);
      box.appendChild(c);
    });
  }
  el.querySelectorAll('.pizza-photo-in img').forEach((img) => {
    const i = +img.parentElement.dataset.photo;
    const fallback = () => {
      const c = drawPizza(PIZZAS[i], 700, i + 3);
      c.className = 'pizza-canvas';
      img.replaceWith(c);
    };
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && !img.naturalWidth) fallback();
  });

  const scroller = el.querySelector('.menu-scroll');
  const list = [...el.querySelectorAll('.pizza')];
  const bar = el.querySelector('.menu-progress i');

  el.classList.add('menu-anim');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { root: scroller, threshold: 0.18 }
  );
  list.forEach((a) => io.observe(a));

  // Parallax + giro suave de las fotos mientras se desplaza.
  let raf = 0;
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const h = scroller.clientHeight;
      bar.style.transform = `scaleX(${scroller.scrollTop / Math.max(1, scroller.scrollHeight - h)})`;
      for (const a of list) {
        const r = a.getBoundingClientRect();
        const k = (r.top + r.height / 2 - h / 2) / h; // -1..1
        if (Math.abs(k) > 1.5) continue;
        const ph = a.querySelector('.pizza-photo-in');
        ph.style.transform = `translateY(${k * -40}px) rotate(${k * -14}deg) scale(${1 - Math.min(Math.abs(k), 1) * 0.08})`;
      }
    });
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  el.querySelectorAll('.menu-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      el.querySelectorAll('.menu-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      const cat = b.dataset.cat;
      list.forEach((a) => (a.hidden = cat !== 'all' && a.dataset.cat !== cat));
      scroller.scrollTo({ top: el.querySelector('.menu-list').offsetTop - 120, behavior: 'smooth' });
      onScroll();
    })
  );
  return { onOpen: () => { scroller.scrollTop = 0; onScroll(); } };
}

export function renderReservar(el) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const hours = ['13:00', '13:30', '14:00', '14:30', '15:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  el.innerHTML = `${closeBtn}
  <div class="page-scroll">
    <div class="sheet">
      <p class="eyebrow">Riservato per voi</p>
      <h2>Reserva tu mesa</h2>
      <p class="lead">Como en casa de la nonna: dinos cuántos son y te guardamos la mesa.</p>
      <form class="resv" novalidate>
        <div class="field-row">
          <label class="field"><span>Fecha</span><input type="date" name="fecha" min="${iso(today)}" value="${iso(today)}" required /></label>
          <label class="field"><span>Hora</span><select name="hora">${hours.map((h) => `<option${h === '20:00' ? ' selected' : ''}>${h}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span>Personas</span>
          <div class="people" role="radiogroup">
            ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" data-n="${n}" class="${n === 2 ? 'active' : ''}">${n}${n === 8 ? '+' : ''}</button>`).join('')}
          </div>
        </div>
        <div class="field-row">
          <label class="field"><span>Nombre</span><input name="nombre" autocomplete="name" placeholder="Tu nombre" required /></label>
          <label class="field"><span>Teléfono / WhatsApp</span><input name="tel" type="tel" autocomplete="tel" placeholder="999 123 4567" required /></label>
        </div>
        <label class="field"><span>Ocasión (opcional)</span>
          <select name="ocasion"><option value="">—</option><option>Cumpleaños</option><option>Aniversario</option><option>Comida familiar</option><option>Negocios</option></select></label>
        <label class="field"><span>Notas</span><textarea name="notas" rows="2" placeholder="Silla para bebé, alergias, terraza…"></textarea></label>
        <button class="btn btn-red btn-block" type="submit">Confirmar por WhatsApp</button>
        <p class="fineprint">Demo: la reserva se envía como mensaje de WhatsApp al restaurante.</p>
      </form>
      <div class="resv-ok" hidden>
        <div class="ok-plate">✓</div>
        <h3>¡Casi listo!</h3>
        <p class="ok-text"></p>
        <p class="ok-msg"></p>
        <a class="btn btn-green" target="_blank" rel="noopener">Enviar por WhatsApp</a>
        <button class="btn btn-ghost" type="button" data-again>Hacer otra reserva</button>
      </div>
    </div>
  </div>`;

  const form = el.querySelector('form');
  let people = 2;
  el.querySelectorAll('.people button').forEach((b) =>
    b.addEventListener('click', () => {
      people = +b.dataset.n;
      el.querySelectorAll('.people button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    let bad = false;
    for (const k of ['nombre', 'tel', 'fecha']) {
      const inp = form.elements[k];
      const ko = !String(d[k] || '').trim();
      inp.closest('.field').classList.toggle('error', ko);
      bad ||= ko;
    }
    if (bad) return;
    const fecha = new Date(d.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = `Hola Il Calabrese, quiero reservar una mesa para ${people}${people === 8 ? '+' : ''} personas el ${fecha} a las ${d.hora}. Nombre: ${d.nombre}. Tel: ${d.tel}.${d.ocasion ? ' Ocasión: ' + d.ocasion + '.' : ''}${d.notas ? ' Notas: ' + d.notas : ''}`;
    const ok = el.querySelector('.resv-ok');
    ok.querySelector('.ok-text').textContent = `${d.nombre}, tu reserva para el ${fecha} a las ${d.hora} (${people}${people === 8 ? '+' : ''} personas) queda confirmada cuando envíes este mensaje:`;
    ok.querySelector('.ok-msg').textContent = msg;
    ok.querySelector('a').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
    form.hidden = true;
    ok.hidden = false;
  });
  el.querySelector('[data-again]').addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    el.querySelector('.resv-ok').hidden = true;
  });
  return {};
}

export function renderUbicacion(el) {
  const { lat, lon } = CONFIG.location;
  const d = 0.012;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d * 0.7},${lon + d},${lat + d * 0.7}&layer=mapnik&marker=${lat},${lon}`;
  el.innerHTML = `${closeBtn}
  <div class="page-scroll">
    <div class="sheet sheet-wide">
      <div class="loc-grid">
        <div>
          <p class="eyebrow">Dove siamo</p>
          <h2>Ubicación</h2>
          <p class="lead">En el corazón de Mérida, a unos pasos de Paseo de Montejo.</p>
          <ul class="info">
            <li><b>Dirección</b><span>${CONFIG.address}</span></li>
            <li><b>Horario</b><span>Martes a domingo · 13:00 – 23:00<br/>Lunes cerrado</span></li>
            <li><b>Teléfono</b><span>${CONFIG.phoneLabel}</span></li>
            <li><b>Estacionamiento</b><span>Valet parking los fines de semana</span></li>
          </ul>
          <div class="loc-actions">
            <a class="btn btn-red" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}">Cómo llegar</a>
            <a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.whatsapp}">WhatsApp</a>
          </div>
          <p class="fineprint">Dirección y teléfono de demostración (por confirmar).</p>
        </div>
        <div class="map-frame">
          ${EMBED_MAP ? `<iframe title="Mapa de Il Calabrese en Mérida" loading="lazy" src="${osm}"></iframe>` : ''}
          <a class="map-pin" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}">Il Calabrese · ver en Google Maps ↗</a>
        </div>
      </div>
    </div>
  </div>`;
  // Sin iframe (página publicada en un entorno que no permite incrustar mapas): mapa ilustrado de Mérida.
  if (!EMBED_MAP) {
    const c = drawMap(900);
    c.className = 'map-canvas';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', 'Mapa ilustrado del centro de Mérida');
    el.querySelector('.map-frame').prepend(c);
  }
  return {};
}
