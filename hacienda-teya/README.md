# Hacienda Teya — demo 3D (proposta Alessia Studio)

Demo di redesign del sito di Hacienda Teya come esperienza 3D (Vite + Three.js + GSAP + pmndrs/postprocessing).
**Solo per uso locale/presentazione: non pubblicare e non fare deploy.**

```bash
npm install
npm run dev            # http://localhost:5173
npm run build:preview  # dist-preview/index.html: un solo file, si apre con doppio clic
```

## Stato
- [x] Fase 1: concept
- [x] Fase 2: apertura (pianta di henequén + la spina-ago che ricama "Hacienda Teya" sul lino)
- [x] Fase 3: hacienda 3D, scroll e resto del sito

## L'apertura (≈ 5 s, nessuna schermata di caricamento)
1. 0–1,6 s: la luce dorata sale, la pianta di henequén si apre e la luce radente scopre la fascia di lino rojo almagre
2. 0,85 s: la spina in punta al cogollo si stacca e tira fuori la fibra (ago e filo dalla stessa pianta, come facevano i Maya),
   sale dietro il lino e lo buca dal retro sull'attacco della "H"
3. 1,5–4,05 s: la spina ricama "Hacienda Teya": i primi punti sono lenti (l'ago attraversa ogni foro, il filo segue,
   si tende e il punto si stende sul lino), poi il ritmo accelera in time-lapse. Il puntino della "i" è un nodo francese
4. 3,95 s: "Desde 1683"; 4,25 s: "Reservar mesa"; poi barra, didascalia e "Desliza para entrar"
- "Saltar" (in basso a destra) porta alla fine in 0,6 s; con `prefers-reduced-motion` si parte dalla fine

## Il percorso (fase 3)
Ogni capitolo dell'HTML (`[data-chapter]`) dichiara un'inquadratura (`data-cam`, vedi `SHOTS` in `src/scroll.js`)
e una luce (`data-mood`, vedi `MOODS` in `src/world/timeOfDay.js`). La camera arriva sull'inquadratura "in"
all'inizio del capitolo e scivola su quella "out" alla fine: si muove poco mentre si legge e viaggia nei passaggi.

| Capitolo | Camera | Luce |
|---|---|---|
| Hero | posa finale dell'apertura | palco |
| Campo · "Antes" | il lino vola via legato al filo, il colore se ne va (foto d'epoca in seppia): la pianta diventa una delle tante del campo di henequén, con il binario e i carrelli di pencas | dorata, seppia |
| Nuestra historia | linea del tempo in 7 tappe davanti alla portada: il 3D passa dal henequén all'abbandono (il campo appassisce, cresce il monte, l'intonaco cade), al restauro e a oggi (prato, alberi, torna il colore) | dorata, seppia → colore |
| Bienvenidos | si passa sotto l'arco, cancelli aperti, cortile e Casa Principal | dorata |
| El Restaurante | la Casa Principal con la loggia e il lampadario | dorata |
| Eventos | la tavolata sul prato sotto le luci appese, che si accendono a onda | tramonto |
| Nuestras casas | vista alta sul cortile, tre schede con identità diverse | ora blu |
| Noches de trova | l'angolo con chitarra e sedia sulla terrazza | notte |
| Contacto | vista aerea notturna | notte |

Il filo torna come motivo: parole "cucite" (Bodas, Corporativos, Familiares, Trova) con la stessa linea
centrale del titolo, impunture sotto i titoli, bordi tratteggiati dei pannelli, la linea del tempo della storia.

### Antes → Hoy (linea del tempo)
Tappe in `#historia` (`index.html`): 1683 fondazione · secoli XVII–XIX bestiame e mais · fine '800 henequén ·
prima metà del '900 abbandono · 1974 rinascita · 1987–1991 restauro · 1995–oggi ristorante (dati forniti dal cliente).
L'avanzamento nel capitolo sceglie la tappa (GSAP) e l'epoca del 3D (`src/world/era.js`, `STOP_ERA`):
- `src/world/epochs.js`: binario Decauville, carrelli di pencas, tendederos con la fibra, monte (boscaglia istanziata), alberi del giardino
- `src/world/materials.js` → `RUIN_GLSL`: intonaco caduto con la muratura a vista, muffa; il terreno passa da solchi a monte a prato
- `src/scene/post.js` → `MemoryEffect`: viraggio seppia da foto d'epoca (grigio freddo negli anni dell'abbandono), grana, polvere, graffi
- cliccando una data della linea del tempo si scorre fino a quella tappa

