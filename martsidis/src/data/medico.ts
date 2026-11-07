/**
 * Curriculum del medico: fonte = CV fornito dal medico (novembre 2026) e dati del brief.
 * Non aggiungere titoli, numeri, percentuali o anni di esperienza che non siano qui.
 * Refusi del CV originale corretti (es. "subuertale" → "suburetrale"), senza cambiare il contenuto.
 */

export type VoceCurriculum = {
  periodo: string;
  titolo: string;
  ente?: string;
  dettaglio?: string;
};

export type Pubblicazione = {
  titolo: string;
  autori?: string;
  fonte: string;
  link?: string;
};

/** Aree di interesse dichiarate nel CV */
export const interessi = [
  'Uroginecologia',
  'Chirurgia del pavimento pelvico',
  'Chirurgia ginecologica vaginale, laparoscopica, laparotomica e isteroscopica',
  'Diagnostica ed ecografia delle alterazioni del pavimento pelvico',
  'Ecografia ginecologica e ostetrica',
];

export const formazione: VoceCurriculum[] = [
  {
    periodo: '2016',
    titolo: 'Specializzazione in Ginecologia e Ostetricia, a pieni voti e lode',
    ente: 'Università degli Studi di Cagliari',
    dettaglio:
    'Tesi: risultati anatomici, funzionali e sulla qualità di vita della correzione dell’incontinenza urinaria da sforzo femminile con TVT transotturatoria.',
  },
  {
    // [DA VERIFICARE: nel CV il corso al Galliera è indicato sia nel 2014 (gennaio–giugno) sia nel 2012]
    periodo: '2014',
    titolo: 'Corso avanzato di Uroginecologia — frequenza di perfezionamento di 6 mesi',
    ente: 'E.O. Ospedali Galliera, Genova (tutor dott. M. Garaventa)',
    dettaglio:
      'Attività ambulatoriale e approccio multidisciplinare di uroginecologia; chirurgia vaginale di correzione del prolasso degli organi pelvici e dell’incontinenza urinaria.',
  },
  {
    periodo: '2009',
    titolo: 'Laurea in Medicina e Chirurgia',
    ente: 'Università degli Studi di Cagliari',
    dettaglio:
      'Tesi: risultati anatomici, funzionali e sulla qualità di vita della correzione dell’incontinenza urinaria da sforzo con TVT in pazienti con prolasso degli organi pelvici.',
  },
  {
    periodo: '2009',
    titolo: 'Iscrizione all’Albo dei Medici Chirurghi della Provincia di Cagliari, n. 9190',
  },
  {
    periodo: '1997',
    titolo: 'Diploma di maturità scientifica',
    ente: 'Liceo scientifico, Atene',
  },
];

export const esperienze: VoceCurriculum[] = [
  {
    // [DA VERIFICARE: il brief indica "dal 2013", il CV "2014 a tuttora". Ancora attuale?]
    periodo: 'dal 2014',
    titolo:
      'Responsabile dell’Ambulatorio di Uroginecologia e del Centro per lo studio e la terapia delle alterazioni del pavimento pelvico e dell’incontinenza urinaria nella donna',
    ente: 'Policlinico Universitario di Cagliari',
  },
  {
    // [DA VERIFICARE: ancora attuale?]
    periodo: 'dal 2016',
    titolo: 'Aiuto primario, reparto di Ginecologia e Ostetricia',
    ente: 'Nuova Casa di Cura di Decimomannu (Cagliari)',
  },
  {
    periodo: '2010 – 2014',
    titolo:
      'Collaboratore del Centro per lo studio e la terapia delle alterazioni del pavimento pelvico e dell’incontinenza urinaria nella donna',
    ente: 'Policlinico Universitario di Cagliari',
  },
  {
    periodo: '2011 – 2012',
    titolo: 'Partner ufficiale dello studio sperimentale sull’incontinenza fecale dopo il parto “TASI-2 EMG Detection”',
  },
  {
    periodo: '2009 – 2010',
    titolo: 'Medico interno associato, Clinica di Ginecologia e Ostetricia',
    ente: 'Ospedale Civile San Giovanni di Dio, Cagliari',
  },
  {
    periodo: '2009 – 2017',
    titolo: 'Sostituzioni di Medicina Generale e Servizio di Continuità Assistenziale (ex Guardia Medica)',
  },
];

