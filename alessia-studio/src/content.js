// Contenuti del sito, in quattro lingue: spagnolo (predefinita), italiano, inglese, portoghese.
// Tutto il testo è qui, da modificare liberamente. Visione e servizi sono una prima bozza (i servizi
// sono in tre gruppi: aggiungere o togliere voci non cambia altro);
// i contatti segnati "DA COMPLETARE" vanno sostituiti con quelli veri.

export const LANGS = [
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'it', label: 'IT', name: 'Italiano' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'pt', label: 'PT', name: 'Português' },
];
export const DEFAULT_LANG = 'es';

// Contatti: solo WhatsApp (niente email sul sito). whatsapp: numero con prefisso internazionale; il
// pulsante WhatsApp è sempre visibile e apre la chat con un messaggio pronto nella lingua scelta.
// instagram: vuoto = non mostrato.
export const CONTACT_LINKS = {
  whatsapp: '+39 346 175 8562',
  instagram: '',
};

export const BRAND_NAME = 'ALESSIA STUDIO';

const TEXT = {
  es: {
    tagline: 'Branding · Dirección creativa · Sitios web 3D',
    origin: ['Italia', 'México', 'Colombia', 'Worldwide'],
    vision: {
      label: 'Visión',
      title: 'Un sitio web puede ser un lugar, no una página.',
      text: 'Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.',
      world: 'Nacimos en Italia, trabajamos entre México y Colombia, con marcas de todo el mundo.',
    },
    services: {
      label: 'Qué hacemos',
      title: 'Marcas, experiencias y contenido.',
      text: 'Del concepto a la publicación, con un solo equipo: cada proyecto cuidado como una obra de arquitectura, y rápido también en el celular.',
      groups: [
        { label: 'Marca', items: ['Estrategia y posicionamiento', 'Branding e identidad visual', 'Naming y tono de voz', 'Dirección creativa y de arte'] },
        { label: 'Digital', items: ['Sitios web 3D inmersivos', 'Diseño UX/UI', 'Showrooms y configuradores 3D', 'Desarrollo, publicación y mantenimiento'] },
        { label: 'Contenido', items: ['Renders y animaciones 3D', 'Motion design y video', 'Contenido para redes sociales', 'Campañas y lanzamientos'] },
      ],
    },
    art: {
      label: 'Escena 3D en tiempo real',
      hintClick: 'Arrastra la escultura para girarla',
      hintTouch: 'Gira la escultura con el dedo',
      fish: { hintClick: 'Haz clic en los peces', hintTouch: 'Toca los peces' },
    },
    contact: {
      label: 'Contáctanos',
      title: '¿Tienes un lugar que construir?',
      text: 'Marca, sitio web o contenido: cuéntanos tu proyecto, estés donde estés. Trabajamos en remoto en español, italiano, inglés y portugués.',
      cta: 'Escríbenos por WhatsApp',
    },
    langLabel: 'Idioma',
    ui: {
      scroll: 'Scroll',
      // invito a giocare con ALESSIA STUDIO liquido (mouse / dito)
      liquidHover: "Pásale el cursor: es líquido",
      liquidTouch: "Tócalo: es líquido",
      whatsapp: 'Escríbenos por WhatsApp',
      whatsappMsg: 'Hola Alessia Studio, quiero contarles sobre un proyecto.',
    },
  },

  it: {
    tagline: 'Branding · Direzione creativa · Siti web 3D',
    origin: ['Italia', 'Messico', 'Colombia', 'Worldwide'],
    vision: {
      label: 'Visione',
      title: 'Un sito può essere un luogo, non una pagina.',
      text: 'Progettiamo brand e spazi digitali da attraversare: architetture di luce, materia e movimento che raccontano un brand come una visita. Ogni scroll è un passo, ogni dettaglio è costruito per restare.',
      world: 'Nati in Italia, lavoriamo tra Messico e Colombia, con brand di tutto il mondo.',
    },
    services: {
      label: 'Cosa facciamo',
      title: 'Brand, esperienze e contenuti.',
      text: "Dal concept alla messa online, con un solo team: ogni progetto curato come un'opera di architettura, e veloce anche su telefono.",
      groups: [
        { label: 'Brand', items: ['Strategia e posizionamento', 'Branding e identità visiva', 'Naming e tono di voce', 'Direzione creativa e art direction'] },
        { label: 'Digitale', items: ['Siti web 3D immersivi', 'Design UX/UI', 'Showroom e configuratori 3D', 'Sviluppo, messa online e manutenzione'] },
        { label: 'Contenuti', items: ['Render e animazioni 3D', 'Motion design e video', 'Contenuti per i social', 'Campagne e lanci'] },
      ],
    },
    art: {
      label: 'Scena 3D in tempo reale',
      hintClick: 'Trascina la scultura per ruotarla',
      hintTouch: 'Ruota la scultura con il dito',
      fish: { hintClick: 'Clicca sui pesci', hintTouch: 'Tocca i pesci' },
    },
    contact: {
      label: 'Contattaci',
      title: 'Hai un luogo da costruire?',
      text: 'Brand, sito o contenuti: raccontaci il progetto, ovunque tu sia. Lavoriamo da remoto in italiano, spagnolo, inglese e portoghese.',
      cta: 'Scrivici su WhatsApp',
    },
    langLabel: 'Lingua',
    ui: {
      scroll: 'Scroll',
      // invito a giocare con ALESSIA STUDIO liquido (mouse / dito)
      liquidHover: "Passaci sopra: è liquido",
      liquidTouch: "Toccalo: è liquido",
      whatsapp: 'Scrivici su WhatsApp',
      whatsappMsg: 'Ciao Alessia Studio, vorrei raccontarvi un progetto.',
    },
  },

  en: {
    tagline: 'Branding · Creative direction · 3D websites',
    origin: ['Italy', 'Mexico', 'Colombia', 'Worldwide'],
    vision: {
      label: 'Vision',
      title: 'A website can be a place, not a page.',
      text: 'We design brands and digital spaces you walk through: architectures of light, matter and motion that tell a brand like a visit. Every scroll is a step; every detail is built to last.',
      world: 'Born in Italy, working between Mexico and Colombia with brands all over the world.',
    },
    services: {
      label: 'What we do',
      title: 'Brands, experiences and content.',
      text: 'From concept to launch, with one team: every project crafted like a work of architecture, and fast on phones too.',
      groups: [
        { label: 'Brand', items: ['Strategy and positioning', 'Branding and visual identity', 'Naming and tone of voice', 'Creative and art direction'] },
        { label: 'Digital', items: ['Immersive 3D websites', 'UX/UI design', '3D showrooms and configurators', 'Development, launch and maintenance'] },
        { label: 'Content', items: ['3D renders and animation', 'Motion design and video', 'Social media content', 'Campaigns and launches'] },
      ],
    },
    art: {
      label: 'Real-time 3D scene',
      hintClick: 'Drag the sculpture to turn it',
      hintTouch: 'Turn the sculpture with your finger',
      fish: { hintClick: 'Click the fish', hintTouch: 'Tap the fish' },
    },
    contact: {
      label: 'Contact us',
      title: 'Got a place to build?',
      text: 'Brand, website or content: tell us about your project, wherever you are. We work remotely in English, Spanish, Italian and Portuguese.',
      cta: 'Message us on WhatsApp',
    },
    langLabel: 'Language',
    ui: {
      scroll: 'Scroll',
      // invito a giocare con ALESSIA STUDIO liquido (mouse / dito)
      liquidHover: "Hover over it: it's liquid",
      liquidTouch: "Touch it: it's liquid",
      whatsapp: 'Message us on WhatsApp',
      whatsappMsg: "Hi Alessia Studio, I'd like to tell you about a project.",
    },
  },

  pt: {
    tagline: 'Branding · Direção criativa · Sites 3D',
    origin: ['Itália', 'México', 'Colômbia', 'Worldwide'],
    vision: {
      label: 'Visão',
      title: 'Um site pode ser um lugar, não uma página.',
      text: 'Projetamos marcas e espaços digitais para percorrer: arquiteturas de luz, matéria e movimento que contam uma marca como uma visita. Cada scroll é um passo; cada detalhe é feito para ficar.',
      world: 'Nascemos na Itália, trabalhamos entre o México e a Colômbia, com marcas do mundo todo.',
    },
    services: {
      label: 'O que fazemos',
      title: 'Marcas, experiências e conteúdo.',
      text: 'Do conceito à publicação, com uma só equipe: cada projeto cuidado como uma obra de arquitetura, e rápido também no celular.',
      groups: [
        { label: 'Marca', items: ['Estratégia e posicionamento', 'Branding e identidade visual', 'Naming e tom de voz', 'Direção criativa e de arte'] },
        { label: 'Digital', items: ['Sites 3D imersivos', 'Design UX/UI', 'Showrooms e configuradores 3D', 'Desenvolvimento, publicação e manutenção'] },
        { label: 'Conteúdo', items: ['Renders e animações 3D', 'Motion design e vídeo', 'Conteúdo para redes sociais', 'Campanhas e lançamentos'] },
      ],
    },
    art: {
      label: 'Cena 3D em tempo real',
      hintClick: 'Arraste a escultura para girá-la',
      hintTouch: 'Gire a escultura com o dedo',
      fish: { hintClick: 'Clique nos peixes', hintTouch: 'Toque nos peixes' },
    },
    contact: {
      label: 'Fale conosco',
      title: 'Tem um lugar para construir?',
      text: 'Marca, site ou conteúdo: conte-nos sobre o seu projeto, onde quer que você esteja. Trabalhamos à distância em português, espanhol, italiano e inglês.',
      cta: 'Fale conosco no WhatsApp',
    },
    langLabel: 'Idioma',
    ui: {
      scroll: 'Scroll',
      // invito a giocare con ALESSIA STUDIO liquido (mouse / dito)
      liquidHover: "Passe o cursor: é líquido",
      liquidTouch: "Toque: é líquido",
      whatsapp: 'Fale conosco no WhatsApp',
      whatsappMsg: 'Olá Alessia Studio, quero contar sobre um projeto.',
    },
  },
};

export function getText(lang) {
  return TEXT[lang] || TEXT[DEFAULT_LANG];
}

// link alla chat WhatsApp con un messaggio pronto
export function waLink(msg) {
  const n = String(CONTACT_LINKS.whatsapp || '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
