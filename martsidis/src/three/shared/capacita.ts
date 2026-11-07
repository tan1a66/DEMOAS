/**
 * Controlli leggeri (senza Three.js) per decidere se caricare il 3D.
 * Restano in questo file piccolo così il bundle di Three.js parte solo se serve.
 */

/** true se il browser può creare un contesto WebGL. Il contesto di prova viene subito rilasciato. */
export function webglDisponibile(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

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
