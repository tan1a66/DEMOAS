// Dati di contatto di ESMALTADAS (dal profilo Instagram @esmaltadasmx e da schede pubbliche:
// indirizzi da confermare con la cliente).
export const SUCURSALES = {
  'prime-center': {
    nombre: 'Prime Center',
    whatsapp: '529999091003', // +52 999 909 1003 (anche il link WhatsApp del profilo)
    telefono: '999 909 1003',
    direccion: ['Plaza Prime Center', 'Carretera Mérida–Progreso, Xcanatún', 'Mérida, Yucatán'],
    mapa: 'Plaza Prime Center, Carretera Mérida-Progreso, Mérida, Yucatán',
  },
  'santa-fe': {
    nombre: 'Santa Fe',
    whatsapp: '529996409472', // +52 999 640 9472
    telefono: '999 640 9472',
    direccion: ['Calle 23 por 62', 'Gran Santa Fe', 'Mérida, Yucatán 97314'],
    mapa: 'Calle 23 62, Gran Santa Fe, Mérida, Yucatán 97314',
  },
  akropolis: {
    nombre: 'Akropolis',
    whatsapp: '529997477499', // +52 999 747 7499
    telefono: '999 747 7499',
    direccion: ['Plaza Akropolis', 'Fracc. Las Américas', 'Mérida, Yucatán 97302'],
    mapa: 'Plaza Akropolis, Las Américas, Mérida, Yucatán',
  },
};

// il numero generale (icona in alto e bottoni senza sucursal): quello del profilo
export const CONTACT = {
  whatsapp: SUCURSALES['prime-center'].whatsapp,
  instagram: 'https://www.instagram.com/esmaltadasmx/',
  horario: 'Lunes a sábado, de 10 a 20 h',
  messages: {
    cita: 'Hola, me gustaría agendar una cita en Esmaltadas.',
  },
};

export const waLink = (key = 'cita', numero = CONTACT.whatsapp) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(CONTACT.messages[key] || CONTACT.messages.cita)}`;

export const mapEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
export const mapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
