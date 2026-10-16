import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Arrow } from '../components/Arrow';
import { HoursList } from '../components/HoursList';
import { Isotype } from '../components/Isotype';
import { AmbientVideo } from '../components/AmbientVideo';
import { Title } from '../components/Title';

/**
 * Ubicación: solo datos publicados en picheta.mx (dirección, horario, teléfono, WhatsApp).
 * De fondo, el vuelo nocturno real sobre la plaza (vídeo oficial de Picheta).
 */
export function Location() {
  const { t } = useLang();
  const l = t.location;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.2 });
  return (
    <section
      ref={ref}
      id={NAV_IDS.location}
      className={`location ${inView ? 'is-in' : ''}`}
      data-theme="dark"
      aria-labelledby="location-title"
    >
      <div className="location__bg" aria-hidden="true">
        <AmbientVideo className="location__video" />
      </div>
      <Isotype className="location__mark" />
      <div className="location__head">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {l.kicker}
        </p>
        <Title lines={l.title} className="h2 location__title" id="location-title" delay={100} />
        <p className="lead location__text fade" style={{ '--d': '350ms' } as CSSProperties}>
          {l.text}
        </p>
      </div>

      <div className="location__grid">
        <div className="location__col fade" style={{ '--d': '400ms' } as CSSProperties}>
          <h3 className="label">{l.address}</h3>
          <address className="location__address">
            {SITE.address.street}
            <br />
            {SITE.address.building}
            <br />
            {SITE.address.city}
          </address>
          <a className="text-link" href={SITE.address.mapsUrl} target="_blank" rel="noopener">
            {l.maps}
            <Arrow />
            <span className="visually-hidden"> {t.common.newTab}</span>
          </a>
        </div>

        <div className="location__col fade" style={{ '--d': '500ms' } as CSSProperties}>
          <h3 className="label">{l.hours}</h3>
          <HoursList className="location__hours" />
        </div>

        <div className="location__col fade" style={{ '--d': '600ms' } as CSSProperties}>
          <h3 className="label">{l.contact}</h3>
          <p className="location__phone">
            <a href={SITE.phone.href}>{SITE.phone.display}</a>
          </p>
          <ul className="location__links">
            <li>
              <a className="text-link" href={SITE.phone.href}>
                {l.call}
              </a>
            </li>
            <li>
              <a className="text-link" href={SITE.whatsapp.url} target="_blank" rel="noopener">
                {l.whatsapp}
                <Arrow />
                <span className="visually-hidden"> {t.common.newTab}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
