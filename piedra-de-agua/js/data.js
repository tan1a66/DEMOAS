// Contenidos de la demo (habitaciones, servicios, experiencias) en español e inglés.

export const ROOMS = [
  {
    id: 'presidencial',
    name: { es: 'Suite Presidencial', en: 'Presidential Suite' },
    card: { es: 'Suite Presidencial', en: 'Presidential Suite' },
    m2: 60,
    beds: { es: '1 cama King', en: '1 King bed' },
    bedsShort: { es: 'King', en: 'King' },
    guests: { es: '2 adultos y 1 niño', en: '2 adults and 1 child' },
    text: {
      es: '60 m² con doble balcón y vista parcial a la plaza principal. Sala de estar, cama King con ropa de cama seleccionada, Smart TV de 65 pulgadas y baño con regadera y tina de relajación. Amenidades de lujo y batas de baño.',
      en: '60 m² with a double balcony and partial view of the main square. Living room, King bed with selected linens, 65-inch Smart TV and a bathroom with shower and soaking tub. Luxury amenities and bathrobes.',
    },
    photo: ['hab-presidencial.jpg'],
    plan: { w: 10, d: 6 },
  },
  {
    id: 'master',
    name: { es: 'Suite Master Studio', en: 'Master Studio Suite' },
    card: { es: 'Master Studio', en: 'Master Studio' },
    m2: 35,
    beds: { es: '1 cama King y sofá cama', en: '1 King bed and sofa bed' },
    bedsShort: { es: 'King y sofá cama', en: 'King + sofa bed' },
    guests: { es: '2 adultos y 1 niño', en: '2 adults and 1 child' },
    text: {
      es: 'Suite de 35 m² con muro de piedra original y objetos hechos por artesanos de la región. Cama King, sala recibidor y baño espacioso con regadera tipo lluvia y doble lavabo, pantuflas y batas de baño.',
      en: 'A 35 m² suite with an original stone wall and objects made by local artisans. King bed, sitting area and a spacious bathroom with rain shower and double sink, slippers and bathrobes.',
    },
    photo: ['hab-master-studio.jpg'],
    plan: { w: 7, d: 5 },
  },
  {
    id: 'doble',
    name: { es: 'Premium Doble', en: 'Premium Double' },
    card: { es: 'Premium Doble', en: 'Premium Double' },
    m2: 25,
    beds: { es: '2 camas Matrimoniales', en: '2 Double beds' },
    bedsShort: { es: '2 Matrimoniales', en: '2 Double' },
    guests: { es: '2 adultos y 2 niños', en: '2 adults and 2 children' },
    text: {
      es: 'Habitación de 25 m² con dos camas matrimoniales, ideal para familias. Aire acondicionado, TV de pantalla plana, servibar y baño con amenidades orgánicas.',
      en: 'A 25 m² room with two double beds, ideal for families. Air conditioning, flat-screen TV, minibar and a bathroom with organic amenities.',
    },
    photo: ['hab-premium-doble.jpg'],
    plan: { w: 5, d: 5 },
  },
  {
    id: 'premium',
    name: { es: 'Premium', en: 'Premium' },
    card: { es: 'Premium', en: 'Premium' },
    m2: 16,
    beds: { es: '1 cama Queen', en: '1 Queen bed' },
    bedsShort: { es: 'Queen', en: 'Queen' },
    guests: { es: '2 adultos', en: '2 adults' },
    text: {
      es: 'Habitación de 16 m² con balcón y vista parcial al centro histórico y a la calle principal. Aire acondicionado, TV de pantalla plana, servibar y baño con ducha y amenidades orgánicas.',
      en: 'A 16 m² room with a balcony and partial view of the historic centre and the main street. Air conditioning, flat-screen TV, minibar and a bathroom with shower and organic amenities.',
    },
    photo: ['hab-premium.jpg'],
    plan: { w: 4, d: 4 },
  },
];

