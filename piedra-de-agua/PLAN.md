# Piano delle scene e delle transizioni

Un solo `WebGLRenderer`; ogni scena ha `update/render/resize/onEnter/onExit` e viene disegnata solo quando è attiva.
I testi sono HTML sopra il 3D (leggibili, navigabili da tastiera, traducibili ES/EN).

| # | Scena | 3D | Uscita |
|---|---|---|---|
| 0 | Loader | nome dell'hotel + barra sottile in ottone | dissolvenza sull'acqua |
| 1 | HOME | acqua vista dall'alto su mattonelle di pasta; onde simulate su GPU che reagiscono a mouse/tocco; rifrazione, caustiche; foglie, buganvillee e plumerie che galleggiano | click → bianco accecante (~1 s) |
| 2 | PORTONE | facciata in calce con balconi, portone a due ante con chiodi in ferro e sopraluce ad arco liberty; l'esposizione scende "come l'occhio che si abitua" | le ante si aprono verso l'interno, la camera attraversa lo zaguán ed entra nel patio (stessa scena, nessun taglio) |
| 3 | PATIO (hub) | 3 piani di colonne corinzie, balconi in ferro battuto, mattonelle, rampicanti, lanterne, ventilatori, tetto di vetro con raggi di sole e polvere luminosa, cascata di nastri verdi/azzurri mossi dall'aria; 4 porte liberty con targa in ottone | hover/tap: la targa si accende e la porta si socchiude → click: la camera vola, la porta si apre, luce calda → sezione. "Volver al patio": animazione inversa |
| 4 | NOSOTROS | slider 1845 (seppia, grana, carta) / hoy su patio.jpg e pasillo.jpg, timeline 1845 → INAH → hoy | |
| 5 | HABITACIONES | pulsantiera in ottone su muro di pietra calcarea; pulsante che si abbassa, spia, "clic"; pianta della stanza in ottone che cresce 16 → 25 → 35 → 60 m² | |
| 6 | SERVICIOS | quadri/nastri con cornice liberty in fila curva (drag/scroll), messa a fuoco al centro; foto a tutto schermo + WhatsApp; Bodas = terrazza 3D con lucine e Cattedrale, cielo dal giorno al tramonto | |
| 7 | EXPERIENCIAS | penisola dello Yucatán in rilievo, Mérida luminosa, pin, volo della camera, rotta tratteggiata, piramidi stilizzate, discesa nel cenote; Activaciones | |
| 8 | CONTACTO | sempre raggiungibile: WhatsApp fisso, indirizzo, mappa SVG del Centro, "a 2 min de la Catedral" | |
