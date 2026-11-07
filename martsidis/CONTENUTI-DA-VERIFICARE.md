# Contenuti da verificare prima della pubblicazione

Sito del **Dott. Konstantinos Martsidis**: elenco di tutto ciò che il medico deve **fornire** o **approvare** prima di andare online.
I testi sono stati scritti come bozza a partire dal brief, dal curriculum e dal vecchio sito, rispettando il Codice di Deontologia Medica (artt. 55–57): niente promesse di risultato, niente superlativi, niente prezzi promozionali.

Come usare questo file: spuntare `[x]` ogni voce approvata, oppure annotare accanto la correzione. Nel codice le stesse voci sono segnate `[DA VERIFICARE]` (approvazione) o `[DA INSERIRE]` (dato mancante, visibile in pagina). A ogni `npm run build` compare l'elenco dei segnaposti ancora presenti.

---

## 1. Dati da fornire (mancano)

- [ ] **Orari di ricevimento**: giorni e fasce orarie. Vanno in `src/data/sito.ts` → `orari`. Finché mancano, in tutte le pagine compare "[DA INSERIRE: orari di ricevimento]".
- [ ] **Foto del medico** (ritratto, verticale, almeno 1200 px sul lato lungo). → `src/assets/foto/ritratto.jpg`
- [ ] **Foto dello studio**: sala d'attesa (`studio-1.jpg`) e ambulatorio (`studio-2.jpg`), orizzontali.
- [ ] **Foto dell'ecografo** Samsung HM70A Plus (`ecografo.jpg`).
- [ ] **Link alla scheda Google** del medico (Google Business Profile), per il pulsante "Leggi le recensioni su Google". Oggi il link è una ricerca su Google Maps.
- [ ] **Elenco dei vecchi URL** del sito attuale, per completare i redirect 301 (`public/_redirects`). Si ricava da Google Search Console → Pagine, o dalla sitemap del vecchio sito.
- [ ] **Dott.ssa Manuela Frau**: numero di iscrizione all'Ordine Nazionale dei Biologi, foto (`nutrizionista.jpg`) e consenso scritto alla pubblicazione di nome e foto.
- [ ] **Recensioni** (facoltativo): solo recensioni reali, già pubblicate, con il consenso scritto della paziente. Vanno in `src/data/recensioni.ts`; finché la lista è vuota il sito mostra solo il rimando a Google.

## 2. Dati anagrafici e professionali

- [ ] **Ruolo ospedaliero**, dicitura breve usata in home, intestazioni e footer: *"Responsabile dell'Ambulatorio di Uroginecologia del Policlinico Universitario di Cagliari"*. È ancora attuale? Va bene così o serve la dicitura completa del CV (*"…e Centro per lo studio e la terapia delle alterazioni del pavimento pelvico e dell'incontinenza urinaria nella donna"*)?
- [ ] **Anno di inizio del ruolo**: il brief dice **2013**, il CV dice **2014**. Sul sito oggi c'è **2014**.
- [ ] **Aiuto primario**, reparto di Ginecologia e Ostetricia, Nuova Casa di Cura di Decimomannu (dal 2016): ancora attuale?
- [ ] **Corso avanzato di Uroginecologia al Galliera di Genova**: nel CV compare sia **2014** (gennaio–giugno, 6 mesi, tutor dott. Garaventa) sia **2012** ("Frequenza di 6 mesi…"). Quale anno è corretto? Sono due esperienze diverse?
- [ ] **Iscrizione all'Ordine dei Medici di Cagliari n. 9190**: confermata dal CV.
- [ ] **P.IVA 03309520326**: fornita.
- [ ] **Email kgmartsi@yahoo.it**: si può pubblicare nella pagina Contatti? È l'indirizzo giusto per le richieste privacy, o meglio una PEC?
- [ ] **Indirizzo**: Via Edmondo De Magistris 29, primo piano, 09123 Cagliari. Il punto sulla mappa è sulla via, non sul portone esatto. Va spostato?
- [ ] **Dominio**: il sito è configurato su `https://www.ginecologiacagliari.com` (con *www*). Va bene, o il dominio principale deve essere senza *www*?
- [ ] **Lingue**: italiano, inglese, greco.

## 3. Home (`/`)

- [ ] Titolo: *"Incontinenza, prolasso, disturbi del pavimento pelvico: problemi comuni, che si possono curare."*
- [ ] Sottotitolo con il ruolo ospedaliero (vedi punto 2).
- [ ] Riga di rassicurazione: *"Riservatezza e ascolto, senza fretta"*.
- [ ] Le 5 frasi delle card ("Perdo urina quando tossisco o rido", ecc.).
- [ ] Sezione "Chi è": *"si occupa da sempre dei disturbi del pavimento pelvico: nella pratica clinica, in sala operatoria e nella ricerca"*; *"autore di lavori scientifici sul pavimento pelvico pubblicati su riviste internazionali"* (sono le due pubblicazioni su *International Urogynecology Journal*, 2014).
- [ ] I tre passi della prima visita.
- [ ] "Non serve spiegare il motivo della visita, se non lo desidera".

