import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { SITE, whatsappLink } from '../config/site';
import { useInView } from '../lib/hooks';
import { Arrow } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import type { PhotoId } from '../data/photos';

const PHOTOS: PhotoId[] = ['sala-privada', 'terraza-brindis'];

/** Eventos: la sala comedor privada (8 personas) y la terraza para eventos, con el contacto oficial de eventos. */
export function Events() {
  const { t, lang } = useLang();
  const e = t.events;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.12 });
  const waMessage =
    lang === 'es' ? 'Hola, Picheta. Me gustaría información sobre eventos.' : 'Hello, Picheta. I would like information about events.';
  return (
    <section ref={ref} className={`events ${inView ? 'is-in' : ''}`} data-theme="light" aria-labelledby="events-title">
      <div className="events__head">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {e.kicker}
        </p>
        <Title lines={e.title} className="h2 events__title" id="events-title" delay={80} />
      </div>
      <ul className="events__list">
        {e.items.map((item, i) => (
          <li key={item.title} className="events__item">
            <div
              className={`frame reveal-photo ${inView ? 'is-in' : ''}`}
              style={{ '--d': `${200 + i * 180}ms` } as CSSProperties}
              data-parallax={i ? '50' : '24'}
            >
              <Picture id={PHOTOS[i] ?? 'sala-privada'} sizes="(max-width: 760px) 100vw, 44vw" decorative />
            </div>
            <span className="events__n fade" style={{ '--d': `${500 + i * 180}ms` } as CSSProperties}>
              0{i + 1}
            </span>
            <h3 className="h3 fade" style={{ '--d': `${560 + i * 180}ms` } as CSSProperties}>
              {item.title}
            </h3>
            <p className="body fade" style={{ '--d': `${620 + i * 180}ms` } as CSSProperties}>
              {item.text}
            </p>
          </li>
        ))}
      </ul>
      <div className="events__actions fade" style={{ '--d': '700ms' } as CSSProperties}>
        <a className="btn btn--dark btn--lg" href={`mailto:${SITE.eventsEmail}`}>
          <span>{e.write}</span>
          <Arrow />
        </a>
        <a className="cta-link" href={whatsappLink(waMessage)} target="_blank" rel="noopener">
          <span>{e.whatsapp}</span>
          <Arrow />
          <span className="visually-hidden"> {t.common.newTab}</span>
        </a>
        <p className="events__mail">{SITE.eventsEmail}</p>
      </div>
    </section>
  );
}
