import { sitio, textos } from '../data';
import { aparece, desaparece, plano } from '../lib/coreografia';
import { env } from '../lib/env';
import { Seccion, type Coreografia } from './Seccion';
import estaticos from '../ui/estaticos';
import { Marca } from '../ui/Marca';

const coreografia: Coreografia = (tl, q) => {
  const mov = !env.movimientoReducido;
  tl.fromTo(
    q('.corte__wordmark'),
    { autoAlpha: 0, y: mov ? 40 : 0, scale: mov ? 1.06 : 1 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.09, ease: 'power2.out' },
    0,
  );
  aparece(tl, q('.corte__bajada'), 0.04, 0.06);
  desaparece(tl, q('.corte__bajada'), 0.2, 0.06);
  desaparece(tl, q('.corte__wordmark'), 0.22, 0.1, { y: -90 });

  aparece(tl, q('.corte__l1a'), 0.32, 0.07);
  aparece(tl, q('.corte__l1b'), 0.38, 0.07);
  desaparece(tl, q('.corte__l1'), 0.5, 0.06);

  plano(tl, q('.corte__l2'), 0.56, 0.7);
  plano(tl, q('.corte__l3'), 0.74, 0.88);
  if (!env.webgl) {
    aparece(tl, q('.estatico'), 0.0, 0.06, {});
    desaparece(tl, q('.estatico'), 0.9, 0.1, {});
  }
};

/** 2 · El corte. Wagyu bajo una sola luz lateral; el wordmark queda detrás del corte. */
export function Corte() {
  return (
    <Seccion
      id="corte"
      alto={340}
      titulo="El corte"
      coreografia={coreografia}
      debajo={
        <div className="corte">
          {!env.webgl && estaticos.corte && <img className="estatico" src={estaticos.corte} alt="Corte de wagyu con marmoleo bajo una luz lateral" />}
          <h1 className="corte__wordmark">
            <Marca decorativa />
            <span className="solo-lector">
              {sitio.nombre} — {sitio.tipo} en {sitio.ciudad}
            </span>
          </h1>
          <p className="corte__bajada mono">{textos.corte.bajada}</p>
        </div>
      }
      encima={
        <div className="corte corte--encima">
          <p className="corte__l1 display">
            <span className="corte__l1a">{textos.corte.linea1a}</span>
            <em className="corte__l1b">{textos.corte.linea1b}</em>
          </p>
          <p className="corte__l2 display">{textos.corte.linea2}</p>
          <p className="corte__l3 texto">{textos.corte.linea3}</p>
        </div>
      }
    />
  );
}
