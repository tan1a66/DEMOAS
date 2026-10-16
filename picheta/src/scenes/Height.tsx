import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { useCompact, useReducedMotion, useStickyProgress } from '../lib/hooks';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import { PHOTOS } from '../data/photos';

const VIDEO = { compact: '/video/merida-aereo-1280.mp4', wide: '/video/merida-aereo-1920.mp4' };

/**
 * Escena 03 — Mérida, desde otra altura. LA INTERACCIÓN FIRMA.
 *
 * Un escenario fijo durante el desplazamiento (--p: 0 → 1, ver useStickyProgress):
 *   1. Detalle: las torres de la Catedral vistas desde la calle, en una ventana vertical estrecha.
 *   2. La ventana se abre hasta ocupar la pantalla mientras la cámara "retrocede" (escala 1.28 → 1).
 *   3. Sobre ella se funde la vista aérea real del centro (vídeo oficial de Picheta), que también desciende de escala.
 * Todo el movimiento lo calcula CSS a partir de --p; React no vuelve a renderizar al desplazarse.
 * Con movimiento reducido: composición fija, sin vídeo en reproducción automática.
 */
export function Height() {
  const { t, lang } = useLang();
  const h = t.height;
  const reduced = useReducedMotion();
  const compact = useCompact();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  // Una vez pedido, el vídeo se conserva (no se vuelve a descargar al salir y volver a la escena).
  const [armed, setArmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<'street' | 'air'>('street');

  const onProgress = useCallback((p: number) => {
    setPhase((prev) => {
      const next = p > 0.52 ? 'air' : 'street';
      return prev === next ? prev : next;
    });
  }, []);
  const ref = useStickyProgress<HTMLElement>(!reduced, onProgress);

  // El vídeo solo se carga y reproduce cuando la escena está cerca de la pantalla.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const visible = Boolean(e?.isIntersecting);
        setInView(visible);
        if (visible) setArmed(true);
      },
      { rootMargin: '25% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced) return;
    if (inView && !paused) {
      v.play().catch(() => {
        /* reproducción automática bloqueada: queda el póster (fotograma real del vídeo) */
      });
    } else {
      v.pause();
    }
  }, [inView, paused, reduced]);

  const poster = `${PHOTOS['aereo-merida'].base}-1080.jpg`;

  return (
    <section
      ref={ref}
      className={`height ${reduced ? 'height--static' : ''}`}
      data-theme="dark"
      data-phase={phase}
      aria-labelledby="height-title"
    >
      <div className="height__stage">
        <div className="height__aperture">
          <Picture id="catedral-calle" sizes="100vw" className="height__street" />
          <div className="height__air">
            {reduced ? (
              <Picture id="aereo-merida" sizes="100vw" className="height__air-still" />
            ) : (
              <video
                ref={videoRef}
                className="height__video"
                muted
                loop
                playsInline
                preload={armed ? 'auto' : 'none'}
                poster={poster}
                aria-label={PHOTOS['aereo-merida'].alt[lang]}
                src={armed ? (compact ? VIDEO.compact : VIDEO.wide) : undefined}
              />
            )}
          </div>
        </div>

        <div className="height__copy">
          <p className="kicker label">
            <span className="kicker__index">{h.index}</span>
            <span className="kicker__rule" />
            {h.kicker}
          </p>
          <Title lines={h.title} className="h2 height__title is-in" id="height-title" />
          <p className="body height__text">{h.text}</p>
        </div>

        <ol className="height__scale label" aria-hidden="true">
          <li className="height__scale-street">{h.scale[0]}</li>
          <li className="height__scale-bar">
            <span />
          </li>
          <li className="height__scale-air">{h.scale[1]}</li>
        </ol>

        <div className="height__foot">
          <p className="height__caption">{h.caption}</p>
          {!reduced && (
            <button type="button" className="height__toggle label" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
              {paused ? h.play : h.pause}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
