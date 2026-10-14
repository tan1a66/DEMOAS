import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { env } from '../lib/env';
import { alCuadro } from '../lib/scroll';
import { hayTomaPresente, presente, tomas, VENTANAS } from './director';
import { CorteHero } from './escenas/CorteHero';

// Las escenas siguientes se descargan solo cuando el recorrido se acerca a ellas.
const Rotonda = lazy(() => import('./escenas/Rotonda'));
const Brasas = lazy(() => import('./escenas/Brasas'));
const Fachada = lazy(() => import('./escenas/Fachada'));
const Cortina = lazy(() => import('./escenas/Cortina'));

const ANTICIPO = 0.85; // se monta cuando faltan ~0.85 escenas para su ventana

/** Renderiza en orden las tomas presentes. */
function Director() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    gl.autoClear = false;
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    const activas = [...tomas.values()].filter((t) => presente(t.id)).sort((a, b) => a.orden - b.orden);
    for (const t of activas) {
      gl.clearDepth();
      gl.render(t.escena, t.camara);
    }
  }, 1);
  return null;
}

/**
 * Reloj: un solo latido (el ticker de GSAP, después de Lenis) mueve el 3D. Si no hay ninguna toma
 * en pantalla no se renderiza nada (ahorro de batería en el texto y en el final).
 * También baja la resolución si el dispositivo no sostiene la fluidez.
 */
function Motor() {
  const setDpr = useThree((s) => s.setDpr);
  const dprMax = env.calidad === 'alta' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.5);
  const medida = useRef({ dpr: dprMax, cuadros: 0, tiempo: 0 });

  useEffect(() => {
    let antes = false;
    return alCuadro((e) => {
      const ahora = hayTomaPresente();
      if (ahora || antes) advance(e.tiempo);
      antes = ahora;
      if (!ahora || e.dt > 0.25) return;
      const m = medida.current;
      m.cuadros++;
      m.tiempo += e.dt;
      if (m.tiempo > 2.5) {
        const fps = m.cuadros / m.tiempo;
        if (fps < 42 && m.dpr > 1) {
          m.dpr = Math.max(1, m.dpr - 0.25);
          setDpr(m.dpr);
        }
        m.cuadros = 0;
        m.tiempo = 0;
      }
    });
  }, [setDpr]);
  return null;
}

export default function Escenario() {
  const [montadas, setMontadas] = useState<string[]>(['corte']);

  useEffect(
    () =>
      alCuadro((e) => {
        const faltan = Object.entries(VENTANAS)
          .filter(([, [a, b]]) => e.historia > a - ANTICIPO && e.historia < b + 0.3)
          .map(([id]) => id);
        setMontadas((prev) => (faltan.every((id) => prev.includes(id)) ? prev : [...new Set([...prev, ...faltan])]));
      }),
    [],
  );

  const alta = env.calidad === 'alta';
  return (
    <div className="lienzo" aria-hidden="true">
      <Canvas
        frameloop="never"
        dpr={alta ? [1, 2] : [1, 1.5]}
        shadows={alta ? 'percentage' : false}
        gl={{ alpha: true, antialias: alta, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [0, 0, 5] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.transmissionResolutionScale = alta ? 0.75 : 0.5;
        }}
      >
        <Motor />
        <Director />
        <CorteHero />
        <Suspense fallback={null}>
          {montadas.includes('coleccion') && <Rotonda />}
          {montadas.includes('fuego') && <Brasas />}
          {montadas.includes('fachada') && <Fachada />}
          {montadas.includes('cortina') && <Cortina />}
        </Suspense>
      </Canvas>
    </div>
  );
}
