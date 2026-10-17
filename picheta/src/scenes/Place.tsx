import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

/** El lugar: composición editorial asimétrica con los espacios reales (salón, balcón, muros de piedra). */
export function Place() {
  const { t } = useLang();
  const p = t.place;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.12 });
  const [figRef, figIn] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [wideRef, wideIn] = useInView<HTMLElement>({ threshold: 0.25 });
  return (
    <section ref={ref} id={NAV_IDS.place} className={`place ${inView ? 'is-in' : ''}`} data-theme="light" aria-labelledby="place-title">
      <div className="place__head">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {p.kicker}
        </p>
        <Title lines={p.title} className="h2 place__title" id="place-title" delay={80} />
      </div>
      <div className="place__copy">
        <p className="lead fade" style={{ '--d': '260ms' } as CSSProperties}>
          {p.lead}
        </p>
        <p className="body fade" style={{ '--d': '360ms' } as CSSProperties}>
          {p.text}
        </p>
      </div>

      <div ref={figRef} className="place__figures">
        <figure className="place__fig place__fig--main">
          <div className={`frame reveal-photo ${figIn ? 'is-in' : ''}`} data-parallax="36">
            <Picture id="salon-boveda" sizes="(max-width: 760px) 100vw, 62vw" decorative />
          </div>
          <figcaption className="caption fade" style={{ '--d': '500ms' } as CSSProperties}>
            <span className="caption__n">01</span>
            {p.captions[0]}
          </figcaption>
        </figure>
        <figure className="place__fig place__fig--side">
          <div className={`frame reveal-photo ${figIn ? 'is-in' : ''}`} style={{ '--d': '220ms' } as CSSProperties} data-parallax="60">
            <Picture id="balcon" sizes="(max-width: 760px) 70vw, 30vw" decorative />
          </div>
          <figcaption className="caption fade" style={{ '--d': '700ms' } as CSSProperties}>
            <span className="caption__n">02</span>
            {p.captions[2]}
          </figcaption>
        </figure>
      </div>

      <figure ref={wideRef} className={`place__wide ${wideIn ? 'is-in' : ''}`}>
        <div className="frame reveal-photo" data-parallax="48">
          <Picture id="salon-piedra" sizes="(max-width: 760px) 100vw, 84vw" decorative />
        </div>
        <figcaption className="caption fade" style={{ '--d': '500ms' } as CSSProperties}>
          <span className="caption__n">03</span>
          {p.captions[1]}
        </figcaption>
      </figure>
    </section>
  );
}
