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
- [x] Fase 2: apertura (pianta di henequén + filo che scrive "Hacienda Teya")
- [ ] Fase 3: hacienda 3D, scroll e resto del sito

## L'apertura (≈ 4,8 s, nessuna schermata di caricamento)
1. 0–1,6 s: la luce dorata sale e la pianta si apre come un bocciolo
2. 0,75 s: il filo nasce dal cogollo, piega a sinistra sotto il pulsante e scende nella "H"
3. 0,75–3,75 s: il filo scrive "Hacienda Teya" (rallenta nelle curve, accelera nei tratti dritti);
   tra tratti staccati "passa dietro" un tessuto invisibile; il puntino della "i" è un nodo francese
4. 3,7 s: "Desde 1683"; 4,0 s: "Reservar mesa"; poi barra, didascalia e "Desliza para entrar"
- "Saltar" (in basso a destra) porta alla fine in 0,6 s; con `prefers-reduced-motion` si parte dalla fine

## Struttura
- `scripts/build-thread.mjs`: **genera `src/data/thread-paths.json`** (`npm run thread`).
  opentype.js → rasterizzazione → scheletro (Zhang-Suen) → grafo → percorso "a mano".
  Usa la linea centrale delle lettere (il contorno darebbe lettere "vuote"). Due impaginazioni:
  `wide` (una riga, desktop) e `tall` (due righe, mobile). `--debug <cartella>` salva le immagini di controllo.
- `fonts/`: Great Vibes (Google Fonts, licenza OFL) usato solo dallo script
- `src/config.js`: qualità desktop/mobile, palette, tempi dell'apertura, link OpenTable
- `src/scene/agave.js`: henequén procedurale (InstancedMesh, foglia con canale/dentini/spina, vento e traslucenza nello shader)
- `src/scene/thread.js`: il filo (tubo a trasporto parallelo, drawRange animato, torsione a 3 capi, fibre sfilacciate)
- `src/scene/atmosphere.js`: environment di tramonto generato (niente HDRI da scaricare), cielo, luci, terra rossa, polvere
- `src/scene/post.js`: bloom, ACES Filmic, vignettatura, grana
- `src/main.js`: renderer, inquadratura adattiva, timeline GSAP, parallax del mouse

## Mobile
`src/config.js` → `QUALITY`: meno foglie e segmenti, tubo a 6 lati invece di 10, meno particelle e fibre,
ombre a 1024. In verticale la scritta va su due righe e "Reservar mesa" scende nella zona del pollice.
Forzare la qualità mobile su desktop: `?mobile`.

## Da completare prima della consegna
- `LINKS.reservarViva` in `src/config.js`: link OpenTable di Teya Viva (non trovato)
- Link WhatsApp per sede (fase 3)

## Debug
- `?t=2.5`: ferma l'apertura a 2,5 s
- `?capture`: espone `window.__teya.frame(t)` per registrare un video fotogramma per fotogramma
- `?nopost`: senza post-processing