export const societa = [
  {
    sigla: 'AIUG',
    nome: 'Associazione Italiana di Urologia Ginecologica e del Pavimento Pelvico',
    ruolo: 'Socio dal 2014',
  },
];

export const premi: VoceCurriculum[] = [
  {
    periodo: '2011',
    titolo: 'Premio per la migliore presentazione libera, XXI Congresso Nazionale AIUG (Torino)',
    dettaglio:
      '“Nuovo metodo di valutazione oggettiva non invasiva dell’incontinenza anale post-partum. Fattori di rischio, fisiopatologia, prevenzione. Risultati preliminari.”',
  },
];

export const pubblicazioni: Pubblicazione[] = [
  {
    titolo:
      'Characterization of the motor units of the external anal sphincter in pregnant women with multichannel surface EMG',
    autori: 'Cescon C., Raimondi E.E., Začesta V., Drusany-Starič K., Martsidis K., Merletti R.',
    fonte: 'International Urogynecology Journal, 2014;25(8):1097-103',
    link: 'https://pubmed.ncbi.nlm.nih.gov/24623258/',
  },
  {
    titolo:
      'Effect of vaginal delivery on the external anal sphincter muscle innervation pattern evaluated by multichannel surface EMG: results of the multicentre study TASI-2',
    autori: 'Cescon C., Riva D., Začesta V., Drusany-Starič K., Martsidis K., Protsepko O., Baessler K., Merletti R.',
    fonte: 'International Urogynecology Journal, 2014;25(11):1491-9',
    link: 'https://pubmed.ncbi.nlm.nih.gov/24687366/',
  },
  {
    titolo:
      'Evaluation of child delivery trauma on anal sphincter muscle by means of surface electromyography (results of the multicenter study TASI-2)',
    autori: 'Začesta V., Zelenova O., Drusany-Starič K., Raimondi E.E., Martsidis K., Protsepko O., Baessler K., Cescon C., Merletti R.',
    fonte: 'XIV European Congress of Perinatal Medicine, Firenze, 2014',
  },
  {
    titolo:
      'Effect of vaginal delivery on external anal sphincter muscle innervation pattern evaluated with multichannel surface EMG (results of the multicenter study TASI-2)',
    autori:
      'Drusany-Starič K., Cescon C., Lukanović A., Začesta V., Zelenova O., Riva D., Raimondi E.E., Martsidis K., Protsepko O., Baessler K., Barbero M., Merletti R.',
    fonte: 'ICS 2012, Pechino',
  },
  {
    titolo: 'The role of caesarean section in modern obstetrics',
    fonte: 'Journal of Pediatric and Neonatal Individualized Medicine, 2012',
  },
  {
    titolo:
      'Nuovo metodo di valutazione oggettiva non invasiva dell’incontinenza anale post-partum. Fattori di rischio, fisiopatologia, prevenzione: risultati preliminari',
    fonte: 'Congresso Nazionale AIUG, Torino, 2011',
  },
  {
    titolo:
      'Distribution of innervation zones of the external anal sphincter and changes after vaginal delivery: preliminary results of a multicenter study – TASI-2',
    autori: 'Baessler K., Cescon C., Drusany K., Raimondi E.E., Riva D., Martsidis K., Marongiu D., Rezeberga D., Začesta V., Merletti R.',
    fonte: 'ICS/IUGA 2010, Toronto',
  },
  {
    titolo:
      'L’uroflussometria come primo step nell’iter diagnostico delle alterazioni del pavimento pelvico e dell’incontinenza urinaria nella donna',
    autori: 'Marotto M.F., Marongiu D., Floris S., Martsidis K. et al.',
    fonte: 'La medicina della riproduzione e della sessualità, Cleup, Padova, 2010, pp. 392-396',
  },
  {
    titolo:
      'Follow-up a lungo termine della correzione dell’incontinenza urinaria da sforzo con TVT in pazienti con prolasso degli organi pelvici',
    fonte: 'La medicina della riproduzione e della sessualità, Cleup, Padova, 2010, pp. 397-399',
  },
  {
    titolo:
      'Psychological distress in women suffering from anterior vaginal wall prolapse with or without urinary incontinence',
    autori: 'Floris S., Melis G.B., Mameli S., Paoletti A.M., Melis M., Minerba L., Giordini L., Martsidis K. et al.',
    fonte: 'ICS 2007, Rotterdam',
  },
];

