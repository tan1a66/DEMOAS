import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sitio, textos, whatsappUrl } from '../data';
import { bloquearScroll } from '../lib/scroll';

const T = textos.reserva;
const EVENTO = 'carnal:reservar';

/** Abre la reserva desde cualquier parte del recorrido (con el privado ya elegido, si se pide). */
export function abrirReserva(opciones: { privado?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: opciones }));
}

function hoy() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Reservar: una sola reserva para todo el sitio, presentada como una invitación. El privado es una
 * opción dentro de la reserva. Se envía como mensaje de WhatsApp (sin servidor).
 */
export function Reserva() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [privado, setPrivado] = useState(false);

  useEffect(() => {
    const abrir = (ev: Event) => {
      setPrivado(Boolean((ev as CustomEvent<{ privado?: boolean }>).detail?.privado));
      const d = dialogo.current;
      if (d && !d.open) {
        d.showModal();
        bloquearScroll(true);
      }
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const fecha = String(f.get('fecha') || '');
    const legible = fecha
      ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const url = whatsappUrl(sitio.whatsapp.mensajeReserva, {
      nombre: String(f.get('nombre') || '').trim(),
      fecha: legible,
      hora: String(f.get('hora') || ''),
      personas: String(f.get('personas') || ''),
      privado: privado ? T.si : T.no,
      comentarios: String(f.get('comentarios') || '').trim() || '—',
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    dialogo.current?.close();
  }

  return (
    <dialog
      ref={dialogo}
      className="reserva"
      aria-labelledby="reserva-titulo"
      onClose={() => bloquearScroll(false)}
      onClick={(ev) => {
        // clic fuera de la tarjeta (en el fondo) cierra
        if (ev.target === dialogo.current) dialogo.current.close();
      }}
    >
      <form id="reserva" className={`invitacion reserva__tarjeta ${privado ? 'reserva__tarjeta--privado' : ''}`} onSubmit={enviar}>
        <button type="button" className="reserva__cerrar mono" onClick={() => dialogo.current?.close()}>
          {T.cerrar} ×
        </button>
        <p className="invitacion__encabezado mono">
          <span className="filete" /> {sitio.nombre} <span className="filete" />
        </p>
        <h2 id="reserva-titulo" className="reserva__titulo display">
          {T.titulo}
        </h2>
        <p className="reserva__bajada display">
          <em>{T.bajada}</em>
        </p>
        <p className="invitacion__texto">{T.texto}</p>

        <label className="campo">
          <span className="mono">{T.campos.nombre}</span>
          <input name="nombre" required autoComplete="name" />
        </label>
        <div className="invitacion__fila invitacion__fila--tres">
          <label className="campo">
            <span className="mono">{T.campos.fecha}</span>
            <input name="fecha" type="date" required min={hoy()} />
          </label>
          <label className="campo campo--corto">
            <span className="mono">{T.campos.hora}</span>
            <select name="hora" defaultValue={sitio.reservas.horas[0]}>
              {sitio.reservas.horas.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="campo campo--corto">
            <span className="mono">{T.campos.personas}</span>
            <select name="personas" defaultValue="2">
              {Array.from({ length: sitio.reservas.personasMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="opcion-privado">
          <input type="checkbox" name="privado" checked={privado} onChange={(ev) => setPrivado(ev.target.checked)} />
          <span className="opcion-privado__interruptor" aria-hidden="true" />
          <span className="opcion-privado__texto">
            <span className="opcion-privado__etiqueta display">{T.privado.etiqueta}</span>
            <span className="opcion-privado__detalle">{T.privado.detalle}</span>
          </span>
        </label>

        <label className="campo">
          <span className="mono">{T.campos.comentarios}</span>
          <input name="comentarios" autoComplete="off" />
        </label>
        <button type="submit" className="boton boton--brasa">
          {T.boton}
        </button>
      </form>
    </dialog>
  );
}
