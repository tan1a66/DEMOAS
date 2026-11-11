/**
 * Testi dell'interfaccia (pulsanti, menu, etichette ripetute).
 * I testi delle pagine stanno invece in src/content/ (Markdown) e nelle pagine in src/pages/.
 * Per aggiungere l'inglese: copiare questo file in en.ts e tradurre i valori (vedi README).
 */
export const it = {
  'meta.lang': 'it',
  'meta.locale': 'it_IT',

  'a11y.skip': 'Salta al contenuto',
  'a11y.menu.open': 'Apri il menu',
  'a11y.menu.close': 'Chiudi il menu',
  'a11y.menu.label': 'Menu principale',
  'a11y.breadcrumb': 'Percorso',
  'a11y.footer.nav': 'Link utili',
  'a11y.contactbar': 'Contatti rapidi',
  'a11y.newwindow': '(si apre in una nuova finestra)',
  'a11y.submenu': 'Mostra i servizi',

  'cta.whatsapp': 'Scrivimi su WhatsApp',
  'cta.whatsapp.short': 'WhatsApp',
  'cta.call': 'Chiama',
  'cta.call.number': 'Chiama il {numero}',
  'cta.book': 'Prenota una visita',
  'cta.title': 'Vuole parlarne con il Dottore?',
  'cta.text':
    'Può prenotare con un messaggio WhatsApp, una telefonata o online su MioDottore. Il messaggio WhatsApp è già pronto e non dice nulla sul motivo della visita.',

  'note.divulgativa': 'Le informazioni di questa pagina sono divulgative e non sostituiscono una visita medica.',
  'note.modello': 'Rappresentazione semplificata a scopo divulgativo.',

  'footer.ordine': 'Iscritto all’{ordine}, n. {numero}',
  'footer.piva': 'P.IVA {piva}',
  'footer.privacy': 'Privacy',
  'footer.cookie': 'Cookie',
  'footer.appuntamento': 'Si riceve su appuntamento',
  'footer.credits': 'Sito realizzato da Alessia Studio',

  'contatti.indirizzo': 'Indirizzo',
  'contatti.orari': 'Orari',
  'contatti.telefono': 'Telefono e WhatsApp',
  'contatti.apriMaps': 'Apri in Google Maps',
  'contatti.indicazioni': 'Indicazioni stradali',

  'faq.title': 'Domande frequenti',
  'breadcrumb.home': 'Home',
  'link.scopri': 'Scopra di più',
  'link.modello': 'Guardi il modello 3D',
} as const;

export type UiKey = keyof typeof it;

/** Menu principale (ordine e voci richiesti: Home, Prenota una visita, Servizi, Laser, Lo Studio, Curriculum Vitae, Contatti). */
export type VoceMenu = {
  label: string;
  href: string;
  descrizione?: string;
  figli?: VoceMenu[];
};

export const menuIt: VoceMenu[] = [
  { label: 'Home', href: '/' },
  { label: 'Prenota una visita', href: '/prenota-una-visita/' },
  {
    label: 'Servizi',
    href: '/servizi/',
    figli: [
      { label: 'Uroginecologia', href: '/uroginecologia/', descrizione: 'Incontinenza, prolasso, pavimento pelvico' },
      { label: 'Esame urodinamico', href: '/esame-urodinamico/', descrizione: 'Come funziona la vescica' },
      { label: 'Ginecologia', href: '/ginecologia/', descrizione: 'Visita, Pap test, menopausa, cistiti' },
      { label: 'Ostetricia', href: '/ostetricia/', descrizione: 'Gravidanza, visite ed ecografie' },
      { label: 'Ecografia 3D/4D', href: '/ecografia-3d-4d/', descrizione: 'Ginecologica e ostetrica' },
      { label: 'Visita a domicilio', href: '/visita-domiciliare/', descrizione: 'Per chi non può spostarsi' },
      { label: 'Consulenza nutrizionale', href: '/consulenza-nutrizionale/', descrizione: 'Con la Dott.ssa Manuela Frau' },
      { label: 'La prima visita', href: '/la-prima-visita/', descrizione: 'Cosa aspettarsi, cosa portare' },
      { label: 'Tutti i servizi', href: '/servizi/' },
    ],
  },
  { label: 'Laser', href: '/laser/' },
  { label: 'Lo Studio', href: '/lo-studio/' },
  { label: 'Curriculum Vitae', href: '/chi-sono/' },
  { label: 'Contatti', href: '/contatti/' },
];
