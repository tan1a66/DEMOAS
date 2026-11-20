// Agendar: si sceglie servizio, sucursal, giorno e fascia oraria; la richiesta parte già scritta
// su WhatsApp, al numero della sucursal scelta (nessun dato passa da questo sito). Servizio e
// sucursal possono arrivare preselezionati ("Agenda tu manicure", "Agendar en esta sucursal").
import { SUCURSALES } from './config.js';

const fmtDay = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const fmtNum = new Intl.DateTimeFormat('es-MX', { day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const fmtLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const clean = (s) => s.replace('.', '');
const FRANJA = { mañana: 'por la mañana', mediodía: 'al mediodía', tarde: 'por la tarde' };
// come si dice nel messaggio
const COSA = {
  Nails: 'una cita de uñas',
  Lashes: 'una cita de pestañas',
  Brows: 'una cita de cejas',
  Hair: 'una cita de cabello',
};
const OPEN_DAYS = 12; // di lunes a sábado: la domenica si salta

export const createBooking = (root) => {
  const form = root.querySelector('.book');
  const days = form.querySelector('.days');
  const summary = form.querySelector('.book-summary');
  const errServicio = form.querySelector('.err-servicio');
  const errSucursal = form.querySelector('.err-sucursal');

  // i prossimi giorni di apertura, da oggi (domenica chiuso)
  const today = new Date();
  for (let i = 0, n = 0; n < OPEN_DAYS && i < 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (d.getDay() === 0) continue;
    n++;
    const label = document.createElement('label');
    label.className = 'day';
    const top = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : clean(fmtDay.format(d));
    label.innerHTML = `<input type="radio" name="dia" /><span><small></small><b></b><small></small></span>`;
    const input = label.querySelector('input');
    input.value = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${fmtLong.format(d).replace(',', '')}`;
    const [a, b, c] = label.querySelectorAll('small, b');
    a.textContent = top;
    b.textContent = fmtNum.format(d);
    c.textContent = clean(fmtMonth.format(d));
    days.appendChild(label);
  }

  const read = () => {
    const f = new FormData(form);
    return {
      servicio: f.get('servicio'),
      sucursal: f.get('sucursal'),
      dia: f.get('dia'),
      franja: f.get('franja'),
      nombre: String(f.get('nombre') || '').trim(),
    };
  };

  const message = ({ servicio, sucursal, dia, franja, nombre }) => {
    let m = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
    m += ` Me gustaría agendar ${COSA[servicio] || servicio}`;
    m += ` en Esmaltadas ${SUCURSALES[sucursal].nombre}`;
    if (dia) m += ` ${dia}`;
    if (franja) m += ` ${FRANJA[franja]}`;
    m += '. ¿Tienen disponibilidad?';
    return m;
  };

  const paint = () => {
    const v = read();
    if (v.servicio) errServicio.hidden = true;
    if (v.sucursal) errSucursal.hidden = true;
    const parts = [];
    if (v.servicio) parts.push(v.servicio);
    if (v.sucursal) parts.push(SUCURSALES[v.sucursal].nombre);
    if (v.dia) parts.push(v.dia.replace(/^el /, ''));
    if (v.franja) parts.push(FRANJA[v.franja]);
    summary.textContent = parts.join(' · ');
  };
  form.addEventListener('change', paint);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    const missing = !v.servicio ? ['.book-servicio', errServicio] : !v.sucursal ? ['.book-sucursal', errSucursal] : null;
    if (missing) {
      missing[1].hidden = false;
      form.querySelector(missing[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const url = `https://wa.me/${SUCURSALES[v.sucursal].whatsapp}?text=${encodeURIComponent(message(v))}`;
    window.open(url, '_blank', 'noopener');
  });

  const check = (name, value) => {
    for (const r of form.querySelectorAll(`input[name="${name}"]`)) r.checked = r.value === value;
  };

  return {
    /** Preseleziona servizio e/o sucursal (undefined: si lascia com'è). */
    preselect({ servicio, sucursal } = {}) {
      if (servicio !== undefined) check('servicio', servicio);
      if (sucursal !== undefined) check('sucursal', sucursal);
      paint();
    },
  };
};
