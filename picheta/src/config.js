// Configuración de la demo. Todo lo que se toca a menudo está aquí.

export const CONFIG = {
  // Terraza de Picheta: Calle 61 x 60 y 62, lado norte de la Plaza Grande de Mérida.
  lat: 20.9674,
  lon: -89.6237,

  // America/Merida: UTC-6 todo el año (México eliminó el horario de verano en 2022).
  // Se usa un desfase fijo para que la hora sea siempre la de Mérida, esté donde esté quien mira.
  utcOffsetMin: -6 * 60,

  // Horario de la terraza (hora de Mérida). 0 = domingo … 6 = sábado.
  // `close` puede pasar de 24 (01:00 del día siguiente = 25).
  hours: {
    0: { open: 17, close: 23 }, // domingo
    1: { open: 17, close: 25 },
    2: { open: 17, close: 25 },
    3: { open: 17, close: 25 },
    4: { open: 17, close: 25 },
    5: { open: 17, close: 25 },
    6: { open: 17, close: 25 }, // sábado
  },

  // Antes de esta hora, la "noche de servicio" todavía pertenece al día anterior
  // (a la 01:00 del martes el texto habla de la noche del lunes).
  serviceDayStartsAt: 5,

  reservationsUrl: 'https://picheta.mx/reservas/',

  // ?timelapse=1 recorre este intervalo (hora de Mérida) en `durationSec` segundos.
  timelapse: { from: '16:00', to: '01:00', durationSec: 40, holdSec: 3 },

  defaultLang: 'es',
};

// Calidad según dispositivo: móvil primero.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export const IS_MOBILE = coarse || Math.min(screen.width, screen.height) < 600;

export const QUALITY = IS_MOBILE
  ? { maxPixelRatio: 2, shadowMapSize: 1024, ao: false, msaa: 0, bloomScale: 0.5 }
  : { maxPixelRatio: 2, shadowMapSize: 2048, ao: true, msaa: 4, bloomScale: 0.5 };

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
