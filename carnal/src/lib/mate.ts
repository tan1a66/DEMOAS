export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 cuando x va de a a b (lineal, saturado). */
export const tramo = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
export const suave = (x: number, a: number, b: number) => {
  const t = tramo(x, a, b);
  return t * t * (3 - 2 * t);
};
/** Sube en [a,b], se mantiene, baja en [c,d]. */
export const ventana = (x: number, a: number, b: number, c: number, d: number) => suave(x, a, b) * (1 - suave(x, c, d));
/** Amortiguación exponencial independiente de los fps. */
export const amortigua = (actual: number, meta: number, lambda: number, dt: number) =>
  mezcla(actual, meta, 1 - Math.exp(-lambda * dt));

/** PRNG determinista (mulberry32). */
export function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
