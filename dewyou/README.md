# DEWYOU — demo (proposta Alessia Studio)

Demo privata del nuovo sito di DEWYOU, workouts faciales, Nail Bar e Snack & Collagen Bar in
Plaza ESPACIO, Puerto Cancún. **Non è il sito ufficiale** (`noindex`). Testi in spagnolo del
Messico. Stessa base della demo Skin Beauty (Vite + Three.js + GSAP + Lenis), ma al posto degli
attrezzi di legno ci sono **gli oggetti DEWYOU in 3D**: la gua sha d'acciaio con il logo, il
rullo a microcorrente, la pelota índigo, la lattina di collagen matcha, il siero, lo smalto, il
balsamo labbra e una goccia "dew" iridescente.

```bash
cd dewyou
npm install
npm run dev            # http://localhost:5173  (?static = versione senza animazioni)
npm run build          # sito in dist/ (per Vercel)
npm run build:preview  # UN solo file: dist-preview/index.html (doppio clic per aprirlo)
```

`dev/tools.html` mostra gli otto oggetti 3D insieme per ritoccare le forme.

## Percorso
1. **Apertura**: la gua sha entra da destra e scopre la pagina. "Glow your way, *every day*"
   (il claim del sito attuale), Reserva su AgendaPro, 4,7 ★ e lo stato aperto/chiuso con l'ora
   di Cancún.
2. **Face Workout** (sezione fissata): la gua sha gigante attraversa lo schermo; a sinistra
   "Masaje profundo" (Deep Lift, LiftTouch), a destra "Tech & boosters"; le due metà si fondono
   in **FACE WORKOUT** con gli oggetti in orbita.
3. **El espacio**: il render del lounge con gli specchi a goccia ritagliato a forma di specchio,
   la foto del masaje Deep Lift (da cui escono la goccia e il siero), testi del sito attuale.
4. **Menú**: Workouts faciales (con le foto del sito), Add ons, Nail Bar, Makeup & Lashes, Self
   Care Club. Ogni scheda apre la ficha con prezzo, durata, Reservar en AgendaPro e WhatsApp.
5. **Snack & Collagen Bar**: il menù delle bevande con i prezzi e una cinta di bevande.
6. **Reseñas**: 4,7 ★ e 7 recensioni vere di AgendaPro.
7. **Visítanos**: mappa (OpenFreeMap) con il punto del locale, orario, WhatsApp, email, social.
8. **Reserva tu glow**: bottone finale con gli oggetti in cerchio e il −10% sulla prima cita.

## Colori e caratteri
- Prugna `#584059` (il colore di AgendaPro e del sito), lilla `#DDCFE8`, crema `#FFFCF7`,
  salvia `#7E8884`, matcha `#D8D690`, pesca `#DE9780` per i prezzi, corallo `#F26262` solo sul
  rullo a microcorrente.
- **Logo e unicorno**: i file ufficiali del sito, usati come maschera (si colorano con CSS).
- **Titoli**: Archivo largo (OFL) al posto di **PP Telegraf** del sito attuale, che è a
  pagamento. **Corsivo**: Sacramento (OFL), vicino a Halimun. **Testi**: Manrope.
- Il riflesso del metallo è una stanza crema e lilla con strisce di luce calda (i LED degli
  specchi), in `createEnvironment()` di `src/three/materials.js`.

## Dati e fonti (novembre 2026)
In `src/data/content.js`:
- **AgendaPro** (pagina pubblica della sucursal 422266): listino con prezzi, recensioni (4,7 su
  18), coordinate, WhatsApp **+52 998 183 3333**, social.
- **dewyou.com.mx**: descrizioni dei workout e degli add ons, menù Nail Bar, Self Care Club
  (membresías da $3,000 e $4,500 al mese), menù del Collagen Bar, −10% prima cita,
  info@dewyou.com.mx, foto e render.
- **Instagram @dewyoumx**: Plaza ESPACIO, orario 10:00–19:00, frasi del brand.
- Le immagini si rigenerano con `npm run assets -- <cartella con gli originali>`
  (`scripts/build-assets.py`); icone con `python3 scripts/icons.py`, anteprima del link con
  `node scripts/og.cjs` (sito avviato).

## Da confermare con la cliente
- **Prezzi**: sono quelli di AgendaPro (più recenti). Il menù Nail Bar del sito ha prezzi più
  bassi; il menù del Collagen Bar è quello del sito (agosto 2025) e potrebbe non includere i
  nuovi snack (ensalada Kani, ecc.).
- **Orario**: Instagram e sito dicono 10:00–19:00; AgendaPro prende prenotazioni dalle 10:15.
- **Descrizioni proposte** dove AgendaPro e sito non ne hanno: DEWTOX, GLOWTOX, Lash Lifting,
  Lami Brows, Extracción de impurezas.
- Le foto e i render sono quelli del sito attuale: per il sito finale servono gli originali in
  alta risoluzione e qualche foto vera del locale finito.

## Anteprima del link
`public/og.jpg` (1200×630, il hero vero), `favicon.ico`, `favicon-32.png` e
`apple-touch-icon.png` (l'unicorno crema su prugna). I tag in `index.html` puntano a
`https://dewyou-alessiastudio.vercel.app/`: se il progetto Vercel ha un altro nome, cambiare
l'indirizzo lì.

**Per pubblicare su Vercel**: caricare la cartella `dist/` (dopo `npm run build`) oppure
importare il repository con *Root Directory* = `dewyou` (`vercel.json` fa già la build). Se si
carica solo un file HTML, il link arriva senza anteprima.
