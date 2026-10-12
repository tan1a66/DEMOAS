// Configuración general de la demo. Todo lo marcado como "indicativo" o
// "placeholder" debe confirmarse con URBAZ antes de cualquier uso real.

export const CONFIG = {
  // Tipo de cambio FIJO e indicativo (no se consulta ninguna API).
  exchange: {
    mxnPerUsd: 18.5, // indicativo — actualizar a mano
    note: 'Tipo de cambio indicativo',
  },

  // Número de WhatsApp: placeholder hasta confirmar el número de ventas oficial.
  // (En el índice de urbaz.mx aparece +52 1 999 322 6482 — POR VERIFICAR antes de usarlo.)
  whatsapp: {
    number: '5219990000000',
    placeholder: true,
  },

  // Calidad: se baja automáticamente en móvil / pantallas táctiles.
  quality: {
    desktop: { maxPixelRatio: 1.75, clouds: 34, antialias: true },
    mobile: { maxPixelRatio: 1.5, clouds: 0, antialias: true },
  },

  defaultLang: 'es',
};

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);

export const QUALITY = IS_MOBILE ? CONFIG.quality.mobile : CONFIG.quality.desktop;
