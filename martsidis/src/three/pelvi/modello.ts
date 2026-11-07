import type { Object3D } from 'three';
import type { ParametriStato } from './stati';

/** Elementi con un'etichetta HTML sopra il modello. */
export type IdEtichetta = 'vescica' | 'utero' | 'retto' | 'pavimento' | 'bacino';

/**
 * Interfaccia comune del modello: la implementano sia il modello procedurale (procedurale.ts)
 * sia quello caricato da .glb (glb.ts). Il resto del codice (scena, controlli, stati, etichette)
 * parla solo con questa interfaccia: per sostituire il modello non serve toccare altro.
 */
export type ModelloPelvi = {
  /** Nodo radice da aggiungere alla scena (centrato più o meno nell'origine, alto circa 2.4 unità). */
  radice: Object3D;
  /** Punti a cui agganciare le etichette (si muovono con gli organi). */
  ancore: Record<IdEtichetta, Object3D>;
  /** Punti di riferimento per frecce e goccia (coordinate locali alla radice). */
  riferimenti: {
    /** Sopra la vescica: da qui parte la freccia della pressione addominale */
    pressione: Object3D;
    /** Accanto all'utero: freccia della discesa */
    discesa: Object3D;
    /** Uscita dell'uretra: posizione della goccia */
    uretra: Object3D;
    /** Centro dell'amaca: sotto si mostrano le frecce di sostegno */
    centroAmaca: Object3D;
  };
  /** Applica i parametri di uno stato (anche intermedi, durante le transizioni). */
  applica: (p: ParametriStato) => void;
  dispose: () => void;
};
