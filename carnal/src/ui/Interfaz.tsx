import { useEffect, useRef } from 'react';
import { sitio, textos, whatsappUrl } from '../data';
import { alCuadro } from '../lib/scroll';
import { saltarA } from '../lib/navegacion';
import { ventana } from '../lib/mate';
import { IconoWhatsApp, Flecha } from './Iconos';

/** Casi nada de UI: logo pequeño, línea fina de avance, WhatsApp discreto e "Ir al final". */
export function Interfaz({ visible }: { visible: boolean }) {
  const raiz = useRef<HTMLDivElement>(null);
  const relleno = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      alCuadro((e) => {
        relleno.current!.style.transform = `scaleY(${e.total})`;
        // En el umbral del privado todo se vuelve oscuro, también la interfaz.
        const oscuro = ventana(e.historia, 6.0, 6.08, 6.36, 6.46);
        const r = raiz.current!;
        r.style.setProperty('--atenuar', String(1 - 0.85 * oscuro));
        r.classList.toggle('interfaz--final', e.historia > 7.35);
      }),
    [],
  );

  return (
    <div ref={raiz} className={`interfaz ${visible ? 'interfaz--visible' : ''}`}>
      <a
        className="interfaz__logo"
        href="#umbral"
        onClick={(ev) => {
          ev.preventDefault();
          saltarA('umbral', 1);
        }}
      >
        {sitio.nombre}
        <span className="solo-lector"> — volver al inicio</span>
      </a>

      <a
        className="interfaz__final mono"
        href="#final"
        onClick={(ev) => {
          ev.preventDefault();
          saltarA('final');
        }}
      >
        {textos.interfaz.irAlFinal} <Flecha />
      </a>

      <div className="interfaz__avance" role="presentation" title={textos.interfaz.avance}>
        <span ref={relleno} />
      </div>

      <a className="interfaz__wa" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label={textos.interfaz.whatsapp}>
        <IconoWhatsApp />
      </a>
    </div>
  );
}
