import { useLang } from '../i18n';
import { SITE } from '../config/site';

/** "Lunes a sábado · 17:00 – 01:00" a partir del horario oficial (config/site.ts). */
export function HoursList({ className = '' }: { className?: string }) {
  const { t, lang } = useLang();
  const fmt = (hhmm: string) => {
    if (lang === 'es') return hhmm;
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    const suffix = h < 12 ? 'am' : 'pm';
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${suffix}`;
  };
  return (
    <dl className={`hours ${className}`}>
      {SITE.hours.map((slot) => {
        const first = slot.days[0] ?? 0;
        const last = slot.days[slot.days.length - 1] ?? first;
        const days = first === last ? t.location.days[first] : t.location.range(t.location.days[first] ?? '', t.location.days[last] ?? '');
        return (
          <div className="hours__row" key={slot.days.join('-')}>
            <dt>{days}</dt>
            <dd>
              {fmt(slot.open)}
              <span aria-hidden="true"> – </span>
              <span className="visually-hidden"> {lang === 'es' ? 'a' : 'to'} </span>
              {fmt(slot.close)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
