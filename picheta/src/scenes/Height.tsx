import { useCallback, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { useReducedMotion, useStickyProgress } from '../lib/hooks';
import { DepthPhoto, type CameraMove } from '../components/DepthPhoto';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * Escena 03 — Mérida, desde otra altura. LA INTERACCIÓN FIRMA.
 *
 * Un escenario fijo durante el desplazamiento (--p: 0 → 1, ver useStickyProgress):
 *   1. Detalle: el campanario de la Catedral visto desde la calle, en una ventana vertical estrecha.
 *   2. La ventana se abre a pantalla completa mientras la cámara retrocede y panea.
 *   3. Se funde la vista aérea real del centro (fotograma del vídeo oficial de Picheta) convertida en un relieve
 *      2.5D: al seguir bajando, la cámara se eleva y se inclina sobre la ciudad; el ratón o el giroscopio la mueven
 *      y las luces de las calles titilan.
 * La ventana, la escala y el fundido los calcula CSS a partir de --p; la cámara 3D, WebGL (DepthPhoto).
 * Con movimiento reducido: composición fija con la vista aérea.
 */
export function Height() {
  const { t } = useLang();
  const h = t.height;
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'street' | 'air'>('street');
  const progress = useRef(0);

  const onProgress = useCallback((p: number) => {
    progress.current = p;
    setPhase((prev) => {
      const next = p > 0.52 ? 'air' : 'street';
      return prev === next ? prev : next;
    });
  }, []);
  const ref = useStickyProgress<HTMLElement>(!reduced, onProgress);

  // Vuelo sobre la ciudad: empieza cerca de la plaza y se eleva/inclina hasta abarcar el centro.
  const flight = useCallback((): CameraMove => {
    const p = progress.current;
    const arrive = smooth(clamp01((p - 0.46) / 0.3));
    const rise = smooth(clamp01((p - 0.55) / 0.45));
    return { dolly: 0.5 * (1 - arrive) - 0.14 * rise, y: 0.05 * rise, x: -0.025 * rise, sparkle: 1 };
  }, []);

  return (
    <section
      ref={ref}
      className={`height ${reduced ? 'height--static' : ''}`}
      data-theme="dark"
      data-phase={phase}
      aria-labelledby="height-title"
    >
      <div className="height__stage">
        <div className="height__aperture">
          <DepthPhoto
            id="catedral-calle"
            sizes="100vw"
            className="height__street"
            position="50% 16%"
            strength={0.026}
            focus={0.5}
            drift={0.7}
            enabled={() => progress.current < 0.78}
          />
          <div className="height__air">
            {reduced ? (
              <Picture id="aereo-merida" sizes="100vw" className="height__air-still" />
            ) : (
              <DepthPhoto
                id="aereo-merida"
                sizes="100vw"
                className="height__air-still"
                strength={0.046}
                focus={0.25}
                dollyCenter={[0.5, 0.62]}
                camera={flight}
                enabled={() => progress.current > 0.44}
              />
            )}
          </div>
        </div>

        <div className="height__copy">
          <p className="kicker label">
            <span className="kicker__index">{h.index}</span>
            <span className="kicker__rule" />
            {h.kicker}
          </p>
          <Title lines={h.title} className="h2 height__title is-in" id="height-title" />
          <p className="body height__text">{h.text}</p>
        </div>

        <ol className="height__scale label" aria-hidden="true">
          <li className="height__scale-street">{h.scale[0]}</li>
          <li className="height__scale-bar">
            <span />
          </li>
          <li className="height__scale-air">{h.scale[1]}</li>
        </ol>

        <div className="height__foot">
          <p className="height__caption">{h.caption}</p>
          {!reduced && (
            <p className="height__hint label" aria-hidden="true">
              <span className="hint--pointer">{h.hint.pointer}</span>
              <span className="hint--touch">{h.hint.touch}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
