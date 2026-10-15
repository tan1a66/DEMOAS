// Textos ES / EN y lógica de los mensajes que dependen de la hora de Mérida.

import { toMerida } from './time.js';

export const STRINGS = {
  es: {
    title: ['Del fogón', 'al cielo de Mérida.'],
    kicker: (now) => `El cielo de Mérida, ahora · ${fmt.es(now)}`,
    subtitle: (sunset, after) =>
      after
        ? `Hoy el sol se puso a las ${fmt.es(sunset)} sobre la Plaza Grande.`
        : `Hoy el sol se pone a las ${fmt.es(sunset)} sobre la Plaza Grande.`,
    cta: {
      before: (s) => `Reserva para el atardecer · hoy ${fmt.es(s)}`,
      setting: () => 'El sol se está poniendo. ¿Tienes mesa?',
      open: () => 'Esta noche, la terraza está abierta',
      closed: (next) => `Mañana, el atardecer es a las ${fmt.es(next)}`,
    },
    address: 'Calle 61 x 60 y 62 · Plaza Grande, Mérida',
    kitchenKicker: 'La cocina',
    kitchenLine: ['Ingredientes de Yucatán.', 'Manos de autor.'],
    photoAlt: ['Plato de Picheta', 'La cocina de Picheta', 'Ingredientes yucatecos'],
    scroll: 'Bajar a la cocina',
    slider: { live: 'En vivo', label: 'Hora de Mérida' },
  },
  en: {
    title: ['From the hearth', 'to the Mérida sky.'],
    kicker: (now) => `The sky over Mérida, now · ${fmt.en(now)}`,
    subtitle: (sunset, after) =>
      after
        ? `Tonight the sun set at ${fmt.en(sunset)} over the Plaza Grande.`
        : `Tonight the sun sets at ${fmt.en(sunset)} over the Plaza Grande.`,
    cta: {
      before: (s) => `Book for sunset · today ${fmt.en(s)}`,
      setting: () => 'The sun is setting. Got a table?',
      open: () => 'Tonight, the terrace is open',
      closed: (next) => `Tomorrow, sunset is at ${fmt.en(next)}`,
    },
    address: 'Calle 61 x 60 y 62 · Plaza Grande, Mérida',
    kitchenKicker: 'The kitchen',
    kitchenLine: ['Yucatán ingredients.', "Authors' hands."],
    photoAlt: ['A dish at Picheta', 'The kitchen at Picheta', 'Yucatecan ingredients'],
    scroll: 'Down to the kitchen',
    slider: { live: 'Live', label: 'Mérida time' },
  },
};

// Horas siempre en hora de Mérida. ES: 18:07 · EN: 6:07 pm
const pad = (n) => String(n).padStart(2, '0');
export const fmt = {
  es(instant) {
    const w = toMerida(instant);
    return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
  },
  en(instant) {
    const w = toMerida(instant);
    const h = w.getUTCHours();
    return `${h % 12 || 12}:${pad(w.getUTCMinutes())}\u00A0${h < 12 ? 'am' : 'pm'}`; // sin salto antes de "pm"
  },
};

/**
 * Estado del botón de reserva:
 *   'before'  más de 60 min antes de la puesta
 *   'setting' de 60 min antes a 30 min después
 *   'open'    después, con la terraza abierta
 *   'closed'  después, fuera de horario → anuncia la puesta de mañana
 */
export function ctaState(service) {
  const m = service.minToSunset;
  if (m > 60) return 'before';
  if (m >= -30) return 'setting';
  return service.open ? 'open' : 'closed';
}

export function ctaText(lang, service) {
  const c = STRINGS[lang].cta;
  const state = ctaState(service);
  if (state === 'before') return c.before(service.sunset);
  if (state === 'closed') return c.closed(service.nextSunset);
  return c[state]();
}
