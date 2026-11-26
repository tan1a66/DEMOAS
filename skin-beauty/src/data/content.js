// Datos reales de Skin Beauty (facilitados por la clienta). No inventar datos nuevos aquí.

export const BRAND = {
  name: 'Skin Beauty',
  owner: 'Liyerlyn Galvis',
  whatsapp: 'https://wa.link/pev3bc',
  instagram: 'https://www.instagram.com/skin.beautybcn/',
  instagramHandle: '@skin.beautybcn',
  phone: '634 661 990',
  phoneHref: 'tel:+34634661990',
  rating: 4.7,
  reviews: 177,
  address: 'C/ Riera Blanca, 55',
  district: 'Sants-Montjuïc',
  city: '08014 Barcelona',
  metro: 'Metro Badal (L5) a 5 min',
  hours: [
    ['Lun – Vie', '10 – 20 h'],
    ['Sábado', '10 – 17 h'],
  ],
  // Coordenadas de C/ Riera Blanca 53-55 (OpenStreetMap) y de la parada Metro Badal.
  coords: [2.12442, 41.37381],
  metroCoords: [2.12803, 41.37552],
  directions:
    'https://www.google.com/maps/dir/?api=1&destination=Carrer+de+la+Riera+Blanca+55,+08014+Barcelona',
  googleReviews:
    'https://www.google.com/maps/search/?api=1&query=Skin+Beauty+Carrer+de+la+Riera+Blanca+55+Barcelona',
};

export const CATEGORIES = [
  { id: 'faciales', label: 'Faciales' },
  { id: 'cejas', label: 'Cejas y Pestañas' },
  { id: 'masajes', label: 'Masajes' },
  { id: 'corporales', label: 'Tratamientos Corporales' },
  { id: 'manicura', label: 'Manicura' },
  { id: 'pedicura', label: 'Pedicura' },
];

export const DEFAULT_CATEGORY = 'corporales';
// Categorías en las que flotan herramientas de madera detrás de las tarjetas.
export const WOOD_CATEGORIES = ['masajes', 'corporales'];

