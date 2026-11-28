// Configuración general de Casa Caracol.
// Los valores del match cut (cámara/concha) están aparte, en src/story/matchcut.js,
// para poder pegarlos directamente desde el panel ?debug.

export const PALETTE = {
  calce: '#F4F1EA', // cal
  sand: '#E6DCCB', // arena
  water: '#BFDCD3', // agua pálida
  sky: '#5B8DBE', // cielo
  coral: '#E07A5F', // acento (solo CTA y detalles)
  ink: '#1E2E38', // tinta para textos sobre fondo claro
  pink: '#EDB9A8', // interior del caracol rosado (derivado del coral, muy suave)
};

export const CONFIG = {
  // Reserva directa. PLACEHOLDER: sustituir por el número real de los propietarios.
  whatsapp: {
    number: '520000000000',
    placeholder: true,
  },

  // Longitud de cada tramo del scroll, en "vh" de pantalla (100 = una pantalla).
  // En iPhone un gesto de deslizar recorre ~100–130 vh.
  story: {
    introHold: 16, // el texto de la intro se desvanece
    descent: 150, // la cámara baja a la arena y gira alrededor de la concha
    cut: 105, // fundido 3D → foto real de las puntas
    cutHold: 70, // la foto se queda, entra la frase
  },

  // Ola: un ciclo completo (llega, moja la concha, se retira, la arena se seca).
  wave: {
    period: 10.5, // segundos
    start: -4.6, // z de salida (fuera de pantalla, lado del mar)
    reach: 0.34, // z máxima que alcanza (pasa la base de la concha)
    rushEnd: 0.21, // fracción del ciclo en que llega al máximo
    holdEnd: 0.31,
    recedeEnd: 0.74,
    dryTime: 2.6, // segundos que tarda la arena en secarse
    edgeAmp: 0.42, // irregularidad del borde
  },

  // Cáusticas (elemento firma). Escala = unidades de mundo por baldosa.
  caustics: {
    scale: 2.6,
    intensity: 0.42, // en arena seca
    underwater: 0.95, // bajo la lámina de agua
    speed: 0.55,
    textureSize: { desktop: 1024, mobile: 768 },
  },

  audio: {
    src: '/audio/sea.mp3',
    volume: 0.32,
    fadeIn: 2.8,
  },

  // Foto del match cut y su encuadre en pantalla (cover).
  photos: {
    base: '/photos/',
    maxTextureSize: 2560,
  },

  model: '/models/conch.glb',

  quality: {
    maxDpr: 2,
    minDpr: 1,
  },
};
