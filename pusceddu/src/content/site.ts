/**
 * Tutti i contenuti del sito. Modifica questo file e le pagine si aggiornano.
 *
 * Regole (codice deontologico forense): solo informazioni vere, sobrie e verificabili.
 * Niente superlativi, promesse di risultato, percentuali, confronti con colleghi,
 * numeri o clienti che non siano qui sotto.
 *
 * `null` significa "da fornire": il sito mostra un segnaposto ben visibile
 * e `npm run build` elenca a fine build tutto quello che manca.
 *
 * Tipografia: apostrofo ’ (non '), virgolette «basse».
 */

/** Valore ancora da ricevere. */
export type DaFornire<T> = T | null;

export interface Sede {
  via: string;
  cap: string;
  comune: string;
  /** Sigla della provincia o città metropolitana. */
  provincia: string;
}

export interface Pubblicazione {
  id: string;
  titolo: string;
  sottotitolo?: string;
  /** `false` finché il titolo non è quello completo. */
  titoloCompleto: boolean;
  /** Percorso in /public, es. '/images/copertine/costituzione.webp'. */
  copertina: DaFornire<string>;
  /** Solo per i titoli che hanno un estratto audio, es. src: '/audio/costituzione.mp3' (in /public/audio). Mai in autoplay. */
  audio?: { src: DaFornire<string>; descrizione: string };
}

export interface Ambito {
  id: string;
  titolo: string;
  /** Lettera incisa sul blocco di caratteri nella cassa. */
  iniziale: string;
  /** 2-3 frasi: cosa comprende e per chi. */
  descrizione: DaFornire<string>;
}

/* ------------------------------------------------------------------ */

/** Dominio definitivo, es. 'https://www.esempio.it'. Serve per canonical, Open Graph e sitemap. */
export const dominio: DaFornire<string> = null;

export const avvocato = {
  titolo: 'Avv.',
  nome: 'Roberto',
  cognome: 'Pusceddu',
  qualifica: 'Avvocato',
  foro: 'Foro di Cagliari',
  ordine: 'Ordine degli Avvocati di Cagliari',
} as const;

export const nomeCompleto = `${avvocato.nome} ${avvocato.cognome}`;
export const nomeConTitolo = `${avvocato.titolo} ${nomeCompleto}`;

/** Apertura: le lettere compongono `frase`, poi si ricompongono nel nome. */
export const apertura = {
  frase: 'Tutti possono agire in giudizio per la tutela dei propri diritti.',
  fonte: 'Art. 24, comma 1, Costituzione',
  nome: nomeCompleto,
  sottotitolo: `${avvocato.qualifica} · ${avvocato.foro}`,
};

export const studio = {
  nome: 'Roberto Pusceddu & Partners Law Firm',
};

/** Bio breve in prima persona, 2-3 frasi, da scrivere con Roberto. */
export const bio: DaFornire<string> = null;

export const attivita = ['Docente di diritto', 'Autore di pubblicazioni giuridiche'];

export const ruoli = ['Avvocato MOSAP', 'Consulente legale KNX Sardegna', 'Avvocato SIC'];

export const formazione = [
  { titolo: 'Dottore di Ricerca (PhD)', dettaglio: 'in Scienze Giuridiche' },
  { titolo: 'Specializzazione CNF', dettaglio: 'in Diritto Civile' },
  { titolo: 'Cultore della materia', dettaglio: 'in Filosofia del Diritto' },
  { titolo: "Corte d’Appello di Cagliari", dettaglio: 'Stage presso la Seconda Sezione Penale' },
];

export const riconoscimenti = [
  {
    esito: 'Vincitore',
    premio: 'Premio Nazionale Tesi di Laurea sulla Sicurezza Stradale',
    ente: 'Fondazione ANIA «Sandro Salvati»',
    motivo: 'per la tesi «Filosofia dei Segnali Stradali»',
  },
];

