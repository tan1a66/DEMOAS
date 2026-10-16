import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { scrollToId, useInView, useReducedMotion } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Arrow } from '../components/Arrow';
import { DepthPhoto } from '../components/DepthPhoto';
import { Title } from '../components/Title';

/** Escena 06 — Una invitación. La acción principal abre directamente el sistema oficial (OpenTable). */
export function Invitation() {
  const { t } = useLang();
  const v = t.invitation;
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.3 });
  return (
    <section ref={ref} id="agendar" className={`invitation ${inView ? 'is-in' : ''}`} data-theme="dark" aria-labelledby="invitation-title">
      <div className="invitation__media">
        {/* La cámara se asienta al llegar (se aleja de la barra) y las luces respiran */}
        <DepthPhoto
          id="terraza-barra-noche"
          sizes="100vw"
          className="invitation__img"
          strength={0.032}
          focus={0.4}
          dollyCenter={[0.62, 0.45]}
          camera={({ through }) => ({ dolly: Math.max(0, 0.6 - through) * 0.6, sparkle: 0.7 })}
        />
      </div>
      <div className="invitation__content">
        <Title lines={v.title} className="display invitation__title" id="invitation-title" />
        <div className="invitation__actions fade" style={{ '--d': '450ms' } as CSSProperties}>
          <a className="btn btn--solid btn--lg" href={SITE.reservations.url} target="_blank" rel="noopener">
            <span>{v.primary}</span>
            <Arrow />
            <span className="visually-hidden"> {t.common.newTab}</span>
          </a>
          <a
            className="btn btn--ghost btn--lg"
            href={`#${NAV_IDS.place}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToId(NAV_IDS.place, reduced);
            }}
          >
            <span>{v.secondary}</span>
          </a>
        </div>
        <p className="invitation__note fade" style={{ '--d': '600ms' } as CSSProperties}>
          {v.note}
        </p>
      </div>
    </section>
  );
}
