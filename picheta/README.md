# Picheta — "El cielo de Mérida, hoy"

Demo dell'hero del nuovo sito di Picheta (cucina yucateca contemporanea, terrazza sulla Plaza Grande di Mérida).
La scena 3D è argilla color crema: l'unico colore è il cielo **reale** sopra Mérida in questo momento,
la luce che cade sugli edifici e il fuoco della cucina.

**Il film d'apertura** (~7,5 s): "Fuego lento." — si parte in cucina, davanti al fogón nel patio della
casona; la camera segue le braci su per il patio tra i portali e i farolitos, sbuca sopra il tetto e si posa
sulla terrazza davanti alla piazza: "Cielo abierto.". Scrollando, la camera torna a guardare giù nel patio,
verso il fuoco, mentre sale la sezione "La cocina".

Vite + Three.js + `suncalc`, JavaScript vanilla, una sola pagina.

```bash
cd picheta
npm install
npm run dev        # http://localhost:5173
npm run build      # build di produzione in dist/
npm run preview    # serve dist/ in locale
```

## Modalità per la presentazione

| URL / tasto | Cosa fa |
| --- | --- |
| `?t=18:10` | Forza un orario (ora di Mérida, oggi). |
| `?timelapse=1` | Dopo il film d'apertura, dalle 16:00 all'01:00 in ~40 s (rallenta attorno al tramonto), poi ricomincia. Opzionali: `&from=17:00&to=22:00&dur=30`, `&ease=0` (velocità costante). |
| `?d=2026-06-21` | Forza una data (es. il tramonto d'estate, alle 18:42). Si combina con `t` e `timelapse`. |
| `?lang=en` | Apre in inglese (altrimenti spagnolo, o l'ultima lingua scelta). |
| `?slider` | Mostra subito lo slider orario (utile su telefono, dove non c'è il tasto T). |
| `?nogl=1` | Forza il fallback senza WebGL (gradiente CSS). |
| `?intro=0` | Salta il film d'apertura (si parte già sulla terrazza). |
| `?introAt=3.4` | Congela il film in un istante (secondi): utile per screenshot e ritocchi. |
| Tasto **R** | Rivede il film d'apertura (anche il pulsante "▶ Intro" nello slider). |
| Tasto **T** | Mostra/nasconde lo slider orario. "En vivo" torna all'ora reale. |
| Tasti **1–9** (slider aperto) | Salti rapidi: 12:00, 16:30, 17:15, 17:45, 18:10, 18:40, 19:30, 21:30, 00:30. |

L'ora è sempre quella di Mérida (UTC−6 fisso, `America/Merida` non ha ora legale), ovunque si trovi chi guarda.

## Cosa sostituire

- **Logo**: mettere il file in `public/logo.png` e, in `index.html`, sostituire `<span class="brand-word">PICHETA</span>`
  con `<img class="brand-logo" src="/logo.png" alt="Picheta" />` (c'è un commento nel punto esatto).
- **Foto** della sezione "La cocina": sostituire `public/photos/01.jpg`, `02.jpg`, `03.jpg` (sono segnaposto).
  Proporzioni consigliate: 01 e 03 verticali 4:5, 02 orizzontale 4:3 (comunque vengono ritagliate con `object-fit: cover`).
- **Testi ES/EN**: `src/copy.js`.
- **Orari, coordinate, link prenotazioni, timelapse**: `src/config.js`.
- **Colori del cielo e della luce** per ogni momento: `src/palette.js` (keyframe per altitudine del sole).
- Prima di pubblicare il sito vero, togliere `<meta name="robots" content="noindex, nofollow">` da `index.html`.

## Logica del bottone di prenotazione

| Momento (ora di Mérida) | Testo ES |
| --- | --- |
| più di 60 min prima del tramonto | Reserva para el atardecer · hoy 17:34 |
| da 60 min prima a 30 min dopo | El sol se está poniendo. ¿Tienes mesa? |
| dopo, terrazza aperta (lun–sab 17–01, dom 17–23) | Esta noche, la terraza está abierta |
| dopo, fuori orario | Mañana, el atardecer es a las 17:33 (tramonto di domani) |

Prima delle 05:00 la notte appartiene ancora al giorno precedente (all'01:30 di martedì si parla della notte di lunedì).

## Struttura

- `src/main.js` — avvio: orologio, interfaccia, poi carica la scena WebGL con `import()` (se non c'è WebGL2, three.js non viene nemmeno scaricato).
- `src/time.js` — orologio di Mérida, `?t=`, timelapse, slider.
- `src/sun.js` — sole e luna con `suncalc`, tramonto di oggi/domani, orari di apertura.
- `src/palette.js` — keyframe del cielo (giorno, golden hour, tramonto, blue hour, notte), condivisi da WebGL e fallback CSS.
- `src/copy.js` — testi ES/EN e logica del bottone.
- `src/ui.js` — testi animati, switch lingua, bottone, slider; tinta del testo adattiva (scura di giorno, crema di notte).
- `src/intro.js` — **la regia del film**: keyframe della camera (tempo, posizione, inclinazione) e momenti dei testi. Per ritoccare la ripresa si cambiano solo questi numeri.
- `src/camera.js` — segue il film, poi camera da seduti con deriva lentissima e parallax mouse/giroscopio; con lo scroll torna a guardare nel patio.
- `src/scene/casona.js` — il patio coloniale a due piani con la cucina: fogón, legna, pentole, pass con i piatti, farolitos, tavoli al piano alto.
- `src/scene/fire.js` — fiamme procedurali, braci che salgono, fumo, luce del fuoco.
- `src/scene/clay.js` — il materiale "argilla": foschia che sale dal suolo, occlusione del patio, pavimenti a mosaico de pasta, vento sulle chiome.
- `src/scene/` (resto) — cielo con nuvole (shader), terrazza, piazza, alberi, edifici, cattedrale, zanates, post-processing (bloom solo sulle luci, grana e vignettatura).
- `src/fallback.js` — gradiente CSS del cielo se WebGL non è disponibile.

Note di regia: la composizione è stilizzata, non topografica. La camera guarda a sud dal lato nord della piazza
(cattedrale a sinistra, tramonto a destra); gli azimut reali di sole e luna vengono compressi
(`SKY_AZIMUTH_SCALE` / `LIGHT_AZIMUTH_SCALE` in `src/scene/index.js`) perché il bagliore del tramonto entri nell'inquadratura.

## Prestazioni

- Pixel ratio massimo 2, che scende da solo se il dispositivo non regge (min. 1).
- Geometria fusa in poche mesh, alberi istanziati, nessuna texture.
- Ombre ricalcolate solo quando il sole si sposta davvero; il rendering si ferma quando la sezione "La cocina" copre la scena.
- Occlusione ambientale analitica nello shader (niente GTAO in screen-space: più pulita e più leggera); su mobile shadow map più piccola.

## Deploy (Vercel o Netlify)

Il progetto vive nella cartella `picheta/` del repository.

- **Vercel**: importare il repository e impostare *Root Directory* = `picheta`. Il resto lo legge da `vercel.json` (framework Vite, output `dist`).
- **Netlify**: impostare *Base directory* = `picheta`. Build e cartella da pubblicare sono in `netlify.toml`.
- Oppure caricare a mano la cartella `dist/` dopo `npm run build` (qualsiasi hosting statico).

Il giroscopio su iOS richiede HTTPS e un tocco sullo schermo per chiedere il permesso; senza permesso resta il parallax al tocco e la deriva automatica.
