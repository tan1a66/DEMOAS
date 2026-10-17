import { CONFIG } from '../config.js';

// Detección de dispositivo y nivel de calidad. Todo lo que cuesta GPU
// (partículas, resolución, bloom) se decide aquí, en un solo sitio.
// Forzar un nivel para pruebas: ?q=low | ?q=mid | ?q=high

const mq = (q) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;

export function detectQuality() {
  const coarse = mq('(pointer: coarse)');
  const mobile = coarse || Math.min(innerWidth, innerHeight) < 600;
  const ios =
    /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;

  let tier = 'high';
  // Los iPhone recientes van sobrados con el nivel medio; Safari no expone núcleos reales.
  if (ios) tier = 'mid';
  else if (mobile) tier = cores >= 8 && memory >= 6 ? 'mid' : 'low';
  else if (cores <= 4 || memory <= 4) tier = 'mid';

  const forced = new URLSearchParams(location.search).get('q');
  if (forced && CONFIG.quality[forced]) tier = forced;

  return {
    tier,
    mobile,
    ios,
    coarse,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    maxDpr: mobile ? 1.5 : 2,
    ...CONFIG.quality[tier],
  };
}

// WebGL2 es necesario (texturas flotantes para la simulación de partículas).
export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
