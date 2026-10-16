import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Arrow } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

/** Gastronomía: una introducción breve. El menú vive en su propia página, sencilla y rápida. */
export function Gastronomy() {
  const { t, href } = useLang();
  const g = t.gastronomy;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.25 });
  return (
    <section
      ref={ref}
      id={NAV_IDS.gastronomy}
      className={`gastronomy ${inView ? 'is-in' : ''}`}
      data-theme="light"
      aria-labelledby="gastronomy-title"
    >
      <p className="kicker label gastronomy__kicker fade">
        <span className="kicker__rule" />
        {g.kicker}
      </p>
      <Title lines={[g.title]} className="h3 gastronomy__title" id="gastronomy-title" />
      <div className="gastronomy__copy">
        <p className="lead fade" style={{ '--d': '200ms' } as CSSProperties}>
          {g.text}
        </p>
        <p className="body fade" style={{ '--d': '300ms' } as CSSProperties}>
          {g.detail}
        </p>
        <a className="cta-link fade" href={href('/menu/')} style={{ '--d': '400ms' } as CSSProperties}>
          <span>{g.cta}</span>
          <Arrow />
        </a>
      </div>
      <ul className="gastronomy__points">
        {g.points.map((p, i) => (
          <li key={p.title} className="fade" style={{ '--d': `${500 + i * 110}ms` } as CSSProperties}>
            <span className="gastronomy__point-n">0{i + 1}</span>
            <h3 className="gastronomy__point-title">{p.title}</h3>
            <p>{p.text}</p>
          </li>
        ))}
      </ul>
      <Picture
        id="plato-salmon"
        sizes="(max-width: 760px) 60vw, 20vw"
        className={`gastronomy__photo reveal-photo ${inView ? 'is-in' : ''}`}
        decorative
      />
    </section>
  );
}
