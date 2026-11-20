// Dati di contatto di SKY Medical Spa (da una scheda pubblica Fresha: da confermare con la cliente).
export const CONTACT = {
  whatsapp: '529992567412', // +52 999 256 7412, senza "+" né spazi
  messages: {
    cita: 'Hola, me gustaría agendar una cita en SKY Medical Spa.',
    faciales: 'Hola, me gustaría agendar un facial en SKY Medical Spa.',
    masajes: 'Hola, me gustaría agendar un masaje en SKY Medical Spa.',
    laser: 'Hola, me gustaría agendar una valoración de depilación láser en SKY Medical Spa.',
    beauty: 'Hola, me gustaría agendar una cita en SKY Beauty Center.',
  },
};

export const waLink = (key = 'cita') =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(CONTACT.messages[key] || CONTACT.messages.cita)}`;
