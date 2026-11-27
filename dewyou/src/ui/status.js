import { BRAND } from '../data/content.js';

// "Abierto ahora · hasta las 19:00" con la hora de Cancún (abre todos los días)
const nowInCancun = () => {
  const parts = new Intl.DateTimeFormat('es-MX', { timeZone: BRAND.timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t) => +parts.find((p) => p.type === t).value;
  return get('hour') * 60 + get('minute');
};
const hhmm = ([h, m]) => `${h}:${String(m).padStart(2, '0')}`;

export const initStatus = () => {
  const els = document.querySelectorAll('[data-status]');
  const update = () => {
    let open = false;
    let text = '';
    try {
      const t = nowInCancun();
      const o = BRAND.open[0] * 60 + BRAND.open[1];
      const c = BRAND.close[0] * 60 + BRAND.close[1];
      open = t >= o && t < c;
      text = open ? `Abierto ahora · hasta las ${hhmm(BRAND.close)}` : t < o ? `Cerrado · abrimos hoy a las ${hhmm(BRAND.open)}` : `Cerrado · abrimos mañana a las ${hhmm(BRAND.open)}`;
    } catch {
      return;
    }
    els.forEach((el) => {
      el.classList.toggle('is-open', open);
      el.querySelector('span').textContent = text;
    });
  };
  update();
  setInterval(update, 60_000);
};
