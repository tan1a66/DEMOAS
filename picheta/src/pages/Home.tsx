import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { scrollToId, useReducedMotion } from '../lib/hooks';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Welcome } from '../scenes/Welcome';
import { Walk } from '../scenes/Walk';
import { Gastronomy } from '../scenes/Gastronomy';
import { Location } from '../scenes/Location';

type Phase = 'welcome' | 'entering' | 'entered';

/** Duración de la transición ENTRAR (debe coincidir con home.css → .welcome.is-entering). */
const ENTER_MS = 1300;

/** Un enlace con ancla (/#ubicacion, desde el menú o las reservaciones) va directo a esa sección. */
function initialPhase(): Phase {
  return location.hash.length > 1 ? 'entered' : 'welcome';
}

export function Home() {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const timer = useRef<number>(0);

  // Mientras se ve la portada, la página no se desplaza por debajo.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('is-locked', phase !== 'entered');
    return () => root.classList.remove('is-locked');
  }, [phase]);

  // Llegada con ancla: se salta la portada y se lleva a la sección pedida.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) requestAnimationFrame(() => scrollToId(id, true));
    return () => window.clearTimeout(timer.current);
  }, []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const enter = useCallback(() => {
    if (phaseRef.current !== 'welcome') return;
    phaseRef.current = 'entering';
    window.scrollTo(0, 0);
    setPhase('entering');
    timer.current = window.setTimeout(
      () => {
        setPhase('entered');
        // El foco acompaña al recorrido (teclado y lectores de pantalla).
        const start = document.getElementById('contenido');
        start?.setAttribute('tabindex', '-1');
        start?.focus({ preventScroll: true });
      },
      reduced ? 60 : ENTER_MS,
    );
  }, [reduced]);

  return (
    <>
      <a className="skip-link" href="#contenido" onClick={phase === 'welcome' ? enter : undefined}>
        {t.common.skip}
      </a>
      <span id="top" />
      <Header page="home" visible={phase === 'entered'} />
      {phase !== 'entered' && <Welcome phase={phase} onEnter={enter} />}
      <div className="home" inert={phase === 'welcome'}>
        <main id="contenido">
          <h1 className="visually-hidden">{t.meta.home.title}</h1>
          <Walk entered={phase === 'entered'} />
          <Gastronomy />
          <Location />
        </main>
        <Footer />
      </div>
    </>
  );
}
