import { useState, type CSSProperties, type Ref } from 'react';
import { PHOTOS, type PhotoId } from '../data/photos';
import { useLang } from '../i18n';

interface PictureProps {
  id: PhotoId;
  /** Atributo `sizes` según el tamaño real en pantalla. */
  sizes: string;
  className?: string;
  /** La primera imagen visible se carga con prioridad; el resto, en diferido. */
  priority?: boolean;
  style?: CSSProperties;
  /** Imagen decorativa (el texto cercano ya la describe). */
  decorative?: boolean;
  /** Encuadre forzado (object-position) para esta aparición de la foto. */
  position?: string;
  /** Acceso al <img> (las fotos 2.5D lo reutilizan como textura, sin descargarlo dos veces). */
  imgRef?: Ref<HTMLImageElement>;
}

/**
 * Fotografía responsiva: AVIF con respaldo JPEG, dimensiones explícitas (sin saltos de layout),
 * color medio de fondo mientras carga, encuadre por pantalla (--pos / --pos-m) y un respaldo sobrio si falla.
 */
export function Picture({ id, sizes, className = '', priority = false, style, decorative = false, position, imgRef }: PictureProps) {
  const { lang } = useLang();
  const photo = PHOTOS[id];
  const [failed, setFailed] = useState(false);
  const avif = photo.widths.map((w) => `${photo.base}-${w}.avif ${w}w`).join(', ');
  const jpeg = photo.jpeg.map((w) => `${photo.base}-${w}.jpg ${w}w`).join(', ');
  const fallback = `${photo.base}-${photo.jpeg[photo.jpeg.length - 1] ?? 1080}.jpg`;

  const css = {
    '--pos': position ?? photo.position ?? '50% 50%',
    '--pos-m': position ?? photo.positionCompact ?? photo.position ?? '50% 50%',
    backgroundColor: photo.color,
    ...style,
  } as CSSProperties;

  if (failed) {
    return (
      <div
        className={`picture picture--failed ${className}`}
        style={css}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : photo.alt[lang]}
      />
    );
  }

  return (
    <picture className={`picture ${className}`} style={css}>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <img
        ref={imgRef}
        src={fallback}
        srcSet={jpeg}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={decorative ? '' : photo.alt[lang]}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setFailed(true)}
        draggable={false}
      />
    </picture>
  );
}
