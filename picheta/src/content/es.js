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
    reservar: 'Reservar',
    bust: 'Busto de Gabriel Vicente Gahona, «Picheta»',
    back: 'Volver',
  },

  intro: {
    hint: 'Dibuja un círculo para entrar',
    enter: 'Entrar',
    enterKey: 'o pulsa Intro',
  },

  // La casa en 3D: sus espacios en el orden del recorrido.
  casa: {
    indexLabel: 'Salas de Picheta',
    next: 'Seguir',
    hintTouch: 'Desliza hacia arriba para recorrer la casa · a los lados para mirar',
    hintMouse: 'Desplázate para recorrer la casa · arrastra para mirar',
    subir: 'Subir a la terraza',
    rooms: [
      { name: 'La entrada', title: 'Bienvenidos a Picheta', sub: 'Cocina de autores en el corazón de Mérida', back: 'Volver a la entrada' },
      { name: 'El salón', title: 'El salón', sub: 'Una mesa larga bajo la bóveda de cuerdas', back: 'Volver al salón' },
      { name: 'El reservado', title: 'El reservado', sub: 'Piedra, luz baja y una mesa para celebrar', back: 'Volver al reservado' },
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
        { text: 'Gabriel Vicente Gahona, «Picheta» (Mérida, 1828–1899).', bust: true },
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
      lead: 'El arte culinario de Picheta se crea a partir de mentes creativas y talentosas, de personas apasionadas por la gastronomía yucateca.',
      people: [
        { name: 'Chef Vidal Elías', role: 'Micaela', photo: 'vidal' },
        { name: 'Chef Roberto Solís', role: 'Nectar', photo: 'roberto' },
      ],
      residents: {
        title: 'Chefs residentes',
        text: 'La comida, cuando se hace bien, es una obra de arte que llega a lo más profundo de nuestro ser.',
        people: [{ name: 'Chef Rodolfo Barrientos', role: 'Chef ejecutivo', photo: 'rodolfo' }],
      },
    },
    menu: {
      title: 'Menú',
      lead: 'El corazón de la gastronomía yucateca.',
      text: 'En el corazón del centro de Mérida, el restaurante Picheta ofrece la mejor gastronomía yucateca contemporánea, con chefs residentes y autores invitados, que se encargan de crear platillos únicos a partir de ingredientes locales. Déjate envolver por una experiencia sensorial completa, con sabores locales, un espacio lujoso y un panorama único sobre el centro histórico.',
      // El menú del sitio actual: platillo, precio y, cuando lo hay, su autor.
      courses: [
        {
          name: 'Entradas',
          dishes: [
            { text: 'Sopa tradicional de lima con pavo y tortilla tostada', price: 190, author: 'Chef David Cetina / La Tradición' },
            { text: 'Tostaditas de atún con limón, aguacate, pepino, cilantro, aceite de ajonjolí con fritura y cenizas de tortilla (6 piezas)', price: 240 },
            { text: 'Salbutes de plátano macho, con chucrut yucateco (col blanca, zanahoria, naranja agria), aguacate y brotes de cilantro', price: 210 },
            { text: 'Yucasotto con carne ahumada de Temozón y queso de bola', price: 250, author: 'Chef Alex Méndez / Astro' },
            { text: 'Carpaccio de pulpo con holandesa de xcatic, gel de naranja agria, sal de mar y pimienta', price: 310 },
            { text: 'Tacos de cerdo pelón servidos en tortilla de maíz azul, cremoso de aguacate, cebolla morada, cilantro y salsa habanera (3 piezas)', price: 280, author: 'Chef Luis Barocio' },
            { text: 'Coliflor al pastor con guacamole de la casa y salsa mexicana', price: 250, author: 'Geraldine Abraham / Rhuban' },
            { text: 'Guacamole con carne ahumada de Temozón y pico de gallo', price: 250 },
            { text: 'Pizzeta de langosta con mantequilla y ajo, salsa pomodoro fresca, jitomate deshidratado y albahaca', price: 320 },
            { text: 'Carpaccio de res con chaya y ceniza de romero y cacao, flor de sal, pimienta rosa y arúgula con vinagreta de lima', price: 250 },
            { text: 'Tacos de camarón con chilmole, xnipec, cremoso de aguacate y crujiente de arroz', price: 260 },
            { text: 'Tacos de rib eye en tortilla de recado negro, pimientos rostizados, salsa tatemada, esferificación de cilantro local', price: 380 },
          ],
        },
        {
          name: 'Platos fuertes',
          dishes: [
            { text: 'Pechuga de pollo glaseada con miel de habanero rellena de calabaza local, acompañada de ensalada de arándanos y semillas', price: 310 },
            { text: 'Hamburguesa de venado y res, champiñones rostizados, pimientos, mostaza rústica, alioli de xcatik en pan de achiote y papas cambray con ajo y mantequilla', price: 330 },
            { text: 'Fettuccine de pasta fresca con salsa de vino blanco y camarones salteados', price: 350 },
            { text: 'Jaiba suave tempura con chutney de manzana y ensalada de mango', price: 470 },
            { text: 'Ravioles de queso ricotta y longaniza de Valladolid en salsa bechamel de chile xcatik, acompañados de queso parmesano y pan campesino', price: 320 },
            { text: 'Ravioles de cangrejo moro con pasta bicolor, con cilantro local y salsa menier', price: 330 },
            { text: 'Risotto a la lima con picaña marinada con cerveza Ceiba o salmón (a elegir)', price: 450 },
            { text: 'Salmón en costra de pepita, risotto a la lima y ceniza de tortilla', price: 450, author: 'Universidad del Centro' },
            { text: 'Roulle de pescado con ceniza de tortilla, mantequilla noisette, ajo, almendra, calabaza local y zanahoria baby', price: 460 },
            { text: 'Cordero en pesto de hierbas, puré de camote aromatizado con hojas de plátano, salsa de calabaza frita, espuma de chile xcatic y crocante de pepita', price: 590, author: 'Talento Picheta / Universidad Vizcaya de las Américas' },
            { text: 'Filete de res madurado con mantequilla y romero, sofrito de champiñones trufados con chaya y puré de papa', price: 560 },
            { text: 'Ensalada fresca con guayaba, higo, pistache, jitomate cherry, aderezo de miel de la región con mostaza antigua', price: 220 },
          ],
        },
        {
          name: 'Postres',
          dishes: [
            { text: 'Tarta de pistache con crema pastelera de vainilla de Papantla', price: 250 },
            { text: 'Manjar de coco acompañado de una esponja de coco y helado de coco tostado', price: 195, author: 'Chef Miriam Peraza / Manjar Blanco' },
            { text: 'Fudge de chocolate con helado de flores y jamaica', price: 220 },
            { text: 'Pavlova rellena de gel de mango y crema diplomat de vainilla de Papantla', price: 210 },
            { text: 'Cenote de dulce de leche, helado de vainilla de Papantla y frutos rojos', price: 250 },
          ],
        },
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
