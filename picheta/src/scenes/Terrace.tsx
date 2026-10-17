import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView, useMediaQuery } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { DepthPhoto } from '../components/DepthPhoto';
import { Title } from '../components/Title';

/**
 * La terraza: el único momento 3D. La panorámica real con su mapa de profundidad; el ratón o el giroscopio
 * mueven la mirada y, al desplazarse, la cámara avanza un poco hacia la Catedral.
 */
export function Terrace() {
  const { t } = useLang();
  const tr = t.terrace;
  const coarse = useMediaQuery('(pointer: coarse)');
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.35 });
  return (
    <section
      ref={ref}
      id={NAV_IDS.experience}
      className={`terrace ${inView ? 'is-in' : ''}`}
      data-theme="dark"
      aria-labelledby="terrace-title"
    >
      <DepthPhoto
        id="terraza-panoramica"
        sizes="100vw"
        className="terrace__photo"
        strength={0.03}
        focus={0.5}
        dollyCenter={[0.3, 0.42]}
        camera={({ through }) => ({ dolly: 0.1 * through })}
      />
      <div className="terrace__shade" aria-hidden="true" />
      <div className="terrace__content">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {tr.kicker}
        </p>
        <Title lines={tr.title} className="h2 terrace__title" id="terrace-title" delay={120} />
        <p className="lead terrace__text fade" style={{ '--d': '420ms' } as CSSProperties}>
          {tr.text}
        </p>
      </div>
      <p className="terrace__hint label fade" style={{ '--d': '700ms' } as CSSProperties} aria-hidden="true">
        <span className="terrace__hint-dot" />
        {coarse ? tr.hint.touch : tr.hint.pointer}
      </p>
    </section>
  );
}
