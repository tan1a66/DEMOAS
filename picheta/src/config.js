// Configuración general de la demo Picheta.
// Todo lo marcado "por confirmar" debe verificarse con el restaurante antes de publicar.

const BASE = import.meta.env.BASE_URL;

export const CONFIG = {
  assets: {
    // Trazo claro sobre fondo oscuro (o transparente). La intro muestrea sus píxeles claros.
    logo: `${BASE}assets/logo-picheta.png`,
  },

  links: {
    instagram: 'https://www.instagram.com/', // por confirmar: cuenta oficial del restaurante
    facturacion: '#', // por confirmar: URL de la página de facturación existente
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

  // Calidad por nivel (ver core/quality.js). Las partículas se reparten:
  // trazo del logo ~80 %, polvo ~18 %, destellos ~2 %.
  quality: {
    high: { particles: 40000, dust: 520, ink: 3600, trail: 420, bloomLevels: 7, stoneSize: 2048 },
    mid: { particles: 24000, dust: 320, ink: 2600, trail: 320, bloomLevels: 6, stoneSize: 2048 },
    low: { particles: 14000, dust: 200, ink: 1800, trail: 240, bloomLevels: 5, stoneSize: 1024 },
  },
};
