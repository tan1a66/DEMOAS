// Catenaria y = a·cosh((x − x0)/a) + c entre dos puntos A y B con longitud L.
// Se resuelve sinh(ξ)/ξ = √(L² − v²)/h con el método de Newton (ξ = h / 2a).

export function solveCatenary(x1, y1, x2, y2, L) {
  const h = Math.max(x2 - x1, 1e-6);
  const v = y2 - y1;
  const chord = Math.hypot(h, v);
  L = Math.max(L, chord * 1.0004);
  const r = Math.sqrt(L * L - v * v) / h;

  let xi = r < 3 ? Math.sqrt(6 * (r - 1)) : Math.log(2 * r) + Math.log(Math.log(2 * r));
  for (let k = 0; k < 40; k++) {
    const f = Math.sinh(xi) - r * xi;
    const df = Math.cosh(xi) - r;
    const d = f / df;
    xi -= d;
    if (xi <= 1e-6) xi = 1e-6;
    if (Math.abs(d) < 1e-11) break;
  }
  const a = h / (2 * xi);
  const x0 = (x1 + x2) / 2 - a * Math.atanh(v / L);
  const c = y1 - a * Math.cosh((x1 - x0) / a);
  const s1 = a * Math.sinh((x1 - x0) / a);
  return { a, x0, c, x1, y1, x2, y2, L, s1 };
}

// Punto y tangente a una distancia s (sobre la curva) desde A.
export function catenaryAt(cat, s, out) {
  const { a, x0, c, s1 } = cat;
  const u = Math.asinh((s + s1) / a);
  out.x = x0 + a * u;
  out.y = a * Math.cosh(u) + c;
  const ch = Math.cosh(u);
  out.tx = 1 / ch;
  out.ty = Math.tanh(u);
  return out;
}

// Ángulos (radianes) de la tangente en los extremos: negativo baja, positivo sube.
export function catenaryEndAngles(cat) {
  const u1 = (cat.x1 - cat.x0) / cat.a;
  const u2 = (cat.x2 - cat.x0) / cat.a;
  return [Math.atan(Math.sinh(u1)), Math.atan(Math.sinh(u2))];
}

export function catenaryLowest(cat) {
  if (cat.x0 > cat.x1 && cat.x0 < cat.x2) return cat.a + cat.c;
  return Math.min(cat.y1, cat.y2);
}
