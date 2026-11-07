/**
 * Recensioni da mostrare sul sito.
 *
 * REGOLE (Codice deontologico, artt. 55–57, e GDPR):
 *  - solo recensioni REALI, già pubblicate dalla paziente (es. su Google);
 *  - solo con autorizzazione scritta della paziente a riportarle sul sito (autorizzata: true);
 *  - nome abbreviato (es. "Maria R."), mai il cognome per intero;
 *  - nessun riferimento a diagnosi o dati sanitari che la paziente non abbia scritto lei stessa;
 *  - non modificare il testo (si può accorciare con "…", senza cambiarne il senso).
 *
 * Finché la lista è vuota il sito mostra solo il rimando alla scheda Google.
 */
export type Recensione = {
  testo: string;
  /** Nome abbreviato, es. "Maria R." */
  autrice: string;
  /** Data della recensione originale, formato AAAA-MM-GG */
  data: string;
  fonte: 'Google' | 'Altro';
  /** Deve essere true: autorizzazione della paziente conservata dallo studio. */
  autorizzata: boolean;
};

export const recensioni: Recensione[] = [];
