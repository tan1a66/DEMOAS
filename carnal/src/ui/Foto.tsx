import { publico } from '../data';

// Fotos del sitio: src/assets/fotos/<carpeta>/<nombre>.webp. Vite las optimiza con hash (y las
// incrusta en el HTML único de presentación). En los datos basta con "origenes/japon.webp".
const fotos = import.meta.glob('../assets/fotos/**/*.{webp,jpg,jpeg,png,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** URL final de una foto de src/assets/fotos (o de public/ si es una ruta absoluta "/…"). */
export const rutaFoto = (src: string): string | undefined =>
  fotos[`../assets/fotos/${src.replace(/^\//, '')}`] ?? (src.startsWith('/') ? publico(src) : undefined);

interface Props {
  /** foto final: ruta dentro de src/assets/fotos (p. ej. "origenes/japon.webp") */
  src?: string;
  alt: string;
  /** descripción de la toma pendiente (se muestra en el marcador) */
  toma: string;
  proporcion?: string;
  className?: string;
}

/** Foto final o, mientras no exista, un marcador oscuro con el formato correcto y la toma descrita. */
export function Foto({ src, alt, toma, proporcion = '4 / 5', className = '' }: Props) {
  // Si el archivo aún no está en src/assets/fotos, se mantiene el marcador.
  const url = src ? rutaFoto(src) : undefined;
  if (url) {
    return (
      <figure className={`foto ${className}`} style={{ aspectRatio: proporcion }}>
        <img src={url} alt={alt} loading="lazy" decoding="async" />
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