export const SERVICES = [
  {
    id: 'restaurante',
    name: { es: 'Restaurante', en: 'Restaurant' },
    text: {
      es: 'Una propuesta gastronómica que fusiona sabores locales con una experiencia sofisticada.',
      en: 'A culinary proposal that blends local flavours with a sophisticated experience.',
    },
    photo: ['restaurante.jpg'],
  },
  {
    id: 'terraza',
    name: { es: 'Terraza y alberca', en: 'Terrace & pool' },
    text: {
      es: 'Alberca en la azotea entre vegetación tropical, con la torre de la Catedral en el horizonte.',
      en: 'A rooftop pool among tropical greenery, with the Cathedral tower on the horizon.',
    },
    photo: ['terraza.jpg', 'terraza-bodas.jpg'],
  },
  {
    id: 'spa',
    name: { es: 'Spa', en: 'Spa' },
    text: {
      es: 'Relájate y renueva cuerpo y mente en un espacio diseñado para el descanso.',
      en: 'Relax and renew body and mind in a space designed for rest.',
    },
    photo: ['spa.jpg'],
  },
  {
    id: 'daypass',
    name: { es: 'Day Pass', en: 'Day Pass' },
    text: {
      es: 'Disfruta de un día de descanso y desconexión en el corazón del centro histórico de Mérida.',
      en: 'Enjoy a day of rest and disconnection in the heart of Mérida’s historic centre.',
    },
    photo: ['day-pass.jpg', 'terraza-bodas.jpg'],
  },
  {
    id: 'bodas',
    name: { es: 'Bodas y Eventos', en: 'Weddings & Events' },
    text: {
      es: 'Celebra momentos inolvidables en un escenario lleno de historia y elegancia.',
      en: 'Celebrate unforgettable moments in a setting full of history and elegance.',
    },
    photo: ['terraza-bodas.jpg'],
    scene3d: true,
  },
  {
    id: 'escapada',
    name: { es: 'Escapada Romántica', en: 'Romantic Getaway' },
    text: {
      es: 'Una experiencia íntima y elegante diseñada para celebrar el amor en un entorno histórico único en el centro de Mérida.',
      en: 'An intimate, elegant experience designed to celebrate love in a unique historic setting in downtown Mérida.',
    },
    photo: ['escapada-romantica.jpg', 'hab-presidencial.jpg'],
  },
];

