// Reservar: si sceglie il trattamento (prezzo, durata e cosa include, dalla scheda Booksy), si
// vede se lo studio è aperto e l'orario della settimana; la prenotazione vera si fa su Booksy,
// dove ÉIA ha già la disponibilità reale (giorno, ora, professionista). Nessun dato passa da qui.
import { ESTUDIO, CONTACT } from './config.js';

// i trattamenti (prezzi e durate dalla scheda Booksy, novembre 2026)
export const SERVICIOS = {
  laminado: {
    nombre: 'Laminado de cejas',
    precio: '60 €',
    duracion: '1 h',
    texto: 'El servicio estrella: limpieza, laminado, diseño personalizado con hilo, tinte (opcional) y crema regeneradora. Dura de 4 a 5 semanas.',
  },
  'diseno-tinte': {
    nombre: 'Diseño y tinte de cejas',
    precio: '30 €',
    duracion: '30 min',
    texto: 'Diseño de la mirada con técnicas avanzadas, depilación con hilo y tinte. Ideal para mantener el laminado cada 3 semanas.',
  },
  diseno: {
    nombre: 'Diseño de cejas',
    precio: '25 €',
    duracion: '20 min',
    texto: 'Cejas perfiladas y definidas, con hilo y gel fijador.',
  },
  'laminado-lifting': {
    nombre: 'Laminado + lifting',
    precio: '110 €',
    duracion: '1 h 45 min',
    texto: 'Cejas laminadas y pestañas curvadas en la misma cita.',
  },
  lifting: {
    nombre: 'Lifting de pestañas',
    precio: '50 €',
    duracion: '1 h 15 min',
    texto: 'Alarga y curva tus pestañas desde la raíz, con tinte incluido. Hasta 6–8 semanas.',
  },
  micro: {
    nombre: 'Micropigmentación de cejas',
    precio: '350 €',
    duracion: '2 h',
    texto: 'Diseño semipermanente, totalmente personalizado. También labios y eyeliner.',
  },
  manicura: {
    nombre: 'Manicura rusa con refuerzo',
    precio: 'desde 40 €',
    duracion: '1 h 30 min',
    texto: 'Cutícula al detalle, refuerzo de la uña natural y semipermanente a elección.',
  },
  pedicura: {
    nombre: 'Pedicura completa',
    precio: 'desde 40 €',
    duracion: '1 h',
    texto: 'Uñas, cutículas y talones; esmaltado opcional.',
  },
  facial: {
    nombre: 'Limpieza facial',
    precio: 'desde 60 €',
    duracion: '45 min',
    texto: 'Limpieza profunda adaptada a tu piel; también premium con hidrafacial.',
  },
  laser: {
    nombre: 'Láser diodo',
    precio: 'desde 15 €',
    duracion: '10 min',
    texto: 'Depilación láser por zonas, de labio a piernas completas.',
  },
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tramo = (d) => (ESTUDIO.cerrado.includes(iso(d)) ? null : ESTUDIO.horario[d.getDay()]);

/** "Abierto ahora · hasta las 20:00" / "Cerrado · abre el lunes a las 10:00" (ora di Madrid) */
export const estadoAhora = () => {
  // l'ora di Madrid, ovunque sia chi guarda
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const min = now.getHours() * 60 + now.getMinutes();
  const t = tramo(now);
  if (t && min >= t[0] && min < t[1]) return { abierto: true, texto: `Abierto ahora · hasta las ${hhmm(t[1])}` };
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const td = tramo(d);
    if (!td || (i === 0 && min >= td[0])) continue;
    const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DIAS[d.getDay()]}`;
    return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${hhmm(td[0])}` };
  }
  return { abierto: false, texto: 'Cerrado' };
};

/** L'orario della settimana, da lunes a domingo, con oggi in evidenza. */
export const renderHorario = (ul) => {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getDay();
  ul.textContent = '';
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const li = document.createElement('li');
    if (d === hoy) li.className = 'is-today';
    const t = ESTUDIO.horario[d];
    li.innerHTML = '<span></span><span></span>';
    li.children[0].textContent = DIAS[d];
    li.children[1].textContent = t ? `${hhmm(t[0])} – ${hhmm(t[1])}` : 'Cerrado';
    ul.appendChild(li);
  }
};

export const createBooking = (root) => {
  const form = root.querySelector('.book');
  const detail = form.querySelector('.svc-detail');
  const err = form.querySelector('.err-servicio');
  const estado = form.querySelector('.estado');

  const paint = () => {
    const key = new FormData(form).get('servicio');
    const s = SERVICIOS[key];
    detail.hidden = !s;
    if (s) {
      err.hidden = true;
      detail.querySelector('.svc-name').textContent = s.nombre;
      detail.querySelector('.svc-meta').textContent = `${s.precio} · ${s.duracion}`;
      detail.querySelector('.svc-text').textContent = s.texto;
    }
  };

  const paintEstado = () => {
    const e = estadoAhora();
    estado.textContent = e.texto;
    estado.classList.toggle('is-open', e.abierto);
  };
  renderHorario(form.querySelector('.horario'));
  paintEstado();
  setInterval(paintEstado, 60000);

  form.addEventListener('change', paint);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!new FormData(form).get('servicio')) {
      err.hidden = false;
      form.querySelector('.book-servicio').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    window.open(CONTACT.booksy, '_blank', 'noopener');
  });

  return {
    /** Preseleziona un trattamento (undefined: si lascia com'è). */
    preselect(key) {
      if (key === undefined) return;
      for (const r of form.querySelectorAll('input[name="servicio"]')) r.checked = r.value === key;
      paint();
    },
  };
};
