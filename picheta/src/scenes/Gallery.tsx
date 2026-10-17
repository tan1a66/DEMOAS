import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { useInView } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Picture } from '../components/Picture';
import { Title } from '../components/Title';
import { PHOTOS, type PhotoId } from '../data/photos';

const ITEMS: PhotoId[] = [
  'terraza-mesa',
  'salon-piedra',
  'terraza-servicio',
  'barra-noche',
  'catedral-calle',
  'cocinero',
  'terraza-flores',
  'platos-mesa',
  'maiz',
];

/** Galería: retícula editorial de fotos reales; cada una se amplía en un visor accesible (<dialog>). */
export function Gallery() {
  const { t, lang } = useLang();
  const g = t.gallery;
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.08 });
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const show = (i: number, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setOpen(i);
  };
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + ITEMS.length) % ITEMS.length)), []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open !== null && !dlg.open) {
      dlg.showModal();
      document.documentElement.classList.add('is-locked');
    } else if (open === null && dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClose = () => {
      document.documentElement.classList.remove('is-locked');
      setOpen(null);
      triggerRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('keydown', onKey);
    return () => {
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('keydown', onKey);
    };
  }, [step]);

  const current = open === null ? null : ITEMS[open];

  return (
    <section
      ref={ref}
      id={NAV_IDS.gallery}
      className={`gallery ${inView ? 'is-in' : ''}`}
      data-theme="light"
      aria-labelledby="gallery-title"
    >
      <div className="gallery__head">
        <p className="kicker label fade">
          <span className="kicker__rule" />
          {g.kicker}
        </p>
        <Title lines={g.title} className="h2 gallery__title" id="gallery-title" delay={80} />
      </div>
      <ul className="gallery__grid">
        {ITEMS.map((id, i) => (
          <li key={id} className={`gallery__item gallery__item--${i + 1}`}>
            <button
              type="button"
              className={`gallery__btn reveal-photo ${inView ? 'is-in' : ''}`}
              style={{ '--d': `${(i % 3) * 120 + Math.floor(i / 3) * 80}ms` } as CSSProperties}
              onClick={(e) => show(i, e.currentTarget)}
              aria-label={g.open(i + 1, ITEMS.length)}
              aria-haspopup="dialog"
            >
              <Picture id={id} sizes="(max-width: 760px) 50vw, 33vw" decorative />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label={g.dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {current && open !== null && (
          <div className="lightbox__inner">
            <figure className="lightbox__figure">
              <Picture key={current} id={current} sizes="92vw" className="lightbox__photo" />
              <figcaption className="lightbox__caption">
                <span className="lightbox__count">
                  {String(open + 1).padStart(2, '0')} / {String(ITEMS.length).padStart(2, '0')}
                </span>
                <span>{PHOTOS[current].alt[lang]}</span>
              </figcaption>
            </figure>
            <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={() => step(-1)} aria-label={g.prev}>
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className="lightbox__nav lightbox__nav--next" onClick={() => step(1)} aria-label={g.next}>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="lightbox__close label" onClick={close}>
              {g.close}
              <span aria-hidden="true" className="lightbox__x" />
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
