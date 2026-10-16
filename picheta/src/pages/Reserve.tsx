import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { handoffUrl, timeSlots, todayISO, validate, type FieldErrors, type ReservationRequest } from '../lib/reservations';
import { Arrow } from '../components/Arrow';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { HoursList } from '../components/HoursList';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

const EMPTY: ReservationRequest = { name: '', date: '', time: '', guests: '2', phone: '', notes: '' };
const FIELD_ORDER: (keyof ReservationRequest)[] = ['name', 'date', 'time', 'guests', 'phone', 'notes'];

/**
 * Agendar: la acción principal abre el sistema oficial (OpenTable). Como alternativa, una solicitud
 * que se entrega por WhatsApp; la página nunca muestra una reserva confirmada.
 */
export function Reserve() {
  const { t, lang } = useLang();
  const r = t.reserve;
  const f = r.form;
  const uid = useId();
  const [data, setData] = useState<ReservationRequest>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'error' | 'opened'>('idle');
  const [link, setLink] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const today = todayISO();
  const slots = useMemo(() => (data.date ? timeSlots(data.date) : []), [data.date]);

  const set = (key: keyof ReservationRequest) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setData((d) => {
      const next = { ...d, [key]: value };
      // Si la nueva fecha no admite la hora elegida, se borra.
      if (key === 'date' && !timeSlots(value).includes(d.time)) next.time = '';
      return next;
    });
    if (errors[key])
      setErrors((er) => {
        const next = { ...er };
        delete next[key];
        return next;
      });
    if (status === 'opened') setStatus('idle');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(data, f.errors, today);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      setStatus('error');
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const url = handoffUrl(data, f, lang);
    setLink(url);
    setStatus('opened');
    window.open(url, '_blank', 'noopener');
  };

  const fid = (k: string) => `${uid}-${k}`;
  const describe = (k: keyof ReservationRequest, extra?: string) =>
    [errors[k] ? fid(`${k}-err`) : '', extra ?? ''].filter(Boolean).join(' ') || undefined;
  const err = (k: keyof ReservationRequest) =>
    errors[k] ? (
      <p className="field__error" id={fid(`${k}-err`)}>
        {errors[k]}
      </p>
    ) : null;

  return (
    <>
      <a className="skip-link" href="#contenido">
        {t.common.skip}
      </a>
      <span id="top" />
      <Header page="reserve" solidOnWide />
      <main id="contenido" className="reserve-page">
        <div className="reserve-page__media" data-theme="dark">
          <Picture id="terraza-brindis" priority sizes="(max-width: 900px) 100vw, 42vw" />
        </div>

        <div className="reserve-page__content" data-theme="light">
          <header className="reserve-page__head is-in">
            <p className="kicker label">
              <span className="kicker__rule" />
              {r.kicker}
            </p>
            <Title lines={r.title} as="h1" className="h2 reserve-page__title" />
            <p className="lead reserve-page__lead">{r.lead}</p>
            <a className="btn btn--dark btn--lg reserve-page__primary" href={SITE.reservations.url} target="_blank" rel="noopener">
              <span>{r.primary}</span>
              <Arrow />
              <span className="visually-hidden"> {t.common.newTab}</span>
            </a>
            <p className="reserve-page__primary-note label">{r.primaryNote}</p>
          </header>

          <section className="reserve-page__alts" aria-labelledby="alts-title">
            <h2 id="alts-title" className="label">
              {r.alternatives}
            </h2>
            <ul>
              <li>
                <span className="reserve-page__alt-k">{r.whatsapp}</span>
                <a className="text-link" href={SITE.whatsapp.url} target="_blank" rel="noopener">
                  {r.whatsappAction}
                  <Arrow />
                  <span className="visually-hidden"> {t.common.newTab}</span>
                </a>
              </li>
              <li>
                <span className="reserve-page__alt-k">{r.phone}</span>
                <a className="text-link" href={SITE.phone.href}>
                  {SITE.phone.display}
                </a>
              </li>
            </ul>
          </section>

          <section className="reserve-form" aria-labelledby="form-title">
            <h2 id="form-title" className="h3">
              {f.title}
            </h2>
            <p className="reserve-form__lead">{f.lead}</p>

            <div className="reserve-form__status" role="status" aria-live="polite">
              {status === 'opened' && (
                <p className="notice notice--ok">
                  {f.opened}{' '}
                  <a className="text-link" href={link} target="_blank" rel="noopener">
                    {f.openedFallback}
                    <Arrow />
                  </a>
                </p>
              )}
            </div>
            {status === 'error' && (
              <p className="notice notice--error" role="alert">
                {f.errors.summary}
              </p>
            )}

            <form ref={formRef} noValidate onSubmit={onSubmit} className="reserve-form__grid">
              <div className={`field field--wide ${errors.name ? 'is-invalid' : ''}`}>
                <label htmlFor={fid('name')}>
                  {f.name} <span className="field__req">· {f.required}</span>
                </label>
                <input
                  id={fid('name')}
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={data.name}
                  onChange={set('name')}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describe('name')}
                />
                {err('name')}
              </div>

              <div className={`field ${errors.date ? 'is-invalid' : ''}`}>
                <label htmlFor={fid('date')}>
                  {f.date} <span className="field__req">· {f.required}</span>
                </label>
                <input
                  id={fid('date')}
                  name="date"
                  type="date"
                  min={today}
                  required
                  value={data.date}
                  onChange={set('date')}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={describe('date')}
                />
                {err('date')}
              </div>

              <div className={`field ${errors.time ? 'is-invalid' : ''}`}>
                <label htmlFor={fid('time')}>
                  {f.time} <span className="field__req">· {f.required}</span>
                </label>
                <select
                  id={fid('time')}
                  name="time"
                  required
                  value={data.time}
                  onChange={set('time')}
                  disabled={!data.date}
                  aria-invalid={errors.time ? true : undefined}
                  aria-describedby={describe('time', data.date ? undefined : fid('time-hint'))}
                >
                  <option value="">{data.date ? f.timePlaceholder : f.timeChooseDate}</option>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {!data.date && (
                  <p className="field__hint" id={fid('time-hint')}>
                    {f.timeChooseDate}
                  </p>
                )}
                {err('time')}
              </div>

              <div className={`field ${errors.guests ? 'is-invalid' : ''}`}>
                <label htmlFor={fid('guests')}>
                  {f.guests} <span className="field__req">· {f.required}</span>
                </label>
                <select
                  id={fid('guests')}
                  name="guests"
                  required
                  value={data.guests}
                  onChange={set('guests')}
                  aria-invalid={errors.guests ? true : undefined}
                  aria-describedby={describe('guests')}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {f.guestsOption(n)}
                    </option>
                  ))}
                  <option value="more">{f.guestsMore}</option>
                </select>
                {err('guests')}
              </div>

              <div className={`field ${errors.phone ? 'is-invalid' : ''}`}>
                <label htmlFor={fid('phone')}>
                  {f.phone} <span className="field__opt">({f.optional})</span>
                </label>
                <input
                  id={fid('phone')}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={data.phone}
                  onChange={set('phone')}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describe('phone')}
                />
                {err('phone')}
              </div>

              <div className="field field--wide">
                <label htmlFor={fid('notes')}>
                  {f.notes} <span className="field__opt">({f.optional})</span>
                </label>
                <textarea
                  id={fid('notes')}
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder={f.notesPlaceholder}
                  value={data.notes}
                  onChange={set('notes')}
                />
              </div>

              <div className="field field--wide">
                <button type="submit" className="btn btn--dark btn--lg">
                  <span>{f.submit}</span>
                  <Arrow />
                </button>
              </div>
            </form>
          </section>

          <section className="reserve-page__info" aria-label={r.hours}>
            <div>
              <h2 className="label">{r.hours}</h2>
              <p className="reserve-page__muted">{t.location.hours}</p>
              <HoursList />
            </div>
            <div>
              <h2 className="label">{r.events}</h2>
              <p className="reserve-page__muted">{r.eventsText}</p>
              <a className="text-link" href={`mailto:${SITE.eventsEmail}`}>
                {SITE.eventsEmail}
              </a>
            </div>
            <div>
              <h2 className="label">{t.location.address}</h2>
              <address>
                {SITE.address.street}
                <br />
                {SITE.address.building}
                <br />
                {SITE.address.city}
              </address>
              <a className="text-link" href={SITE.address.mapsUrl} target="_blank" rel="noopener">
                {t.location.maps}
                <Arrow />
                <span className="visually-hidden"> {t.common.newTab}</span>
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
