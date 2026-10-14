import { publico } from '../data';

interface Props {
  /** ruta en public/ cuando exista la foto final */
  src?: string;
  alt: string;
  /** descripción de la toma pendiente (se muestra en el marcador) */
  toma: string;
  proporcion?: string;
  className?: string;
}

/** Foto final o, mientras no exista, un marcador oscuro con el formato correcto y la toma descrita. */
export function Foto({ src, alt, toma, proporcion = '4 / 5', className = '' }: Props) {
  if (src) {
    return (
      <figure className={`foto ${className}`} style={{ aspectRatio: proporcion }}>
        <img src={publico(src)} alt={alt} loading="lazy" decoding="async" />
      </figure>
    );
  }
  return (
    <figure className={`foto foto--pendiente ${className}`} style={{ aspectRatio: proporcion }} role="img" aria-label={alt}>
      <span className="foto__esquinas" aria-hidden="true" />
      <figcaption className="mono">
        <span>Foto pendiente · {proporcion.replace(/\s/g, '')}</span>
        <span>{toma}</span>
      </figcaption>
    </figure>
  );
}
