// Dati di contatto di buenquerer (dal sito www.buenquerer.com e dal profilo Instagram
// @_buenquerer_; da confermare con la cliente).
export const CONTACT = {
  whatsapp: '34683137669', // +34 683 13 76 69 (il link WhatsApp del sito e "Reserva por WhatsApp" su IG)
  telefono: '+34914219705', // 91 421 97 05
  email: 'buenquerer@buenquerer.com',
  instagram: 'https://www.instagram.com/_buenquerer_/',
  direccion: ['Calle María de Guzmán, 53', 'esquina Alonso Cano', '28003 Madrid'],
  mapa: 'buenquerer, Calle de María de Guzmán 53, 28003 Madrid',
  messages: {
    cita: 'Hola, me gustaría pedir cita en buenquerer.',
  },
};

export const waLink = (key = 'cita') =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(CONTACT.messages[key] || CONTACT.messages.cita)}`;

export const mapEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
export const mapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
