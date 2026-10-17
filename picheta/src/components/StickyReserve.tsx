import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { Arrow } from './Arrow';

/** Barra fija en el teléfono: Agendar siempre a un toque (aparece al dejar atrás la apertura). */
export function StickyReserve() {
  const { t, href } = useLang();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className={`sticky-reserve ${shown ? 'is-shown' : ''}`} inert={!shown}>
      <a className="sticky-reserve__menu label" href={href('/menu/')}>
        {t.sticky.menu}
      </a>
      <a className="btn btn--dark sticky-reserve__btn" href={href('/agendar/')}>
        <span>{t.sticky.reserve}</span>
        <Arrow />
      </a>
    </div>
  );
}
