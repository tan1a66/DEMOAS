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

// anteprime dei progetti: src/assets/projects/<id>.jpg (quadrate, ~768 px)
const IMAGES = import.meta.glob('./assets/projects/*.{jpg,webp,png}', { eager: true, import: 'default', query: '?url' });
const img = (id) => IMAGES[`./assets/projects/${id}.jpg`] || IMAGES[`./assets/projects/${id}.webp`] || IMAGES[`./assets/projects/${id}.png`] || null;

// screenshot delle demo per la galleria: public/gallery/<id>/<nn>-{1280,720,320}.webp
// (elenco generato da tools/gallery.mjs; si scaricano solo aprendo la galleria)
import GALLERY from './assets/gallery.json';
const shots = (id) => (GALLERY[id] || []).map((n) => {
  const base = `${import.meta.env.BASE_URL}gallery/${id}/${n}`;
  return { full: `${base}-1280.webp`, mid: `${base}-720.webp`, thumb: `${base}-320.webp` };
});

// Ogni progetto diventa una bolla sott'acqua (le demo fatte finora). Toccando la bolla si apre la
// galleria con le immagini del sito. image: anteprima dentro la bolla; url: dove porta il pulsante
// "Abrir la demo" nella galleria (vuoto = nessun pulsante: le demo non sono ancora pubblicate).
// Niente nomi di clienti, marchi o persone (nessuna autorizzazione): il titolo di ogni bolla è la
// categoria, tradotta in projects.items; le immagini sono ritagli delle scene 3D senza testi né loghi.
export const PROJECTS = [
  { id: 'inmobiliaria' },
  { id: 'hotel' },
  { id: 'restaurante' },
  { id: 'abogados' },
  { id: 'hacienda' },
  { id: 'cocina-italiana' },
  { id: 'carniceria' },
  { id: 'pizzeria' },
].map((p) => ({ url: '', image: img(p.id), gallery: shots(p.id), ...p }));

// Contatti (i valori vuoti non vengono mostrati). whatsapp: numero con prefisso internazionale; il
// pulsante WhatsApp è sempre visibile e apre la chat con un messaggio pronto nella lingua scelta.
export const CONTACT_LINKS = {
  email: 'alessiapir@icloud.com',
  whatsapp: '+39 346 175 8562',
  instagram: '',
};

export const BRAND_NAME = 'ALESSIA STUDIO';

