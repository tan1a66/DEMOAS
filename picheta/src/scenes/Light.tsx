import { useState, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useReducedMotion, useStickyProgress } from '../lib/hooks';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import type { PhotoId } from '../data/photos';

/** La misma terraza en cuatro momentos de luz (fotografías reales del sitio oficial). */
const MOMENTS: { id: PhotoId; position: string }[] = [
  { id: 'terraza-flores', position: '50% 30%' },
  { id: 'terraza-servicio', position: '50% 35%' },
  { id: 'terraza-atardecer', position: '50% 50%' },
  { id: 'terraza-barra-noche', position: '55% 50%' },
];

/**
 * La luz: un escenario fijo mientras se desplaza la página; cada tramo funde a la siguiente atmósfera.
 * Con movimiento reducido, las cuatro fotos se muestran en una retícula.
 */
export function Light() {
  const { t } = useLang();
  const l = t.light;
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const ref = useStickyProgress<HTMLElement>(!reduced, (p) => {
    const i = Math.min(MOMENTS.length - 1, Math.floor(p * MOMENTS.length * 0.999));
    setActive((cur) => (cur === i ? cur : i));
  });

  if (reduced) {
    return (
      <section className="light light--static is-in" data-theme="dark" aria-labelledby="light-title">
        <div className="light__intro">
          <p className="kicker label">
            <span className="kicker__rule" />
            {l.kicker}
          </p>
          <Title lines={l.title} className="h2" id="light-title" />
          <p className="body light__text">{l.text}</p>
        </div>
        <ul className="light__grid">
          {MOMENTS.map((m, i) => (
            <li key={m.id}>
              <Picture id={m.id} sizes="(max-width: 760px) 100vw, 50vw" position={m.position} />
              <p className="label">{l.moments[i]}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="light is-in"
      data-theme="dark"
      aria-labelledby="light-title"
      style={{ '--n': MOMENTS.length } as CSSProperties}
    >
      <div className="light__stage">
        {MOMENTS.map((m, i) => (
          <div key={m.id} className={`light__layer ${i === active ? 'is-active' : ''} ${i < active ? 'is-past' : ''}`}>
            <Picture id={m.id} sizes="100vw" position={m.position} decorative={i !== active} />
          </div>
        ))}
        <div className="light__shade" aria-hidden="true" />
        <div className="light__intro">
          <p className="kicker label">
            <span className="kicker__rule" />
            {l.kicker}
          </p>
          <Title lines={l.title} className="h2 light__title" id="light-title" />
          <p className="body light__text">{l.text}</p>
        </div>
        <ol className="light__timeline">
          {l.moments.map((name, i) => (
            <li
              key={name}
              className={i === active ? 'is-active' : i < active ? 'is-past' : ''}
              aria-current={i === active ? 'step' : undefined}
            >
              <span className="light__n">0{i + 1}</span>
              <span className="light__name">{name}</span>
            </li>
          ))}
        </ol>
        <div className="light__progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </section>
  );
}
