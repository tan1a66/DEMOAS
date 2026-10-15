// ─────────────────────────────────────────────────────────────────────────────
//  Antes → Hoy: l'epoca segue la linea del tempo di "Nuestra historia"
//
//  La storia ha 7 tappe (vedi #historia in index.html). Per ogni tappa c'è
//  un'epoca del mondo 3D:
//    0 = l'hacienda del henequén (campo, binari, fibra al sole)
//    1 = l'abbandono (niente henequén, monte, muri in rovina)
//    2 = il restauro (intonaco rifatto, il monte si ritira, torna il colore)
//    3 = oggi (prato e alberi attorno alla casa)
//  Tra una tappa e l'altra l'epoca scorre in modo continuo.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

// epoca al centro di ogni tappa: 1683 · ganado y maíz · henequén · abandono ·
// 1974 · restauración · 1995–hoy
export const STOP_ERA = [0, 0, 0, 1, 1.2, 2.1, 3];

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

/** epoca (0…3) per l'avanzamento p (0…1) nel capitolo Historia */
export function eraAt(p) {
  const n = STOP_ERA.length;
  const x = p * n - 0.5; // centri delle tappe sugli interi
  if (x <= 0) return STOP_ERA[0];
  if (x >= n - 1) return STOP_ERA[n - 1];
  const i = Math.floor(x);
  const f = x - i;
  return THREE.MathUtils.lerp(STOP_ERA[i], STOP_ERA[i + 1], f * f * (3 - 2 * f));
}

/** tappa attiva per l'avanzamento p */
export const stopAt = (p) => Math.min(STOP_ERA.length - 1, Math.max(0, Math.floor(p * STOP_ERA.length)));

/**
 * Stato del mondo per l'epoca e (0…3)
 *  field  henequén in piedi        wild   monte cresciuto
 *  clear  monte tagliato vicino alla casa   garden prato e alberi di oggi
 *  ruin   muri in rovina           props  oggetti del henequén svaniti
 *  sink   binario sotto terra      past   viraggio seppia (ricordo)
 *  cool   seppia più fredda e grigia (gli anni dell'abbandono)
 */
export function eraState(e, out = {}) {
  out.e = e;
  out.wither = smooth(0.05, 0.85, e) * 1.45; // >1: anche le piante più lontane spariscono
  out.field = 1 - smooth(0.05, 0.85, e);
  out.props = smooth(0.15, 0.55, e);
  out.sink = smooth(0.5, 2.6, e);
  out.wild = smooth(0.2, 1.0, e);
  out.clear = smooth(1.35, 2.3, e);
  out.garden = smooth(1.75, 2.95, e);
  out.ruin = (0.12 + 0.88 * smooth(0.15, 0.95, e)) * (1 - smooth(1.3, 1.95, e));
  out.past = 1 - smooth(1.45, 2.45, e);
  out.cool = smooth(0.35, 0.95, e) * (1 - smooth(1.25, 1.9, e));
  return out;
}
