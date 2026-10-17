import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useLang } from '../i18n';
import { scrollToId, useCompact, useReducedMotion } from '../lib/hooks';
import { Arrow, ArrowDown } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { rich } from '../components/Title';
import type { PhotoId } from '../data/photos';

/** Fotografías de la apertura, en orden (los nombres viven en las traducciones: hero.slides). */
const SLIDES: { id: PhotoId; compactId?: PhotoId; position?: string; positionCompact?: string }[] = [
  // En pantallas anchas, la terraza al atardecer (cuadrada); en el teléfono, la mesa frente a la Catedral (vertical).
  { id: 'terraza-atardecer', compactId: 'terraza-mesa', position: '50% 50%', positionCompact: '50% 40%' },
  { id: 'salon-boveda', position: '50% 45%', positionCompact: '50% 50%' },
  { id: 'terraza-panoramica', position: '50% 55%', positionCompact: '16% 50%' },
  { id: 'terraza-barra-noche', position: '55% 50%', positionCompact: '62% 50%' },
];

/** Primera sección después de la apertura (destino de ENTRAR). */
export const INTRO_ID = 'bienvenida';

/** Tiempo de cada fotografía (debe coincidir con la barra de progreso en home.css: --slide-ms). */
const SLIDE_MS = 7000;

/**
 * Apertura: fotografías reales a pantalla completa que se suceden con un fundido lento y un acercamiento sutil.
 * ENTRAR baja al recorrido; AGENDAR es un enlace normal a /agendar/ que funciona desde el primer instante.
 * La primera foto se precarga (index.html); las demás se montan cuando la primera ya está en pantalla.
 */
export function Hero() {
  const { t, href } = useLang();
  const h = t.hero;
  const reduced = useReducedMotion();
  const compact = useCompact();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLElement>(null);

  // El resto de fotos se descarga cuando la primera ya pintó (o a los 1,5 s como tarde).
  useEffect(() => {
    const go = () => setReady(true);
    const id = window.setTimeout(go, 1500);
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('load', go);
    };
  }, []);

  // El pase automático se detiene fuera de pantalla.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playing = ready && !paused && !reduced && inView;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [playing, index]);

  const enter = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollToId(INTRO_ID, reduced);
  };

  return (
    <section
      ref={rootRef}
      className={`hero ${playing ? 'is-playing' : ''}`}
      data-theme="dark"
      aria-labelledby="hero-title"
      style={{ '--slide-ms': `${SLIDE_MS}ms` } as CSSProperties}
    >
      <div className="hero__slides" role="group" aria-roledescription="carrusel" aria-label={h.slidesLabel}>
        {SLIDES.map((s, i) =>
          i === 0 || ready ? (
            <div key={s.id} className={`hero__slide ${i === index ? 'is-active' : ''}`} aria-hidden={i === index ? undefined : true}>
              <Picture
                id={(compact && s.compactId) || s.id}
                sizes="100vw"
                priority={i === 0}
                className="hero__photo"
                {...(s.position && !(compact && s.compactId) ? { position: s.position } : {})}
                {...(s.positionCompact ? { style: { '--pos-m': s.positionCompact } as CSSProperties } : {})}
              />
            </div>
          ) : null,
        )}
        <div className="hero__shade" aria-hidden="true" />
      </div>

      <div className="hero__content">
        <p className="label hero__location">{h.location}</p>
        <h1 className="hero__title" id="hero-title">
          {h.title.map((line, i) => (
            <span className="hero__line" key={i} style={{ '--i': i } as CSSProperties}>
              {rich(line)}
            </span>
          ))}
        </h1>
        <p className="hero__lead">{h.lead}</p>
        <div className="hero__actions">
          <a className="btn btn--lg hero__enter" href={`#${INTRO_ID}`} onClick={enter}>
            <span>{h.enter}</span>
            <ArrowDown />
          </a>
          <a className="btn btn--ghost btn--lg" href={href('/agendar/')}>
            <span>{h.reserve}</span>
            <Arrow />
          </a>
        </div>
      </div>

      <div className="hero__bar">
        <p className="hero__caption" aria-live="polite">
          <span className="hero__count">
            {String(index + 1).padStart(2, '0')} <span aria-hidden="true">/</span> {String(SLIDES.length).padStart(2, '0')}
          </span>
          <span className="hero__caption-text">{h.slides[index]}</span>
        </p>
        <div className="hero__dots">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`hero__dot ${i === index ? 'is-active' : ''}`}
              aria-label={h.goTo(i + 1)}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
            >
              <span className="hero__dot-fill" key={i === index ? `on-${index}` : 'off'} />
            </button>
          ))}
          {!reduced && (
            <button
              type="button"
              className="hero__pause"
              aria-label={paused ? h.play : h.pause}
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
            >
              <span aria-hidden="true" className={paused ? 'hero__icon-play' : 'hero__icon-pause'} />
            </button>
          )}
        </div>
      </div>

      <a className="hero__scroll label" href={`#${INTRO_ID}`} onClick={enter} tabIndex={-1} aria-hidden="true">
        <span>{h.scroll}</span>
        <i />
      </a>
    </section>
  );
}
