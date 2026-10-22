// Contenuti del sito: tutto il testo è qui, da modificare liberamente.
// I testi di VISIONE e SERVIZI sono una prima bozza; contatti e progetti segnati "DA COMPLETARE"
// vanno sostituiti con quelli veri.

// anteprime dei progetti: src/assets/projects/<id>.jpg (quadrate, ~1024 px)
const IMAGES = import.meta.glob('./assets/projects/*.{jpg,webp,png}', { eager: true, import: 'default', query: '?url' });
const img = (id) => IMAGES[`./assets/projects/${id}.jpg`] || IMAGES[`./assets/projects/${id}.webp`] || IMAGES[`./assets/projects/${id}.png`] || null;

export const BRAND = {
  name: 'ALESSIA STUDIO',
  tagline: 'Siti web 3D immersivi',
};

export const VISION = {
  label: 'Visione',
  title: 'Un sito può essere un luogo, non una pagina.',
  text:
    'Progettiamo spazi digitali da attraversare: architetture di luce, materia e movimento che raccontano ' +
    'un brand come una visita. Ogni scroll è un passo, ogni dettaglio è costruito per restare.',
  whatLabel: 'Cosa facciamo',
  what:
    'Siti web 3D su misura, dal concept alla messa online: veloci anche su telefono, curati come un progetto di architettura.',
  servicesLabel: 'Servizi',
  services: [
    'Direzione creativa e concept',
    'Siti web 3D immersivi (WebGL, Three.js)',
    'Storytelling a scroll',
    'Showroom e configuratori 3D',
    'Ottimizzazione per mobile e prestazioni',
    'Sviluppo, messa online e manutenzione',
  ],
};

// Ogni progetto diventa una bolla sott'acqua (le demo fatte finora). image: anteprima dentro la bolla;
// url: dove porta "Apri la demo" (vuoto = nessun pulsante: le demo non sono ancora pubblicate).
export const PROJECTS = [
  {
    id: 'urbaz',
    title: 'URBAZ',
    kind: 'Real estate · Mappa 3D interattiva',
    text: 'La penisola dello Yucatán in 3D: progetti immobiliari esplorabili, ricerca con filtri e percorsi animati.',
  },
  {
    id: 'piedra-de-agua',
    title: 'Piedra de Agua',
    kind: 'Hotel boutique · Mérida',
    text: "Dall'acqua al patio: un percorso immersivo tra le stanze dell'hotel, in 3D procedurale con le foto vere come materia.",
  },
  {
    id: 'picheta',
    title: 'Picheta',
    kind: 'Ristorante · Cucina yucateca de autores',
    text: "La casa diventa il sito: dall'ingresso alla terrazza sopra Mérida, con menù, autori e prenotazione.",
  },
  {
    id: 'pusceddu',
    title: 'Avv. Pusceddu',
    kind: 'Studio legale',
    text: "Un drone esplora un monumento in marmo ispirato al cosmo di Dante: ogni cornice racconta un'area di attività.",
  },
  {
    id: 'hacienda-teya',
    title: 'Hacienda Teya',
    kind: 'Hacienda · Ristorante dal 1683',
    text: 'Una spina di henequén ricama il nome sul lino; poi la storia, da Antes a Hoy, diventa il percorso 3D.',
  },
  {
    id: 'antica-roma',
    title: 'Antica Roma',
    kind: 'Ristorante · Cucina romana a Mérida',
    text: 'Un aereo parte dal Colosseo e atterra sul Paseo de Montejo; sulla tovaglia, i piatti sono i pulsanti del sito.',
  },
  {
    id: 'carnal',
    title: 'CARNAL',
    kind: 'Carnicería boutique · Mérida',
    text: "Otto scene in un'unica pellicola a scroll: vetrine, tagli, il privato e la prenotazione.",
  },
  {
    id: 'il-calabrese',
    title: 'Il Calabrese',
    kind: 'Pizzeria · Mérida',
    text: 'Dal cielo della Calabria alla tavola di famiglia: menù, prenotazione e mappa sono piatti da toccare.',
  },
].map((p) => ({ year: '', url: '', image: img(p.id), ...p }));

export const CONTACT = {
  label: 'Contattaci',
  title: 'Hai un luogo da costruire?',
  text: 'Raccontaci il progetto: ti rispondiamo con un\'idea, non con un preventivo standard.',
  // DA COMPLETARE: contatti veri (i valori vuoti non vengono mostrati)
  email: 'ciao@esempio.it',
  whatsapp: '',
  instagram: '',
};
