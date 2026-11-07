/**
 * Dati dello studio: si modificano qui e cambiano in tutto il sito
 * (header, footer, contatti, barra mobile, dati strutturati per Google).
 *
 * Convenzioni:
 *  - "[DA INSERIRE …]"  = dato che manca. Compare in pagina finché non viene compilato
 *                         e la build lo segnala a fine compilazione.
 *  - "[DA VERIFICARE …]" = dato presente ma da far confermare al medico (vedi CONTENUTI-DA-VERIFICARE.md).
 */

export type FasciaOraria = {
  /** Es. "Lunedì" oppure "Lunedì – Venerdì" */
  giorni: string;
  /** Es. "15:30 – 19:30" */
  orario: string;
};

export const sito = {
  nome: 'Dott. Konstantinos Martsidis',
  nomeBreve: 'Dott. Martsidis',
  nomeProprio: 'Konstantinos Martsidis',
  titolo: 'Specialista in Ginecologia e Ostetricia',
  ruoloPrincipale: 'Uroginecologo',
  sottotitoloLogo: 'Uroginecologia · Ginecologia · Ostetricia',

  // Dal CV: "Responsabile dell'ambulatorio di Uroginecologia e Centro per lo studio e la terapia delle
  // alterazioni del pavimento pelvico e dell'incontinenza urinaria nella donna presso Policlinico Universitario di Cagliari".
  // [DA VERIFICARE: dicitura breve approvata dal medico e se è ancora attuale]
  ruoloOspedaliero: "Responsabile dell'Ambulatorio di Uroginecologia del Policlinico Universitario di Cagliari",
  ruoloOspedalieroBreve: 'Ambulatorio di Uroginecologia, Policlinico Universitario di Cagliari',

  telefono: {
    visualizzato: '320 79 03 754',
    internazionale: '+39 320 790 3754',
    href: 'tel:+393207903754',
  },

  whatsapp: {
    numero: '393207903754',
    // Messaggio neutro: nessun riferimento ai sintomi (privacy). La paziente aggiunge lei quello che vuole.
    messaggio: 'Buongiorno Dottore, vorrei prenotare una visita.',
  },

  /**
   * Email (dal curriculum del medico). Mostrata in Contatti come canale secondario e usata per le richieste privacy.
   * null = non mostrata. [DA VERIFICARE: il medico vuole pubblicarla sul sito?]
   */
  email: 'kgmartsi@yahoo.it' as string | null,

  indirizzo: {
    via: 'Via Edmondo De Magistris 29',
    dettaglio: 'primo piano',
    cap: '09123',
    citta: 'Cagliari',
    provincia: 'CA',
    regione: 'Sardegna',
    paese: 'IT',
  },

  // Coordinate della via (OpenStreetMap/Nominatim), non del civico esatto.
  // [DA VERIFICARE: posizionare il punto sul portone dello studio]
  geo: { lat: 39.2228841, lon: 9.1061653 },

  /**
   * Orari di ricevimento. Su indicazione dello studio NON vengono pubblicati: si mostra solo
   * "Si riceve su appuntamento". Per pubblicarli in futuro, ad esempio:
   *   [{ giorni: 'Lunedì e Mercoledì', orario: '15:30 – 19:30' }]
   */
  orari: [] as FasciaOraria[],
  suAppuntamento: true,

  piva: '03309520326',

  // Numero confermato dal CV del medico ("Iscrizione all'albo dei Medici Chirurghi della provincia di Cagliari N° 9190").
  ordine: { nome: 'Ordine dei Medici Chirurghi e degli Odontoiatri della Provincia di Cagliari', numero: '9190' },

  lingue: ['Italiano', 'Inglese', 'Greco'],
  lingueCodici: ['it', 'en', 'el'],

  /** Link "Apri in Google Maps" (non incorpora nulla: è un semplice link). */
  googleMaps: {
    apri: 'https://www.google.com/maps/search/?api=1&query=Via+Edmondo+De+Magistris+29%2C+09123+Cagliari',
    indicazioni: 'https://www.google.com/maps/dir/?api=1&destination=Via+Edmondo+De+Magistris+29%2C+09123+Cagliari',
  },

  /** Scheda Google del medico (recensioni). */
  googleRecensioni: 'https://share.google/fMzeuEML8Mg22ftJs',

  /** Profilo MioDottore (recensioni). Link pulito, senza parametri di tracciamento pubblicitario. */
  mioDottore: 'https://www.miodottore.it/profilo/konstantinos-martsidis',

  /** Titolare dei dati per privacy e cookie. */
  titolareTrattamento: {
    nome: 'Dott. Konstantinos Martsidis',
    indirizzo: 'Via Edmondo De Magistris 29, 09123 Cagliari',
    // [DA VERIFICARE: va bene questa email per le richieste privacy o il medico preferisce una PEC?]
    contatto: 'kgmartsi@yahoo.it',
  },
} as const;

export const indirizzoCompleto = `${sito.indirizzo.via}, ${sito.indirizzo.cap} ${sito.indirizzo.citta}`;