export const TREATMENTS = {
  corporales: [
    { t: 'Drenoredux', d: 75, x: 'Técnica exclusiva: drenaje linfático y maderoterapia para desinflamar y definir la silueta.', exclusive: true },
    { t: 'Tratamiento Anticelulítico', d: 50, x: 'Reduce la apariencia de la celulitis y suaviza la textura de la piel.' },
    { t: 'Radiofrecuencia Corporal', d: 50, x: 'Calor controlado que estimula el colágeno y reafirma la piel.' },
    { t: 'Tratamiento Reductor', d: 60, x: 'Ayuda a disminuir medidas y favorece la tonificación.' },
    { t: 'Presoterapia', d: 45, x: 'Presión de aire que activa la circulación y alivia la sensación de piernas cansadas.' },
    { t: 'Lipólisis', d: 50, x: 'Ayuda a descomponer la grasa localizada y a moldear el cuerpo.' },
    { t: 'Vacumterapia', d: 50, x: 'Succión que estimula la circulación y ayuda a reducir la celulitis.' },
    { t: 'Glúteos Perfect', d: 50, x: 'Vacumterapia especializada para levantar, tonificar y mejorar la forma de los glúteos.' },
  ],
  masajes: [
    { t: 'Maderoterapia Corporal', d: 60, x: 'Instrumentos de madera que moldean la figura, activan la circulación y reducen la celulitis.' },
    { t: 'Masaje Relajante', d: 60, x: 'Libera tensiones, reduce el estrés y brinda una profunda sensación de bienestar.' },
    { t: 'Masaje Descontracturante', d: 60, x: 'Alivia tensiones musculares, reduce el dolor y mejora la movilidad.' },
    { t: 'Masaje Deportivo', d: 60, x: 'Prepara, recupera y relaja los músculos, mejorando el rendimiento.' },
    { t: 'Masaje Postoperatorio', d: 60, x: 'Reduce la inflamación y favorece una recuperación más rápida tras procedimientos estéticos.' },
    { t: 'Drenaje Linfático Manual', d: 60, x: 'Estimula el sistema linfático, elimina líquidos retenidos y desinflama el cuerpo.' },
  ],
  faciales: [
    { t: 'Hydrafacial', d: 50, x: 'Limpieza facial avanzada que exfolia, extrae impurezas e hidrata la piel, dejando el rostro limpio, fresco y luminoso.' },
    { t: 'Limpieza Glow Skin', d: 50, x: 'Limpia la piel a profundidad, elimina impurezas y células muertas, dejando el rostro fresco y luminoso.' },
    { t: 'Dermaplaning', d: 50, x: 'Exfoliación facial que elimina células muertas y vello fino, dejando la piel más suave y uniforme.' },
    { t: 'Dermapen', d: 45, x: 'Microneedling que estimula el colágeno, mejorando textura, cicatrices y líneas de expresión.' },
    { t: 'Hollywood Peel', d: 50, x: 'Láser con carbón activado que limpia profundamente, reduce poros y aporta luminosidad.' },
    { t: 'Radiofrecuencia Facial', d: 50, x: 'Calor controlado que estimula el colágeno y ayuda a reafirmar la piel.' },
    { t: 'Limpieza con Punta de Diamante', d: 50, x: 'Exfoliación profunda que elimina células muertas e impurezas, mejorando la textura de la piel.' },
    { t: 'Drenaje Linfático Facial', d: 50, x: 'Masaje suave que desinflama el rostro, elimina toxinas y mejora la apariencia de la piel.' },
    { t: 'Hidralips', d: 50, x: 'Exfolia, hidrata y revitaliza los labios, dejándolos suaves y con apariencia saludable.' },
  ],
  cejas: [
    { t: 'Laminado de Cejas', d: 45, x: 'Alinea y fija los vellos de las cejas, con un efecto definido, ordenado y natural.' },
    { t: 'Lifting de Pestañas + Tinte', d: 50, x: 'Eleva, curva y da color a las pestañas naturales, para una mirada más expresiva.' },
    { t: 'Diseño de Cejas', d: 30, x: 'Define y da forma a las cejas según las facciones del rostro, de forma armoniosa.' },
  ],
  manicura: [
    { t: 'Manicura Exprés con Semipermanente', d: 50, x: 'Cuidado y esmaltado rápido con acabado brillante y duradero.' },
    { t: 'Manicura Rusa con Semipermanente', d: 60, x: 'Alta precisión: limpieza profunda de cutícula y acabado definido y elegante.' },
    { t: 'Manicura Completa con Semipermanente', d: 60, x: 'Cuidado completo de uñas y cutículas con esmaltado de larga duración.' },
    { t: 'Uñas Acrílicas', d: 60, x: 'Extensión que brinda longitud, resistencia y un acabado elegante.' },
    { t: 'Uñas Press On', d: 45, x: 'Extensión fijada con gel para mayor adherencia y un acabado duradero.' },
  ],
  pedicura: [
    { t: 'Pedicura Exprés con Semipermanente', d: 60, x: 'Cuidado rápido de los pies con limpieza y arreglo de uñas.' },
    { t: 'Pedicura Completa con Semipermanente', d: 60, x: 'Remojo, limpieza profunda, cuidado de cutículas y arreglo de uñas.' },
  ],
};

// RESEÑAS DE EJEMPLO (marcadores de posición). Sustituir por reseñas reales de Google
// antes de publicar: no deben presentarse como opiniones reales.
export const REVIEWS = [
  { n: 'Nombre de clienta', i: 'A', tx: 'Aquí irá una reseña real de Google sobre Drenoredux: resultados, trato y sensación después de la sesión.', tag: 'Drenoredux' },
  { n: 'Nombre de clienta', i: 'M', tx: 'Espacio para una opinión real sobre maderoterapia: cómo se sintió el cuerpo y qué cambió tras varias sesiones.', tag: 'Maderoterapia' },
  { n: 'Nombre de clienta', i: 'L', tx: 'Reseña de ejemplo sobre un facial (Hydrafacial o Glow Skin): luminosidad, limpieza y atención recibida.', tag: 'Faciales' },
  { n: 'Nombre de clienta', i: 'C', tx: 'Texto provisional: aquí una clienta cuenta su experiencia con el masaje postoperatorio y la recuperación.', tag: 'Postoperatorio' },
  { n: 'Nombre de clienta', i: 'S', tx: 'Marcador para una reseña sobre cejas y pestañas: laminado, lifting y el resultado natural.', tag: 'Cejas y Pestañas' },
  { n: 'Nombre de clienta', i: 'P', tx: 'Ejemplo de reseña sobre el ambiente del centro en Sants y la puntualidad de cada cita.', tag: 'Experiencia' },
];