## 4. Modello 3D del pavimento pelvico (in Home)

- [ ] I testi dei 4 stati (Normale, Incontinenza da sforzo, Prolasso, Riabilitazione) e la descrizione testuale completa. File: `src/three/pelvi/stati.ts`.
- [ ] Il modello è volutamente stilizzato ("Rappresentazione semplificata a scopo divulgativo"): va bene la semplificazione anatomica (ad esempio: nel prolasso scende l'utero)?

## 5. Uroginecologia (`/uroginecologia/`)

- [ ] Definizione dell'uroginecologo.
- [ ] Elenco "Altri disturbi" (dal vecchio sito): cistiti ricorrenti e cistite interstiziale, atrofia vaginale, ritenzione urinaria post-partum, dolore pelvico cronico, fistole vescico-vaginali.
- [ ] Elenco esami e trattamenti in ambulatorio, compresi "laser o radiofrequenza" ed "ecografia uroginecologica".
- [ ] **Interventi chirurgici** (dal vecchio sito): prolasso uterino per via vaginale; incontinenza urinaria da sforzo; correzione dell'iperattività detrusoriale. Sono ancora eseguiti? Dove (Policlinico, Decimomannu)? Va scritto dove?

## 6. Pagine di condizione

Tutte seguono lo schema: *non è un problema raro → sintomi → cause → diagnosi → trattamenti (dal più semplice al più impegnativo) → domande frequenti → contatto*. Va approvato ogni testo.

### Incontinenza urinaria (`/uroginecologia/incontinenza-urinaria/`)
- [ ] Trattamenti: abitudini → riabilitazione (*"di solito il primo trattamento consigliato"*) → estrogeni locali e farmaci → laser/radiofrequenza in casi selezionati → sling suburetrale.
- [ ] Frase sul medico: *"un tema a cui il Dott. Martsidis ha dedicato anche le sue tesi e diversi lavori scientifici"* (tesi di laurea 2009 e di specializzazione 2016 sulla TVT/TVT-O, e diversi atti congressuali).
- [ ] FAQ: esercizi (*"per molte donne… sono di grande aiuto"*), intervento, imbarazzo, sport.

### Prolasso genitale (`/uroginecologia/prolasso-genitale/`)
- [ ] Tipi di prolasso, pessario, *"spesso per via vaginale, cioè senza tagli sull'addome"*.
- [ ] FAQ: *"nella grande maggioranza dei casi non è pericoloso"*.

### Vescica iperattiva (`/uroginecologia/vescica-iperattiva/`)
- [ ] Trattamenti di secondo livello citati: stimolazione del nervo tibiale, tossina botulinica intravescicale. Li esegue o li indirizza? Si possono lasciare come informazione generale?

### Pavimento pelvico dopo il parto (`/uroginecologia/pavimento-pelvico-post-parto/`)
- [ ] Frase: *"Il Dott. Martsidis ha partecipato a uno studio multicentrico europeo sugli effetti del parto sul pavimento pelvico (studio TASI-2)"*.
- [ ] FAQ sui tempi del controllo (nessun numero di settimane indicato, di proposito).

### Dolore nei rapporti (`/uroginecologia/dolore-nei-rapporti/`)
- [ ] Elenco cause e trattamenti, compreso il supporto sessuologico/psicologico.

## 7. Servizi

### Esame urodinamico (`/esame-urodinamico/`)
- [ ] Si esegue **nello studio privato**? (lo dice anche la pagina Lo Studio)
- [ ] Durata: *"in genere meno di un'ora"*.
- [ ] Preparazione: urinocoltura (entro quanti giorni?), vescica piena all'arrivo, diario minzionale, farmaci.
- [ ] La sonda per la pressione addominale è vaginale o rettale? (oggi il testo non lo specifica)
- [ ] Gestione del ciclo mestruale.

### Ginecologia (`/ginecologia/`)
- [ ] Elenco dei servizi ripreso dal vecchio sito. **Esclusi in attesa di conferma**: *Fibroadenoma* (riguarda il seno: lo segue?) e *Vaginoplastica* (la esegue? dove?).
- [ ] Screening: il vecchio sito diceva "visita e Pap test annuali". Qui non c'è nessuna cadenza (*"Le indicherà il Dottore, in base ai programmi di screening"*), perché i programmi regionali prevedono intervalli diversi.
- [ ] Contraccezione, compresa l'applicazione della spirale in studio.

### Ostetricia (`/ostetricia/`)
- [ ] Elenco esami ed epoche gestazionali (dal vecchio sito): Doppler arterie uterine 23ª–25ª, accrescimento 29ª–31ª, Doppler materno-fetale 30ª–35ª, stima del peso 33ª–34ª, canale cervicale, tamponi.
- [ ] Non sono citati di proposito: ecografia morfologica, translucenza nucale, test combinato. Vanno aggiunti? (Per la translucenza serve indicare la certificazione.)
- [ ] FAQ sul rapporto con il percorso nascita pubblico.

### Ecografia 3D/4D (`/ecografia-3d-4d/`)
- [ ] Preparazione per la transaddominale (quanta acqua e quanto prima).
- [ ] Vengono consegnate immagini 3D/4D alla paziente?
- [ ] Paragrafo sull'ecografia uroginecologica.

### Laser (`/laser/`): **tutta la pagina da approvare**
- [ ] Apparecchio: il vecchio sito cita **FemiLift** (laser CO2 frazionato). Il testo dice "laser CO2 frazionato" senza nominare il marchio. Corretto? Va nominato?
- [ ] Indicazioni elencate (dal vecchio sito): secchezza/sindrome genitourinaria della menopausa, dolore nei rapporti legato alla secchezza, lassità dopo il parto, incontinenza da sforzo lieve, condilomi e lesioni del collo dell'utero.
- [ ] Radiofrequenza vaginale: la esegue?
- [ ] Condilomi e lesioni del collo dell'utero: quali accertamenti prima (colposcopia, biopsia)?
- [ ] Numero di sedute, intervallo, eventuale anestesia locale, indicazioni dopo la seduta.
- [ ] **Tolte di proposito dal vecchio testo** (non ammesse dagli artt. 55–57): *"sicuro, veloce e indolore"*, *"garantisce un miglioramento immediato e risultati duraturi"*, *"definitiva e permanente"*, *"elimina le infezioni"*, *"ringiovanimento"*. Non vanno reinserite.

### La prima visita (`/la-prima-visita/`)
- [ ] Durata: *"tra mezz'ora e un'ora"*.
- [ ] *"La visita in studio è privata e non serve l'impegnativa"*.
- [ ] *"Il costo Le viene comunicato al momento della prenotazione"*.
- [ ] *"Può restare con Lei anche durante la visita"* (accompagnatore).
- [ ] Esempio di diario minzionale.

### Visita a domicilio (`/visita-domiciliare/`)
- [ ] Zone servite (*"Cagliari e dintorni"*).
- [ ] Si porta l'ecografo a domicilio?

### Consulenza nutrizionale (`/consulenza-nutrizionale/`)
- [ ] Collaborazione ancora attiva con la Dott.ssa Manuela Frau.
- [ ] Come si prenota: stesso numero del Dott. Martsidis o un recapito della Dott.ssa Frau?
- [ ] I "pacchetti" del vecchio sito sono diventati "percorsi", senza prezzi. Va bene l'elenco (gravidanza, chetogenica, GLP-1, su misura)?

## 8. Altre pagine

### Prenota una visita (`/prenota-una-visita/`)
- [ ] FAQ su disdette e prenotazione per altre persone.
- [ ] Consiglio di non inviare referti su WhatsApp.

### Lo Studio (`/lo-studio/`)
- [ ] Accessibilità: c'è l'ascensore? Oggi il testo dice solo "primo piano" e invita a segnalare esigenze particolari.
- [ ] Didascalie delle foto (sala d'attesa, ambulatorio).

### Contatti (`/contatti/`)
- [ ] "Come arrivare": quartiere Tuvixeddu, vicino a Viale Trento e ai Giardini di Villa Devoto. Aggiungere parcheggi o linee di autobus?

### Curriculum Vitae (`/chi-sono/`)
- [ ] **Testo in prima persona** dell'introduzione ("Sono un ginecologo e mi occupo soprattutto di uroginecologia…").
- [ ] Elenco di pubblicazioni, atti e corsi: ripreso dal CV, con i refusi corretti (es. "subuertale" → "suburetrale", "ingagine" → "indagine"). In un atto del CV manca un nome d'autore ("Contraccezione ormonale in donne trapiantate, V. , C. Prasciolu…"): qui sono stati omessi gli autori. Va completato?
- [ ] La maturità (Liceo scientifico di Atene, 1997) è mostrata senza voto: va bene o va tolta?
- [ ] Il voto di laurea (106/110) non è mostrato: va bene?

### Privacy e Cookie (`/privacy/`, `/cookie/`)
- [ ] Testi base da far rivedere a un consulente privacy.
- [ ] Indicare il fornitore di hosting scelto (Cloudflare o Netlify).
- [ ] Se si attivano le statistiche: quale servizio (Plausible/Umami) e dove è ospitato.

---

## Cosa è stato tolto o non usato dal vecchio sito

- Foto stock di corpi (mani sull'inguine, pance): non usate. Le foto saranno reali (medico, studio, ecografo).
- Le promesse sul laser (vedi sopra).
- La cadenza "visita e Pap test annuali".
- I tre verdi del vecchio sito: sostituiti dalla palette viola + neutri caldi + salvia.
- I pulsanti "Sezione dedicata": ora i link descrivono la destinazione (accessibilità e SEO).
