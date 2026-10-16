import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { scrollToId, useReducedMotion } from '../lib/hooks';
import { ArrowDown } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import { NAV_IDS } from '../lib/nav';

/** Escena 01 — La revelación: la panorámica de la terraza, casi sin texto encima. */
export function Reveal({ active }: { active: boolean }) {
  const { t } = useLang();
  const r = t.reveal;
  const reduced = useReducedMotion();
  return (
    <section id={NAV_IDS.place} className={`reveal ${active ? 'is-in' : ''}`} data-theme="dark" aria-labelledby="reveal-title">
      <div className="reveal__media">
        <Picture id="terraza-panoramica" priority sizes="100vw" className="reveal__img" />
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
