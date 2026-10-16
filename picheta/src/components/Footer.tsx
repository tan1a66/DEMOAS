import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { HoursList } from './HoursList';
import { Arrow } from './Arrow';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';

/** Pie: solo información verificada en picheta.mx (dirección, horario, contacto, redes). */
export function Footer() {
  const { t, href } = useLang();
  const f = t.footer;
  return (
    <footer className="site-footer" data-theme="dark">
      <div className="site-footer__top">
        <a className="site-footer__logo" href={href('/')} aria-label={t.nav.home}>
          <Logo />
        </a>
        <p className="site-footer__tagline label">{f.tagline}</p>
      </div>

      <div className="site-footer__grid">
        <section aria-labelledby="f-visit">
          <h2 id="f-visit" className="label">
            {f.visit}
          </h2>
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
        </section>

        <section aria-labelledby="f-hours">
          <h2 id="f-hours" className="label">
            {f.hours}
          </h2>
          <p className="site-footer__muted">{t.location.hours}</p>
          <HoursList />
        </section>

        <section aria-labelledby="f-contact">
          <h2 id="f-contact" className="label">
            {f.contact}
          </h2>
          <ul className="site-footer__list">
            <li>
              <a className="text-link" href={SITE.phone.href}>
                {SITE.phone.display}
              </a>
            </li>
            <li>
              <a className="text-link" href={SITE.whatsapp.url} target="_blank" rel="noopener">
                WhatsApp
                <Arrow />
                <span className="visually-hidden"> {t.common.newTab}</span>
              </a>
            </li>
            <li>
              <span className="site-footer__muted">{f.events} · </span>
              <a className="text-link" href={`mailto:${SITE.eventsEmail}`}>
                {SITE.eventsEmail}
              </a>
            </li>
          </ul>
        </section>

        <section aria-labelledby="f-follow">
          <h2 id="f-follow" className="label">
            {f.follow}
          </h2>
          <ul className="site-footer__list">
            {SITE.social.map((s) => (
              <li key={s.id}>
                <a className="text-link" href={s.url} target="_blank" rel="noopener">
                  {s.label}
                  <Arrow />
                  <span className="visually-hidden"> {t.common.newTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <nav aria-labelledby="f-nav">
          <h2 id="f-nav" className="label">
            {f.nav}
          </h2>
          <ul className="site-footer__list">
            <li>
              <a className="text-link" href={href('/menu/')}>
                {f.menu}
              </a>
            </li>
            <li>
              <a className="text-link" href={href('/agendar/')}>
                {f.reserve}
              </a>
            </li>
            <li>
              <a className="text-link" href={SITE.officialUrl} target="_blank" rel="noopener">
                {f.official}
                <Arrow />
                <span className="visually-hidden"> {t.common.newTab}</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="site-footer__bottom">
        <p className="site-footer__credits">{f.credits}</p>
        <div className="site-footer__tools">
          <LangSwitch />
          <a className="text-link" href="#top">
            {f.top}
          </a>
        </div>
      </div>
    </footer>
  );
}
