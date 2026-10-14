import { useMemo } from 'react';
import mapa from '../data/mapa.json';
import { destino, origenes } from '../data';

const { vista, ancho, alto } = mapa;

/** Proyección equirectangular con el Pacífico al centro (la misma del script build-mapa). */
export function proyectar(lat: number, lng: number): [number, number] {
  const lon = lng < 0 ? lng + 360 : lng;
  return [(lon - vista.lon0) * vista.escala, (vista.lat0 - lat) * vista.escala];
}

/** Coordenadas normalizadas 0..1 dentro del mapa. */
export function normalizado(lat: number, lng: number): [number, number] {
  const [x, y] = proyectar(lat, lng);
  return [x / ancho, y / alto];
}

export function ruta(lat: number, lng: number) {
  const [x0, y0] = proyectar(lat, lng);
  const [x1, y1] = proyectar(destino.lat, destino.lng);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const d = Math.hypot(x1 - x0, y1 - y0);
  // Arco hacia el norte, como una ruta de vuelo.
  return `M${x0} ${y0} Q${mx} ${my - d * 0.3} ${x1} ${y1}`;
}

/** Mapa minimalista de puntos con las rutas de cada origen hacia Mérida. */
export function Mapa() {
  const puntos = useMemo(() => mapa.puntos.map(([x, y]) => `M${x} ${y}h0`).join(''), []);
  const [dx, dy] = proyectar(destino.lat, destino.lng);

  return (
    <svg className="mapa__svg" viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <path className="mapa__puntos" d={puntos} />
      {origenes.map((o) => {
        const [x, y] = proyectar(o.lat, o.lng);
        return (
          <g key={o.id} className={`mapa__origen mapa__origen--${o.id}`}>
            <path className="mapa__ruta" d={ruta(o.lat, o.lng)} pathLength={1} />
            <circle className="mapa__halo" cx={x} cy={y} r={26} />
            <circle className="mapa__punto" cx={x} cy={y} r={6} />
          </g>
        );
      })}
      <g className="mapa__destino">
        <circle className="mapa__halo mapa__halo--destino" cx={dx} cy={dy} r={30} />
        <circle className="mapa__punto mapa__punto--destino" cx={dx} cy={dy} r={7} />
        <text className="mapa__etiqueta" x={dx + 18} y={dy + 38}>
          {destino.nombre.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}
