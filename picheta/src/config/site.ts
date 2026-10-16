/**
 * Datos públicos de Picheta. TODO lo que aparece aquí se verificó en el sitio oficial
 * (picheta.mx: inicio, /contacto/, /reservas/, /historia/, /terraza-para-eventos/) el 16-10-2026.
 * Si algo cambia, se edita solo este archivo.
 */
export const SITE = {
  name: 'Picheta',
  /** Sitio oficial (la demo es una propuesta independiente, no lo sustituye). */
  officialUrl: 'https://picheta.mx/',

  address: {
    street: 'Calle 61 x 60 y 62',
    building: 'Plataforma Picheta Centro',
    city: 'Mérida, Yucatán',
    /** Enlace "Ver en Google Maps" del sitio oficial. */
    mapsUrl: 'https://goo.gl/maps/AhNc2CfzgBRLikqb6',
  },

  phone: {
    display: '+52 999 506 0339',
    href: 'tel:+529995060339',
  },

  /** Botón de WhatsApp del sitio oficial (wa.me/529995060339). */
  whatsapp: {
    number: '529995060339',
    url: 'https://wa.me/529995060339',
  },

  /** Correo publicado en el formulario de eventos (/terraza-para-eventos/). */
  eventsEmail: 'eventos@picheta.mx',

  /**
   * Sistema de reservaciones oficial: OpenTable (rid 1088797).
   * Es el enlace "Reserva una mesa" del sitio oficial; /reservas/ incrusta el widget de OpenTable con el mismo rid.
   */
  reservations: {
    platform: 'OpenTable',
    url: 'https://www.opentable.com.mx/restaurant/profile/1088797/reserve?rid=1088797&restref=1088797',
  },

  /** Horario "Restaurante y barra" publicado en el pie del sitio oficial. Días: 0 = domingo … 6 = sábado. */
  hours: [
    { days: [1, 2, 3, 4, 5, 6], open: '17:00', close: '01:00' },
    { days: [0], open: '17:00', close: '23:00' },
  ],

  social: [
    { id: 'instagram', label: 'Instagram', handle: '@pichetamx', url: 'https://www.instagram.com/pichetamx/' },
    { id: 'facebook', label: 'Facebook', handle: 'Picheta', url: 'https://www.facebook.com/Picheta-780049155712027/' },
    {
      id: 'tripadvisor',
      label: 'Tripadvisor',
      handle: 'Picheta',
      url: 'https://www.tripadvisor.com.mx/Restaurant_Review-g150811-d19390540-Reviews-Picheta-Merida_Yucatan_Peninsula.html',
    },
  ],

  /** Menú oficial (la página interna /menu/ reproduce su contenido). */
  officialMenuUrl: 'https://picheta.mx/menu/',
} as const;

export type Site = typeof SITE;

/** Enlace de WhatsApp con un mensaje ya escrito (el envío lo decide la persona en WhatsApp). */
export function whatsappLink(message?: string): string {
  return message ? `${SITE.whatsapp.url}?text=${encodeURIComponent(message)}` : SITE.whatsapp.url;
}
