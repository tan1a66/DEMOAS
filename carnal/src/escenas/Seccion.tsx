import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { registrarSeccion, type SeccionId } from '../lib/scroll';

export type Selector = (sel: string) => Element[];
export type Coreografia = (tl: gsap.core.Timeline, q: Selector) => void;

interface Props {
  id: SeccionId;
  /** alto total de la sección en pantallas×100 (vh) */
  alto: number;
  titulo: string;
  /** capa bajo el 3D */
  debajo?: ReactNode;
  /** capa sobre el 3D */
  encima?: ReactNode;
  coreografia?: Coreografia;
}

/** Escena anclada: el escenario se queda fijo mientras la sección avanza con el scroll. */
export function Seccion({ id, alto, titulo, debajo, encima, coreografia }: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const quitar = registrarSeccion(id, el);
    const ctx = gsap.context(() => {
      if (!coreografia) return;
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      coreografia(tl, gsap.utils.selector(el));
      tl.set({}, {}, 1); // la línea siempre dura exactamente 1
      const escenario = el.querySelector<HTMLElement>(':scope > .escenario');
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: () => `+=${Math.max(1, el.offsetHeight - (escenario?.offsetHeight ?? 0))}`,
        scrub: true,
        animation: tl,
        invalidateOnRefresh: true,
      });
    }, el);
    return () => {
      ctx.revert();
      quitar();
    };
  }, [id, coreografia]);

  return (
    <section id={id} ref={ref} className={`seccion seccion--${id}`} style={{ '--alto': alto } as CSSProperties} aria-label={titulo}>
      {debajo && <div className="escenario escenario--debajo">{debajo}</div>}
      {encima && <div className="escenario escenario--encima">{encima}</div>}
    </section>
  );
}
