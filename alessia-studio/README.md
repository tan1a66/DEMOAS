# Alessia Studio: sito vetrina 3D

```bash
npm install
npm run dev            # http://127.0.0.1:5173
npm run build          # dist/ (asset con hash)
npm run build:preview  # dist-preview/index.html: un unico file, si apre con doppio clic
```

Parametri utili nell'URL: `?q=low` / `?q=high` forza il livello di qualità, `?still` senza parallasse,
`?notext` senza testi.

## Percorso
1. Il muro rosa a cassero riempie lo schermo (niente mare attorno): la linea del loader si dissolve
   nell'orizzonte visto attraverso la finestra circolare
2. Attraversamento della finestra → sosta accanto al divano verde: **ALESSIA STUDIO**
3. Lo sguardo sale al lucernario: **Visione**, cosa facciamo, servizi
4. Il fascio di sole, la grande apertura, la terrazza con il sole basso
5. In fondo alla terrazza ci si tuffa nel mare: **ogni bolla è un progetto** (una sosta per bolla)
6. Oltre l'ultima bolla, lo sguardo sale verso la luce: **Contattaci**

## Contenuti (`src/content.js`)
Tutti i testi stanno in un solo file. Visione e servizi sono una prima bozza; **i contatti sono segnaposto**
(`ciao@esempio.it`): vanno messi quelli veri (i campi vuoti non vengono mostrati).
I progetti sono le 8 demo fatte finora (URBAZ, Piedra de Agua, Picheta, Avv. Pusceddu, Hacienda Teya,
Antica Roma, CARNAL, Il Calabrese). Per ogni progetto:
- `image`: anteprima dentro la bolla, file `src/assets/projects/<id>.jpg` (quadrato, ~768 px).
  Quelle attuali sono screenshot delle demo (per Pusceddu l'immagine di anteprima della demo stessa)
- `url`: link per "Apri la demo" (vuoto = nessun pulsante: le demo non sono ancora pubblicate)
Aggiungere o togliere un progetto allunga o accorcia da solo il percorso sott'acqua e lo scroll.

## Struttura
- `src/layout.js`: misure, soli, palette (condiviso tra runtime e pipeline)
- `src/loader.js`: loader (avanzamento in byte reali via `THREE.LoadingManager`)
- `src/scene.js`: carica GLB (Draco) e texture KTX2, assegna i materiali
- `src/materials.js`: cemento (illuminazione fisica mappata sulla palette rosa), cuscini in velluto, fascio di luce, pulviscolo
- `src/camera-path.js`: `CatmullRomCurve3` per posizione e target, chiavi con durata di scroll (soste), mappa monotona, smorzamento
- `src/overlay.js`: i testi sopra il canvas, sincronizzati con la telecamera
- `src/underwater.js`: bolle dei progetti, bollicine, pulviscolo
- `src/sea.js`: cielo + mare infinito in un unico shader (onde, scia del sole, ombra e riflesso dell'edificio, schiuma)
- `src/lights.js`: soli, esposizione, mappa d'ombra opzionale del pit
- `src/post.js`: MSAA, bloom, vignettatura, grana
- `src/parallax.js`: mouse / giroscopio (con fallback), disattivato con `prefers-reduced-motion`
- `src/quality.js`: livelli di qualità e risoluzione adattiva
- `src/scene/*`: geometria procedurale (usata dalla pipeline)

## Asset (`npm run assets`)
- `tools/textures.mjs`: superfici in cemento a cassero e liscio → `assets/tex/*.ktx2` (UASTC + Zstd, 1024 e 512)
- `tools/scene/build.mjs`: geometria → atlante della lightmap → bake su CPU (three-mesh-bvh, worker):
  visibilità del sole, cielo, 3 rimbalzi → `assets/lightmap-{2048,1024}.ktx2` e `assets/scene.glb` (Draco)
- `tools/fetch-textures.mjs`: scarica un cemento reale CC0 (Poly Haven / ambientCG) in `tools/.cache/base/`;
  se presente, `tools/textures.mjs` lo fonde come micro-dettaglio. **In questo ambiente i due siti sono
  bloccati dalla rete**: le texture attuali vengono solo dal generatore procedurale.
- `tools/shoot.mjs`: screenshot e fps lungo il percorso (Playwright)
- `tools/check-colors.mjs`: controllo automatico dei colori sugli screenshot (con `--mask`)

## Test
```bash
npm run build && npx vite preview --port 4173 &
node tools/shoot.mjs http://127.0.0.1:4173/ shots --q=high --mask --fps          # desktop 1440x900
node tools/shoot.mjs http://127.0.0.1:4173/ shots-m --mobile --q=high --mask --fps # 390x844 @2x
node tools/check-colors.mjs shots
```
Opzioni: `--scroll` (rotella reale), `--reduced` (prefers-reduced-motion), `--transition` (loader → orizzonte).

## Peso del primo caricamento
| livello | JS+CSS+HTML | decoder Draco/Basis | GLB + lightmap + texture | totale (gzip su JS/wasm) |
|---|---|---|---|---|
| desktop (alta) | 0,26 MB | 0,33 MB | 2,66 MB | ~3,3 MB |
| mobile / bassa | 0,26 MB | 0,33 MB | 1,17 MB | ~1,75 MB |

Le anteprime dei progetti (~0,5 MB in tutto) si scaricano solo arrivando sulla terrazza, non nel primo caricamento.
