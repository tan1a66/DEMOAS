import { useEffect, useRef, useState, type RefObject } from 'react';

/** Suscripción a una media query (p. ej. movimiento reducido o pantallas pequeñas). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useCompact = () => useMediaQuery('(max-width: 760px)');

/**
 * Marca un elemento como visible la primera vez que entra en pantalla.
 * Con movimiento reducido o sin IntersectionObserver, es visible desde el principio.
 */
export function useInView<T extends Element>(options: { margin?: string; threshold?: number } = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { margin = '0px 0px -12% 0px', threshold = 0.15 } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, threshold]);
  return [ref, inView];
}

/**
 * Progreso (0 → 1) del desplazamiento a través de una sección alta con escenario fijo (sticky).
 * Escribe la variable CSS `--p` en el elemento: la animación vive en CSS y no provoca renders de React.
 * Solo calcula mientras la sección está cerca de la pantalla.
 */
export function useStickyProgress<T extends HTMLElement>(enabled: boolean, onProgress?: (p: number) => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.setProperty('--p', '1');
      cb.current?.(1);
      return;
    }
    let raf = 0;
    let active = false;
    let last = -1;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      if (Math.abs(p - last) > 0.0005) {
        last = p;
        el.style.setProperty('--p', p.toFixed(4));
        cb.current?.(p);
      }
    };
    const onScroll = () => {
      if (active && !raf) raf = requestAnimationFrame(measure);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        active = Boolean(entry?.isIntersecting);
        if (active) onScroll();
      },
      { rootMargin: '20% 0px 20% 0px' },
    );
    io.observe(el);
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return ref;
}

/** Desplazamiento suave hacia un ancla, respetando el movimiento reducido. */
export function scrollToId(id: string, reduced: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  // El foco acompaña al lector de pantalla y al teclado.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