// Coordenadas geográficas reales (aprox.); duraciones de tour orientativas.
export const PLACES = [
  {
    id: 'chichen', kind: 'pyramid', lat: 20.6843, lng: -88.5678,
    name: { es: 'Chichén Itzá', en: 'Chichén Itzá' },
    km: 120, drive: { es: '1 h 45 min', en: '1 h 45 min' }, tour: { es: 'Día completo · 8–9 h', en: 'Full day · 8–9 h' },
    text: {
      es: 'Una de las Nuevas Siete Maravillas del Mundo: la pirámide de Kukulcán, el Juego de Pelota y el Cenote Sagrado.',
      en: 'One of the New Seven Wonders of the World: the Kukulcán pyramid, the Ball Court and the Sacred Cenote.',
    },
    // una foto propia en images/exp-chichen-itza.jpg tiene prioridad; si no, Wikimedia Commons
    photo: ['exp-chichen-itza.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Chichen_Itza_3.jpg/1280px-Chichen_Itza_3.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Chichen_Itza_3.jpg?width=1280'],
    credit: { by: 'Daniel Schwen', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Chichen_Itza_3.jpg' },
  },
  {
    id: 'uxmal', kind: 'pyramid-round', lat: 20.3594, lng: -89.7713,
    name: { es: 'Uxmal', en: 'Uxmal' },
    km: 80, drive: { es: '1 h 10 min', en: '1 h 10 min' }, tour: { es: 'Medio día · 6 h', en: 'Half day · 6 h' },
    text: {
      es: 'La joya del estilo Puuc: la Pirámide del Adivino y el Cuadrángulo de las Monjas, con fachadas de mosaico de piedra.',
      en: 'The jewel of the Puuc style: the Pyramid of the Magician and the Nunnery Quadrangle, with stone-mosaic façades.',
    },
    // una foto propia en images/exp-uxmal.jpg tiene prioridad; si no, Wikimedia Commons
    photo: ['exp-uxmal.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pyramid_of_the_Magician_(8264902976).jpg/1280px-Pyramid_of_the_Magician_(8264902976).jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Pyramid_of_the_Magician_(8264902976).jpg?width=1280'],
    credit: { by: 'Rob Young', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:Pyramid_of_the_Magician_(8264902976).jpg' },
  },
  {
    id: 'cenotes', kind: 'cenote', lat: 20.73, lng: -89.28,
    name: { es: 'Cenotes', en: 'Cenotes' },
    km: 50, drive: { es: '1 h', en: '1 h' }, tour: { es: 'Medio día · 5 h', en: 'Half day · 5 h' },
    text: {
      es: 'Nada en agua turquesa bajo bóvedas de piedra caliza, entre raíces colgantes y haces de luz que entran desde lo alto.',
      en: 'Swim in turquoise water beneath limestone vaults, among hanging roots and shafts of light from above.',
    },
    // una foto propia en images/exp-cenotes.jpg tiene prioridad; si no, Wikimedia Commons
    photo: ['exp-cenotes.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Cenote_Suytun_2009_06.jpg/1280px-Cenote_Suytun_2009_06.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Cenote_Suytun_2009_06.jpg?width=1280'],
    credit: { by: 'Daniel Lobo', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:Cenote_Suytun_2009_06.jpg' },
  },
  {
    id: 'celestun', kind: 'flamingo', lat: 20.8597, lng: -90.3997,
    name: { es: 'Celestún', en: 'Celestún' },
    km: 95, drive: { es: '1 h 30 min', en: '1 h 30 min' }, tour: { es: 'Día completo · 7 h', en: 'Full day · 7 h' },
    text: {
      es: 'Reserva de la Biosfera donde miles de flamencos rosados se alimentan en la ría, entre manglares.',
      en: 'A Biosphere Reserve where thousands of pink flamingos feed in the estuary among mangroves.',
    },
    // una foto propia en images/exp-celestun.jpg tiene prioridad; si no, Wikimedia Commons
    photo: ['exp-celestun.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/FLAMINGOS.jpg/1280px-FLAMINGOS.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/FLAMINGOS.jpg?width=1280'],
    credit: { by: 'José Carlos Bernabé Corona Campillo', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:FLAMINGOS.jpg' },
  },
  {
    id: 'izamal', kind: 'convent', lat: 20.9314, lng: -89.0178,
    name: { es: 'Izamal', en: 'Izamal' },
    km: 70, drive: { es: '1 h', en: '1 h' }, tour: { es: 'Medio día · 5 h', en: 'Half day · 5 h' },
    text: {
      es: 'La Ciudad Amarilla: un convento franciscano del siglo XVI levantado sobre una pirámide maya.',
      en: 'The Yellow City: a 16th-century Franciscan convent built on top of a Maya pyramid.',
    },
    // una foto propia en images/exp-izamal.jpg tiene prioridad; si no, Wikimedia Commons
    photo: ['exp-izamal.jpg', 'https://upload.wikimedia.org/wikipedia/commons/8/83/Izamal.JPG', 'https://commons.wikimedia.org/wiki/Special:FilePath/Izamal.JPG'],
    credit: { by: 'RichardMarcJ', license: { es: 'Dominio público', en: 'Public domain' }, url: 'https://commons.wikimedia.org/wiki/File:Izamal.JPG' },
  },
];

export const MERIDA = { lat: 20.9674, lng: -89.6237 };

// Ejemplos de activaciones dentro del hotel (propuesta de contenidos).
export const ACTIVATIONS = [
  { es: 'Clase de cocina yucateca', en: 'Yucatecan cooking class' },
  { es: 'Taller de henequén con artesanas', en: 'Henequen workshop with artisans' },
  { es: 'Recorrido histórico por la casona', en: 'Historic tour of the casona' },
  { es: 'Noche de trova yucateca en el patio', en: 'Yucatecan trova night in the courtyard' },
  { es: 'Yoga al amanecer en la terraza', en: 'Sunrise yoga on the terrace' },
];
