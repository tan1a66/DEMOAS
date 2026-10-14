import { forwardRef, useMemo } from 'react';
import { azar } from '../lib/mate';

export interface Veta {
  d: string;
  nivel: number;
  orden: number;
}

/** Vetas de marmoleo procedurales: troncos que serpentean y se ramifican, como la grasa en la carne. */
export function generarVetas(semilla: number, troncos = 9, ancho = 1000, alto = 1000): Veta[] {
  const r = azar(semilla);
  const vetas: Veta[] = [];
  type Brote = { x: number; y: number; ang: number; pasos: number; nivel: number; orden: number };
  const cola: Brote[] = [];

  for (let t = 0; t < troncos; t++) {
    // Las vetas nacen fuera o cerca del borde izquierdo/superior y cruzan en diagonal.
    const desdeArriba = r() < 0.4;
    cola.push({
      x: desdeArriba ? r() * ancho : -20 - r() * 60,
      y: desdeArriba ? -20 - r() * 60 : r() * alto,
      ang: desdeArriba ? 0.9 + r() * 0.9 : -0.5 + r() * 0.9,
      pasos: 55 + Math.floor(r() * 45),
      nivel: 0,
      orden: t * 0.6,
    });
  }

  while (cola.length) {
    const b = cola.shift()!;
    const pts: [number, number][] = [[b.x, b.y]];
    const f1 = 0.08 + r() * 0.1;
    const f2 = 0.21 + r() * 0.2;
    const p1 = r() * 6.28;
    const p2 = r() * 6.28;
    const paso = b.nivel === 0 ? 15 : 11;
    let { x, y, ang } = b;
    for (let i = 0; i < b.pasos; i++) {
      ang += Math.sin(i * f1 + p1) * 0.09 + Math.sin(i * f2 + p2) * 0.06 + (r() - 0.5) * 0.28;
      x += Math.cos(ang) * paso;
      y += Math.sin(ang) * paso;
      pts.push([x, y]);
      if (x < -120 || y < -120 || x > ancho + 120 || y > alto + 120) break;
      if (b.nivel < 3 && i > 3 && r() < (b.nivel === 0 ? 0.075 : 0.05)) {
        cola.push({
          x,
          y,
          ang: ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7),
          pasos: Math.floor((b.pasos - i) * (0.35 + r() * 0.3)) + 6,
          nivel: b.nivel + 1,
          orden: b.orden + i * 0.03 + 0.2,
        });
      }
    }
    if (pts.length > 2) vetas.push({ d: suavizar(pts), nivel: b.nivel, orden: b.orden });
  }
  return vetas.sort((a, b) => a.orden - b.orden);
}

/** Catmull-Rom → curvas de Bézier cúbicas. */
function suavizar(p: [number, number][]) {
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const GROSOR = [1.1, 0.7, 0.45, 0.35];

interface Props {
  semilla?: number;
  troncos?: number;
  className?: string;
}

/** SVG de vetas. Cada trazo lleva pathLength=1 para poder dibujarlo con stroke-dashoffset. */
export const Vetas = forwardRef<SVGSVGElement, Props>(function Vetas({ semilla = 7, troncos = 9, className = '' }, ref) {
  const vetas = useMemo(() => generarVetas(semilla, troncos), [semilla, troncos]);
  return (
    <svg ref={ref} className={`vetas ${className}`} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {vetas.map((v, i) => (
        <path
          key={i}
          d={v.d}
          pathLength={1}
          className={`vetas__trazo vetas__trazo--${v.nivel}`}
          style={{ strokeWidth: GROSOR[v.nivel] }}
        />
      ))}
    </svg>
  );
});