const TEXT = {
  es: {
    tagline: 'Branding · Dirección creativa · Sitios web 3D',
    origin: ['Desde Italia', 'Con base en México', 'Trabajamos en todo el mundo'],
    vision: {
      label: 'Visión',
      title: 'Un sitio web puede ser un lugar, no una página.',
      text: 'Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.',
      world: 'Nacimos en Italia, vivimos en México y trabajamos en remoto con marcas de todo el mundo.',
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
    projects: {
      label: 'Proyectos',
      title: 'Cada burbuja es un proyecto.',
      hintClick: 'Haz clic en la burbuja para verlo · scroll para la siguiente.',
      hintTouch: 'Toca la burbuja para verlo · desliza para la siguiente.',
      open: 'Ver el proyecto',
      cta: 'Abrir la demo',
      // [titolo della bolla, tipo, descrizione]
      items: {
        inmobiliaria: ['Bienes raíces', 'Mapa 3D interactivo', 'Una península en 3D: desarrollos inmobiliarios para explorar, búsqueda con filtros y rutas animadas.'],
        hotel: ['Hotel boutique', 'Casona histórica', 'Del agua al patio: un recorrido inmersivo por la casona y sus habitaciones, en 3D con fotos reales como materia.'],
        restaurante: ['Restaurante de autor', 'Cocina regional', 'La casa se vuelve el sitio: de la entrada a la terraza, con menú, autores y reservas.'],
        abogados: ['Despacho de abogados', 'Sitio profesional', 'Un monumento de mármol inspirado en el cosmos de Dante: cada cornisa cuenta un área de práctica.'],
        hacienda: ['Hacienda', 'Restaurante y eventos', 'Una espina de henequén borda sobre el lino; después la historia de la casa, de ayer a hoy, se vuelve el recorrido 3D.'],
        'cocina-italiana': ['Restaurante italiano', 'Cocina romana', 'Un avión despega del Coliseo y aterriza en tu ciudad; sobre el mantel, los platos son los botones del sitio.'],
        carniceria: ['Carnicería boutique', 'Cortes selectos', 'Ocho escenas en una sola película con scroll: vitrinas, cortes, el privado y la reserva.'],
        pizzeria: ['Pizzería', 'Cocina del sur de Italia', 'Del cielo del sur de Italia a la mesa familiar: menú, reservas y mapa son platos que se tocan.'],
      },
    },
    contact: {
      label: 'Contáctanos',
      title: '¿Tienes un lugar que construir?',
      text: 'Marca, sitio web o contenido: cuéntanos tu proyecto, estés donde estés. Trabajamos en remoto en español, italiano, inglés y portugués.',
    },
    langLabel: 'Idioma',
    ui: {
      scroll: 'Scroll',
      whatsapp: 'Escríbenos por WhatsApp',
      whatsappMsg: 'Hola Alessia Studio, quiero contarles sobre un proyecto.',
      open: 'Ver el proyecto',
      close: 'Cerrar',
      prev: 'Imagen anterior',
      next: 'Imagen siguiente',
      prevProject: 'Proyecto anterior',
      nextProject: 'Proyecto siguiente',
    },
  },

  it: {
    tagline: 'Branding · Direzione creativa · Siti web 3D',
    origin: ["Dall'Italia", 'Base in Messico', 'Lavoriamo in tutto il mondo'],
    vision: {
      label: 'Visione',
      title: 'Un sito può essere un luogo, non una pagina.',
      text: 'Progettiamo brand e spazi digitali da attraversare: architetture di luce, materia e movimento che raccontano un brand come una visita. Ogni scroll è un passo, ogni dettaglio è costruito per restare.',
      world: 'Nati in Italia, di base in Messico, lavoriamo da remoto con brand di tutto il mondo.',
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
    projects: {
      label: 'Progetti',
      title: 'Ogni bolla è un progetto.',
      hintClick: 'Clicca sulla bolla per vederlo · scroll per la successiva.',
      hintTouch: 'Tocca la bolla per vederlo · scorri per la successiva.',
      open: 'Vedi il progetto',
      cta: 'Apri la demo',
      items: {
        inmobiliaria: ['Immobiliare', 'Mappa 3D interattiva', 'Una penisola in 3D: progetti immobiliari esplorabili, ricerca con filtri e percorsi animati.'],
        hotel: ['Hotel boutique', 'Casona storica', "Dall'acqua al patio: un percorso immersivo tra la casona e le sue stanze, in 3D con le foto vere come materia."],
        restaurante: ["Ristorante d'autore", 'Cucina regionale', "La casa diventa il sito: dall'ingresso alla terrazza, con menù, autori e prenotazione."],
        abogados: ['Studio legale', 'Sito professionale', "Un monumento in marmo ispirato al cosmo di Dante: ogni cornice racconta un'area di attività."],
        hacienda: ['Hacienda', 'Ristorante ed eventi', 'Una spina di henequén ricama sul lino; poi la storia della casa, da ieri a oggi, diventa il percorso 3D.'],
        'cocina-italiana': ['Ristorante italiano', 'Cucina romana', 'Un aereo parte dal Colosseo e atterra nella tua città; sulla tovaglia, i piatti sono i pulsanti del sito.'],
        carniceria: ['Macelleria boutique', 'Tagli selezionati', "Otto scene in un'unica pellicola a scroll: vetrine, tagli, il privato e la prenotazione."],
        pizzeria: ['Pizzeria', 'Cucina del Sud Italia', 'Dal cielo del Sud Italia alla tavola di famiglia: menù, prenotazione e mappa sono piatti da toccare.'],
      },
    },
    contact: {
      label: 'Contattaci',
      title: 'Hai un luogo da costruire?',
      text: 'Brand, sito o contenuti: raccontaci il progetto, ovunque tu sia. Lavoriamo da remoto in italiano, spagnolo, inglese e portoghese.',
    },
    langLabel: 'Lingua',
    ui: {
      scroll: 'Scroll',
      whatsapp: 'Scrivici su WhatsApp',
      whatsappMsg: 'Ciao Alessia Studio, vorrei raccontarvi un progetto.',
      open: 'Apri il progetto',
      close: 'Chiudi',
      prev: 'Immagine precedente',
      next: 'Immagine successiva',
      prevProject: 'Progetto precedente',
      nextProject: 'Progetto successivo',
    },
  },

  en: {
    tagline: 'Branding · Creative direction · 3D websites',
    origin: ['From Italy', 'Based in Mexico', 'Working worldwide'],
    vision: {
      label: 'Vision',
      title: 'A website can be a place, not a page.',
      text: 'We design brands and digital spaces you walk through: architectures of light, matter and motion that tell a brand like a visit. Every scroll is a step; every detail is built to last.',
      world: 'Born in Italy, based in Mexico, working remotely with brands all over the world.',
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
    projects: {
      label: 'Projects',
      title: 'Every bubble is a project.',
      hintClick: 'Click the bubble to see it · scroll for the next one.',
      hintTouch: 'Tap the bubble to see it · swipe for the next one.',
      open: 'See the project',
      cta: 'Open the demo',
      items: {
        inmobiliaria: ['Real estate', 'Interactive 3D map', 'A peninsula in 3D: explorable real-estate developments, filtered search and animated routes.'],
        hotel: ['Boutique hotel', 'Historic townhouse', 'From the water to the patio: an immersive walk through the house and its rooms, in 3D with real photos as material.'],
        restaurante: ['Signature restaurant', 'Regional cuisine', 'The house becomes the website: from the entrance to the terrace, with menu, chefs and bookings.'],
        abogados: ['Law firm', 'Professional website', "A marble monument inspired by Dante's cosmos: each ledge tells a practice area."],
        hacienda: ['Hacienda', 'Restaurant and events', "A henequen thorn embroiders on linen; then the house's story, from past to present, becomes the 3D journey."],
        'cocina-italiana': ['Italian restaurant', 'Roman cuisine', "A plane takes off from the Colosseum and lands in your city; on the tablecloth, the plates are the site's buttons."],
        carniceria: ['Boutique butcher', 'Select cuts', 'Eight scenes in a single scrolling film: display cases, cuts, the private room and booking.'],
        pizzeria: ['Pizzeria', 'Southern Italian cuisine', 'From the southern Italian sky to the family table: menu, booking and map are plates you can touch.'],
      },
    },
    contact: {
      label: 'Contact us',
      title: 'Got a place to build?',
      text: 'Brand, website or content: tell us about your project, wherever you are. We work remotely in English, Spanish, Italian and Portuguese.',
    },
    langLabel: 'Language',
    ui: {
      scroll: 'Scroll',
      whatsapp: 'Message us on WhatsApp',
      whatsappMsg: "Hi Alessia Studio, I'd like to tell you about a project.",
      open: 'Open the project',
      close: 'Close',
      prev: 'Previous image',
      next: 'Next image',
      prevProject: 'Previous project',
      nextProject: 'Next project',
    },
  },

  pt: {
    tagline: 'Branding · Direção criativa · Sites 3D',
    origin: ['Da Itália', 'Com base no México', 'Trabalhando no mundo todo'],
    vision: {
      label: 'Visão',
      title: 'Um site pode ser um lugar, não uma página.',
      text: 'Projetamos marcas e espaços digitais para percorrer: arquiteturas de luz, matéria e movimento que contam uma marca como uma visita. Cada scroll é um passo; cada detalhe é feito para ficar.',
      world: 'Nascemos na Itália, moramos no México e trabalhamos à distância com marcas do mundo todo.',
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
    projects: {
      label: 'Projetos',
      title: 'Cada bolha é um projeto.',
      hintClick: 'Clique na bolha para ver · role para a próxima.',
      hintTouch: 'Toque na bolha para ver · deslize para a próxima.',
      open: 'Ver o projeto',
      cta: 'Abrir a demo',
      items: {
        inmobiliaria: ['Imobiliária', 'Mapa 3D interativo', 'Uma península em 3D: empreendimentos imobiliários para explorar, busca com filtros e rotas animadas.'],
        hotel: ['Hotel boutique', 'Casarão histórico', 'Da água ao pátio: um percurso imersivo pelo casarão e seus quartos, em 3D com fotos reais como matéria.'],
        restaurante: ['Restaurante autoral', 'Cozinha regional', 'A casa vira o site: da entrada ao terraço, com cardápio, chefs e reservas.'],
        abogados: ['Escritório de advocacia', 'Site profissional', 'Um monumento de mármore inspirado no cosmos de Dante: cada cornija conta uma área de atuação.'],
        hacienda: ['Hacienda', 'Restaurante e eventos', 'Um espinho de henequém borda no linho; depois a história da casa, de ontem a hoje, vira o percurso 3D.'],
        'cocina-italiana': ['Restaurante italiano', 'Cozinha romana', 'Um avião decola do Coliseu e pousa na sua cidade; sobre a toalha, os pratos são os botões do site.'],
        carniceria: ['Açougue boutique', 'Cortes selecionados', 'Oito cenas em um único filme com scroll: vitrines, cortes, o reservado e a reserva.'],
        pizzeria: ['Pizzaria', 'Cozinha do sul da Itália', 'Do céu do sul da Itália à mesa da família: cardápio, reservas e mapa são pratos para tocar.'],
      },
    },
    contact: {
      label: 'Fale conosco',
      title: 'Tem um lugar para construir?',
      text: 'Marca, site ou conteúdo: conte-nos sobre o seu projeto, onde quer que você esteja. Trabalhamos à distância em português, espanhol, italiano e inglês.',
    },
    langLabel: 'Idioma',
    ui: {
      scroll: 'Scroll',
      whatsapp: 'Fale conosco no WhatsApp',
      whatsappMsg: 'Olá Alessia Studio, quero contar sobre um projeto.',
      open: 'Ver o projeto',
      close: 'Fechar',
      prev: 'Imagem anterior',
      next: 'Próxima imagem',
      prevProject: 'Projeto anterior',
      nextProject: 'Próximo projeto',
    },
  },
};

export function getText(lang) {
  return TEXT[lang] || TEXT[DEFAULT_LANG];
}

// [titolo, tipo, descrizione] di un progetto nella lingua scelta
export const projectText = (lang, id) => getText(lang).projects.items[id] || [id, '', ''];
