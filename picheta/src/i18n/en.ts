import type { Dict } from './es';

/** English copy. Same structure as es.ts (TypeScript flags any missing key). */
export const en: Dict = {
  meta: {
    home: {
      title: 'Picheta Mérida — The city, from another perspective',
      description:
        'Contemporary Yucatecan cuisine and author’s cuisine in a building more than 350 years old, with a terrace on Mérida’s main square overlooking the Cathedral.',
    },
    menu: {
      title: 'Menu — Picheta Mérida',
      description:
        'Starters, main courses and desserts at Picheta: contemporary Yucatecan cuisine and author’s cuisine in the heart of Mérida.',
    },
    reserve: {
      title: 'Book a table — Picheta Mérida',
      description: 'Book your table at Picheta through OpenTable, WhatsApp or by phone. Calle 61 x 60 y 62, downtown Mérida.',
    },
  },

  common: {
    skip: 'Skip to content',
    langLabel: 'Language',
    langNames: { es: 'Español', en: 'English' },
    newTab: '(opens in a new tab)',
    proposal: 'Independent redesign proposal · not the official website',
    backToExperience: 'Back to the experience',
  },

  nav: {
    label: 'Main navigation',
    home: 'Picheta, back to the start',
    items: {
      place: 'The place',
      experience: 'The terrace',
      gastronomy: 'Cuisine',
      gallery: 'Gallery',
      location: 'Location',
    },
    reserve: 'Book',
    open: 'Index',
    close: 'Close',
  },

  hero: {
    location: 'Mérida · Yucatán',
    title: ['The city,', 'from another *perspective.*'],
    lead: 'Architecture, cuisine and a horizon that asks you to stay a little longer.',
    enter: 'Enter',
    reserve: 'Book a table',
    slides: ['The terrace', 'The dining room', 'The Cathedral', 'The bar'],
    slidesLabel: 'Photographs of Picheta',
    goTo: (n: number) => `Show photograph ${n}`,
    pause: 'Pause photographs',
    play: 'Play photographs',
    scroll: 'Discover',
  },

  intro: {
    kicker: 'Mérida’s historic centre',
    text: 'Contemporary Yucatecan cuisine and author’s cooking, in a building more than *350 years* old, facing the Cathedral.',
    facts: [
      { value: '350+', label: 'years of history in the building' },
      { value: 'Terrace', label: 'overlooking the Cathedral' },
      { value: 'Authors', label: 'resident and guest chefs' },
    ],
  },

  place: {
    kicker: 'The place',
    title: ['Space', 'changes *everything.*'],
    lead: 'Behind a discreet entrance, a building more than 350 years old.',
    text: 'Stone walls, a vaulted ceiling of timber slats and a warm light over every table. From the dining room to the wrought-iron balcony, the centre of Mérida keeps its rhythm just beyond the windows.',
    captions: ['The vaulted dining room', 'Stone walls', 'The balcony'],
  },

  terrace: {
    kicker: 'The terrace',
    title: ['A place', 'above the *everyday.*'],
    text: 'On Mérida’s main square, with a view of the majestic Cathedral.',
    hint: { pointer: 'Move the cursor to look around', touch: 'Tilt your phone to look around' },
  },

  light: {
    kicker: 'The light',
    title: ['Light transforms', 'the *moment.*'],
    text: 'One terrace, four atmospheres: from the open sky of the day to the pink of sunset and the glowing bar at dusk.',
    moments: ['By day', 'Golden hour', 'Sunset', 'Dusk'],
  },

  gastronomy: {
    kicker: 'Cuisine',
    title: ['The culinary', '*proposal.*'],
    text: 'A contemporary reading of Yucatecan flavours.',
    detail: 'Resident chefs and guest authors create unique dishes from local ingredients: starters, mains and desserts.',
    quote: 'We serve food with heart.',
    source: 'Picheta’s philosophy',
    cta: 'Explore the menu',
  },

  events: {
    kicker: 'Events',
    title: ['For the moments', 'that *matter.*'],
    items: [
      { title: 'Private dining room', text: 'An intimate room between stone walls, for gatherings of up to eight.' },
      { title: 'Terrace for events', text: 'From weddings and receptions to corporate events, with the Cathedral as the backdrop.' },
    ],
    write: 'Email the events team',
    whatsapp: 'Ask on WhatsApp',
  },

  gallery: {
    kicker: 'Gallery',
    title: ['Picheta,', 'in *pictures.*'],
    open: (n: number, total: number) => `Enlarge photograph ${n} of ${total}`,
    dialog: 'Photo gallery',
    close: 'Close',
    prev: 'Previous',
    next: 'Next',
  },

  invitation: {
    title: ['The next moment', 'could be *yours.*'],
    primary: 'Book a table',
    secondary: 'Back to the top',
    note: 'Online reservations through OpenTable, Picheta’s official booking system.',
  },

  sticky: {
    reserve: 'Book a table',
    menu: 'Menu',
  },

  location: {
    kicker: 'Location',
    title: ['In the heart', 'of the *old town.*'],
    text: 'On Mérida’s main square, overlooking the Cathedral.',
    address: 'Address',
    hours: 'Restaurant & bar',
    contact: 'Contact',
    maps: 'Open in Google Maps',
    call: 'Call',
    whatsapp: 'WhatsApp',
    days: { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' },
    range: (from: string, to: string) => `${from} to ${to}`,
  },

  footer: {
    tagline: 'Contemporary Yucatecan cuisine + author’s cuisine',
    visit: 'Visit',
    hours: 'Opening hours',
    contact: 'Contact',
    follow: 'Follow',
    events: 'Events',
    nav: 'Explore',
    menu: 'Menu',
    reserve: 'Book',
    official: 'Official website',
    credits:
      'Independent digital redesign proposal. This is not Picheta’s official website: logo, photographs, film, menu and contact details come from picheta.mx.',
    top: 'Back to top',
  },

  menu: {
    kicker: 'Menu',
    title: 'The culinary proposal.',
    intro: 'Contemporary Yucatecan cuisine, with resident chefs and guest authors creating unique dishes from local ingredients.',
    categories: 'Categories',
    by: 'Created by',
    note: 'Prices in Mexican pesos. Menu as published on picheta.mx (October 2026); subject to change without notice.',
    translationNote:
      'English descriptions follow the current Spanish menu; names match the official English menu where the dish appears in it.',
    official: 'See the menu on the official website',
    reserve: 'Book a table',
    back: 'Back to the experience',
  },

  reserve: {
    kicker: 'Book',
    title: ['Your table', 'at *Picheta.*'],
    lead: 'Picheta takes reservations through OpenTable: choose the date, time and party size, and the platform confirms your table.',
    primary: 'Book on OpenTable',
    primaryNote: 'Picheta’s official booking system',
    alternatives: 'You can also book by',
    whatsapp: 'WhatsApp',
    whatsappAction: 'Message on WhatsApp',
    phone: 'Phone',
    phoneAction: 'Call',
    hours: 'Opening hours',
    events: 'Events and groups',
    eventsText: 'Terrace for events and a private dining room for eight.',
    form: {
      title: 'Prepare your request on WhatsApp',
      lead: 'Fill in these details and we’ll open WhatsApp with your message ready to send. Your table is only confirmed once the restaurant replies.',
      required: 'Required',
      optional: 'optional',
      name: 'Name',
      date: 'Date',
      time: 'Time',
      timeChooseDate: 'Choose a date first',
      timePlaceholder: 'Select a time',
      guests: 'Guests',
      guestsOption: (n: number) => (n === 1 ? '1 guest' : `${n} guests`),
      guestsMore: 'More than 10 (groups)',
      phone: 'Phone',
      notes: 'Notes',
      notesPlaceholder: 'Special occasion, allergies, preferences…',
      submit: 'Open WhatsApp with my request',
      errors: {
        summary: 'Please check the highlighted fields.',
        name: 'Please enter your name.',
        date: 'Please choose a date.',
        datePast: 'Please choose today or a later date.',
        time: 'Please choose a time within opening hours.',
        guests: 'Please tell us how many guests.',
        phone: 'Please check the number: digits, spaces, + or hyphens only.',
      },
      opened:
        'We’ve opened WhatsApp in a new tab with your request. Send it from there — your booking isn’t confirmed until Picheta replies.',
      openedFallback: 'If it didn’t open, use this link',
      message: {
        greeting: 'Hello Picheta, I’d like to request a reservation.',
        name: 'Name',
        date: 'Date',
        time: 'Time',
        guests: 'Guests',
        phone: 'Phone',
        notes: 'Notes',
      },
    },
  },
};
