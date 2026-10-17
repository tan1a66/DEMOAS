import type { CSSProperties, MouseEvent } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { useInView, useReducedMotion } from '../lib/hooks';
import { Arrow } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

/** Invitación final: un plato servido en la terraza frente a la Catedral y la reserva directa en OpenTable (sistema oficial). */
export function Invitation() {
  const { t } = useLang();
  const v = t.invitation;
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.35 });
  const top = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };
  return (
    <section ref={ref} className={`invitation ${inView ? 'is-in' : ''}`} data-theme="dark" aria-labelledby="invitation-title">
      <div className="invitation__bg" data-parallax="60">
        <Picture id="terraza-plato" sizes="100vw" decorative />
      </div>
      <div className="invitation__shade" aria-hidden="true" />
      <div className="invitation__content">
        <Title lines={v.title} className="h2 invitation__title" id="invitation-title" />
        <div className="invitation__actions fade" style={{ '--d': '380ms' } as CSSProperties}>
          <a className="btn btn--lg" href={SITE.reservations.url} target="_blank" rel="noopener">
            <span>{v.primary}</span>
            <Arrow />
            <span className="visually-hidden"> {t.common.newTab}</span>
          </a>
          <a className="cta-link" href="#top" onClick={top}>
            <span>{v.secondary}</span>
          </a>
        </div>
        <p className="invitation__note fade" style={{ '--d': '480ms' } as CSSProperties}>
          {v.note}
        </p>
      </div>
    </section>
  );
}
