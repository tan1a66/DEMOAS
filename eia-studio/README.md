# ÉIA STUDIO — demo (proposta Alessia Studio)

Demo privata del nuovo sito di ÉIA Studio, Cejas & Beauty (Valdemoro, Madrid). **Non è il sito
ufficiale** (`noindex`). Testi in spagnolo di Spagna. Stessa struttura della demo Esmaltadas
(Vite + Three.js + GSAP), ma al posto della seta ci sono **mirtilli in 3D** (con qualche ciliegia
rosso smaltato), come nel moodboard della cliente.

```bash
cd eia-studio
npm install
npm run dev              # http://127.0.0.1:5183  (?debug per fps e tempi)
npm run build            # sito in dist/ (per Vercel)
npm run build:vercel     # deploy/: la pagina in un solo file + anteprima del link + icone
npm run build:anteprima  # anteprima in UN file: anteprima/eia-studio-anteprima.html
```

## I mirtilli (`src/berries/`)
- Un vassoio visto dall'alto, appena inclinato verso l'alto dello schermo: i mirtilli si
  ammucchiano in alto e lasciano libero il basso, dove sta il nome. Fisica a posizioni (PBD):
  sfere che cadono, si urtano e rotolano (`berries.js`); il mucchio a riposo si calcola
  all'apertura, prima del primo fotogramma.
- **Apertura**: piovono dall'alto e si posano. **Scroll**: il vassoio s'inclina di più e
  rotolano verso l'alto. **Dito**: dove passa li scansa (anche mentre la pagina scorre); un
  tocco li fa saltare. **Mouse**: passandoci sopra si apre un varco; un clic li fa saltare.
- Materiale (`shaders.js`): la pruina azzurra opaca, qualche zona strofinata dove si vede la
  buccia lucida, la corona in cima; le ciliegie laccate con il riflesso dello studio. Ombre di
  contatto sul piano (una piccola mappa ridisegnata a ogni fotogramma).
- La camera tiene il bordo del mucchio a una quota fissa dello schermo (62% sul telefono nella
  prima pagina, ~29% nel menu), misurandolo sulle bacche.
- Nelle sezioni la camera vola su un punto del mucchio; i mirtilli si fermano e un velo
  azzurro li schiarisce: le scritte restano mora e rosse (niente tema scuro, scelta della cliente).
- `?speed=4` (solo per le prove automatiche) accelera la fisica; `?still` salta la pioggia.

## Percorso
1. **Apertura**: ÉIA enorme in rosso smaltato, "Studio · Cejas & Beauty" sotto, i mirtilli sopra.
2. **Scroll**: le tre lettere salgono e diventano il marchio della barra; poi la frase
   "Primero, tu mirada." e il menu.
3. **Menu**: Servicios · Estudio · Reservar. In alto a destra: Instagram, Estudio, Reservar.

| Sezione | Stato |
| --- | --- |
| Servicios | Cejas, Pestañas, Micropigmentación, Uñas, Piel y cuerpo |
| Cejas | completa: La mirada, El laminado (4 passi), El acabado (il lucido si spegne e torna), De cerca, Precios, Tu cita → Reservar con il laminado già scelto |
| Pestañas, Micropigmentación, Uñas, Piel y cuerpo | **Work in progress** · Alessia Studio |
| Estudio | indirizzo, aperto/chiuso adesso (ora di Madrid), orario della settimana, servizi del locale, 4,9 ★ su Booksy, mappa, Cómo llegar, Instagram |
| Reservar | si sceglie il trattamento (prezzo, durata, cosa include), aperto/chiuso e orario; "Reservar en Booksy" apre la scheda Booksy (lì la disponibilità reale) |

## Colori e caratteri
- Azzurro `#BBD5EC` (lo sfondo della storia Instagram "En otro orden de prioridades…"),
  mirtilli `PALETTE` in `src/berries/berries.js`, rosso smaltato `#B0101D` (`--rojo`), mora
  `#270E12` per le scritte (il colore della foto profilo).
- **Marchio e titoli**: Bodoni Moda (variabile, grandezza ottica automatica), ridotto ai
  caratteri dello spagnolo con `scripts/build-fonts.py`. **Testi**: Cormorant Garamond.
  **Menu ed etichette**: Archivo largo. **Bottoni**: Manrope. Licenze OFL in `src/fonts/`.

## Dati (da confermare con la cliente)
Dalla scheda Booksy pubblica e dal profilo Instagram @eeia.studio (novembre 2026), in
`src/config.js` e `src/booking.js`:
- Glorieta de las Amazonas, 12 · 28341 Valdemoro (Madrid)
- Lunes a viernes 10:00–20:00, sábado 10:00–14:30, domingo cerrado; 7 e 8 dicembre chiuso
- Prenotazioni solo su Booksy: https://eiastudio.booksy.com/a (nessun WhatsApp pubblico)
- Prezzi: laminado 60 €, diseño y tinte 30 €, diseño 25 €, laminado + lifting 110 €, lifting
  50 €, micropigmentación 350 €, manicura rusa da 40 €, pedicura da 40 €, limpieza facial da
  60 €, láser diodo da 15 €

## Anteprima del link
`public/og-eia.jpg` (1200×630: una foto del sito vero, i mirtilli a riposo e il nome),
`public/favicon-96.png` e `public/apple-touch-icon.png` (la É, rosso su azzurro); si rifanno con
`node scripts/og-icons.cjs` (sito avviato e Playwright installato). I tag in `index.html` puntano
a `https://eiastudio-demo-alessiastudio.vercel.app/`: se il progetto Vercel ha un altro nome,
cambiare l'indirizzo lì.

**Per pubblicare su Vercel** l'immagine e le icone devono stare accanto alla pagina: caricare la
cartella `deploy/` (dopo `npm run build:vercel`) oppure `dist/` (dopo `npm run build`). Se si
carica solo il file HTML, il link arriva senza anteprima.
