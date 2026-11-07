/**
 * Controlli leggeri (senza Three.js) per decidere se caricare il 3D.
 * Restano in questo file piccolo così il bundle di Three.js parte solo se serve.
 */

/**
 * Controllo leggero: il browser conosce WebGL? Non crea contesti di prova (costerebbe centinaia di ms
 * sul thread principale). Se poi la creazione del renderer fallisce, l'isola torna al fallback statico.
 */
export function webglDisponibile(): boolean {
  return typeof window !== 'undefined' && ('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window);
}

/** Cede il thread principale (spezza i lavori lunghi in più task brevi: meglio per INP/TBT). */
export const cedi = () => new Promise<void>((r) => setTimeout(r, 0));

export const riduciMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ?no3d nell'URL spegne tutto il 3D: utile per misurare LCP/INP con e senza (vedi README). */
export const disattivatoDaUrl = () => new URLSearchParams(window.location.search).has('no3d');

/** Schermi piccoli o touch: usati per limitare DPR e, per l'hero, per mostrare la versione statica. */
export const isMobile = () => window.matchMedia('(max-width: 63.99rem), (pointer: coarse)').matches;

/** Risparmio dati attivo (Chrome/Android). */
export const risparmioDati = () =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

/** Esegue `fn` quando il browser è libero (dopo il primo caricamento). */
export function quandoLibero(fn: () => void, timeout = 2000) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 300);
}
