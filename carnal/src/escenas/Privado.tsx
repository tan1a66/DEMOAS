import { useEffect, useRef, useState } from 'react';
import { textos } from '../data';
import { aparece, desaparece } from '../lib/coreografia';
import { env } from '../lib/env';
import { alCuadro, progreso } from '../lib/scroll';
import { PRIVADO } from '../lib/tiempos';
import { Foto } from '../ui/Foto';
import { abrirReserva } from '../ui/Reserva';
import { Seccion, type Coreografia } from './Seccion';

const coreografia: Coreografia = (tl, q) => {
  // Oscuridad total y una frase.
  tl.fromTo(q('.privado__frase'), { autoAlpha: 0, filter: 'blur(8px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.07, ease: 'power1.out' }, 0.08);
  tl.to(q('.privado__frase'), { autoAlpha: 0, filter: 'blur(6px)', duration: 0.05, ease: 'power1.in' }, 0.22);

  // Detrás de la cortina (aún cerrada), el privado.
  tl.fromTo(q('.privado__contenido'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, PRIVADO.apareceCortina);
  aparece(tl, q('.privado__foto'), 0.48, 0.08, { scale: 1.06 });
  aparece(tl, q('.privado__titulo'), 0.54, 0.06);
  aparece(tl, q('.privado__lema'), 0.58, 0.06);
  aparece(tl, q('.privado__texto'), 0.62, 0.06);
  aparece(tl, q('.invitacion'), 0.68, 0.08, { y: 40 });

  // Sin WebGL: cortina de CSS.
  if (!env.webgl) {
    aparece(tl, q('.cortina-css'), 0.26, 0.05, {});
    if (env.movimientoReducido) desaparece(tl, q('.cortina-css'), PRIVADO.abre, PRIVADO.abierta - PRIVADO.abre, {});
    else {
      tl.to(q('.cortina-css__mitad--izq'), { xPercent: -92, duration: PRIVADO.abierta - PRIVADO.abre, ease: 'power1.inOut' }, PRIVADO.abre);
      tl.to(q('.cortina-css__mitad--der'), { xPercent: 92, duration: PRIVADO.abierta - PRIVADO.abre, ease: 'power1.inOut' }, PRIVADO.abre);
    }
  }
};

const T = textos.privado;

/** 7 · El privado. Oscuridad, "Hay un lugar más.", la cortina de terciopelo y la invitación. */
export function Privado() {
  const contenido = useRef<HTMLDivElement>(null);
  const [abierta, setAbierta] = useState(false);

  // Mientras la cortina esté cerrada, la invitación no recibe foco.
  useEffect(() => {
    let ultimo = false;
    return alCuadro(() => {
      const ab = progreso('privado') > PRIVADO.abierta - 0.06;
      if (ab !== ultimo) {
        ultimo = ab;
        setAbierta(ab);
      }
    });
  }, []);

  return (
    <Seccion
      id="privado"
      alto={430}
      titulo={T.titulo}
      coreografia={coreografia}
      debajo={
        <>
          <div ref={contenido} className="privado__contenido" inert={!abierta}>
            <Foto className="privado__foto" alt="El privado de Carnal" toma="Mesa íntima, una vela, luz cálida tenue" proporcion="3 / 4" />
            <div className="privado__columna">
              <h2 className="privado__titulo display">{T.titulo}</h2>
              <p className="privado__lema display">
                <em>{T.lema}</em>
              </p>
              <p className="privado__texto texto">{T.texto}</p>

              <div className="invitacion">
                <p className="invitacion__encabezado mono">
                  <span className="filete" /> {T.invitacion} <span className="filete" />
                </p>
                <p className="invitacion__texto">{T.invitacionTexto}</p>
                <button type="button" className="boton boton--brasa" onClick={() => abrirReserva({ privado: true })}>
                  {T.boton}
                </button>
              </div>
            </div>
          </div>
          {!env.webgl && (
            <div className="cortina-css" aria-hidden="true">
              <span className="cortina-css__mitad cortina-css__mitad--izq" />
              <span className="cortina-css__mitad cortina-css__mitad--der" />
            </div>
          )}
        </>
      }
      encima={
        <div className="privado">
          <p className="privado__frase display">
            <em>{T.frase}</em>
          </p>
        </div>
      }
    />
  );
}
