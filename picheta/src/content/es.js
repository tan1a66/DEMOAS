// Todos los textos visibles del sitio (sólo español).
// Horarios y textos marcados "por confirmar" deben verificarse con el restaurante.

export const content = {
  brand: 'Picheta',
  tagline: 'Cocina de autores · Mérida, Yucatán',
  address: 'Calle 61 #501, Pasaje Picheta, Centro, Mérida, Yucatán',

  ui: {
    loading: 'Cargando',
    openMenu: 'Abrir navegación',
    closeMenu: 'Cerrar navegación',
    soundOn: 'Activar sonido',
    soundOff: 'Silenciar sonido',
    sound: 'Sonido',
    back: 'Volver',
    backTerrace: 'Volver a la terraza',
    skip: 'Saltar',
  },

  intro: {
    hint: 'Dibuja un círculo para entrar',
    enter: 'Entrar',
    enterKey: 'o pulsa Intro',
  },

  // Escenas siguientes (aún en desarrollo en esta entrega).
  inmersion: {
    line: 'En el corazón de Mérida, un edificio de más de 350 años.',
    wip: 'Escena 2 · Inmersión — en desarrollo',
    restart: 'Volver al inicio',
  },

  // Menú textual de respaldo: mismas voces que el sitio actual.
  // Cada fila puede llevar una o varias voces (HISTORIA · AUTORES).
  nav: [
    [{ id: 'inicio', label: 'Inicio' }],
    [
      { id: 'historia', label: 'Historia' },
      { id: 'autores', label: 'Autores' },
    ],
    [{ id: 'menu', label: 'Menú' }],
    [{ id: 'reserva', label: 'Reserva una mesa' }],
    [{ id: 'concurso', label: 'Concurso gastronómico' }],
    [{ id: 'eventos', label: 'Eventos' }],
    [{ id: 'facturacion', label: 'Facturación', external: true }],
  ],

  footer: {
    instagram: 'Instagram',
    facturacion: 'Facturación',
    credit: 'Experiencia por Alessia Studio – 3D web experience',
  },

  // Secciones (paneles sobre la terraza). Bloques:
  //   phrase: frase grande, una a la vez · text: párrafo · meta: datos breves
  //   placeholder: espacio reservado para contenido del cliente
  sections: {
    historia: {
      title: 'Historia',
      lead: 'Un tambor de unión entre lo prehispánico, lo colonial y lo actual.',
      blocks: [
        { type: 'phrase', text: 'Gabriel Vicente Gahona, «Picheta» (Mérida, 1828–1899).' },
        {
          type: 'phrase',
          text: 'Grabador y caricaturista. En 1847 fundó Don Bullebulle, periódico satírico que hizo reír y pensar a todo Yucatán.',
        },
        { type: 'phrase', text: 'Fundó la primera academia de grabado de la región y fue alcalde de Mérida en 1880.' },
        {
          type: 'phrase',
          text: 'Desde 1639, estos pasillos fueron Ayuntamiento y cárcel pública. Hoy son el Pasaje Picheta.',
        },
        { type: 'phrase', text: 'La calle lleva su nombre. Nosotros también.' },
        // Texto completo del restaurante: por recibir del cliente.
        { type: 'text', text: 'En un edificio de más de 350 años, en el corazón del centro de Mérida…' },
      ],
    },
    autores: {
      title: 'Autores',
      lead: 'Más que seguir recetas, comunicamos emoción.',
      blocks: [{ type: 'placeholder', text: 'Retratos y biografías de los chefs autores.' }],
    },
    menu: {
      title: 'Menú',
      lead: 'Una evolución de nuestra comida típica.',
      blocks: [{ type: 'placeholder', text: 'Platillos de temporada: nombres y descripciones breves.' }],
    },
    reserva: {
      title: 'Reserva una mesa',
      lead: 'La vista más bella de Mérida te espera.',
      blocks: [
        { type: 'meta', label: 'Dirección', text: 'Calle 61 #501, Pasaje Picheta, Centro, Mérida' },
        // Horarios por confirmar con el restaurante.
        { type: 'meta', label: 'Horario', text: 'Lun–Sáb 17:00–00:00 · Dom 14:30–21:00' },
      ],
    },
    concurso: {
      title: 'Concurso gastronómico',
      lead: 'Cocina de autor en competencia.',
      blocks: [{ type: 'placeholder', text: 'Bases, fechas y participantes del concurso.' }],
    },
    eventos: {
      title: 'Eventos',
      lead: 'Eventos privados, empresariales y cenas especiales.',
      blocks: [{ type: 'placeholder', text: 'Formatos, capacidad y contacto para eventos.' }],
    },
  },
};
