import { sitio, textos } from '../data';
import { aparece, desaparece } from '../lib/coreografia';
import { env } from '../lib/env';
import estaticos from '../ui/estaticos';
import { MapaCiudad } from '../ui/MapaCiudad';
import { Seccion, type Coreografia } from './Seccion';

const coreografia: Coreografia = (tl, q) => {
  if (!env.webgl) {
    aparece(tl, q('.estatico'), 0.0, 0.08, {});
    desaparece(tl, q('.estatico'), 0.92, 0.08, {});
  }
  aparece(tl, q('.visitanos__titulo'), 0.05, 0.08, { y: 40 });
  aparece(tl, q('.visitanos__frase'), 0.12, 0.07);
  desaparece(tl, q('.visitanos__apertura'), 0.32, 0.06);
  aparece(tl, q('.visitanos__info'), 0.42, 0.08, { y: 40 });
  aparece(tl, q('.mapa-ciudad'), 0.48, 0.08, { y: 30 });
  desaparece(tl, q('.visitanos__info, .mapa-ciudad'), 0.93, 0.05);
};

const d = sitio.direccion;

/** 6 · Visítanos. La cámara llega a Mérida: piedra caliza, muro colonial, la entrada a Carnal. */
export function Visitanos() {
  return (
    <Seccion
      id="visitanos"
      alto={280}
      titulo={textos.visitanos.titulo}
      coreografia={coreografia}
      debajo={!env.webgl && estaticos.fachada ? <img className="estatico" src={estaticos.fachada} alt="" /> : undefined}
      encima={
        <div className="visitanos">
          <header className="visitanos__apertura">
            <p className="mono visitanos__ciudad">{sitio.ciudad}</p>
            <h2 className="visitanos__titulo display">{textos.visitanos.titulo}</h2>
            <p className="visitanos__frase display">
              <em>{textos.visitanos.frase}</em>
            </p>
          </header>

          <div className="visitanos__info">
            <h2 className="visitanos__titulo-chico display">{textos.visitanos.titulo}</h2>
            <div className="visitanos__bloque">
              <h3 className="mono">{textos.visitanos.direccion}</h3>
              <address>
                {d.calle}
                <br />
                {d.colonia}, {d.ciudad}, {d.estado} · C.P. {d.cp}
              </address>
              <p className="visitanos__referencia">{d.referencia}</p>
            </div>
            <div className="visitanos__bloque">
              <h3 className="mono">{textos.visitanos.horarios}</h3>
              <dl className="ficha">
                {sitio.horarios.map((h) => (
                  <div key={h.dias} className="ficha__fila">
                    <dt className="mono">{h.dias}</dt>
                    <dd className="mono">{h.horas}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <a className="boton boton--linea" href={d.mapsUrl} target="_blank" rel="noopener noreferrer">
              {textos.visitanos.comoLlegar} →
            </a>
          </div>

          <MapaCiudad nota={textos.visitanos.mapaPendiente} />
        </div>
      }
    />
  );
}
