import { useEffect, useRef, useState } from 'react';
import { cortes, origenes, sitio, textos, whatsappUrl } from '../data';
import { aparece, desaparece } from '../lib/coreografia';
import { indiceColeccion } from '../lib/coleccion';
import { env } from '../lib/env';
import { alCuadro, progreso } from '../lib/scroll';
import estaticos from '../ui/estaticos';
import { Seccion, type Coreografia } from './Seccion';

const coreografia: Coreografia = (tl, q) => {
  aparece(tl, q('.coleccion__titulo'), 0.0, 0.035, { y: 30 });
  aparece(tl, q('.coleccion__bajada'), 0.02, 0.035);
  desaparece(tl, q('.coleccion__cabecera'), 0.075, 0.03);
  aparece(tl, q('.coleccion__marco'), 0.07, 0.03, {});
  desaparece(tl, q('.coleccion__marco'), 0.965, 0.03, {});
};

const L = textos.coleccion.etiquetas;
const pais = (id: string) => origenes.find((o) => o.id === id)?.pais ?? id;

/** 4 · La Colección: un museo de la carne. La ficha técnica sigue al corte que llega al frente. */
export function Coleccion() {
  const [indice, setIndice] = useState(0);
  const [enFrente, setEnFrente] = useState(false);
  const ultimo = useRef({ indice: 0, enFrente: false });

  useEffect(
    () =>
      alCuadro(() => {
        const p = progreso('coleccion');
        const f = indiceColeccion(p, cortes.length);
        const i = Math.round(f);
        // La ficha solo se muestra cuando el corte está quieto al frente.
        const quieto = Math.abs(f - i) < 0.06 && p > 0.075 && p < 0.965;
        if (i !== ultimo.current.indice) {
          ultimo.current.indice = i;
          setIndice(i);
        }
        if (quieto !== ultimo.current.enFrente) {
          ultimo.current.enFrente = quieto;
          setEnFrente(quieto);
        }
      }),
    [],
  );

  const c = cortes[indice];
  const n = cortes.length;
  const dos = (x: number) => String(x).padStart(2, '0');

  return (
    <Seccion
      id="coleccion"
      alto={140 + n * 72}
      titulo={textos.coleccion.titulo}
      coreografia={coreografia}
      encima={
        <div className="coleccion">
          <header className="coleccion__cabecera">
            <h2 className="coleccion__titulo display">{textos.coleccion.titulo}</h2>
            <p className="coleccion__bajada display">
              <em>{textos.coleccion.bajada}</em>
            </p>
          </header>

          <div className="coleccion__marco">
            <p className="coleccion__contador numero" aria-hidden="true">
              {dos(indice + 1)} <span>/</span> {dos(n)}
            </p>
            <ol className="coleccion__indice" aria-hidden="true">
              {cortes.map((x, k) => (
                <li key={x.id} className={k === indice ? 'activo' : ''} />
              ))}
            </ol>

            <article className={`ficha-tecnica ${enFrente ? 'ficha-tecnica--visible' : ''}`} aria-live="polite">
              {!env.webgl && estaticos.cortes[c.id] && (
                <img className="ficha-tecnica__estatico" src={estaticos.cortes[c.id]} alt={`${c.nombre} en su vitrina`} />
              )}
              <p className="ficha-tecnica__num mono">
                Nº <span className="numero">{dos(indice + 1)}</span> · {pais(c.origen)}
              </p>
              <h3 className="ficha-tecnica__nombre display">{c.nombre}</h3>
              <span className="filete" />
              <dl className="ficha">
                <div className="ficha__fila"><dt className="mono">{L.origen}</dt><dd className="mono">{c.region}</dd></div>
                <div className="ficha__fila"><dt className="mono">{L.raza}</dt><dd className="mono">{c.raza}</dd></div>
                <div className="ficha__fila"><dt className="mono">{L.grado}</dt><dd className="mono ficha__grado">{c.grado}</dd></div>
                <div className="ficha__fila"><dt className="mono">{L.peso}</dt><dd className="mono">{c.peso}</dd></div>
                <div className="ficha__fila"><dt className="mono">{L.notas}</dt><dd className="mono">{c.notas}</dd></div>
                <div className="ficha__fila"><dt className="mono">{L.coccion}</dt><dd className="mono">{c.coccion}</dd></div>
              </dl>
              <a
                className="ficha-tecnica__pedir mono"
                href={whatsappUrl(sitio.whatsapp.mensajeCorte, { corte: c.nombre })}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={enFrente ? 0 : -1}
              >
                {textos.coleccion.pedir} →
              </a>
            </article>
          </div>

          {/* Para lectores de pantalla y buscadores: la colección completa, sin depender del giro. */}
          <ul className="solo-lector">
            {cortes.map((x) => (
              <li key={x.id}>
                {x.nombre}. {L.origen}: {x.region}. {L.raza}: {x.raza}. {L.grado}: {x.grado}. {L.peso}: {x.peso}.{' '}
                {L.notas}: {x.notas}. {L.coccion}: {x.coccion}
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
