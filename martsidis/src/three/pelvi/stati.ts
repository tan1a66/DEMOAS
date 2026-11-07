/**
 * Stati del modello del pavimento pelvico: testi (mostrati accanto al modello e letti dagli screen reader)
 * e parametri numerici usati dall'animazione 3D e dalla versione SVG.
 * Questo file NON importa Three.js: lo usa anche la pagina lato server.
 * [DA VERIFICARE CON IL MEDICO] testi degli stati.
 */

export type IdStato = 'normale' | 'incontinenza' | 'prolasso' | 'riabilitazione';

export type ParametriStato = {
  /** Abbassamento del centro dell'amaca (unità della scena). */
  cedimento: number;
  /** "Tono" del muscolo: 0 normale, 1 tonico (colore più vivo, fibre più evidenti). */
  tono: number;
  /** Discesa aggiuntiva di ciascun organo oltre a quella dovuta all'amaca. */
  discesaVescica: number;
  discesaUtero: number;
  discesaRetto: number;
  /** Rotazione dell'utero (rad): nel prolasso si verticalizza un po'. */
  inclinazioneUtero: number;
  /** Visibilità (0–1) delle frecce e della goccia. */
  frecciaPressione: number;
  frecciaDiscesa: number;
  frecceSostegno: number;
  goccia: number;
};

export type Stato = {
  id: IdStato;
  /** Etichetta del pulsante */
  etichetta: string;
  titolo: string;
  testo: string;
  /** Descrizione per lettori di schermo (cosa si vede nel modello in questo stato) */
  descrizione: string;
  link?: { href: string; label: string };
  parametri: ParametriStato;
};

const base: ParametriStato = {
  cedimento: 0.16,
  tono: 0,
  discesaVescica: 0,
  discesaUtero: 0,
  discesaRetto: 0,
  inclinazioneUtero: 0,
  frecciaPressione: 0,
  frecciaDiscesa: 0,
  frecceSostegno: 0,
  goccia: 0,
};

export const STATI: Stato[] = [
  {
    id: 'normale',
    etichetta: 'Normale',
    titolo: 'L’amaca sostiene gli organi',
    testo:
      'Il pavimento pelvico è un insieme di muscoli e legamenti che chiude in basso il bacino, come un’amaca. Sostiene vescica, utero e retto e aiuta a trattenere urina e feci.',
    descrizione:
      'Vista del bacino stilizzato. In basso, l’amaca muscolare viola è tesa e regolare. Sopra l’amaca, da davanti a dietro: la vescica (verde salvia), l’utero (lilla) e il retto (sabbia), ognuno al suo posto.',
    parametri: { ...base },
  },
  {
    id: 'incontinenza',
    etichetta: 'Incontinenza da sforzo',
    titolo: 'Sotto sforzo, il sostegno cede un po’',
    testo:
      'Quando tossisce, ride o solleva un peso, la pressione nell’addome spinge verso il basso. Se l’amaca è indebolita cede leggermente, la vescica si abbassa e l’uretra non si chiude bene: compaiono piccole perdite.',
    descrizione:
      'Una freccia dall’alto indica la pressione dell’addome. L’amaca si incurva un po’ verso il basso e la vescica scende leggermente; sotto l’uretra compare una piccola goccia.',
    link: { href: '/uroginecologia/incontinenza-urinaria/', label: 'Incontinenza urinaria' },
    parametri: {
      ...base,
      cedimento: 0.3,
      discesaVescica: -0.08,
      discesaUtero: -0.03,
      frecciaPressione: 1,
      goccia: 1,
    },
  },
  {
    id: 'prolasso',
    etichetta: 'Prolasso',
    titolo: 'Un organo scende verso il basso',
    testo:
      'Se il sostegno si indebolisce molto, un organo può scivolare verso la vagina: qui è l’utero. Si avverte un senso di peso o una “pallina”. Può succedere anche alla vescica (cistocele) o al retto (rettocele).',
    descrizione:
      'L’amaca è molto incurvata verso il basso. L’utero è sceso e la sua parte inferiore supera il livello dell’amaca; una freccia accanto all’utero indica la discesa. Anche la vescica è un po’ più in basso.',
    link: { href: '/uroginecologia/prolasso-genitale/', label: 'Prolasso genitale' },
    parametri: {
      ...base,
      cedimento: 0.38,
      discesaVescica: -0.1,
      discesaUtero: -0.52,
      discesaRetto: -0.04,
      inclinazioneUtero: -0.55,
      frecciaDiscesa: 1,
    },
  },
  {
    id: 'riabilitazione',
    etichetta: 'Riabilitazione',
    titolo: 'Con il trattamento, l’amaca torna a sostenere',
    testo:
      'Esercizi mirati, terapie e, quando serve, un intervento aiutano muscoli e tessuti a ridare sostegno agli organi, che tornano al loro posto. Il percorso più adatto si sceglie insieme al medico.',
    descrizione:
      'L’amaca è di nuovo tesa, leggermente più alta e di un viola più intenso, segno di muscoli più forti. Piccole frecce verdi sotto l’amaca indicano la spinta verso l’alto. Gli organi sono tornati al loro posto.',
    link: { href: '/uroginecologia/pavimento-pelvico-post-parto/', label: 'La riabilitazione del pavimento pelvico' },
    parametri: { ...base, cedimento: 0.1, tono: 1, frecceSostegno: 1 },
  },
];

export const STATO_INIZIALE: IdStato = 'normale';

export const isIdStato = (v: string): v is IdStato => STATI.some((s) => s.id === v);

export const statoPerId = (id: IdStato): Stato => STATI.find((s) => s.id === id) ?? STATI[0]!;
