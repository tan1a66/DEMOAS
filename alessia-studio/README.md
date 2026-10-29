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
4. Nello stesso gesto, senza fermarsi: lungo la terrazza verso il sole, oltre il bordo e giù nell'acqua
   (5 secondi al massimo)
5. Sul fondale, la **statua di bronzo** con i due volti (`src/sculpture.js`), da girare trascinandola col dito o
   col mouse; mentre la si gira lo scroll resta fermo
6. Lo sguardo sale verso la luce: **Contáctanos**

Sott'acqua: due squali (1,5 e 1,15 m) girano attorno alla statua, con l'ombra sulla sabbia (toccati,
scattano via). Le bolle sono come quelle vere, grandi e piccole: bordo argentato, centro trasparente, le grandi
schiacciate e tremolanti; salgono piano a zigzag, in colonne dal fondo e sparse. Il puntatore scosta le bollicine, un
tocco nell'acqua libera uno sbuffo di bolle, trascinare il dito (o muovere il mouse) lascia una scia.

Sempre visibili: lingua (ES · IT · EN · PT, in alto a destra: si apre nella lingua del telefono o del computer, inglese
se non è tra le quattro; la scelta viene ricordata), WhatsApp (in
basso a destra) e l'invito a scorrere.

## Contenuti (`src/content.js`)
Tutti i testi stanno in un solo file, in quattro lingue (spagnolo predefinito). Visione e servizi sono una
prima bozza. Contatti in `CONTACT_LINKS`: solo WhatsApp `+39 346 175 8562`, niente email (il pulsante apre la chat
con un messaggio pronto nella lingua scelta).
Sul fondale c'è solo l'invito a girare la statua (`art`). Niente demo di clienti.

## Google e anteprime nei social
`vite.seo.js` scrive nell'HTML, al build, dai testi di `src/content.js` (`seo`, in spagnolo): titolo,
descrizione, icone, Open Graph e X con l'immagine `public/og-image.jpg` (1200x630), dati strutturati
schema.org e, per chi non esegue JavaScript, i testi del sito in una pagina semplice (`<noscript>`).
Nel sito titolo e descrizione seguono la lingua scelta. Il dominio (`https://alessia.studio/`, senza www) è in
`SITE_URL` (in `vite.seo.js`): l'immagine di anteprima è un indirizzo completo (WhatsApp e Facebook lo
richiedono) e ci sono link canonico e lingue alternative (`?lang=es|it|en|pt`). Il profilo Instagram è nei dati
strutturati (`sameAs`), non sul sito, dove come contatto resta solo WhatsApp.
Immagine e icone: `node tools/seo-assets.mjs <schermata>` (vedi in cima al file).

## Struttura
- `src/layout.js`: misure, soli, palette (condiviso tra runtime e pipeline)
- `src/loader.js`: loader (avanzamento in byte reali via `THREE.LoadingManager`)
- `src/scene.js`: carica GLB (Draco) e texture KTX2, assegna i materiali
- `src/materials.js`: cemento (illuminazione fisica mappata sulla palette rosa), cuscini in velluto, fascio di luce, pulviscolo
- `src/camera-path.js`: `CatmullRomCurve3` per posizione e target, chiavi con durata (soste), mappa monotona,
  smorzamento; inquadratura della scultura adattata alla forma dello schermo
- `src/guide.js`: scroll guidato (un gesto = una sosta) con GSAP
- `src/overlay.js`: testi sopra il canvas, lingua, WhatsApp, invito a scorrere
- `src/sculpture.js`: il fondale di sabbia e la statua da girare (bronzo con patina e rilievo dalle texture, inerzia,
  poi torna verso il davanti)
- `src/underwater.js`: statua, bolle (colonne dal fondo, sbuffi al tocco), pulviscolo
- `src/sharks.js`: i due squali (geometria procedurale con pinne a falce e coda asimmetrica, nuoto nel
  vertex shader, controombreggiatura, branchie, caustiche)
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
- `tools/statue.mjs`: la statua del fondale, dal GLB di Meshy (~18 MB, 370k triangoli, da mettere in
  `tools/.cache/statue/source.glb`, fuori dal repo) a `assets/statue.glb` (60k triangoli, Draco, ~250 KB) e
  `assets/tex/statue-{color,normal}-1024.ktx2`. Si scarica dopo l'apertura del sito (~1,7 MB). La statua
  riproduce un'opera esistente: va usata solo con l'autorizzazione di chi ne detiene i diritti
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

Dopo l'apertura si scarica la statua del fondale (~1,7 MB).

`npm run build:preview` produce `dist-preview/index.html`, un solo file con tutto incorporato (si apre
con doppio clic).

## Marchio, social e presentazione (`brand/`)
```bash
node tools/brand-kit.mjs                    # logo (SVG/PNG, verde e rosa), immagini del profilo, tavola dei colori
node tools/brand-pdf.mjs                    # brand/alessia-studio-brand-kit.pdf: il kit per chi prepara i post
node tools/presentation-pdf.mjs <cartella>           # brand/alessia-studio-presentacion.pdf: 16:9, 16 pagine, senza progetti né prezzi
node tools/ig-posts.mjs <cartella>                   # brand/instagram/post/: i primi 9 post (1080x1350) e la griglia
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
