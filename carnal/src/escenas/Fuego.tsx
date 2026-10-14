import { ritual, textos } from '../data';
import { aparece, desaparece } from '../lib/coreografia';
import { env } from '../lib/env';
import { Foto } from '../ui/Foto';
import estaticos from '../ui/estaticos';
import { Seccion, type Coreografia } from './Seccion';

const coreografia: Coreografia = (tl, q) => {
  if (!env.webgl) {
    aparece(tl, q('.estatico'), 0.0, 0.06, {});
    desaparece(tl, q('.estatico'), 0.94, 0.06, {});
  }
  // Plano 1: el título
  aparece(tl, q('.fuego__titulo'), 0.06, 0.07, { y: 40 });
  aparece(tl, q('.fuego__frase'), 0.12, 0.06);
  aparece(tl, q('.fuego__texto'), 0.16, 0.06);
  desaparece(tl, q('.fuego__apertura'), 0.28, 0.05);

  // Plano 2: los productos
  aparece(tl, q('.fuego__productos .fuego__subtitulo'), 0.33, 0.04);
  q('.producto').forEach((el, i) => aparece(tl, el, 0.35 + i * 0.03, 0.06, { y: 50 }));
  desaparece(tl, q('.fuego__productos'), 0.58, 0.05);

  // Plano 3: las tres reglas, una por una
  aparece(tl, q('.fuego__guias .fuego__subtitulo'), 0.63, 0.04);
  q('.guia').forEach((el, i) => aparece(tl, el, 0.65 + i * 0.07, 0.06, { y: 40 }));
  desaparece(tl, q('.fuego__guias'), 0.92, 0.05);
};

/** 5 · El fuego / Ritual en casa. Brasas, calor, humo; productos y tres reglas. */
export function Fuego() {
  return (
    <Seccion
      id="fuego"
      alto={360}
      titulo={textos.fuego.titulo}
      coreografia={coreografia}
      debajo={!env.webgl && estaticos.fuego ? <img className="estatico estatico--abajo" src={estaticos.fuego} alt="" /> : undefined}
      encima={
        <div className="fuego">
          <header className="fuego__apertura">
            <h2 className="fuego__titulo display">{textos.fuego.titulo}</h2>
            <p className="fuego__frase display">
              <em>{textos.fuego.frase}</em>
            </p>
            <p className="fuego__texto texto">{textos.fuego.texto}</p>
          </header>

          <section className="fuego__productos" aria-label={textos.fuego.productosTitulo}>
            <h3 className="fuego__subtitulo mono">{textos.fuego.productosTitulo}</h3>
            <ul className="fuego__lista">
              {ritual.productos.map((p) => (
                <li key={p.id} className="producto">
                  <Foto src={p.foto} alt={p.nombre} toma={p.fotoDescripcion} proporcion="1 / 1" />
                  <h4 className="producto__nombre display">{p.nombre}</h4>
                  <p className="producto__linea">{p.linea}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="fuego__guias" aria-label={textos.fuego.guiasTitulo}>
            <h3 className="fuego__subtitulo mono">{textos.fuego.guiasTitulo}</h3>
            <ol className="fuego__reglas">
              {ritual.guias.map((g, i) => (
                <li key={g.titulo} className="guia">
                  <span className="guia__dato numero">{g.dato}</span>
                  <h4 className="guia__titulo mono">
                    <span className="numero">0{i + 1}</span> {g.titulo}
                  </h4>
                  <p className="guia__texto">{g.texto}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      }
    />
  );
}
