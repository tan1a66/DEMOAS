// El logotipo de Carnal (rótulo a pincel), vectorizado de la imagen del cliente.
// Toma el color del texto (currentColor).
import svg from '../assets/marca/carnal.svg?raw';

const viewBox = svg.match(/viewBox="([^"]+)"/)![1];
const d = svg.match(/ d="([^"]+)"/)![1];

/** Proporción ancho/alto del logotipo. */
export const PROPORCION_MARCA = (() => {
  const [, , w, h] = viewBox.split(' ').map(Number);
  return w / h;
})();

interface Props {
  className?: string;
  /** decorativa: oculta a lectores de pantalla (cuando ya hay texto con el nombre) */
  decorativa?: boolean;
}

export function Marca({ className = '', decorativa = false }: Props) {
  return (
    <svg
      className={`marca ${className}`}
      viewBox={viewBox}
      {...(decorativa ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'CARNAL' })}
    >
      <path fill="currentColor" fillRule="evenodd" d={d} />
    </svg>
  );
}

/** El logotipo como cadena SVG con un color fijo (para dibujarlo en canvas). */
export const marcaSvg = (color: string) => svg.replace('currentColor', color);