/**
 * Gli scomparti della cassa tipografica.
 * La tutela delle donne vittime di violenza NON va qui: ha la sua pagina (/assistenza-riservata).
 */
export const ambiti: Ambito[] = [
  { id: 'legal-design', titolo: 'Legal design e contratti chiari', iniziale: 'L', descrizione: null },
  { id: 'diritto-civile', titolo: 'Diritto civile', iniziale: 'C', descrizione: null },
  { id: 'aziende-enti', titolo: 'Consulenza per aziende ed enti', iniziale: 'A', descrizione: null },
];

export const pubblicazioni: Pubblicazione[] = [
  {
    id: 'diritto-musica',
    titolo: "Diritto e [è] musica: l’orchestra delle regole…",
    titoloCompleto: false,
    copertina: null,
  },
  {
    id: 'costituzione-ascolto',
    titolo: "La Costituzione all’ascolto",
    sottotitolo: 'Diritti, doveri e libertà raccontati alla radio',
    titoloCompleto: true,
    copertina: null,
    audio: { src: null, descrizione: "Ascolta un estratto di «La Costituzione all’ascolto»" },
  },
  {
    id: 'avvocato-essere-umano',
    titolo: "L’Avvocato, l’essere umano e la comunità",
    titoloCompleto: true,
    copertina: null,
  },
];

/** Le sedi, nell’ordine in cui vanno mostrate. `null` = indirizzo da fornire. */
export const sedi: DaFornire<Sede>[] = [
  { via: 'Via Garibaldi 16', cap: '09069', comune: 'Maracalagonis', provincia: 'CA' },
  null,
];

export const contatti = {
  /** Come va scritto sul sito, es. '070 000 0000'. Il link `tel:` si genera da solo. */
  telefono: null as DaFornire<string>,
  email: null as DaFornire<string>,
  pec: null as DaFornire<string>,
};

export const fiscale = {
  piva: null as DaFornire<string>,
};

/** Pagina /assistenza-riservata: numeri pubblici, sempre visibili in alto. */
export const assistenza = {
  numeri: [
    { numero: '1522', nome: 'Numero antiviolenza e stalking', nota: 'Gratuito, attivo 24 ore su 24.' },
    { numero: '112', nome: 'Emergenze', nota: 'Se sei in pericolo adesso.' },
  ],
  uscita: 'https://www.google.it',
};

/* ------------------------------------------------------------------ */

/** Link `tel:` da un numero scritto per le persone ('070 123…' → 'tel:+39070123…'). */
export function telHref(numero: string): string {
  const cifre = numero.replace(/[^\d+]/g, '');
  if (cifre.startsWith('+') || cifre.length <= 4) return `tel:${cifre}`;
  return `tel:+39${cifre}`;
}

export function indirizzoSede(s: Sede): string {
  return `${s.via}, ${s.cap} ${s.comune} (${s.provincia})`;
}

export function mapsHref(s: Sede): string {
  const q = encodeURIComponent(`${s.via}, ${s.cap} ${s.comune} ${s.provincia}, Italia`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Elenco di quello che manca, mostrato a fine build. */
export function campiMancanti(): string[] {
  const m: string[] = [];
  if (!dominio) m.push('dominio del sito');
  if (!bio) m.push('bio breve');
  if (!contatti.telefono) m.push('telefono');
  if (!contatti.email) m.push('email');
  if (!contatti.pec) m.push('PEC');
  if (!fiscale.piva) m.push('P.IVA');
  sedi.forEach((s, i) => !s && m.push(`sede ${i + 1}: indirizzo`));
  ambiti.forEach((a) => !a.descrizione && m.push(`ambito "${a.titolo}": descrizione`));
  pubblicazioni.forEach((p) => {
    if (!p.titoloCompleto) m.push(`pubblicazione "${p.titolo}": titolo completo`);
    if (!p.copertina) m.push(`pubblicazione "${p.titolo}": copertina`);
    if (p.audio && !p.audio.src) m.push(`pubblicazione "${p.titolo}": file audio`);
  });
  return m;
}
