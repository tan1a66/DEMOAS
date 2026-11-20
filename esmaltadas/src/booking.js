// Agendar: si sceglie servizio, sucursal, giorno, fascia e ora precisa; la richiesta parte già scritta
// su WhatsApp, al numero della sucursal scelta (nessun dato passa da questo sito). Servizio e
// sucursal possono arrivare preselezionati ("Agenda tu manicure", "Agendar en esta sucursal").
import { SUCURSALES } from './config.js';

const fmtDay = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const fmtNum = new Intl.DateTimeFormat('es-MX', { day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const fmtLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const clean = (s) => s.replace('.', '');
const FRANJA = { mañana: 'por la mañana', mediodía: 'al mediodía', tarde: 'por la tarde' };
// gli orari precisi di ogni fascia, ogni mezz'ora (aperto dalle 10 alle 20: l'ultimo turno alle 19)
const HORAS = {
  mañana: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'],
  mediodía: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
  tarde: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
};
const MARGEN_HOY = 30; // oggi: solo gli orari tra almeno 30 minuti
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
  const horas = form.querySelector('.horas');
  const horasNote = form.querySelector('.horas-note');

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
      hora: f.get('hora'),
      nombre: String(f.get('nombre') || '').trim(),
    };
  };

  const message = ({ servicio, sucursal, dia, franja, hora, nombre }) => {
    let m = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
    m += ` Me gustaría agendar ${COSA[servicio] || servicio}`;
    m += ` en Esmaltadas ${SUCURSALES[sucursal].nombre}`;
    if (dia) m += ` ${dia}`;
    if (hora) m += ` a las ${hora}`;
    else if (franja) m += ` ${FRANJA[franja]}`;
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
    if (v.hora) parts.push(`a las ${v.hora}`);
    else if (v.franja) parts.push(FRANJA[v.franja]);
    summary.textContent = parts.join(' · ');
  };

  // gli orari precisi della fascia scelta; oggi quelli già passati sono spenti
  const renderHoras = () => {
    const { franja, dia, hora } = read();
    horas.textContent = '';
    horasNote.hidden = true;
    if (!franja) {
      horas.hidden = true;
      return;
    }
    const now = new Date();
    const limite = now.getHours() * 60 + now.getMinutes() + MARGEN_HOY;
    let libres = 0;
    HORAS[franja].forEach((h, i) => {
      const [hh, mm] = h.split(':').map(Number);
      const pasada = dia === 'hoy' && hh * 60 + mm < limite;
      const label = document.createElement('label');
      label.className = 'chip chip-hora';
      label.style.setProperty('--i', i);
      label.innerHTML = '<input type="radio" name="hora" /><span></span>';
      const input = label.querySelector('input');
      input.value = h;
      input.disabled = pasada;
      input.checked = !pasada && h === hora;
      label.querySelector('span').textContent = h;
      horas.appendChild(label);
      if (!pasada) libres++;
    });
    horas.hidden = false;
    if (!libres) {
      horasNote.textContent = `Hoy ya no quedan horarios ${FRANJA[franja]}: elige otra franja u otro día.`;
      horasNote.hidden = false;
    }
  };

  form.addEventListener('change', (e) => {
    if (e.target.name === 'franja' || e.target.name === 'dia') renderHoras();
    paint();
  });

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
