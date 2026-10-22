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
// galleria con gli screenshot del sito. image: anteprima dentro la bolla; url: dove porta il pulsante
// "Abrir la demo" nella galleria (vuoto = nessun pulsante: le demo non sono ancora pubblicate).
export const PROJECTS = [
  { id: 'urbaz', title: 'URBAZ' },
  { id: 'piedra-de-agua', title: 'Piedra de Agua' },
  { id: 'picheta', title: 'Picheta' },
  { id: 'pusceddu', title: 'Avv. Pusceddu' },
  { id: 'hacienda-teya', title: 'Hacienda Teya' },
  { id: 'antica-roma', title: 'Antica Roma' },
  { id: 'carnal', title: 'CARNAL' },
  { id: 'il-calabrese', title: 'Il Calabrese' },
].map((p) => ({ url: '', image: img(p.id), gallery: shots(p.id), ...p }));

// Contatti (i valori vuoti non vengono mostrati). DA COMPLETARE: whatsapp, numero con prefisso
// internazionale, es. '+52 999 123 4567'; il pulsante WhatsApp è sempre visibile (finché il numero
// manca, apre WhatsApp per scegliere a chi scrivere).
export const CONTACT_LINKS = {
  email: 'alessiapir@icloud.com',
  whatsapp: '',
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
      hintClick: 'Haz clic en una burbuja para ver el sitio.',
      hintTouch: 'Toca una burbuja para ver el sitio.',
      cta: 'Abrir la demo',
      items: {
        urbaz: ['Bienes raíces · Mapa 3D interactivo · Yucatán, México', 'La península de Yucatán en 3D: desarrollos inmobiliarios para explorar, búsqueda con filtros y rutas animadas.'],
        'piedra-de-agua': ['Hotel boutique · Mérida, México', 'Del agua al patio: un recorrido inmersivo por las habitaciones del hotel, en 3D procedural con fotos reales como materia.'],
        picheta: ['Restaurante · Cocina yucateca de autor · Mérida, México', 'La casa se vuelve el sitio: de la entrada a la terraza sobre Mérida, con menú, autores y reservas.'],
        pusceddu: ['Despacho de abogados · Cagliari, Italia', 'Un dron recorre un monumento de mármol inspirado en el cosmos de Dante: cada cornisa cuenta un área de práctica.'],
        'hacienda-teya': ['Hacienda · Restaurante desde 1683 · Yucatán, México', 'Una espina de henequén borda el nombre sobre el lino; después la historia, del Antes al Hoy, se vuelve el recorrido 3D.'],
        'antica-roma': ['Restaurante · Cocina romana · Mérida, México', 'Un avión despega del Coliseo y aterriza en Paseo de Montejo; sobre el mantel, los platos son los botones del sitio.'],
        carnal: ['Carnicería boutique · Mérida, México', 'Ocho escenas en una sola película con scroll: vitrinas, cortes, el privado y la reserva.'],
        'il-calabrese': ['Pizzería · Mérida, México', 'Del cielo de Calabria a la mesa familiar: menú, reservas y mapa son platos que se tocan.'],
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
      hintClick: 'Clicca su una bolla per vedere il sito.',
      hintTouch: 'Tocca una bolla per vedere il sito.',
      cta: 'Apri la demo',
      items: {
        urbaz: ['Real estate · Mappa 3D interattiva · Yucatán, Messico', 'La penisola dello Yucatán in 3D: progetti immobiliari esplorabili, ricerca con filtri e percorsi animati.'],
        'piedra-de-agua': ['Hotel boutique · Mérida, Messico', "Dall'acqua al patio: un percorso immersivo tra le stanze dell'hotel, in 3D procedurale con le foto vere come materia."],
        picheta: ["Ristorante · Cucina yucateca d'autore · Mérida, Messico", "La casa diventa il sito: dall'ingresso alla terrazza sopra Mérida, con menù, autori e prenotazione."],
        pusceddu: ['Studio legale · Cagliari, Italia', "Un drone esplora un monumento in marmo ispirato al cosmo di Dante: ogni cornice racconta un'area di attività."],
        'hacienda-teya': ['Hacienda · Ristorante dal 1683 · Yucatán, Messico', 'Una spina di henequén ricama il nome sul lino; poi la storia, da Antes a Hoy, diventa il percorso 3D.'],
        'antica-roma': ['Ristorante · Cucina romana · Mérida, Messico', 'Un aereo parte dal Colosseo e atterra sul Paseo de Montejo; sulla tovaglia, i piatti sono i pulsanti del sito.'],
        carnal: ['Macelleria boutique · Mérida, Messico', "Otto scene in un'unica pellicola a scroll: vetrine, tagli, il privato e la prenotazione."],
        'il-calabrese': ['Pizzeria · Mérida, Messico', 'Dal cielo della Calabria alla tavola di famiglia: menù, prenotazione e mappa sono piatti da toccare.'],
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
      hintClick: 'Click a bubble to see the site.',
      hintTouch: 'Tap a bubble to see the site.',
      cta: 'Open the demo',
      items: {
        urbaz: ['Real estate · Interactive 3D map · Yucatán, Mexico', 'The Yucatán peninsula in 3D: explorable real-estate developments, filtered search and animated routes.'],
        'piedra-de-agua': ['Boutique hotel · Mérida, Mexico', "From the water to the patio: an immersive walk through the hotel's rooms, in procedural 3D with real photos as material."],
        picheta: ['Restaurant · Yucatecan auteur cuisine · Mérida, Mexico', 'The house becomes the website: from the entrance to the terrace above Mérida, with menu, chefs and bookings.'],
        pusceddu: ['Law firm · Cagliari, Italy', "A drone explores a marble monument inspired by Dante's cosmos: each ledge tells a practice area."],
        'hacienda-teya': ['Hacienda · Restaurant since 1683 · Yucatán, Mexico', 'A henequen thorn embroiders the name on linen; then the story, from Then to Now, becomes the 3D journey.'],
        'antica-roma': ['Restaurant · Roman cuisine · Mérida, Mexico', "A plane takes off from the Colosseum and lands on Paseo de Montejo; on the tablecloth, the plates are the site's buttons."],
        carnal: ['Boutique butcher shop · Mérida, Mexico', 'Eight scenes in a single scrolling film: display cases, cuts, the private room and booking.'],
        'il-calabrese': ['Pizzeria · Mérida, Mexico', 'From the Calabrian sky to the family table: menu, booking and map are plates you can touch.'],
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
      hintClick: 'Clique em uma bolha para ver o site.',
      hintTouch: 'Toque em uma bolha para ver o site.',
      cta: 'Abrir a demo',
      items: {
        urbaz: ['Imóveis · Mapa 3D interativo · Yucatán, México', 'A península de Yucatán em 3D: empreendimentos imobiliários para explorar, busca com filtros e rotas animadas.'],
        'piedra-de-agua': ['Hotel boutique · Mérida, México', 'Da água ao pátio: um percurso imersivo pelos quartos do hotel, em 3D procedural com fotos reais como matéria.'],
        picheta: ['Restaurante · Cozinha yucateca autoral · Mérida, México', 'A casa vira o site: da entrada ao terraço sobre Mérida, com cardápio, chefs e reservas.'],
        pusceddu: ['Escritório de advocacia · Cagliari, Itália', 'Um drone explora um monumento de mármore inspirado no cosmos de Dante: cada cornija conta uma área de atuação.'],
        'hacienda-teya': ['Hacienda · Restaurante desde 1683 · Yucatán, México', 'Um espinho de henequém borda o nome no linho; depois a história, do Antes ao Hoje, vira o percurso 3D.'],
        'antica-roma': ['Restaurante · Cozinha romana · Mérida, México', 'Um avião decola do Coliseu e pousa no Paseo de Montejo; sobre a toalha, os pratos são os botões do site.'],
        carnal: ['Açougue boutique · Mérida, México', 'Oito cenas em um único filme com scroll: vitrines, cortes, o reservado e a reserva.'],
        'il-calabrese': ['Pizzaria · Mérida, México', 'Do céu da Calábria à mesa da família: cardápio, reservas e mapa são pratos para tocar.'],
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
