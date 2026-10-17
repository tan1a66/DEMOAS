// Configuración general de la demo Picheta.
// Todo lo marcado "por confirmar" debe verificarse con el restaurante antes de publicar.

const BASE = import.meta.env.BASE_URL;
const asset = (p) => `${BASE}assets/${p}`;

export const CONFIG = {
  assets: {
    // Trazo claro sobre fondo oscuro (o transparente). La intro muestrea sus píxeles claros.
    logo: asset('logo-picheta.png'),
    // Escena 2: foto B/N de la cuadrícula del centro dentro del doble círculo de spray.
    map: asset('merida-mapa.jpg'),
    // Escena 4: busto de Picheta en GLB (opcional). null = busto estilizado provisional.
    bust: null, // p. ej. asset('busto-picheta.glb')
    // Escena 4: panorámica equirectangular de la terraza (opcional). null = terraza 3D.
    panorama: null, // p. ej. asset('terraza-360.jpg')
    photos: {
      terraza: asset('fotos/terraza-atardecer.webp'),
      platillo: asset('fotos/platillo.webp'),
      comal: asset('fotos/comal.webp'),
      ingredientes: asset('fotos/ingredientes.webp'),
      patio: asset('fotos/patio.webp'),
      fogon: asset('fotos/fogon.webp'),
    },
  },

  links: {
    instagram: 'https://www.instagram.com/', // por confirmar: cuenta oficial del restaurante
    facturacion: '#', // por confirmar: URL de la página de facturación existente
    // Reservas: deja vacío el que no se use y el botón desaparece.
    opentable: 'https://www.opentable.com/', // por confirmar: enlace de reserva de Picheta
    whatsapp: '', // por confirmar: número en formato internacional sin "+", p. ej. '529990000000'
    maps: 'https://www.google.com/maps/search/?api=1&query=Picheta%20Calle%2061%20501%20Centro%20M%C3%A9rida',
  },

  intro: {
    // Gesto "dibuja un círculo": ángulo recorrido alrededor del centro del trazo.
    minAngleDeg: 330,
    // Desviación máxima del radio (desviación típica / radio medio).
    maxRadiusDeviation: 0.3,
    // Segundos tras la unión de los círculos.
    hintDelay: 1.5,
    enterButtonDelay: 5,
  },

  // Escena 2. Coordenadas de la foto del mapa normalizadas 0..1 (x a la derecha,
  // y hacia abajo, como en cualquier editor de imágenes). Si se cambia la foto,
  // basta con medir estos puntos sobre la nueva.
  map: {
    circle: { x: 0.5, y: 0.5, r: 0.417, band: 0.03 }, // doble círculo de spray (centro y radio medio)
    // Cuadrícula de calles: origen (una intersección), paso entre calles y giro en grados.
    grid: { x: 0.5 - 0.06152 / 2, y: 0.5 - 0.06152 / 2, step: 0.06152, angle: 0 },
    plaza: { x: 0.5, y: 0.5 },
    catedral: { x: 0.556, y: 0.5 },
    picheta: { x: 0.511, y: 0.456 }, // Calle 61 #501, Pasaje Picheta
    // Nombres de las calles alrededor de la plaza (pares: norte-sur · nones: oriente-poniente).
    streets: [
      { name: 'Calle 60', axis: 'x', at: 0.5 + 0.06152 / 2 },
      { name: 'Calle 62', axis: 'x', at: 0.5 - 0.06152 / 2 },
      { name: 'Calle 61', axis: 'y', at: 0.5 - 0.06152 / 2 },
      { name: 'Calle 63', axis: 'y', at: 0.5 + 0.06152 / 2 },
    ],
  },

  terraza: {
    // Segundos sin tocar nada (móvil) antes de sugerir "Toca los objetos…".
    hintDelay: 6,
    // Giro máximo de la mirada desde el centro (240° en total).
    yawLimitDeg: 120,
  },

  // Calidad por nivel (ver core/quality.js). Las partículas se reparten:
  // trazo del logo ~80 %, polvo ~18 %, destellos ~2 %.
  quality: {
    high: { particles: 40000, dust: 520, ink: 3600, trail: 420, bloomLevels: 7, stoneSize: 2048, mapSegments: 320, shadows: 2048 },
    mid: { particles: 24000, dust: 320, ink: 2600, trail: 320, bloomLevels: 6, stoneSize: 2048, mapSegments: 220, shadows: 1024 },
    low: { particles: 14000, dust: 200, ink: 1800, trail: 240, bloomLevels: 5, stoneSize: 1024, mapSegments: 140, shadows: 0 },
  },
};
