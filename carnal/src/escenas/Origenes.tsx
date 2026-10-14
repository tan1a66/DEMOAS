import { origenes, textos } from '../data';
import { aparece, desaparece, dibuja } from '../lib/coreografia';
import { env } from '../lib/env';
import { Foto } from '../ui/Foto';
import { Mapa, normalizado } from '../ui/Mapa';
import { destino } from '../data';
import { Seccion, type Coreografia, type Selector } from './Seccion';

const INICIO = 0.2;
const CAPITULO = 0.26;

const movil = () => window.innerWidth < 760;

/** Valores para centrar el punto (u,v) del mapa en (sx,sy) de la pantalla con escala s. */
function enfoque(q: Selector, u: number, v: number, sx: number, sy: number, s: number) {
  const marco = () => q('.mapa__marco')[0] as HTMLElement;
  const caja = (m: HTMLElement) => (m.offsetParent as HTMLElement | null) ?? document.body;
  return {
    scale: s,
    xPercent: () => {
      const m = marco();
      const W = m.offsetWidth;
      return ((sx * caja(m).offsetWidth - m.offsetLeft - W / 2 - (u - 0.5) * W * s) / W) * 100;
    },
    yPercent: () => {
      const m = marco();
      const H = m.offsetHeight;
      return ((sy * caja(m).offsetHeight - m.offsetTop - H / 2 - (v - 0.5) * H * s) / H) * 100;
    },
  };
}

const coreografia: Coreografia = (tl, q) => {
  const mov = !env.movimientoReducido;
  aparece(tl, q('.mapa'), 0.0, 0.12, {});
  aparece(tl, q('.origenes__t1'), 0.05, 0.06);
  aparece(tl, q('.origenes__t2'), 0.1, 0.06);
  desaparece(tl, q('.origenes__titulo'), 0.17, 0.05);
  tl.fromTo(q('.origenes'), { '--penumbra': 0 }, { '--penumbra': 1, duration: 0.05 }, 0.18);
  tl.to(q('.origenes'), { '--penumbra': 0, duration: 0.05 }, 0.93);
  aparece(tl, q('.mapa__destino'), 0.1, 0.06, {});

  const [du, dv] = normalizado(destino.lat, destino.lng);
  origenes.forEach((o, k) => {
    const s = INICIO + k * CAPITULO;
    const [u, v] = normalizado(o.lat, o.lng);
    const mu = (u + du) / 2;
    const mv = (v + dv) / 2;
    const foco = () => (movil() ? { x: 0.5, y: 0.27, s0: 2.6, s1: 1.45 } : { x: 0.66, y: 0.48, s0: 1.75, s1: 1.15 });
    if (mov) {
      const f = foco();
      tl.to(q('.mapa__marco'), { ...enfoque(q, u, v, f.x, f.y, f.s0), duration: 0.08, ease: 'power2.inOut' }, s - 0.04);
      tl.to(q('.mapa__marco'), { ...enfoque(q, mu, mv, f.x, f.y, f.s1), duration: 0.13, ease: 'power1.inOut' }, s + 0.06);
    }
    aparece(tl, q(`.mapa__origen--${o.id} .mapa__halo, .mapa__origen--${o.id} .mapa__punto`), s, 0.04, {});
    dibuja(tl, q(`.mapa__origen--${o.id} .mapa__ruta`), s + 0.05, 0.14);
    aparece(tl, q(`.origen--${o.id}`), s + 0.01, 0.06, { y: 40 });
    desaparece(tl, q(`.origen--${o.id}`), s + CAPITULO - 0.06, 0.05);
    tl.to(q(`.mapa__origen--${o.id} .mapa__ruta`), { opacity: 0.3, duration: 0.04 }, s + CAPITULO - 0.04);
  });

  if (mov) tl.to(q('.mapa__marco'), { scale: 1, xPercent: 0, yPercent: 0, duration: 0.08, ease: 'power2.inOut' }, 0.98 - 0.12);
  tl.to(q('.mapa__origen .mapa__ruta'), { opacity: 1, duration: 0.05 }, 0.88);
  desaparece(tl, q('.mapa'), 0.95, 0.05, {});
};

/** 3 · Orígenes. Las vetas del corte se vuelven líneas que viajan sobre un mapa minimalista. */
export function Origenes() {
  return (
    <Seccion
      id="origenes"
      alto={120 + origenes.length * 115}
      titulo="Orígenes"
      coreografia={coreografia}
      debajo={
        <div className="mapa">
          <div className="mapa__marco">
            <Mapa />
          </div>
        </div>
      }
      encima={
        <div className="origenes">
          <h2 className="origenes__titulo display">
            <span className="origenes__t1">{textos.origenes.titulo1}</span>
            <em className="origenes__t2">{textos.origenes.titulo2}</em>
          </h2>
          {origenes.map((o, i) => (
            <article key={o.id} className={`origen origen--${o.id}`}>
              <p className="origen__num numero">0{i + 1} / 0{origenes.length}</p>
              <h3 className="origen__pais display">
                {o.pais}
                {o.acento && (
                  <span className="origen__acento jp" lang="ja">
                    {o.acento}
                  </span>
                )}
              </h3>
              <p className="origen__linea display">{o.linea}</p>
              <div className="origen__cuerpo">
                <Foto className="origen__foto" src={o.foto} alt={`${o.pais}: ${o.fotoDescripcion}`} toma={o.fotoDescripcion} />
                <dl className="ficha">
                  {o.datos.map((d) => (
                    <div key={d.etiqueta} className="ficha__fila">
                      <dt className="mono">{d.etiqueta}</dt>
                      <dd className="mono">{d.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </div>
      }
    />
  );
}
