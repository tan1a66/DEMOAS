import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { sitio, textos, whatsappUrl } from '../data';
import { env } from '../lib/env';
import { registrarSeccion } from '../lib/scroll';
import { saltarA } from '../lib/navegacion';
import { IconoInstagram, IconoWhatsApp } from '../ui/Iconos';
import { abrirReserva } from '../ui/Reserva';

const B = textos.final.botones;
const romano = ['I', 'II', 'III', 'IV', 'V'];

/** 8 · El final: la mesa servida. Una carta limpia con todos los botones. */
export function Final() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const quitar = registrarSeccion('final', el);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('.carta > *'),
        { autoAlpha: 0, y: env.movimientoReducido ? 0 : 24 },
        {
          autoAlpha: 1,
          y: 0,
          stagger: 0.08,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 55%' },
        },
      );
    }, el);
    return () => {
      ctx.revert();
      quitar();
    };
  }, []);

  const acciones = [
    { id: 'coleccion', texto: B.coleccion, onClick: () => saltarA('coleccion', 0.12) },
    { id: 'whatsapp', texto: B.whatsapp, href: whatsappUrl(), icono: <IconoWhatsApp tam={16} />, destacado: true },
    { id: 'llegar', texto: B.llegar, href: sitio.direccion.mapsUrl },
    { id: 'reservar', texto: B.reservar, onClick: () => abrirReserva() },
    { id: 'instagram', texto: B.instagram, href: sitio.instagram.url, icono: <IconoInstagram tam={15} /> },
  ];

  return (
    <section id="final" ref={ref} className="seccion seccion--final" aria-label={textos.final.titulo}>
      <div className="carta">
        <p className="carta__marca display">{sitio.nombre}</p>
        <h2 className="carta__titulo display">
          <em>{textos.final.titulo}</em>
        </h2>
        <span className="carta__adorno" aria-hidden="true" />
        <nav aria-label="Acciones">
          <ul className="carta__lista">
            {acciones.map((a, i) => (
              <li key={a.id}>
                {a.href ? (
                  <a className={`carta__accion ${a.destacado ? 'carta__accion--destacada' : ''}`} href={a.href} target="_blank" rel="noopener noreferrer">
                    <span className="carta__texto">
                      {a.icono}
                      {a.texto}
                    </span>
                    <span className="carta__puntos" aria-hidden="true" />
                    <span className="carta__num numero" aria-hidden="true">{romano[i]}</span>
                  </a>
                ) : (
                  <button type="button" className="carta__accion" onClick={a.onClick}>
                    <span className="carta__texto">{a.texto}</span>
                    <span className="carta__puntos" aria-hidden="true" />
                    <span className="carta__num numero" aria-hidden="true">{romano[i]}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <span className="carta__adorno" aria-hidden="true" />
        <footer className="carta__pie">
          <p className="mono">
            {sitio.direccion.calle} · {sitio.direccion.colonia}, {sitio.direccion.ciudad}
          </p>
          <p className="mono">
            {sitio.horarios.map((h) => `${h.dias} ${h.horas}`).join(' · ')}
          </p>
          <p className="carta__lema display">
            <em>{textos.final.pie}</em>
          </p>
          <p className="mono carta__derechos">
            © {new Date().getFullYear()} {sitio.nombre} · {sitio.ciudad}
          </p>
        </footer>
      </div>
    </section>
  );
}
