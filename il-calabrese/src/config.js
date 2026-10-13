// Datos de contacto: MARCADORES DE POSICIÓN para la demo. Sustituir por los reales.
export const CONFIG = {
  whatsapp: '529990000000', // formato internacional sin "+"
  phoneLabel: '+52 999 000 0000',
  address: 'Calle 60 por 47, Centro, Mérida, Yucatán',
  location: { lat: 20.9752, lon: -89.6229 },
};

// Build para página privada (`npm run build:artifact`): ahí no se cargan imágenes externas ni iframes,
// así que las pizzas se dibujan y el mapa es ilustrado.
export const ARTIFACT = import.meta.env.MODE === 'artifact';
