import type { CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { Picture } from '../components/Picture';
import { DepthPhoto, type CameraState, type CameraMove } from '../components/DepthPhoto';
import type { DepthId } from '../data/depth';
import { Title } from '../components/Title';
import type { PhotoId } from '../data/photos';

/** Una fotografía de la retícula editorial: se revela al entrar en pantalla (con profundidad si se indica). */
function Plate({
  id,
  n,
  caption,
  sizes,
  className,
  delay = 0,
  depth,
}: {
  id: PhotoId;
  n: string;
  caption: string;
  sizes: string;
  className: string;
  delay?: number;
  depth?: { id: DepthId; strength?: number; focus?: number; dollyCenter?: [number, number]; camera?: (s: CameraState) => CameraMove };
}) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.2 });
  const reveal = `reveal-photo ${inView ? 'is-in' : ''}`;
  const style = { '--d': `${delay}ms` } as CSSProperties;
  return (
    <figure ref={ref} className={`plate ${className}`}>
      <div className="plate__frame">
        {depth ? (
          <DepthPhoto
            id={depth.id}
            sizes={sizes}
            className={reveal}
            style={style}
            {...(depth.strength !== undefined ? { strength: depth.strength } : {})}
            {...(depth.focus !== undefined ? { focus: depth.focus } : {})}
            {...(depth.dollyCenter ? { dollyCenter: depth.dollyCenter } : {})}
            {...(depth.camera ? { camera: depth.camera } : {})}
          />
        ) : (
          <Picture id={id} sizes={sizes} className={reveal} style={style} />
        )}
      </div>
      <figcaption className={`caption fade ${inView ? 'is-in' : ''}`} style={{ '--d': `${delay + 500}ms` } as CSSProperties}>
        <span className="caption__n">{n}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

/** Al recorrer la sección, la cámara entra en el salón abovedado, hacia el muro de piedra del fondo. */
const walkIn = ({ through }: CameraState): CameraMove => ({ dolly: (through - 0.35) * 0.7 });

/** Escena 02 — La arquitectura: retícula asimétrica, mucho espacio negativo, cuatro espacios reales. */
export function Space() {
  const { t } = useLang();
  const s = t.space;
  const [headRef, headIn] = useInView<HTMLDivElement>();
  const [figRef, figIn] = useInView<HTMLDivElement>({ threshold: 0.4 });
  return (
    <section id="espacio" className="space" data-theme="light" aria-labelledby="space-title">
      <div ref={headRef} className={`space__head ${headIn ? 'is-in' : ''}`}>
        <p className="kicker label fade">
          <span className="kicker__index">{s.index}</span>
          <span className="kicker__rule" />
          {s.kicker}
        </p>
        <Title lines={s.title} className="h2 space__title" id="space-title" delay={120} />
      </div>

      <div className="space__grid">
        <Plate
          id="salon-boveda"
          n="01"
          caption={s.captions[0] ?? ''}
          sizes="(max-width: 760px) 100vw, 62vw"
          className="space__a"
          depth={{ id: 'salon-boveda', strength: 0.026, focus: 0.3, dollyCenter: [0.5, 0.52], camera: walkIn }}
        />

        <div className={`space__text ${headIn ? 'is-in' : ''}`}>
          <p className="lead fade" style={{ '--d': '250ms' } as CSSProperties}>
            {s.lead}
          </p>
          <p className="body fade" style={{ '--d': '400ms' } as CSSProperties}>
            {s.text}
          </p>
        </div>

        <div ref={figRef} className={`space__figure ${figIn ? 'is-in' : ''}`}>
          <p className="space__number" aria-hidden="true">
            <span className="line">
              <span className="line__inner">{s.figure}</span>
            </span>
          </p>
          <p className="space__number-label label fade" style={{ '--d': '300ms' } as CSSProperties}>
            <span className="visually-hidden">{s.figure} </span>
            {s.figureLabel}
          </p>
        </div>

        <Plate
          id="balcon"
          n="02"
          caption={s.captions[2] ?? ''}
          sizes="(max-width: 760px) 70vw, 26vw"
          className="space__b"
          delay={120}
          depth={{ id: 'balcon', strength: 0.028, focus: 0.5 }}
        />
        <Plate id="salon-piedra" n="03" caption={s.captions[1] ?? ''} sizes="(max-width: 760px) 100vw, 44vw" className="space__c" />
        <Plate
          id="sala-privada"
          n="04"
          caption={s.captions[3] ?? ''}
          sizes="(max-width: 760px) 80vw, 28vw"
          className="space__d"
          delay={160}
        />
      </div>
    </section>
  );
}
