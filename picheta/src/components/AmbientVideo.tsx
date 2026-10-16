import { useEffect, useRef, useState } from 'react';
import { useCompact, useReducedMotion } from '../lib/hooks';
import { PHOTOS } from '../data/photos';
import { Picture } from './Picture';

const SOURCES = { compact: '/video/merida-aereo-1280.mp4', wide: '/video/merida-aereo-1920.mp4' };

/**
 * Vídeo aéreo real del centro de Mérida (fragmento del vídeo oficial de Picheta) como fondo ambiental.
 * Se descarga solo cuando está cerca, se pausa fuera de pantalla y, con movimiento reducido, queda el fotograma.
 */
export function AmbientVideo({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const compact = useCompact();
  const ref = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const vis = Boolean(e?.isIntersecting);
        setInView(vis);
        if (vis) setArmed(true);
      },
      { rootMargin: '30% 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !armed) return;
    if (inView) v.play().catch(() => undefined);
    else v.pause();
  }, [inView, armed]);

  if (reduced) return <Picture id="aereo-merida" sizes="100vw" className={className} decorative />;

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      aria-hidden="true"
      preload={armed ? 'auto' : 'none'}
      poster={`${PHOTOS['aereo-merida'].base}-1080.jpg`}
      src={armed ? (compact ? SOURCES.compact : SOURCES.wide) : undefined}
    />
  );
}
