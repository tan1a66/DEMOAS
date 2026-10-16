import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { scrollToId, useReducedMotion } from '../lib/hooks';
import { ArrowDown } from '../components/Arrow';
import { DepthPhoto } from '../components/DepthPhoto';
import { Title } from '../components/Title';
import { NAV_IDS } from '../lib/nav';

/** Ajustes de la foto 2.5D de la escena 01 (la portada usa la misma escala para el fundido sin cortes). */
export const REVEAL_DEPTH = { strength: 0.032, focus: 0.36, dollyCenter: [0.27, 0.42] as [number, number] };

/**
 * Escena 01 — La revelación: la panorámica de la terraza, casi sin texto encima.
 * Al bajar, la cámara avanza sobre la terraza hacia la Catedral (dolly ligado al desplazamiento).
 */
export function Reveal({ active }: { active: boolean }) {
  const { t } = useLang();
  const r = t.reveal;
  const reduced = useReducedMotion();
  return (
    <section id={NAV_IDS.place} className={`reveal ${active ? 'is-in' : ''}`} data-theme="dark" aria-labelledby="reveal-title">
      <div className="reveal__media">
        <DepthPhoto
          id="terraza-panoramica"
          priority
          sizes="100vw"
          className="reveal__img"
          active={active}
          strength={REVEAL_DEPTH.strength}
          focus={REVEAL_DEPTH.focus}
          dollyCenter={REVEAL_DEPTH.dollyCenter}
          camera={({ exit }) => ({ dolly: exit * 0.55 })}
        />
      </div>
      <div className="reveal__content">
        <p className="kicker label fade" style={{ '--d': '200ms' } as CSSProperties}>
          <span className="kicker__index">{r.index}</span>
          <span className="kicker__rule" />
          {r.kicker}
        </p>
        <Title lines={r.title} className="display reveal__title" id="reveal-title" delay={250} tabIndex={-1} />
        <div className="reveal__aside fade" style={{ '--d': '700ms' } as CSSProperties}>
          <p className="body">{r.text}</p>
          <a
            className="reveal__scroll label"
            href="#espacio"
            onClick={(e) => {
              e.preventDefault();
              scrollToId('espacio', reduced);
            }}
          >
            <span>{r.scroll}</span>
            <ArrowDown />
          </a>
        </div>
      </div>
    </section>
  );
}
