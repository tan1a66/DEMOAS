# Alessia Studio: sito vetrina 3D

```bash
npm install
npm run dev            # http://127.0.0.1:5173
npm run build          # dist/ (asset con hash)
npm run build:preview  # dist-preview/index.html: un unico file, si apre con doppio clic
```

Parametri utili nell'URL: `?lang=es|it|en|pt` lingua, `?q=low` / `?q=high` forza il livello di qualità,
`?still` senza parallasse, `?notext` senza testi.

## Percorso (scroll guidato)
Ogni gesto (rotella, trackpad, dito, frecce/PagGiù/spazio della tastiera, o il pulsante "Scroll") porta
alla sosta successiva; il passaggio tra due soste è un movimento continuo della telecamera.
0. Il muro rosa a cassero riempie lo schermo (niente mare attorno): la linea del loader si dissolve
   nell'orizzonte visto attraverso la finestra circolare
1. Accanto al divano verde: **ALESSIA STUDIO**, cosa facciamo in una riga, *Italia · México · Colombia · Worldwide*
2. Sotto il lucernario: **Visión**
3. Fuori sulla terrazza, davanti al mare: **Qué hacemos**, i servizi in tre gruppi
4. Nello stesso gesto: fino al bordo della terrazza, una pausa davanti al sole, poi il tuffo, lento
5. Sott'acqua, **i servizi**: due grandi testi che galleggiano nell'acqua, uno per sosta (Sitios 3D
   inmersivos · Marca y contenido; dietro si intravede il successivo); un tocco li fa increspare.
   Dopo *Sitios 3D inmersivos* si scende sul fondale: una scultura 3D (anello di cemento rosa e nodo verde,
   `src/sculpture.js`) che si gira trascinandola col dito o col mouse; mentre la si gira lo scroll resta fermo
6. Lo sguardo sale verso la luce: **Contáctanos**

Sott'acqua: due squaletti nuotano attorno ai testi (toccati, scattano via); il puntatore scosta le
bollicine, un tocco nell'acqua libera uno sbuffo di bollicine e fa increspare il testo, trascinare il dito
(o muovere il mouse) lascia una scia.

Sempre visibili: lingua (ES · IT · EN · PT, in alto a destra: si apre nella lingua del telefono o del computer, inglese
se non è tra le quattro; la scelta viene ricordata), WhatsApp (in
basso a destra) e l'invito a scorrere.

## Contenuti (`src/content.js`)
Tutti i testi stanno in un solo file, in quattro lingue (spagnolo predefinito). Visione e servizi sono una
prima bozza. Contatti in `CONTACT_LINKS`: solo WhatsApp `+39 346 175 8562`, niente email (il pulsante apre la chat
con un messaggio pronto nella lingua scelta).
Sott'acqua i servizi stanno in `SERVICES` e, per ogni lingua, in `deep.items` (titolo su due righe, una
riga di dettaglio, messaggio WhatsApp pronto). Niente demo di clienti. Aggiungere o togliere un servizio
cambia da solo il percorso sott'acqua.

## Struttura
- `src/layout.js`: misure, soli, palette (condiviso tra runtime e pipeline)
- `src/loader.js`: loader (avanzamento in byte reali via `THREE.LoadingManager`)
- `src/scene.js`: carica GLB (Draco) e texture KTX2, assegna i materiali
- `src/materials.js`: cemento (illuminazione fisica mappata sulla palette rosa), cuscini in velluto, fascio di luce, pulviscolo
- `src/camera-path.js`: `CatmullRomCurve3` per posizione e target, chiavi con durata (soste), mappa monotona,
  smorzamento; inquadratura dei testi sott'acqua adattata alla forma dello schermo
- `src/guide.js`: scroll guidato (un gesto = una sosta) con GSAP
- `src/overlay.js`: testi sopra il canvas, lingua, WhatsApp, invito a scorrere
- `src/words.js`: i servizi sott'acqua, testi nella scena 3D che galleggiano nell'acqua
- `src/sculpture.js`: il fondale di sabbia e la scultura da girare (inerzia, poi gira piano da sola)
- `src/underwater.js`: testi dei servizi, bollicine (anche al tocco), pulviscolo
- `src/sharks.js`: i due squaletti (geometria procedurale, nuoto nel vertex shader)
- `src/water-glsl.js`: colori e nebbia dell'acqua condivisi
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
node tools/shoot.mjs http://127.0.0.1:4173/ shots --q=high --stops            # desktop 1440x900
node tools/shoot.mjs http://127.0.0.1:4173/ shots-m --device=phone --stops    # 390x844 @2x
node tools/shoot.mjs http://127.0.0.1:4173/ shots-t --device=ipad --stops               # iPad 820x1180
node tools/shoot.mjs http://127.0.0.1:4173/ shots --q=high --mask --fps && node tools/check-colors.mjs shots
```
Dispositivi: `desktop`, `phone`, `phone-land`, `ipad`, `ipad-land`, `ipad-pro`. Opzioni: `--scroll` (gesti
reali di rotella), `--lang=it`, `--reduced` (prefers-reduced-motion), `--transition` (loader → orizzonte).

## Peso del primo caricamento
| livello | JS+CSS+HTML | decoder Draco/Basis | GLB + lightmap + texture | totale (gzip su JS/wasm) |
|---|---|---|---|---|
| desktop (alta) | 0,26 MB | 0,33 MB | 2,66 MB | ~3,3 MB |
| mobile / bassa | 0,26 MB | 0,33 MB | 1,17 MB | ~1,75 MB |

`npm run build:preview` produce `dist-preview/index.html`, un solo file con tutto incorporato (si apre
con doppio clic).

## Marchio, social e presentazione (`brand/`)
```bash
node tools/brand-kit.mjs                    # logo (SVG/PNG, verde e rosa), immagini del profilo, tavola dei colori
node tools/brand-pdf.mjs                    # brand/alessia-studio-brand-kit.pdf: il kit per chi prepara i post
node tools/presentation-pdf.mjs <cartella>           # brand/alessia-studio-presentacion.pdf: 16:9, 16 pagine, senza progetti né prezzi
node tools/presentation-pdf-vertical.mjs <cartella>  # brand/alessia-studio-presentacion-vertical.pdf: A4, 6 pagine, senza progetti né prezzi
# immagini senza testi, nelle proporzioni della pagina (niente ritagli):
#   orizzontale: shoot.mjs "<url>?still" <cartella> --size=1600x900 --notext --points=0,0.1,0.251,0.359,0.445,0.555,0.612,0.675
#   verticale:   shoot.mjs "<url>?still" <cartella> --size=1191x1684 --notext --points=0.251,0.359
```
Colori del marchio: solo **verde `#B8F03A`** e **rosa `#D4A39C`**. Font: Syne ExtraBold (logo e titoli), Inter
(testi), in `brand/fonts`. Le immagini del sito in formato post sono in `brand/sito`
(`node tools/shoot.mjs <url> <cartella> --device=insta --stops`). Contenuti comuni delle due presentazioni in
`tools/lib/presentacion.mjs`; `<cartella>` (facoltativa) contiene le immagini del sito senza testi (vedi sopra);
in mancanza si usano quelle di `brand/sito`.
