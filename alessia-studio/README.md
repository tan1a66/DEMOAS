# Alessia Studio: scena 3D del sito vetrina

Solo la scena: nessun testo, logo o interfaccia. Sopra il canvas c'è un layer HTML vuoto
(`#overlay`) e lo scroll è diviso in capitoli vuoti (`#scroll .chapter[data-chapter]`), pronti
per ospitare i testi.

```bash
npm install
npm run dev            # http://127.0.0.1:5173
npm run build          # dist/ (asset con hash)
npm run build:preview  # dist-preview/index.html: un unico file, si apre con doppio clic
```

Parametri utili nell'URL: `?q=low` / `?q=high` forza il livello di qualità.

## Percorso
Loader rosa → la linea diventa l'orizzonte → monolite rosa sul mare → attraversamento della
finestra circolare → conversation pit (discesa, sguardo al lucernario con pausa nello scroll,
ripartenza attraverso il fascio di sole) → grande apertura → terrazza sospesa sul mare, la
telecamera si gira verso il sole basso.

## Struttura
- `src/layout.js`: misure, soli, palette (condiviso tra runtime e pipeline)
- `src/loader.js`: loader (avanzamento in byte reali via `THREE.LoadingManager`)
- `src/scene.js`: carica GLB (Draco) e texture KTX2, assegna i materiali
- `src/materials.js`: cemento (illuminazione fisica mappata sulla palette rosa), cuscini in velluto, fascio di luce, pulviscolo
- `src/camera-path.js`: `CatmullRomCurve3` per posizione e target, mappa scroll → percorso monotona (pausa), smorzamento
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
| desktop (alta) | 0,25 MB | 0,33 MB | 2,66 MB | ~3,2 MB |
| mobile / bassa | 0,25 MB | 0,33 MB | 1,17 MB | ~1,75 MB |
