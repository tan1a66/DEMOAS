import { SITE, whatsappLink } from '../config/site';
import type { Dict } from '../i18n/es';

/**
 * Solicitud de reservación (interfaz). Hoy no hay backend: la solicitud se entrega por WhatsApp,
 * el canal publicado por Picheta, y la confirmación la da el restaurante.
 * Para conectar un servicio de reservas en el futuro, basta con sustituir `handoffUrl` por la llamada a su API
 * y mostrar el estado que devuelva (nunca una confirmación inventada).
 */
export interface ReservationRequest {
  name: string;
  date: string; // AAAA-MM-DD
  time: string; // HH:MM
  guests: string; // "1"…"10" o "more"
  phone: string;
  notes: string;
}

export type FieldErrors = Partial<Record<keyof ReservationRequest, string>>;

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Día de la semana de una fecha AAAA-MM-DD (0 = domingo), sin desfases de zona horaria. */
function weekday(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

/**
 * Horas que se pueden solicitar: cada 30 min desde la apertura hasta las 23:30 (o media hora antes del cierre
 * si cierra antes de medianoche). Horario oficial en config/site.ts.
 */
export function timeSlots(iso: string): string[] {
  const day = weekday(iso);
  if (day === null) return [];
  const slot = SITE.hours.find((s) => (s.days as readonly number[]).includes(day));
  if (!slot) return [];
  const toMin = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const open = toMin(slot.open);
  let close = toMin(slot.close);
  if (close <= open) close += 24 * 60; // cierra después de medianoche
  const last = Math.min(close - 30, 23 * 60 + 30);
  const out: string[] = [];
  for (let t = open; t <= last; t += 30) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  return out;
}

export function validate(req: ReservationRequest, e: Dict['reserve']['form']['errors'], today = todayISO()): FieldErrors {
  const errors: FieldErrors = {};
  if (req.name.trim().length < 2) errors.name = e.name;
  if (!req.date) errors.date = e.date;
  else if (req.date < today) errors.date = e.datePast;
  if (!req.time || !timeSlots(req.date).includes(req.time)) errors.time = e.time;
  if (!req.guests) errors.guests = e.guests;
  if (req.phone.trim() && !/^\+?[\d\s-]{7,20}$/.test(req.phone.trim())) errors.phone = e.phone;
  return errors;
}

/** Fecha legible en el idioma de la interfaz, para el mensaje. */
export function formatDate(iso: string, lang: 'es' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

/** Enlace de WhatsApp con la solicitud redactada. El envío lo hace la persona desde WhatsApp. */
export function handoffUrl(req: ReservationRequest, f: Dict['reserve']['form'], lang: 'es' | 'en'): string {
  const m = f.message;
  const guests = req.guests === 'more' ? f.guestsMore : f.guestsOption(Number(req.guests));
  const lines = [
    m.greeting,
    '',
    `${m.name}: ${req.name.trim()}`,
    `${m.date}: ${formatDate(req.date, lang)}`,
    `${m.time}: ${req.time}`,
    `${m.guests}: ${guests}`,
    req.phone.trim() ? `${m.phone}: ${req.phone.trim()}` : '',
    req.notes.trim() ? `${m.notes}: ${req.notes.trim()}` : '',
  ].filter((l, i) => l !== '' || i === 1);
  return whatsappLink(lines.join('\n'));
}
