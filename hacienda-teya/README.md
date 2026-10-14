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
- [ ] Fase 3: hacienda 3D, scroll e resto del sito

## L'apertura (≈ 5 s, nessuna schermata di caricamento)
1. 0–1,6 s: la luce dorata sale, la pianta di henequén si apre e la luce radente scopre la fascia di lino rojo almagre
2. 0,85 s: la spina in punta al cogollo si stacca e tira fuori la fibra (ago e filo dalla stessa pianta, come facevano i Maya),
   sale dietro il lino e lo buca dal retro sull'attacco della "H"
3. 1,5–4,05 s: la spina ricama "Hacienda Teya": i primi punti sono lenti (l'ago attraversa ogni foro, il filo segue,
   si tende e il punto si stende sul lino), poi il ritmo accelera in time-lapse. Il puntino della "i" è un nodo francese
4. 3,95 s: "Desde 1683"; 4,25 s: "Reservar mesa"; poi barra, didascalia e "Desliza para entrar"
- "Saltar" (in basso a destra) porta alla fine in 0,6 s; con `prefers-reduced-motion` si parte dalla fine

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
- `src/main.js`: renderer, inquadratura adattiva, timeline GSAP, parallax del mouse

## Mobile
`src/config.js` → `QUALITY`: meno foglie e segmenti, lino meno suddiviso, filo a 5 lati invece di 7-8,
meno particelle, ombre a 1024, niente frange (le estremità del lino sono fuori schermo).
In verticale la scritta va su due righe e "Reservar mesa" scende nella zona del pollice.
Forzare la qualità mobile su desktop: `?mobile`.

## Da completare prima della consegna
- `LINKS.reservarViva` in `src/config.js`: link OpenTable di Teya Viva (non trovato)
- Link WhatsApp per sede (fase 3)

## Debug
- `?t=2.5`: ferma l'apertura a 2,5 s
- `?capture`: espone `window.__teya.frame(t)` per registrare un video fotogramma per fotogramma
  (la simulazione dei fili avanza a 30 fps anche tra un fotogramma e l'altro)
- `?nopost`: senza post-processing
