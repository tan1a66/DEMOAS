import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Arrow } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

/** Gastronomía: una introducción breve con la filosofía oficial. El menú vive en su propia página. */
export function Gastronomy() {
  const { t, href } = useLang();
  const g = t.gastronomy;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.15 });
  return (
    <section
      ref={ref}
      id={NAV_IDS.gastronomy}
      className={`gastronomy ${inView ? 'is-in' : ''}`}
      data-theme="dark"
      aria-labelledby="gastronomy-title"
    >
      <figure className="gastronomy__main">
        <div className={`frame reveal-photo ${inView ? 'is-in' : ''}`} data-parallax="40">
          <Picture id="cocina-manos" sizes="(max-width: 760px) 100vw, 46vw" decorative />
        </div>
      </figure>

      <div className="gastronomy__copy">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {g.kicker}
        </p>
        <Title lines={g.title} className="h2 gastronomy__title" id="gastronomy-title" delay={80} />
        <p className="lead fade" style={{ '--d': '300ms' } as CSSProperties}>
          {g.text}
        </p>
        <p className="body gastronomy__detail fade" style={{ '--d': '380ms' } as CSSProperties}>
          {g.detail}
        </p>
        <blockquote className="gastronomy__quote fade" style={{ '--d': '480ms' } as CSSProperties}>
          <p>“{g.quote}”</p>
          <footer className="label">{g.source}</footer>
        </blockquote>
        <a className="btn btn--lg gastronomy__cta fade" href={href('/menu/')} style={{ '--d': '560ms' } as CSSProperties}>
          <span>{g.cta}</span>
          <Arrow />
        </a>
      </div>

      <div className="gastronomy__pair">
        <div className={`frame reveal-photo ${inView ? 'is-in' : ''}`} style={{ '--d': '300ms' } as CSSProperties} data-parallax="70">
          <Picture id="plato-salmon" sizes="(max-width: 760px) 50vw, 22vw" decorative />
        </div>
        <div className={`frame reveal-photo ${inView ? 'is-in' : ''}`} style={{ '--d': '450ms' } as CSSProperties} data-parallax="30">
          <Picture id="ingredientes" sizes="(max-width: 760px) 50vw, 22vw" decorative />
        </div>
      </div>
    </section>
  );
}
