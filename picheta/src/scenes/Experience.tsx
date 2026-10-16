import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

/** Escena 05 — La experiencia: el espacio conecta con la cocina, sin convertirse en catálogo. */
export function Experience() {
  const { t } = useLang();
  const e = t.experience;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.12 });
  const [mediaRef, mediaIn] = useInView<HTMLDivElement>({ threshold: 0.2 });
  return (
    <section
      ref={ref}
      id={NAV_IDS.experience}
      className={`experience ${inView ? 'is-in' : ''}`}
      data-theme="dark"
      aria-labelledby="experience-title"
    >
      <div ref={mediaRef} className="experience__media">
        <Picture
          id="terraza-plato"
          sizes="(max-width: 760px) 100vw, 46vw"
          className={`experience__main reveal-photo ${mediaIn ? 'is-in' : ''}`}
        />
        <Picture
          id="cocina-manos"
          sizes="(max-width: 760px) 56vw, 22vw"
          className={`experience__inset reveal-photo ${mediaIn ? 'is-in' : ''}`}
          style={{ '--d': '350ms' } as CSSProperties}
        />
      </div>

      <div className="experience__copy">
        <p className="kicker label fade">
          <span className="kicker__index">{e.index}</span>
          <span className="kicker__rule" />
          {e.kicker}
        </p>
        <Title lines={e.title} className="h2 experience__title" id="experience-title" delay={100} />
        <p className="lead experience__text fade" style={{ '--d': '400ms' } as CSSProperties}>
          {e.text}
        </p>

        <figure className="experience__quote fade" style={{ '--d': '550ms' } as CSSProperties}>
          <blockquote>
            <p>“{e.quote}”</p>
          </blockquote>
          <figcaption className="label">— {e.quoteSource}</figcaption>
        </figure>

        <ul className="experience__points">
          {e.points.map((p, i) => (
            <li key={p.title} className="fade" style={{ '--d': `${650 + i * 110}ms` } as CSSProperties}>
              <span className="experience__point-n">0{i + 1}</span>
              <h3 className="experience__point-title">{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
