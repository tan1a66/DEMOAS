/**
 * Textos en español (idioma predeterminado). Es la referencia de estructura: en.ts debe tener las mismas claves.
 * Los datos de Picheta (filosofía, historia del edificio, horarios…) proceden del sitio oficial; ver src/config/site.ts.
 */
export const es = {
  meta: {
    home: {
      title: 'Picheta Mérida — La ciudad, desde otra perspectiva',
      description:
        'Gastronomía yucateca contemporánea y cocina de autores en un edificio de más de 350 años, con terraza en la plaza central de Mérida y vista a la Catedral.',
    },
    menu: {
      title: 'Menú — Picheta Mérida',
      description:
        'Entradas, platos fuertes y postres de Picheta: gastronomía yucateca contemporánea y cocina de autores en el centro de Mérida.',
    },
    reserve: {
      title: 'Agendar una mesa — Picheta Mérida',
      description: 'Reserva tu mesa en Picheta a través de OpenTable, WhatsApp o teléfono. Calle 61 x 60 y 62, centro de Mérida.',
    },
  },

  common: {
    skip: 'Saltar al contenido',
    langLabel: 'Idioma',
    langNames: { es: 'Español', en: 'English' },
    newTab: '(se abre en una pestaña nueva)',
    proposal: 'Propuesta independiente de rediseño · no es el sitio oficial',
    backToExperience: 'Volver a la experiencia',
  },

  nav: {
    label: 'Navegación principal',
    home: 'Picheta, volver al inicio',
    items: {
      place: 'El lugar',
      experience: 'La experiencia',
      gastronomy: 'Gastronomía',
      gallery: 'Galería',
      location: 'Ubicación',
    },
    reserve: 'Agendar',
    open: 'Índice',
    close: 'Cerrar',
  },

  welcome: {
    location: 'Mérida · Yucatán',
    title: ['La ciudad,', 'desde otra', '*perspectiva.*'],
    lead: 'Arquitectura, gastronomía y un horizonte que invita a quedarse.',
    enter: 'Entrar',
    enterHint: 'Recorrer Picheta',
    reserve: 'Agendar',
    reserveHint: 'Reservar una mesa',
    tagline: 'Gastronomía yucateca contemporánea + cocina de autores',
    photo: 'La terraza al atardecer',
    scroll: 'o desliza',
  },

  reveal: {
    index: '01',
    kicker: 'La terraza',
    title: ['Un lugar', 'sobre lo *cotidiano.*'],
    text: 'Una nueva manera de vivir Mérida, entre arquitectura, horizonte y experiencias que permanecen.',
    scroll: 'Descubrir',
  },

  space: {
    index: '02',
    kicker: 'La arquitectura',
    title: ['El espacio', 'lo cambia *todo.*'],
    lead: 'Un edificio de más de 350 años en el corazón del centro de Mérida.',
    text: 'Una entrada discreta da paso a muros de piedra, madera y luz cálida. Un lugar pensado para vivir la gastronomía con todos los sentidos.',
    figure: '+350',
    figureLabel: 'años tiene el edificio que habita Picheta',
    captions: ['El salón', 'Piedra, madera y luz', 'El balcón', 'Sala privada para ocho'],
  },

  height: {
    index: '03',
    kicker: 'Otra perspectiva',
    title: ['Mérida,', 'desde otra *altura.*'],
    text: 'Desde la calle, las torres de la Catedral. Desde arriba, la plaza entera y la ciudad que se abre a su alrededor.',
    caption: 'El centro de Mérida desde el aire · fotograma del vídeo oficial de Picheta, con profundidad',
    hint: { pointer: 'Mueve el cursor para mirar', touch: 'Inclina el teléfono para mirar' },
    scale: ['Desde la calle', 'Desde el aire'],
  },

  light: {
    index: '04',
    kicker: 'La terraza y la luz',
    title: ['La luz', 'transforma', 'el *momento.*'],
    text: 'De la claridad del día a la noche: la misma terraza, otra atmósfera.',
    frames: ['Luz del día', 'Hora dorada', 'Última luz', 'Hora azul', 'De noche'],
    label: 'Galería: la terraza a distintas horas',
    hint: 'Desliza',
  },

  experience: {
    index: '05',
    kicker: 'La experiencia',
    title: ['Una experiencia', 'que va más allá', 'de la *mesa.*'],
    text: 'Una mirada contemporánea a la gastronomía yucateca, en un entorno que invita a descubrir, compartir y disfrutar.',
    quote:
      'Ofrecemos comida con corazón; una experiencia de experiencias: vibrante, apasionada, cálida, excitante y profundamente yucateca.',
    quoteSource: 'Filosofía de Picheta',
    points: [
      { title: 'Cocina de autores', text: 'Chefs residentes y autores invitados crean platillos únicos a partir de ingredientes locales.' },
      { title: 'Sala comedor privada', text: 'Un espacio íntimo para reuniones de hasta ocho personas.' },
      { title: 'Terraza para eventos', text: 'De bodas y recepciones a eventos corporativos, con la Catedral como escenario.' },
    ],
  },

  gastronomy: {
    kicker: 'Gastronomía',
    title: 'La propuesta gastronómica.',
    text: 'Una interpretación contemporánea de los sabores yucatecos.',
    detail: 'Entradas, platos fuertes y postres, con creaciones de chefs residentes y autores invitados.',
    cta: 'Explorar menú',
  },

  location: {
    kicker: 'Ubicación',
    title: ['En el corazón', 'del *centro.*'],
    text: 'En la plaza central de Mérida, con vista a la Catedral.',
    address: 'Dirección',
    hours: 'Restaurante y barra',
    contact: 'Contacto',
    maps: 'Ver en Google Maps',
    call: 'Llamar',
    whatsapp: 'WhatsApp',
    days: { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' } as Record<number, string>,
    range: (from: string, to: string) => `${from} a ${to.toLowerCase()}`,
  },

  invitation: {
    title: ['El siguiente momento', 'puede ser *tuyo.*'],
    primary: 'Agendar una mesa',
    secondary: 'Volver a explorar',
    note: 'Reservaciones en línea con OpenTable, el sistema oficial de Picheta.',
  },

  footer: {
    tagline: 'Gastronomía yucateca contemporánea + cocina de autores',
    visit: 'Visítanos',
    hours: 'Horario',
    contact: 'Contacto',
    follow: 'Síguenos',
    events: 'Eventos',
    nav: 'Explorar',
    menu: 'Menú',
    reserve: 'Agendar',
    official: 'Sitio oficial',
    credits:
      'Propuesta independiente de rediseño digital. No es el sitio oficial de Picheta: logotipo, fotografías, vídeo, menú y datos de contacto proceden de picheta.mx.',
    top: 'Volver arriba',
  },

  menu: {
    kicker: 'Menú',
    title: 'La propuesta gastronómica.',
    intro:
      'Gastronomía yucateca contemporánea, con chefs residentes y autores invitados que crean platillos únicos a partir de ingredientes locales.',
    categories: 'Categorías',
    by: 'Creación de',
    note: 'Precios en pesos mexicanos. Contenido del menú publicado en picheta.mx (octubre de 2026); puede cambiar sin previo aviso.',
    translationNote: '',
    official: 'Ver el menú en el sitio oficial',
    reserve: 'Agendar una mesa',
    back: 'Volver a la experiencia',
  },

  reserve: {
    kicker: 'Agendar',
    title: ['Tu mesa', 'en *Picheta.*'],
    lead: 'Las reservaciones de Picheta se realizan en OpenTable: eliges fecha, hora y número de personas, y la plataforma confirma tu mesa.',
    primary: 'Reservar en OpenTable',
    primaryNote: 'Sistema oficial de reservaciones de Picheta',
    alternatives: 'También puedes reservar',
    whatsapp: 'WhatsApp',
    whatsappAction: 'Escribir por WhatsApp',
    phone: 'Teléfono',
    phoneAction: 'Llamar',
    hours: 'Horario',
    events: 'Eventos y grupos',
    eventsText: 'Terraza para eventos y sala comedor privada para ocho personas.',
    form: {
      title: 'Prepara tu solicitud por WhatsApp',
      lead: 'Completa estos datos y abriremos WhatsApp con tu mensaje listo para enviar. Tu mesa queda confirmada solo cuando el restaurante te responda.',
      required: 'Obligatorio',
      optional: 'opcional',
      name: 'Nombre',
      date: 'Fecha',
      time: 'Hora',
      timeChooseDate: 'Elige primero una fecha',
      timePlaceholder: 'Selecciona una hora',
      guests: 'Personas',
      guestsOption: (n: number) => (n === 1 ? '1 persona' : `${n} personas`),
      guestsMore: 'Más de 10 (grupos)',
      phone: 'Teléfono',
      notes: 'Comentarios',
      notesPlaceholder: 'Ocasión especial, alergias, preferencias…',
      submit: 'Abrir WhatsApp con mi solicitud',
      errors: {
        summary: 'Revisa los campos marcados para continuar.',
        name: 'Escribe tu nombre.',
        date: 'Elige una fecha.',
        datePast: 'Elige una fecha a partir de hoy.',
        time: 'Elige una hora dentro del horario del restaurante.',
        guests: 'Indica cuántas personas.',
        phone: 'Revisa el número: solo dígitos, espacios, + o guiones.',
      },
      opened:
        'Abrimos WhatsApp en una pestaña nueva con tu solicitud. Envíala desde ahí: la reserva no está confirmada hasta que Picheta te responda.',
      openedFallback: 'Si no se abrió, usa este enlace',
      message: {
        greeting: 'Hola, Picheta. Me gustaría solicitar una reservación.',
        name: 'Nombre',
        date: 'Fecha',
        time: 'Hora',
        guests: 'Personas',
        phone: 'Teléfono',
        notes: 'Comentarios',
      },
    },
  },
};

export type Dict = typeof es;
