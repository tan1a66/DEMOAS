/**
 * Stati del modello 3D (public/models/pelvi.glb) e problematiche dell'"anello" in Home.
 * Questo file NON importa Three.js: lo usa anche la pagina lato server.
 * [DA VERIFICARE CON IL MEDICO] testi delle problematiche.
 */

export type Organo = 'vescica' | 'utero' | 'vagina' | 'retto' | 'pavimento' | 'bacino';

export type IdStato =
  | 'normale'
  | 'incontinenza'
  | 'prolasso'
  | 'urgenza'
  | 'postparto'
  | 'tensione'
  | 'cistiti'
  | 'menopausa'
  | 'riabilitazione';

export type ParametriStato = {
  /** morph target del pavimento (0–1) */
  cedimento: number;
  iato: number;
  tensione: number;
  discesaVescica: number;
  discesaUtero: number;
  /** variazione dell'inclinazione dell'utero (rad) */
  rotUtero: number;
  /** organo messo in evidenza (bagliore) */
  evidenza: Organo | null;
  /** pulsazione dell'organo in evidenza (es. vescica iperattiva) */
  pulsa: number;
};

const base: ParametriStato = {
  cedimento: 0, iato: 0, tensione: 0, discesaVescica: 0, discesaUtero: 0, rotUtero: 0, evidenza: null, pulsa: 0,
};

export const PARAMETRI: Record<IdStato, ParametriStato> = {
  normale: base,
  incontinenza: { ...base, cedimento: 0.45, discesaVescica: -0.07, evidenza: 'vescica' },
  prolasso: { ...base, cedimento: 1, iato: 0.45, discesaVescica: -0.08, discesaUtero: -0.42, rotUtero: -0.55, evidenza: 'utero' },
  urgenza: { ...base, evidenza: 'vescica', pulsa: 1 },
  postparto: { ...base, cedimento: 0.35, iato: 1, evidenza: 'pavimento' },
  tensione: { ...base, tensione: 1, evidenza: 'pavimento', pulsa: 0.4 },
  cistiti: { ...base, evidenza: 'vescica' },
  menopausa: { ...base, evidenza: 'vagina' },
  riabilitazione: { ...base, tensione: 0.35, evidenza: 'pavimento' },
};

export type Problematica = {
  id: IdStato;
  nome: string;
  /** con le parole della paziente */
  frase: string;
  /** cosa succede (si vede nel modello) */
  testo: string;
  link: string;
};

/** L'anello delle problematiche che gira attorno al modello in Home. */
export const PROBLEMATICHE: Problematica[] = [
  {
    id: 'incontinenza',
    nome: 'Incontinenza urinaria',
    frase: 'Perdo urina quando tossisco o rido',
    testo: 'Sotto sforzo la pressione spinge verso il basso: se il pavimento pelvico è indebolito cede un po’, la vescica scende e l’uretra non si chiude bene.',
    link: '/uroginecologia/incontinenza-urinaria/',
  },
  {
    id: 'prolasso',
    nome: 'Prolasso genitale',
    frase: 'Sento un peso in basso',
    testo: 'Quando il sostegno si indebolisce molto, un organo scivola verso la vagina: qui è l’utero. Può succedere anche alla vescica o al retto.',
    link: '/uroginecologia/prolasso-genitale/',
  },
  {
    id: 'urgenza',
    nome: 'Vescica iperattiva',
    frase: 'Devo correre in bagno spesso',
    testo: 'La vescica si contrae quando non dovrebbe: lo stimolo arriva all’improvviso, anche di notte, a volte con piccole perdite.',
    link: '/uroginecologia/vescica-iperattiva/',
  },
  {
    id: 'postparto',
    nome: 'Dopo il parto',
    frase: 'Dopo il parto non è più come prima',
    testo: 'Gravidanza e parto allungano i muscoli e allargano lo iato, l’apertura del pavimento pelvico. Con il tempo e la riabilitazione si recupera.',
    link: '/uroginecologia/pavimento-pelvico-post-parto/',
  },
  {
    id: 'tensione',
    nome: 'Dolore nei rapporti',
    frase: 'Ho dolore durante i rapporti',
    testo: 'A volte il pavimento pelvico è troppo contratto e non riesce a rilassarsi; altre volte la causa è la secchezza o un’infiammazione.',
    link: '/uroginecologia/dolore-nei-rapporti/',
  },
  {
    id: 'cistiti',
    nome: 'Cistiti ricorrenti',
    frase: 'Le cistiti tornano',
    testo: 'Quando le infezioni urinarie si ripetono c’è spesso un motivo: capirlo aiuta a prevenirle, non solo a curarle.',
    link: '/ginecologia/',
  },
  {
    id: 'menopausa',
    nome: 'Menopausa',
    frase: 'Secchezza, bruciore, fastidi',
    testo: 'Con il calo degli estrogeni i tessuti vaginali e urinari diventano più sottili e sensibili. Ci sono terapie efficaci per molte donne.',
    link: '/ginecologia/',
  },
];

export const isIdStato = (v: string): v is IdStato => v in PARAMETRI;
