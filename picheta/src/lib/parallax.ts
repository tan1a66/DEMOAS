/**
 * Paralaje editorial: cada elemento con `data-parallax="<fuerza>"` recibe `--py` (en px) según su posición
 * respecto al centro de la pantalla. El movimiento vive en CSS (translate de la imagen dentro de su marco).
 * Un solo listener para toda la página; solo se calculan los elementos cercanos a la pantalla.
 * Con movimiento reducido no hace nada.
 */
export function startParallax(root: ParentNode = document): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined;
  const items = [...root.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (!items.length) return () => undefined;

  const near = new Set<HTMLElement>();
  let raf = 0;

  const update = () => {
    raf = 0;
    const vh = window.innerHeight;
    for (const el of near) {
      const r = el.getBoundingClientRect();
      // -1 cuando el centro del elemento está bajo la pantalla, 1 cuando está por encima.
      const k = Math.max(-1, Math.min(1, (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2)));
      const strength = Number(el.dataset.parallax) || 40;
      el.style.setProperty('--py', `${(k * strength).toFixed(1)}px`);
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) near.add(el);
        else near.delete(el);
      }
      schedule();
    },
    { rootMargin: '25% 0px' },
  );
  items.forEach((el) => io.observe(el));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (raf) cancelAnimationFrame(raf);
  };
}