## Struttura
- `scripts/build-thread.mjs`: **genera `src/data/thread-paths.json`** (`npm run thread`).
  opentype.js → rasterizzazione → scheletro (Zhang-Suen) → grafo → percorso "a mano".
  Usa la linea centrale delle lettere (il contorno darebbe lettere "vuote"). Due impaginazioni:
  `wide` (una riga, desktop) e `tall` (due righe, mobile). `--debug <cartella>` salva le immagini di controllo.
- `fonts/`: Great Vibes (Google Fonts, licenza OFL) usato solo dallo script
- `src/config.js`: qualità desktop/mobile, palette, tempi dell'apertura, link OpenTable
- `src/scene/layout.js`: dove stanno scritta e fascia di lino rispetto alla camera
- `src/scene/fabric.js`: lino (trama tela procedurale, vento, avvallamento sotto l'ago, controluce, frange) e luce radente del ricamo
- `src/scene/embroidery.js`: punti (punto indietro, ripassi nascosti dietro il lino), traiettoria e tempi dell'ago, fili liberi
- `src/scene/fiber.js`: materiale del filo (tre capi ritorti), tubo dinamico, corda simulata (Verlet)
- `src/scene/needle.js`: la spina-ago
- `src/scene/agave.js`: henequén procedurale (InstancedMesh, foglia con canale/dentini/spina, vento e traslucenza nello shader)
- `src/scene/atmosphere.js`: environment di tramonto generato (niente HDRI da scaricare), cielo, luci, terra rossa, polvere
- `src/scene/post.js`: bloom, ACES Filmic, vignettatura, grana
- `src/main.js`: renderer, inquadratura adattiva, timeline GSAP, scroll, luce, parallax del mouse
- `src/scroll.js`: Lenis, inquadrature dei capitoli (`SHOTS`), percorso della camera e ora del giorno
- `src/world/timeOfDay.js`: le luci (palco, dorata, tramonto, ora blu, notte) e come si mescolano
- `src/world/materials.js`: materiali PBR procedurali in coordinate mondo (intonaco almagre, calce, cantera,
  legno, ferro, bronzo, terracotta, sascab del viale, terra rossa del campo, pavimento a lastre)
- `src/world/architecture.js`: muri con archi, cornici, scale, colonne, copete delle finestre, inferriate, campane, lanterne
- `src/world/hacienda.js`: portale d'ingresso con espadaña, muri del cortile, Casa Principal (`SITE` = misure)
- `src/world/vegetation.js`: campo di henequén (stessa foglia dell'apertura, istanziata), alberi, palme reali, vasi
- `src/world/props.js`: tavolata degli eventi, luci appese, angolo della trova, luci notturne
- `src/ui/sections.js`: parole cucite, impunture, comparsa dei pannelli, link

## Mobile
`src/config.js` → `QUALITY`: meno foglie e segmenti, lino meno suddiviso, filo a 5 lati invece di 7-8,
meno particelle, ombre a 1024, niente frange (le estremità del lino sono fuori schermo).
In verticale la scritta va su due righe e "Reservar mesa" scende nella zona del pollice.
Forzare la qualità mobile su desktop: `?mobile`.

L'HDRI di tramonto (`@pmndrs/assets/hdri/sunset.exr`, CC0) si carica dopo l'apertura e sostituisce
l'environment generato. SSAO (N8AO) solo su desktop.

## Da completare prima della consegna
I link mancanti sono segnaposto visibili (sottolineatura tratteggiata, tooltip "… por confirmar"):
- `LINKS.reservarViva` in `src/config.js`: link OpenTable di Teya Viva (non trovato)
- `WHATSAPP` in `src/config.js`: numero WhatsApp di ogni sede
- `LINKS.menu`: link al menù
- Foto dei piatti (`.dish__photo` in `index.html`): ora riquadri "Foto · …"; piatti e testi sono d'esempio

## Debug
- `?t=2.5`: ferma l'apertura a 2,5 s
- `?capture`: espone `window.__teya.frame(t)` per registrare un video fotogramma per fotogramma
  (la simulazione dei fili avanza a 30 fps anche tra un fotogramma e l'altro)
- `?nopost`: senza post-processing
- con `?capture` anche `await window.__teya.scroll(s)` porta il percorso allo scroll `s ∈ [0,1]`
