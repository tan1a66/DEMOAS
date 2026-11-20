# ESMALTADAS — demo (proposta Alessia Studio)

Demo privata del nuovo sito di Esmaltadas, Nail & Beauty Studio (Mérida). **Non è il sito
ufficiale** (`noindex`). Testi in spagnolo. Stesso motore della demo SKY Medical Spa (Vite +
Three.js + GSAP): seta simulata nel vento, **senza giroscopio**.

```bash
cd esmaltadas
npm install
npm run dev              # http://127.0.0.1:5182  (?debug per fps e tempi)
npm run build            # sito in dist/ (per Vercel)
npm run build:anteprima  # anteprima in UN file: anteprima/esmaltadas-anteprima.html
```

## Percorso
1. **Apertura**: ESMALTADAS come nel logo (A senza traverso, bordeaux) e "Nail & Beauty Studio"
   sotto una seta **rosa antico** con un bordino bordeaux lungo l'orlo.
2. **Scroll**: le dieci lettere salgono una dopo l'altra e diventano il marchio della barra
   (a sinistra sul telefono, al centro sugli schermi larghi); poi la frase
   "Hechas para brillar." e il menu.
3. **Menu**: Servicios (Nails · Lashes · Brows · Hair) · Sucursales (Prime Center · Santa Fe ·
   Akropolis) · Agendar. Ogni voce è un luogo sulla seta: la camera ci vola.
4. **Dentro le sezioni** la seta scende a un rosa antico profondo e le scritte sono bianche
   (il bordeaux sottile sul rosa si perdeva). Titoli in Bellefair, testi in Cormorant.
   Le tre linee in alto riportano sempre al menu principale (anche da Nails);
   "Servicios / Nails" riporta a Servicios.

| Sezione | Stato |
| --- | --- |
| Servicios | pagina con Nails, Lashes, Brows, Hair |
| Nails | completa (vedi sotto) |
| Lashes, Brows, Hair | **Work in progress** · Alessia Studio (da costruire con la cliente) |
| Sucursales | si sceglie lo studio: indirizzo, orario e telefono, mappa, Cómo llegar, WhatsApp di quella sucursal, "Agendar en esta sucursal" |
| Agendar | servizio, sucursal, giorno (prossimi 12 giorni di apertura, domenica esclusa), fascia e **ora precisa** (ogni mezz'ora: mañana 10:00–12:30, mediodía 13:00–15:30, tarde 16:00–19:00; oggi solo gli orari ad almeno 30 minuti), nome → messaggio pronto su WhatsApp **al numero della sucursal scelta** |

In alto a destra: Instagram (@esmaltadasmx), Sucursales, WhatsApp (numero del profilo, Prime Center).

## Nails, la sezione sviluppata
Lo scroll guida la camera sulla seta (`data-cam` sui capitoli: direzione x,y,z e distanza).
1. "Nails" enorme che entra lettera per lettera, "El detalle que se nota."
2. **Cuidado**: UÑAS che si compone.
3. **El ritual**: Forma, Cutícula, Color, Brillo, con una linea che si disegna.
4. **Brillo**: la seta si spegne (opaca) e ritrova il lucido mentre la luce le passa sopra
   (`uGloss` nello shader). "Mira la seda".
5. **De cerca**: la camera si tuffa sul tessuto. "Cada detalle cuenta, uña por uña." (niente
   riferimenti al tempo: le clienti non vogliono pensare a un appuntamento lungo).
6. **Tu cita**: "Tus manos, listas." Il colore si sceglie in studio, con il muestrario
   (le clienti non lo sanno mai prima: niente scelta del colore sul sito). "Agenda tu manicure"
   apre Agendar con Nails già scelto.

## Colori e caratteri
- Fondo nude `#F2E8DE` (dal logo), seta rosa antico (`SILK_COLORS`), dettagli bordeaux
  `#84152F` (`--bordeaux` in `styles.css`; il bordino della seta è `trim` in `SILK_COLORS`).
  Nelle sezioni la seta usa `SILK_PROFONDO`.
- **Marchio**: "Esmaltadas Mark", cioè Italiana (Santiago Orozco) con la A senza traverso come
  nel logo: è la V ruotata di 180°, solo le lettere del nome (844 byte). Fatto con
  `scripts/build-fonts.py`.
- **Titoli**: Bellefair. **Testi**: Cormorant Garamond. **Menu ed etichette**: Archivo largo.
  **Bottoni e "Nail & Beauty Studio"**: Manrope. Tutti in `src/fonts/` con le licenze OFL,
  ridotti ai caratteri dello spagnolo.
- La forma a riposo della seta è la stessa della demo SKY (`src/silk/baked.js`, `npm run bake`
  se si cambiano misure, griglia o sotto-passi).

## Dati da confermare con la cliente
Dal profilo Instagram (@esmaltadasmx) e da schede pubbliche, in `src/config.js`:
- Prime Center: WhatsApp **+52 999 909 1003**; Plaza Prime Center, carretera Mérida–Progreso,
  Xcanatún (via e numero del locale non trovati)
- Santa Fe: WhatsApp **+52 999 640 9472**; Calle 23 por 62, Gran Santa Fe, Mérida 97314
- Akropolis: WhatsApp **+52 999 747 7499**; Plaza Akropolis, Fracc. Las Américas, Mérida 97302
- Orario: lunes a sábado, 10 a 20 h (dal profilo)
- Testi dei servizi (proposti): descrizioni di Nails, Lashes, Brows, Hair e del rituale

## Anteprima del link
`public/og.jpg` (1200×630, la prima schermata vera), `public/apple-touch-icon.png` e
`public/favicon-96.png` (la E del marchio, bordeaux su nude). I tag in `index.html` puntano a
`https://demo-esmaltadas-alessiastudio.vercel.app/`: se il dominio su Vercel è un altro,
aggiornare `og:url` e `og:image`.
