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
    prev: 'Anterior',
    next: 'Siguiente',
  },

  intro: {
    hint: 'Dibuja un círculo para entrar',
    enter: 'Entrar',
    enterKey: 'o pulsa Intro',
  },

  // La casa en 3D: una sala por foto real del restaurante, en el orden del recorrido.
  casa: {
    indexLabel: 'Salas de Picheta',
    next: 'Seguir',
    hintTouch: 'Desliza hacia arriba para recorrer la casa · toca los puntos de luz',
    hintMouse: 'Desplázate para recorrer la casa · elige un punto de luz',
    subir: 'Subir a la terraza',
    rooms: [
      { name: 'La entrada', title: 'Bienvenidos a Picheta', sub: 'Cocina de autores en el corazón de Mérida', back: 'Volver a la entrada' },
      { name: 'El salón', title: 'El salón', sub: 'Una mesa larga bajo la bóveda de cuerdas', back: 'Volver al salón' },
      { name: 'El reservado', title: 'El reservado', sub: 'Piedra, luz baja y una mesa para celebrar', back: 'Volver al reservado' },
      { name: 'La escalera', title: 'Subimos', sub: 'La escalera lleva a la terraza', back: 'Volver a la escalera' },
      { name: 'La terraza', title: 'La terraza', sub: 'Atardecer junto a la Catedral', back: 'Volver a la terraza' },
      { name: 'La vista', title: 'La mejor vista de Mérida', sub: 'La Catedral de San Ildefonso, a un paso', back: 'Volver a la vista' },
    ],
    // Segunda línea de cada punto de luz.
    spotSubs: {
      historia: 'Dos círculos, una unión',
      autores: 'La firma de la casa',
      menu: 'La mesa',
      eventos: 'Para celebrar',
      subir: 'Hacia el cielo de Mérida',
      concurso: 'La barra',
      reserva: 'Frente a la Catedral',
    },
  },

  // Menú textual de respaldo: mismas voces que el sitio actual.
  nav: [
    [{ id: 'inicio', label: 'Inicio' }],
    [
      { id: 'salon', label: 'El salón' },
      { id: 'terraza', label: 'La terraza' },
    ],
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
  // Etiquetas de los puntos de luz de la casa.
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
        { text: 'Desde 1639, estos pasillos fueron Ayuntamiento y cárcel pública. Hoy son el Pasaje Picheta.', art: 'arcos' },
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
        { title: 'Eventos privados', text: 'El reservado y la terraza, para celebrar frente a la Catedral.' },
        { title: 'Empresariales', text: 'Comidas, presentaciones y cenas de equipo en el salón.' },
        { title: 'Cenas especiales', text: 'Menús de autor a cuatro manos y noches temáticas.' },
      ],
      cta: 'Solicitar información',
    },
  },
};
