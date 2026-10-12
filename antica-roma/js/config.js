/* Antica Roma — Mérida · configurazione modificabile senza toccare il resto del codice */
window.AR = window.AR || {};
AR.config = {
  // WhatsApp per "Reserva ahora" — SEGNAPOSTO: sostituire con il numero reale (formato internazionale, solo cifre)
  whatsapp: { number: '5219990000000', display: '+52 999 000 0000' },
  // Indirizzo e orari — SEGNAPOSTO da confermare con il ristorante
  address: { line1: 'Mérida, Yucatán', line2: 'México', mapsQuery: 'Antica Roma Mérida Yucatán' },
  hours: [
    { days: 'Martes a domingo', time: '13:00 – 23:00' },
    { days: 'Lunes', time: 'Cerrado' },
  ],
  // Carta: se si forniscono immagini delle pagine (es. ['assets/menu/01.jpg', ...]) il libro usa quelle;
  // se l'array è vuoto usa la carta di esempio in HTML (js/book.js)
  menuPages: [],
  // distanza Roma (Colosseo) → Mérida (Monumento a la Patria), circonferenza massima
  distanceKm: 9411,
  from: { name: 'Roma', lat: 41.8902, lon: 12.4922 },
  to: { name: 'Mérida', lat: 20.9967, lon: -89.6170 },
};
