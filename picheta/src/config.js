// Configuración general de la demo Picheta.
// Todo lo marcado "por confirmar" debe verificarse con el restaurante antes de publicar.

const BASE = import.meta.env.BASE_URL;
const asset = (p) => `${BASE}assets/${p}`;

export const CONFIG = {
  assets: {
    // Trazo claro sobre fondo oscuro (o transparente). La intro muestrea sus píxeles claros.
    logo: asset('logo-picheta.png'),
    // La casa en 3D: las salas (fotos reales + mapas de profundidad en public/assets/casa/)
    // y sus puntos de luz están en src/scenes/casa/rooms.js.
    // Foto de portada de la versión sin WebGL.
    hero: asset('casa/terraza.webp'),
    // Imágenes provisionales de cocina para Menú y Autores (generadas con IA): sustituir
    // por fotos de los platillos y retratos de los chefs.
    photos: {
      platillo: asset('fotos/platillo.webp'),
      comal: asset('fotos/comal.webp'),
      ingredientes: asset('fotos/ingredientes.webp'),
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
    hintDelay: 0.2,
    enterButtonDelay: 4,
  },

  // Calidad por nivel (ver core/quality.js). Intro: partículas del logo (trazo ~80 %,
  // polvo ~18 %, destellos ~2 %). Casa: malla de cada sala (celdas a lo ancho) y motas de polvo.
  quality: {
    high: { particles: 40000, dust: 520, ink: 3600, trail: 420, bloomLevels: 7, stoneSize: 2048, roomGrid: 240, roomDust: 110000, dustSize: 2.2 },
    mid: { particles: 24000, dust: 320, ink: 2600, trail: 320, bloomLevels: 6, stoneSize: 2048, roomGrid: 190, roomDust: 70000, dustSize: 2.4 },
    low: { particles: 14000, dust: 200, ink: 1800, trail: 240, bloomLevels: 5, stoneSize: 1024, roomGrid: 140, roomDust: 42000, dustSize: 2.6 },
  },
};
