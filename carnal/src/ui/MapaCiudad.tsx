/**
 * Mapa de marcador: la cuadrícula de calles numeradas del centro de Mérida (pares de norte a sur,
 * nones de oriente a poniente). Se sustituye por un mapa real cuando exista la dirección definitiva.
 */
export function MapaCiudad({ nota }: { nota: string }) {
  const cols = [40, 100, 160, 220, 280, 340];
  const filas = [30, 85, 140, 195];
  return (
    <figure className="mapa-ciudad" role="img" aria-label={nota}>
      <svg viewBox="0 0 380 225" aria-hidden="true">
        <rect width="380" height="225" fill="none" />
        {cols.map((x, i) => (
          <g key={`c${x}`}>
            <line x1={x} y1="0" x2={x + (i % 2 ? 2 : -2)} y2="225" className="mapa-ciudad__calle" />
            <text x={x + 4} y="218" className="mapa-ciudad__nombre">{`C. ${66 - i * 2}`}</text>
          </g>
        ))}
        {filas.map((y, i) => (
          <g key={`f${y}`}>
            <line x1="0" y1={y} x2="380" y2={y + (i % 2 ? 1.5 : -1.5)} className="mapa-ciudad__calle" />
            <text x="4" y={y - 4} className="mapa-ciudad__nombre">{`C. ${55 + i * 2}`}</text>
          </g>
        ))}
        <rect x="104" y="89" width="52" height="47" className="mapa-ciudad__plaza" />
        <g transform="translate(250 112)">
          <circle r="16" className="mapa-ciudad__halo" />
          <circle r="4" className="mapa-ciudad__pin" />
        </g>
      </svg>
      <figcaption className="mono">{nota}</figcaption>
    </figure>
  );
}
