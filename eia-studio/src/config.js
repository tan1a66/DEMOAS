// Dati di ÉIA STUDIO (dalla scheda Booksy pubblica e dal profilo Instagram @eeia.studio,
// novembre 2026: da confermare con la cliente).
export const ESTUDIO = {
  nombre: 'ÉIA Studio',
  direccion: ['Glorieta de las Amazonas, 12', '28341 Valdemoro, Madrid'],
  mapa: 'Glorieta de las Amazonas 12, 28341 Valdemoro, Madrid',
  // lunes = 1 … domingo = 0; [apertura, cierre] in minuti
  horario: {
    1: [600, 1200],
    2: [600, 1200],
    3: [600, 1200],
    4: [600, 1200],
    5: [600, 1200],
    6: [600, 870],
    0: null,
  },
  // giorni di chiusura speciali (Booksy): festivi di dicembre
  cerrado: ['2026-12-07', '2026-12-08'],
  resenas: { nota: '4,9', total: 783 },
};

export const CONTACT = {
  instagram: 'https://www.instagram.com/eeia.studio/',
  // il link di prenotazione del profilo Instagram (porta alla scheda Booksy)
  booksy: 'https://eiastudio.booksy.com/a',
};

export const mapEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
export const mapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
