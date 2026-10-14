import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { textos } from '../data';
import { env } from '../lib/env';
import { desaparece } from '../lib/coreografia';
import { Vetas } from '../ui/Vetas';
import estaticos from '../ui/estaticos';
import { Seccion, type Coreografia } from './Seccion';

// Con el scroll, el umbral se disuelve hacia arriba mientras la luz del hero sube.
const coreografia: Coreografia = (tl, q) => {
  desaparece(tl, q('.umbral__vetas-scroll'), 0.15, 0.6, { y: -80, scale: 1.06 });
  desaparece(tl, q('.umbral__frase-scroll'), 0.2, 0.45, { y: -50 });
  desaparece(tl, q('.umbral__desliza-scroll'), 0.02, 0.15, {});
  if (!env.webgl) desaparece(tl, q('.umbral__fondo'), 0.3, 0.5, {});
};

/**
 * 1 · Umbral. Las vetas del marmoleo se dibujan como líneas finas color marfil (es el loader)
 * mientras se encienden las brasas del fondo (la misma toma 3D de "El fuego"); luego, una frase.
 */
export function Umbral({ listo, onVetasDibujadas }: { listo: boolean; onVetasDibujadas: () => void }) {
  const vetas = useRef<SVGSVGElement>(null);
  const frase = useRef<HTMLParagraphElement>(null);
  const desliza = useRef<HTMLDivElement>(null);

  // Dibujo de las vetas: corre en el tiempo, no con el scroll (es la espera de carga).
  useEffect(() => {
    const trazos = vetas.current!.querySelectorAll<SVGPathElement>('path');
    const rapido = env.rapido || env.movimientoReducido;
    const ctx = gsap.context(() => {
      if (rapido) {
        gsap.set(trazos, { strokeDashoffset: 0 });
        gsap.fromTo(vetas.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, onComplete: onVetasDibujadas });
        return;
      }
      gsap.set(trazos, { strokeDashoffset: 1 });
      const tl = gsap.timeline({ onComplete: onVetasDibujadas });
      tl.to(trazos, {
        strokeDashoffset: 0,
        duration: 1.8,
        ease: 'power2.inOut',
        stagger: { each: 2.2 / trazos.length },
      });
    });
    return () => ctx.revert();
  }, [onVetasDibujadas]);

  // Cuando todo está listo: la frase, lenta.
  useEffect(() => {
    if (!listo) return;
    const ctx = gsap.context(() => {
      const palabras = frase.current!.querySelectorAll('span');
      gsap.fromTo(
        palabras,
        { autoAlpha: 0, y: env.movimientoReducido ? 0 : 14, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', stagger: 0.12 },
      );
      gsap.fromTo(desliza.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, delay: 1.6 });
      // Las vetas fueron la espera; ahora el protagonista es el fuego.
      gsap.to(vetas.current, { opacity: 0.12, duration: 2.8, ease: 'power1.inOut' });
    });
    return () => ctx.revert();
  }, [listo]);

  return (
    <Seccion
      id="umbral"
      alto={170}
      titulo="Umbral"
      coreografia={coreografia}
      encima={
        <div className="umbral">
          {!env.webgl && estaticos.fuego && <img className="umbral__fondo" src={estaticos.fuego} alt="" />}
          <div className="umbral__vetas-scroll">
            <Vetas ref={vetas} semilla={11} troncos={10} className="umbral__vetas" />
          </div>
          <div className="umbral__frase-scroll">
            <p ref={frase} className="umbral__frase display" aria-live="polite">
              {textos.umbral.frase.split(' ').map((p, i) => (
                <span key={i} style={{ visibility: 'hidden' }}>
                  {p}{' '}
                </span>
              ))}
            </p>
          </div>
          <div className="umbral__desliza-scroll">
            <div ref={desliza} className="umbral__desliza mono" style={{ visibility: 'hidden' }}>
              <span>{textos.interfaz.desliza}</span>
              <i aria-hidden="true" />
            </div>
          </div>
        </div>
      }
    />
  );
}
