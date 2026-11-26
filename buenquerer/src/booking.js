// Pide cita: si sceglie trattamento, giorno, fascia e ora precisa; la richiesta parte già scritta
// su WhatsApp (+34 683 13 76 69). Nessun dato passa da questo sito. Il trattamento può arrivare
// già scelto ("Solicita tu diagnóstico", "Pide cita" da una pagina dei trattamenti).
// Orario: lunes a viernes 10–20 h, sábado 10–14 h (domenica chiuso).
import { CONTACT } from './config.js';

const LOC = 'es-ES';
const fmtDay = new Intl.DateTimeFormat(LOC, { weekday: 'short' });
const fmtNum = new Intl.DateTimeFormat(LOC, { day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat(LOC, { month: 'short' });
const fmtLong = new Intl.DateTimeFormat(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
const clean = (s) => s.replace('.', '');
const FRANJA = { mañana: 'por la mañana', mediodía: 'a mediodía', tarde: 'por la tarde' };
// gli orari precisi di ogni fascia, ogni mezz'ora (aperto fino alle 20: l'ultimo turno alle 19)
const HORAS = {
  mañana: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'],
  mediodía: ['14:00', '14:30', '15:00', '15:30'],
  tarde: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
};
// il sabato si chiude alle 14: l'ultimo turno alle 13
const SABADO_ULTIMA = 13 * 60;
const MARGEN_HOY = 30; // oggi: solo gli orari tra almeno 30 minuti
// come si dice nel messaggio
const COSA = {
  Diagnóstico: 'un diagnóstico de piel',
  Facial: 'un tratamiento facial',
  Corporal: 'un tratamiento corporal',
  'Masaje o ritual': 'un masaje o un ritual',
  Mirada: 'una cita de mirada (pestañas y cejas)',
  'Manicura y pedicura': 'una cita de manicura y pedicura',
  Depilación: 'una cita de depilación',
};
const OPEN_DAYS = 12; // de lunes a sábado: el domingo se salta
const toMin = (h) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

export const createBooking = (root) => {
  const form = root.querySelector('.book');
  const days = form.querySelector('.days');
  const summary = form.querySelector('.book-summary');
  const errServicio = form.querySelector('.err-servicio');
  const horas = form.querySelector('.horas');
  const horasNote = form.querySelector('.horas-note');
  const otro = form.querySelector('.chip-otro span');
  let detalle = ''; // "Otro" arrivando da una pagina: il nome del trattamento (Novias, Piercing…)

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
    input.dataset.sabado = d.getDay() === 6 ? '1' : '';
    const [a, b, c] = label.querySelectorAll('small, b');
    a.textContent = top;
    b.textContent = fmtNum.format(d);
    c.textContent = clean(fmtMonth.format(d));
    days.appendChild(label);
  }

  const read = () => {
    const f = new FormData(form);
    const diaEl = form.querySelector('input[name="dia"]:checked');
    return {
      servicio: f.get('servicio'),
      dia: f.get('dia'),
      sabado: !!diaEl?.dataset.sabado,
      franja: f.get('franja'),
      hora: f.get('hora'),
      nombre: String(f.get('nombre') || '').trim(),
    };
  };

  const cosa = (servicio) => (servicio === 'Otro' ? (detalle ? `una cita de ${detalle}` : 'una cita') : COSA[servicio] || servicio);

  const message = ({ servicio, dia, franja, hora, nombre }) => {
    let m = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
    m += ` Me gustaría reservar ${cosa(servicio)} en buenquerer`;
    if (dia) m += ` ${dia}`;
    if (hora) m += ` a las ${hora}`;
    else if (franja) m += ` ${FRANJA[franja]}`;
    m += '. ¿Tenéis disponibilidad?';
    return m;
  };

  const paint = () => {
    const v = read();
    if (v.servicio) errServicio.hidden = true;
    otro.textContent = detalle || 'Otro';
    const parts = [];
    if (v.servicio) parts.push(v.servicio === 'Otro' ? detalle || 'Otro' : v.servicio);
    if (v.dia) parts.push(v.dia.replace(/^el /, ''));
    if (v.hora) parts.push(`a las ${v.hora}`);
    else if (v.franja) parts.push(FRANJA[v.franja]);
    summary.textContent = parts.join(' · ');
  };

  // il sabato solo la mattina (fino alle 14)
  const syncFranjas = () => {
    const { sabado } = read();
    for (const r of form.querySelectorAll('input[name="franja"]')) {
      const off = sabado && r.value !== 'mañana';
      r.disabled = off;
      if (off && r.checked) r.checked = false;
    }
  };

  // gli orari precisi della fascia scelta; oggi quelli già passati sono spenti
  const renderHoras = () => {
    const { franja, dia, hora, sabado } = read();
    horas.textContent = '';
    horasNote.hidden = true;
    if (!franja) {
      horas.hidden = true;
      if (sabado) {
        horasNote.textContent = 'Los sábados abrimos de 10 a 14 h.';
        horasNote.hidden = false;
      }
      return;
    }
    const now = new Date();
    const limite = now.getHours() * 60 + now.getMinutes() + MARGEN_HOY;
    let libres = 0;
    HORAS[franja].forEach((h, i) => {
      const min = toMin(h);
      if (sabado && min > SABADO_ULTIMA) return;
      const pasada = dia === 'hoy' && min < limite;
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
      horasNote.textContent = `Hoy ya no quedan horas ${FRANJA[franja]}: elige otra franja u otro día.`;
      horasNote.hidden = false;
    } else if (sabado) {
      horasNote.textContent = 'Los sábados abrimos de 10 a 14 h.';
      horasNote.hidden = false;
    }
  };

  form.addEventListener('change', (e) => {
    if (e.target.name === 'servicio' && e.target.value !== 'Otro') detalle = '';
    if (e.target.name === 'dia') syncFranjas();
    if (e.target.name === 'franja' || e.target.name === 'dia') renderHoras();
    paint();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    if (!v.servicio) {
      errServicio.hidden = false;
      form.querySelector('.book-servicio').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const url = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message(v))}`;
    window.open(url, '_blank', 'noopener');
  });

  const check = (name, value) => {
    for (const r of form.querySelectorAll(`input[name="${name}"]`)) r.checked = r.value === value;
  };

  return {
    /** Preseleziona il trattamento (undefined: si lascia com'è). `detalle`: il nome per "Otro". */
    preselect({ servicio, detalle: d } = {}) {
      if (servicio !== undefined) {
        check('servicio', servicio);
        detalle = servicio === 'Otro' ? d || '' : '';
      }
      paint();
    },
  };
};
