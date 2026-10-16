import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useCompact, useInView, useReducedMotion, useStickyProgress } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import { PHOTOS, type PhotoId } from '../data/photos';

/** Del día a la noche: el orden es el de la luz, no el de las fotos. */
const FRAMES: PhotoId[] = ['terraza-flores', 'terraza-mesa', 'terraza-servicio', 'terraza-barra-noche', 'barra-noche'];

/**
 * Escena 04 — La terraza y la luz (también "Galería" en la navegación).
 * Escritorio: el desplazamiento vertical mueve una secuencia horizontal y el fondo pasa del marfil del día
 * al carbón de la noche. Móvil o movimiento reducido: carrusel nativo con desplazamiento lateral.
 */
export function Light() {
  const { t } = useLang();
  const l = t.light;
  const compact = useCompact();
  const reduced = useReducedMotion();
  const pinned = !compact && !reduced;
  const trackRef = useRef<HTMLOListElement>(null);
  const [headRef, headIn] = useInView<HTMLDivElement>();

  const onProgress = useCallback((p: number) => {
    const el = trackRef.current?.closest<HTMLElement>('.light');
    if (!el) return;
    const night = p > 0.5;
    const tone = night ? 'night' : 'day';
    if (el.dataset.tone === tone) return;
    el.dataset.tone = tone;
    el.dataset.theme = night ? 'dark' : 'light'; // el encabezado cambia de color con la escena
  }, []);
  const ref = useStickyProgress<HTMLElement>(pinned, onProgress);

  // Distancia horizontal a recorrer = ancho de la secuencia − ancho de la pantalla.
  useEffect(() => {
    const section = ref.current;
    const track = trackRef.current;
    if (!section || !track) return;
    if (!pinned) {
      section.style.removeProperty('--dist');
      section.style.removeProperty('height');
      delete section.dataset.tone;
      return;
    }
    const measure = () => {
      const dist = Math.max(0, track.scrollWidth - window.innerWidth);
      section.style.setProperty('--dist', String(dist));
      section.style.height = `${window.innerHeight + dist}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [pinned, ref]);

  return (
    <section
      ref={ref}
      id={NAV_IDS.gallery}
      className={`light ${pinned ? 'light--pinned' : 'light--native'}`}
      data-theme={pinned ? 'light' : 'dark'}
      aria-labelledby="light-title"
    >
      <div className="light__stage">
        <ol ref={trackRef} className="light__track" aria-label={l.label} tabIndex={pinned ? undefined : 0}>
          <li className="light__intro">
            <div ref={headRef} className={headIn ? 'is-in' : ''}>
              <p className="kicker label fade">
                <span className="kicker__index">{l.index}</span>
                <span className="kicker__rule" />
                {l.kicker}
              </p>
              <Title lines={l.title} className="h2 light__title" id="light-title" delay={100} />
              <p className="body fade" style={{ '--d': '450ms' } as CSSProperties}>
                {l.text}
              </p>
              {!pinned && (
                <p className="light__hint label" aria-hidden="true">
                  {l.hint} →
                </p>
              )}
            </div>
          </li>
          {FRAMES.map((id, i) => {
            const photo = PHOTOS[id];
            return (
              <li key={id} className="light__frame" style={{ '--ar': `${photo.width} / ${photo.height}` } as CSSProperties}>
                <figure>
                  <div className="light__photo">
                    <Picture id={id} sizes="(max-width: 760px) 80vw, 46vw" />
                  </div>
                  <figcaption className="caption">
                    <span className="caption__n">0{i + 1}</span>
                    <span>{l.frames[i]}</span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ol>
        {pinned && (
          <div className="light__progress" aria-hidden="true">
            <span />
          </div>
        )}
      </div>
    </section>
  );
}
