import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { Isotype } from '../components/Isotype';
import { rich } from '../components/Title';
import { INTRO_ID } from './Hero';

/** Bienvenida: una sola frase que dice qué es Picheta, y tres datos verificados en picheta.mx. */
export function Intro() {
  const { t } = useLang();
  const it = t.intro;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.3 });
  return (
    <section ref={ref} id={INTRO_ID} className={`intro ${inView ? 'is-in' : ''}`} data-theme="light" aria-labelledby="intro-text">
      <Isotype className="intro__mark fade" />
      <p className="label intro__kicker fade" style={{ '--d': '120ms' } as CSSProperties}>
        {it.kicker}
      </p>
      <p className="intro__text fade" id="intro-text" style={{ '--d': '220ms' } as CSSProperties}>
        {rich(it.text)}
      </p>
      <ul className="intro__facts">
        {it.facts.map((f, i) => (
          <li key={f.label} className="fade" style={{ '--d': `${420 + i * 120}ms` } as CSSProperties}>
            <span className="intro__value">{f.value}</span>
            <span className="intro__label">{f.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
