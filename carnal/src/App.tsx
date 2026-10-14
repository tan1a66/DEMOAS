import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { env } from './lib/env';
import { bloquearScroll, iniciarScroll, ORDEN, type SeccionId } from './lib/scroll';
import { esperarCarga, marcarListo } from './lib/carga';
import { saltarA } from './lib/navegacion';
import { Interfaz } from './ui/Interfaz';
import { Umbral } from './escenas/Umbral';
import { Corte } from './escenas/Corte';
import { Origenes } from './escenas/Origenes';
import { Coleccion } from './escenas/Coleccion';
import { Fuego } from './escenas/Fuego';
import { Visitanos } from './escenas/Visitanos';
import { Privado } from './escenas/Privado';
import { Final } from './escenas/Final';

// El 3D (three + react-three-fiber) se descarga aparte, mientras el umbral dibuja sus vetas.
const Escenario3D = lazy(() => import('./tres/Escenario'));

class SinWebGL extends Component<{ onFallo: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[carnal] 3D no disponible, se muestran imágenes estáticas.', error);
    this.props.onFallo();
  }
  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

export function App() {
  const [vetasDibujadas, setVetasDibujadas] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [listo, setListo] = useState(false);
  const [falloGL, setFalloGL] = useState(false);

  useLayoutEffect(() => {
    iniciarScroll();
    window.scrollTo(0, 0);
    bloquearScroll(true);
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => marcarListo('fuentes'));
    if (!env.webgl) marcarListo('3d');
    esperarCarga(['fuentes', '3d']).then(() => setCargado(true));
  }, []);

  useEffect(() => {
    if (!cargado || !vetasDibujadas || listo) return;
    setListo(true);
    bloquearScroll(false);
    ScrollTrigger.refresh();
    // Enlaces directos (p. ej. desde Instagram): carnal.mx/#final
    const destino = window.location.hash.slice(1) as SeccionId;
    if (ORDEN.includes(destino) && destino !== 'umbral') saltarA(destino, destino === 'coleccion' ? 0.12 : 0);
  }, [cargado, vetasDibujadas, listo]);

  const alDibujar = useCallback(() => setVetasDibujadas(true), []);
  const alFallar = useCallback(() => {
    env.webgl = false;
    document.documentElement.classList.add('sin-gl');
    marcarListo('3d');
    setFalloGL(true);
  }, []);

  return (
    <>
      {env.webgl && (
        <SinWebGL onFallo={alFallar}>
          <Suspense fallback={null}>
            <Escenario3D />
          </Suspense>
        </SinWebGL>
      )}
      <main key={falloGL ? 'sin-gl' : 'gl'}>
        <Umbral listo={listo} onVetasDibujadas={alDibujar} />
        <Corte />
        <Origenes />
        <Coleccion />
        <Fuego />
        <Visitanos />
        <Privado />
        <Final />
      </main>
      <Interfaz visible={listo} />
      <div className="vineta" aria-hidden="true" />
      <div className="grano" aria-hidden="true" />
      <div className="velo" aria-hidden="true" />
    </>
  );
}
