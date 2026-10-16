import { useEffect, useRef, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { Arrow } from '../components/Arrow';
import { LangSwitch } from '../components/LangSwitch';
import { Logo } from '../components/Logo';
import { Picture } from '../components/Picture';
import { rich } from '../components/Title';

interface WelcomeProps {
  phase: 'welcome' | 'entering';
  onEnter: () => void;
}

/**
 * Portada: dos caminos visibles desde el primer instante.
 *  ENTRAR  → transición breve hacia el recorrido.
 *  AGENDAR → enlace normal a /agendar/ (funciona aunque el JavaScript de la animación no haya terminado).
 */
export function Welcome({ phase, onEnter }: WelcomeProps) {
  const { t, href } = useLang();
  const w = t.welcome;
  const rootRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  // Desplazarse hacia abajo en la portada equivale a ENTRAR (rueda, gesto o teclado).
  useEffect(() => {
    if (phase !== 'welcome') return;
    const el = rootRef.current;
    if (!el) return;
    let touchY: number | null = null;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 24) onEnter();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY !== null && y !== undefined && touchY - y > 56) {
        touchY = null;
        onEnter();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('a, button, input, select, textarea')) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
        onEnter();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [phase, onEnter]);

  return (
    <div ref={rootRef} className={`welcome ${phase === 'entering' ? 'is-entering' : ''}`} data-theme="dark">
      <div className="welcome__photo">
        <Picture id="terraza-atardecer" priority sizes="(max-width: 1023px) 100vw, 62vw" className="welcome__img" />
        <p className="welcome__caption" aria-hidden="true">
          <span className="welcome__caption-n">N.º 01</span>
          <span>{w.photo}</span>
        </p>
      </div>

      {/* Capa de transición: la misma imagen y el mismo encuadre que la escena 01, para un fundido sin cortes */}
      <div className="welcome__next" aria-hidden="true">
        <Picture id="terraza-panoramica" sizes="100vw" decorative />
      </div>

      <div className="welcome__top">
        <div className="welcome__brand">
          <Logo title="Picheta" />
          <span className="label welcome__location">{w.location}</span>
        </div>
        <LangSwitch className="welcome__lang" />
      </div>

      <div className="welcome__body">
        <p className="welcome__title display">
          <span className="visually-hidden">{w.title.map((l) => l.replace(/\*/g, '')).join(' ')}</span>
          {w.title.map((line, i) => (
            <span className="line" key={i} aria-hidden="true">
              <span className="line__inner" style={{ '--i': i } as CSSProperties}>
                {rich(line)}
              </span>
            </span>
          ))}
        </p>

        <div className="welcome__foot">
          <p className="welcome__lead fade" style={{ '--d': '380ms' } as CSSProperties}>
            {w.lead}
          </p>
          <div className="welcome__actions fade" style={{ '--d': '480ms' } as CSSProperties}>
            <button ref={enterRef} type="button" className="btn btn--solid btn--lg" onClick={onEnter} aria-describedby="enter-hint">
              <span>{w.enter}</span>
              <Arrow />
            </button>
            <a className="btn btn--ghost btn--lg" href={href('/agendar/')} aria-describedby="reserve-hint">
              <span>{w.reserve}</span>
              <Arrow />
            </a>
            <span id="enter-hint" className="visually-hidden">
              {w.enterHint}
            </span>
            <span id="reserve-hint" className="visually-hidden">
              {w.reserveHint}
            </span>
          </div>
        </div>
      </div>

      <div className="welcome__meta" aria-hidden="true">
        <span className="label">{w.tagline}</span>
        <span className="label welcome__address">{SITE.address.street}</span>
      </div>
    </div>
  );
}
