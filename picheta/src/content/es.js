// Todos los textos visibles del sitio (sólo español).
// Lo marcado "por confirmar" debe verificarse con el restaurante.

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
    prev: 'Anterior',
    next: 'Siguiente',
  },

  intro: {
    hint: 'Dibuja un círculo para entrar',
    enter: 'Entrar',
    enterKey: 'o pulsa Intro',
  },

  inmersion: {
    line: 'En el corazón de Mérida, un edificio de más de 350 años.',
    hint: 'Desliza o toca para descender',
    plaza: 'Plaza Grande',
    catedral: 'Catedral',
    picheta: 'Pasaje Picheta',
    pichetaSub: 'Calle 61 #501',
  },

  llegada: {
    entrada: 'Una discreta entrada…',
    arriba: '…y, arriba, Mérida entera.',
  },

  terraza: {
    hintTouch: 'Toca los objetos para descubrir Picheta',
    hintMouse: 'Pasa el cursor sobre los objetos para descubrir Picheta',
  },

  // Menú textual de respaldo: mismas voces que el sitio actual.
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
  // Etiquetas de los objetos de la terraza.
  navLabels: {
    inicio: 'Inicio',
    historia: 'Historia',
    autores: 'Autores',
    menu: 'Menú',
    reserva: 'Reserva una mesa',
    concurso: 'Concurso gastronómico',
    eventos: 'Eventos',
  },

  footer: {
    instagram: 'Instagram',
    facturacion: 'Facturación',
    credit: 'Experiencia por Alessia Studio – 3D web experience',
  },

  sections: {
    historia: {
      title: 'Historia',
      lead: 'Un tambor de unión entre lo prehispánico, lo colonial y lo actual.',
      phrases: [
        { text: 'Gabriel Vicente Gahona, «Picheta» (Mérida, 1828–1899).', art: 'medallon' },
        {
          text: 'Grabador y caricaturista. En 1847 fundó Don Bullebulle, periódico satírico que hizo reír y pensar a todo Yucatán.',
          art: 'cabecera',
        },
        { text: 'Fundó la primera academia de grabado de la región y fue alcalde de Mérida en 1880.', art: 'buril' },
        { text: 'Desde 1639, estos pasillos fueron Ayuntamiento y cárcel pública. Hoy son el Pasaje Picheta.', photo: 'patio' },
        { text: 'La calle lleva su nombre. Nosotros también.', art: 'placa' },
      ],
      // Texto completo del restaurante: por recibir del cliente (se maqueta en bloques).
      body: [
        'En un edificio de más de 350 años, en el corazón del centro de Mérida…',
        'Un tambor de unión entre lo prehispánico, lo colonial y lo actual.',
      ],
    },
    autores: {
      title: 'Autores',
      lead: 'Más que seguir recetas, comunicamos emoción.',
      // Retratos y nombres por confirmar: las fotos actuales son provisionales.
      people: [
        { name: 'Nombre por confirmar', role: 'Chef ejecutivo', photo: 'comal' },
        { name: 'Nombre por confirmar', role: 'Chef de cocina', photo: 'fogon' },
        { name: 'Nombre por confirmar', role: 'Chef pastelero', photo: 'ingredientes' },
      ],
      note: 'La cocina de autor nace de la milpa, del fogón y de la memoria.',
    },
    menu: {
      title: 'Menú',
      lead: 'Una evolución de nuestra comida típica.',
      // Platillos de ejemplo (cocina yucateca): sustituir por el menú real.
      dishes: [
        { name: 'Cochinita pibil', course: 'Fuerte', text: 'Cerdo en achiote y naranja agria, cocido lentamente en hoja de plátano.', photo: 'platillo' },
        { name: 'Sopa de lima', course: 'Entrada', text: 'Caldo perfumado con lima yucateca, pollo deshebrado y tortilla crujiente.' },
        { name: 'Papadzules', course: 'Entrada', text: 'Tortillas bañadas en salsa de pepita, huevo y chiltomate.', photo: 'ingredientes' },
        { name: 'Relleno negro', course: 'Fuerte', text: 'Pavo en recado de chiles quemados, con su but de cerdo.' },
        { name: 'Poc chuc', course: 'Fuerte', text: 'Cerdo marinado en naranja agria, asado al carbón, con cebolla asada.', photo: 'comal' },
        { name: 'Marquesita', course: 'Postre', text: 'La crepa crujiente de la feria, con queso de bola.' },
      ],
    },
    reserva: {
      title: 'Reserva una mesa',
      lead: 'La vista más bella de Mérida te espera.',
      ctaOnline: 'Reservar en línea',
      ctaWhatsapp: 'Reservar por WhatsApp',
      ctaMaps: 'Cómo llegar',
      info: [
        { label: 'Dirección', text: 'Calle 61 #501, Pasaje Picheta, Centro, Mérida' },
        // Horarios por confirmar con el restaurante.
        { label: 'Horario', text: 'Lun–Sáb 17:00–00:00 · Dom 14:30–21:00' },
      ],
    },
    concurso: {
      title: 'Concurso gastronómico',
      lead: 'Cocina de autor en competencia.',
      cards: [
        { title: 'Convocatoria', text: 'Bases y requisitos de participación: por publicar.' },
        { title: 'Fechas', text: 'Calendario de rondas y final: por confirmar.' },
        { title: 'Jurado', text: 'Chefs y cronistas invitados: por anunciar.' },
      ],
      cta: 'Bases del concurso · próximamente',
    },
    eventos: {
      title: 'Eventos',
      lead: 'Eventos privados, empresariales y cenas especiales.',
      cards: [
        { title: 'Eventos privados', text: 'La terraza para celebraciones frente a la Catedral.', photo: 'terraza' },
        { title: 'Empresariales', text: 'Comidas, presentaciones y cenas de equipo.', photo: 'patio' },
        { title: 'Cenas especiales', text: 'Menús de autor a cuatro manos y noches temáticas.', photo: 'fogon' },
      ],
      cta: 'Solicitar información',
    },
  },
};