export const attiCongressuali: string[] = [
  'Valutazione oggettiva non invasiva dell’incontinenza anale post-partum. Fattori di rischio, fisiopatologia, prevenzione. Risultati preliminari — Terze Giornate Sarde di Scienze Ostetriche e Ginecologiche, Alghero, 2011',
  'Risultati del trattamento dell’incontinenza urinaria da sforzo con sling suburetrale — Terze Giornate Sarde di Scienze Ostetriche e Ginecologiche, Alghero, 2011',
  'Valutazione oggettiva non invasiva dell’incontinenza anale post-partum: nuovo metodo di indagine non invasivo. Risultati preliminari — La medicina della riproduzione, Cleup, Padova, 2011, pp. 517-521',
  'Risultati del trattamento dell’incontinenza urinaria da sforzo con sling suburetrale TVT, TVT-O, TVT-S — La medicina della riproduzione, Cleup, Padova, 2011, pp. 523-525',
  'Risultati a lungo termine della correzione dell’incontinenza urinaria da sforzo con TVT in pazienti con prolasso uterino — Seconde Giornate Sarde di Scienze Ostetriche e Ginecologiche, Alghero, 2009',
  'Valutazione prospettica dei sintomi del basso tratto urinario e della funzione anorettale in donne sottoposte a isterectomia vaginale e riparazione del pavimento pelvico per prolasso degli organi pelvici: effetti sulla qualità di vita — Alghero, 2009',
  'Incontinenza urinaria occulta in donne con prolasso della parete vaginale anteriore — XI Congresso Nazionale Società Italiana della Menopausa, Sassari-Alghero, 2007',
  'Valutazione basale del muscolo pubo-coccigeo in donne con o senza incontinenza urinaria e prolasso degli organi pelvici — XI Congresso Nazionale Società Italiana della Menopausa, 2007',
  'Ruolo della linfadenectomia nel carcinoma dell’endometrio stadio IA (classificazione FIGO 2009) — Terze Giornate Sarde di Scienze Ostetriche e Ginecologiche, Alghero, 2011',
  'La prevenzione delle aderenze dopo miomectomia — Giornale Italiano di Ostetricia e Ginecologia, 2008',
  'Multidisciplinary approach to adhesion prevention — International Society for Gynecologic Endoscopy, 2007',
  'Contraccezione ormonale in donne trapiantate — Terze Giornate Sarde di Scienze Ostetriche e Ginecologiche, 2011',
  'Trattamenti medici alternativi o complementari alla HRT — 2007',
  'La laparoscopia in oncologia ginecologica: vantaggi e svantaggi — 2007',
];

