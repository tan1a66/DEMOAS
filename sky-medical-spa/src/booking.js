// Agendar: si sceglie servizio, giorno e fascia oraria; la richiesta parte già scritta su
// WhatsApp (nessun dato passa da questo sito). Il servizio può arrivare preselezionato
// dai bottoni in fondo alle sezioni ("Agenda tu facial"…).
import { CONTACT } from './config.js';

const fmtDay = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const fmtNum = new Intl.DateTimeFormat('es-MX', { day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const fmtLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const clean = (s) => s.replace('.', '');
const FRANJA = { mañana: 'por la mañana', mediodía: 'al mediodía', tarde: 'por la tarde' };
// come si dice nel messaggio
const COSA = {
  Faciales: 'un facial',
  Masajes: 'un masaje',
  'Depilación láser': 'una valoración de depilación láser',
  Lashes: 'una cita de pestañas (lashes)',
  Nails: 'una cita de uñas (nails)',
  Hair: 'una cita de cabello (hair)',
  'Manos y pies': 'manicure y pedicure',
};

export const createBooking = (root) => {
  const form = root.querySelector('.book');
  const days = form.querySelector('.days');
  const summary = form.querySelector('.book-summary');
  const error = form.querySelector('.book-error');
  let nota = ''; // dal test della pelle in Faciales: "piel seca · me interesa: hidratación profunda"

  // i prossimi 14 giorni, da oggi
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
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
      dia: f.get('dia'),
      franja: f.get('franja'),
      nombre: String(f.get('nombre') || '').trim(),
    };
  };

  const message = ({ servicio, dia, franja, nombre }) => {
    let m = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
    const lugar = ['Lashes', 'Nails', 'Hair', 'Manos y pies'].includes(servicio) ? 'SKY Beauty Center' : 'SKY Medical Spa';
    m += ` Me gustaría agendar ${COSA[servicio] || servicio}`;
    if (nota && servicio === 'Faciales') m += ` (${nota})`;
    m += ` en ${lugar}`;
    if (dia) m += ` ${dia}`;
    if (franja) m += ` ${FRANJA[franja]}`;
    m += '. ¿Tienen disponibilidad?';
    return m;
  };

  const paint = () => {
    const v = read();
    if (v.servicio) error.hidden = true;
    summary.textContent = v.servicio
      ? `${v.servicio}${nota && v.servicio === 'Faciales' ? ' (' + nota + ')' : ''}${v.dia ? ' · ' + v.dia.replace(/^el /, '') : ''}${v.franja ? ' · ' + FRANJA[v.franja] : ''}`
      : '';
  };
  form.addEventListener('change', paint);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    if (!v.servicio) {
      error.hidden = false;
      form.querySelector('.book-servicio').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const url = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message(v))}`;
    window.open(url, '_blank', 'noopener');
  });

  return {
    /** Preseleziona un servizio (stringa vuota: nessuno), con una nota facoltativa. */
    preselect(servicio, notaNueva = '') {
      if (servicio === undefined) return;
      nota = notaNueva;
      for (const r of form.querySelectorAll('input[name="servicio"]')) r.checked = r.value === servicio;
      paint();
    },
  };
};
