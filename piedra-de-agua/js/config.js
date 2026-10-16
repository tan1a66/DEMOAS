// Configuración general de la demo.

export const CONFIG = {
  // WhatsApp de contacto: +52 56 3858 1547
  // (formato internacional sin "+", espacios ni guiones; México móvil = 521 + 10 dígitos).
  whatsapp: '5215638581547',

  address: 'Calle 60 #498, Centro, 97000 Mérida, Yuc., México',
  // Búsqueda para el enlace de Google Maps (sin coordenadas inventadas).
  mapsQuery: 'Hotel Piedra de Agua, Calle 60 498, Centro, Mérida, Yucatán',

  imagesPath: 'images/',
};

const ua = navigator.userAgent || '';
const coarse = window.matchMedia('(pointer: coarse)').matches;
export const IS_MOBILE = coarse || /Android|iPhone|iPad|iPod/i.test(ua);
export const IS_IOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
// ?slow=4 ralentiza todas las animaciones (solo para revisar la intro).
const SLOW = Math.max(0.1, Number(new URLSearchParams(location.search).get('slow')) || 1);
export const motion = {
  reduced: reducedQuery.matches,
  // Factor que acorta duraciones cuando el usuario prefiere menos movimiento.
  get k() { return (this.reduced ? 0.35 : 1) * SLOW; },
};
reducedQuery.addEventListener?.('change', (e) => { motion.reduced = e.matches; });

// Dos niveles de calidad: "high" (escritorio) y "low" (teléfonos y tabletas).
const lowEnd = IS_MOBILE || (navigator.hardwareConcurrency || 8) <= 4;
export const QUALITY = lowEnd
  ? { tier: 'low', maxDpr: 2, particles: 0.45, shadowMap: 1024, ribbons: 300, leaves: 1800, sim: 176, texSize: 512, aniso: 4 }
  : { tier: 'high', maxDpr: 2, particles: 1, shadowMap: 2048, ribbons: 560, leaves: 3600, sim: 256, texSize: 1024, aniso: 8 };

export function waLink(message = '') {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${CONFIG.whatsapp}${text}`;
}