/** Corsi e congressi (attestati di partecipazione), dal più recente. */
export const corsi: string[] = [
  'Seste Giornate Sarde di Scienze Ostetriche e Ginecologiche (moderatore), 2017',
  'Il dolore pelvico, corso di aggiornamento multidisciplinare, Cagliari, 2017',
  'Highlights in chirurgia uroginecologica: la scelta della via vaginale nei difetti del pavimento pelvico, Conegliano, 2017',
  'Relatore: “Valutazione di eventuali lesioni perineali da parto vaginale”, congresso nazionale “Dalla cura all’aver cura della donna”, Cagliari, 2016',
  'Workshop on Gynaecological CO2 Laser Procedures, Ospedale San Raffaele, Milano, 2016',
  'L’approccio multidisciplinare nel trattamento dei difetti del pavimento pelvico, corso di chirurgia mini-invasiva, Peschiera del Garda, 2016',
  'Corso teorico-pratico di uroginecologia e disfunzioni del pavimento pelvico, AIUG Live Surgery, Sassari, 2016',
  'Multidisciplinary management of pelvic floor diseases, Pisa, 2016',
  '1° Congresso Nazionale di Video-Chirurgia Ginecologica, Cagliari, 2016',
  'Il trattamento mini-invasivo del prolasso genitale e dell’incontinenza urinaria femminile, AIUG Live Surgery, Oristano, 2015',
  'Corso di formazione di Chirurgia del Pavimento Pelvico, Abano, 2015',
  'La riabilitazione del pavimento pelvico, corso di formazione, Cagliari, 2015',
  'Pavimento pelvico: la gestione dell’incontinenza urinaria, Genova, 2014',
  'Corso teorico-pratico di ecografia in sala parto, Monserrato, 2014',
  'Congresso SIGO, AOGOI, AGUI “Isola donna al centro del mondo medico e sociale”, Cagliari, 2014',
  'Ecosistema vaginale e patologie correlate: percorsi diagnostici e terapeutici, Cagliari, 2013',
  'Difetti del pavimento pelvico, dall’anatomia alla chirurgia, Cagliari, 2012',
  'Patologia del pavimento pelvico e incontinenza urinaria, Oristano, 2012',
  'Workshop di chirurgia mini-invasiva avanzata “Endometrio: patologie benigne e maligne”, Cagliari, 2012',
  'Workshop teorico-pratico di ecografia funzionale del pavimento pelvico, XXI Congresso Nazionale AIUG, Torino, 2011',
  'La pelvi: centro di gravità permanente, XXI Congresso Nazionale AIUG, Torino, 2011',
  'Primo incontro di formazione in Uroginecologia, Napoli, 2010',
  'Workshop di chirurgia mini-invasiva, chirurgia ambulatoriale e day surgery, 4° corso ESGE-AGUI, Cagliari, 2010',
  'Corso regionale di uroginecologia, Nuoro, 2009',
  'Prevenzione della patologia del basso tratto genitale femminile, Cagliari, 2009',
  'Corso teorico-pratico di chirurgia mini-invasiva in ginecologia e urologia, Cagliari, 2008',
  'Endometriosi, Contraccezione, Menopausa, I Congresso Nazionale congiunto SIC, SIM, AIE, Cagliari, 2008',
];

export const strumentazione = {
  ecografo: 'Samsung HM70A Plus',
  caratteristiche: 'con immagini 2D, 3D e 4D (3D in tempo reale)',
};

/** Servizi offerti in studio (elenco fornito dal medico). */
export const serviziElenco = [
  'Visita uroginecologica',
  'Esame urodinamico e uroflussometria',
  'Visita ginecologica',
  "Visita ostetrica, dal concepimento all'allattamento",
  'Ecografia ginecologica e ostetrica, transvaginale e transaddominale, 3D/4D',
  'Pap test e test HPV',
  'Trattamenti laser',
  'Riabilitazione del pavimento pelvico',
  'Visite ed ecografie a domicilio',
];

/** Condizioni trattate (brief + vecchia pagina Uroginecologia). */
export const condizioniElenco = [
  'Incontinenza urinaria da sforzo, da urgenza e mista',
  'Vescica iperattiva',
  'Prolasso genitale: cistocele, isterocele, rettocele, prolasso della cupola vaginale',
  'Disfunzioni del pavimento pelvico dopo il parto, anche ritenzione urinaria post-partum',
  'Cistiti ricorrenti e cistite interstiziale',
  'Dolore durante i rapporti (dispareunia) e dolore pelvico',
  'Atrofia vaginale e sintomi della menopausa',
  'Fistole vescico-vaginali',
];
