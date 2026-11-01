# Villa Pedramar — piano di lavoro (passaggio di consegne tra sessioni)

**Branch di lavoro: `claude/lucid-fermi-w7vjzy`** (repository tan1a66/DEMOAS). Se la sessione ha un altro branch
assegnato, partire da questo: `git fetch origin claude/lucid-fermi-w7vjzy` e continuare da lì.
La chiave Runpod è in `RUNPOD_API_KEY` (Alessia l'ha impostata nell'ambiente; permessi "All", credito 10–15 $).

Leggere tutto prima di lavorare. Scrivere ad Alessia **in italiano**, frasi brevi e chiare.
**Chiedere sempre ad Alessia quando c'è una scelta da fare** (richiesta esplicita, con AskUserQuestion).

## Chi, cosa, quando
- Cliente: Alessia, Alessia Studio (siti web 3D immersivi). Demo privata per un costruttore di ville spagnolo
  ("¿Tienes algún proyecto con acabados realistas?").
- Villa reale: TM2 di Gatti/Piu, Terra Mala (Quartu Sant'Elena, Sardegna). Nel sito si chiama **Villa Pedramar**,
  con sotto **DEMO ALESSIA STUDIO**, sempre visibile in alto a sinistra.
- Lingue: spagnolo (predefinito) e italiano, selettore ES/IT. Tutti i testi in `src/data/villa.json`.
- **Scadenza: domenica 1 novembre 2026, sera.** Budget GPU: 10–15 € su Runpod (approvato).

## Decisioni di Alessia (in ordine)
1. Prima versione con foto + profondità (visore in `src/viewer/`) e plastico 3D: **bocciata** ("è solo un montaggio di foto").
2. Plastico stile maquette / notturno in tempo reale: **bocciato** ("sembra un videogioco"). Anche la demo Xelha
   (branch `claude/clever-keller-zvhdc1`) per lei era "troppo finta, 3D scarso".
3. **Obiettivo attuale: render così realistici da far venire il dubbio che siano foto**, resi navigabili.
4. Interazione scelta: **render navigabile** (render precalcolati, non tempo reale).
5. Configuratore di materiali: **rimandato**, non farlo ora.
6. **Tutta la casa in 3D navigabile, NIENTE FOTO, tutto render, qualità massima possibile.**
   Soggiorno e cucina sono **un unico ambiente** (open space a doppia altezza).
7. Ora del giorno **selezionabile: mattina, tramonto, notte.**
8. Render su **Runpod** con chiave API in `RUNPOD_API_KEY` (variabile d'ambiente, mai in chat, mai stampata).

## Cosa consegnare (domenica sera)
Un sito (Vite + Three.js + GSAP, in questo repository) che mostra solo render:
- **Esterno**: giro a 360° intorno alla villa trascinando (fotogrammi renderizzati, ~48 per giro) per
  mattina / tramonto / notte; punti per entrare.
- **Interni e terrazza**: panorami sferici 360° (equirettangolari, ~6000×3000) in cui ci si guarda intorno,
  collegati da passi (dissolvenza con spinta in avanti). Punti previsti, in ordine di priorità:
  1. soggiorno (centro della doppia altezza)  2. cucina/pranzo (stesso ambiente)  3. scala / ballatoio
  4. camera padronale (vetrata sul vuoto)  5. bagno padronale  6. terrazza/piscina  7. passaggio in pietra.
  Ogni punto nelle 3 ore del giorno se il tempo lo permette (priorità: tramonto, poi notte, poi mattina).
- Selettore ora del giorno, ES/IT, marchio, indicatore della stanza, finiture (punti con pannello, testi già in villa.json),
  CTA finale "Agenda una visita" (WhatsApp 393461758562), `noindex`, deploy (Vercel o file unico `npm run build:preview`).

## Pipeline di render (cartella `render/`)
- `lib.py`: coordinate villa (x verso la strada, y quota, z verso sud → Blender X, -Z, Y), materiali fisici
  (Poly Haven CC0), vetro sottile senza riflessione interna, marmo nero, tessuti, mare, terreno, luci, portali,
  post-produzione fotografica, GPU automatica (OptiX/CUDA, se no CPU).
- `salon.py`: soggiorno di prova (inquadratura della foto 08). Da allargare a tutta la casa in `villa.py`.
- `fetch_assets.py`: scarica texture/HDRI/modelli in `render/assets/` (non nel repo).
- `runpod.py` + `farm_server.py`: Pod con RTX 4090. Flusso:
  ```bash
  python3 render/runpod.py up            # crea il Pod (COMMUNITY, ~0,4–0,7 $/h)
  python3 render/runpod.py status        # aspetta "ready": true (installazione bpy ~3-5 min)
  python3 render/runpod.py push          # invia script e villa.json
  python3 render/runpod.py run assets -- render/fetch_assets.py   # gli asset li scarica il Pod
  python3 render/runpod.py run salon -- render/salon.py --preview
  python3 render/runpod.py wait salon
  python3 render/runpod.py pull render/out/salon_preview.jpg render/out/salon_preview.jpg
  python3 render/runpod.py down          # SEMPRE alla fine: termina il Pod
  ```
  Nota: `run` usa il Python del Pod; fetch_assets.py usa solo la libreria standard.
  Nota (31/10): il cloud COMMUNITY era vuoto per tutte le GPU; Alessia ha scelto **RTX 4090 SECURE (0,89 $/h)**:
  `python3 render/runpod.py up --cloud SECURE`. Cloudflare blocca lo User-Agent "Python-urllib" (errore 1010):
  runpod.py ora manda un User-Agent proprio.
  **Spegnere il Pod quando non si renderizza.** Tenere traccia delle ore (budget 10–15 €).
- In questo ambiente cloud (4 CPU) un'anteprima 960×640 del soggiorno richiede ~1 min; un finale ~1 h.
- **Tempi misurati sulla 4090 (OptiX), 31/10:** setup del Pod ~1 min, asset ~1 min, soggiorno anteprima
  960×640/48 campioni **10 s**, finale 1800×1200/640 campioni **25 s** (+ ~10 s di caricamento scena).
  Stima: panorama 6000×3000 ~3–4 min; 21 panorami ~75 min; giro esterno 3×48 fotogrammi ~1 h → ~2–3 $ in tutto.

## Cieli e asset scelti (render/fetch_assets.py)
- MATTINA `qwantani_mid_morning_puresky`, TRAMONTO `qwantani_sunset_puresky`, NOTTE `qwantani_dusk_2_puresky`
  (attenuato, ~0,1–0,2, con tutte le luci della casa accese). Sono HDRI di **solo cielo** della stessa serie:
  terreno, mare (a ~60 m sotto la villa) e costa lontana vanno modellati. `white_cliff_top` resta per la prova del soggiorno.
- Texture: rovere `laminate_floor_02`, boiserie `oak_veneer_01`, pietra `rustic_stone_wall_02`, cemento a vista
  `concrete_layers_02`, lastre `granite_tile`, deck `wood_floor_deck`, terreno `dry_ground_rocks`, velluto `velour_velvet`.
- Modelli: cespugli `shrub_01/02/04`, massi di granito `namaqualand_boulder_02/04`, pianta, vaso, libri.
  Gli arredi di Poly Haven sono classici/vintage: divani, poltrone, sedie, letto vanno modellati (vedi salon.py).

## Riferimenti geometrici
- `src/data/inventory.md`: lettura dei disegni (livelli, soppalco, scala, camere, piscina, pendenza) e finiture.
- `public/source/`: foto e disegni originali (solo riferimento: **nel sito finale niente foto**).
  Foto utili per la modellazione: 08/09/12/14/15/24 soggiorno-cucina-scala, 13 bar, 28/29 camera padronale,
  23 bagno in cantiere (parete verde salvia, lungo top con due lavabi, pavimento scuro), 02/03/05/06/11 terrazza e
  piscina, 19/20/26 facciata, 21/22 pietra e passaggio, 01 sbalzo, video del drone (copertura chiara con luci
  incassate, volume superiore rivestito in pietra, scala esterna in legno sul lato strada).
- Geometria dell'esterno già misurata in `src/data/villa.json` (levels, parts, site, lamps…).

## Stato al passaggio (1 novembre, mattina, seconda tornata)
**Richieste di Alessia del 1/11 (tutte fatte nel codice, render in corso o fatti):**
- sedie del pranzo girate verso il tavolo; libri sul tavolino in pila (prima sbordavano);
- giro esterno più fluido: **96 fotogrammi** (`--orbit-n 96`, cartelle `orbit96_<ora>`);
- pulsante **"Contáctanos / Contattaci"** (WhatsApp 393461758562);
- camera: cuscini appoggiati alla testata, niente porta finta accanto al comodino (al bagno si passa dalla
  cabina armadio dietro i pannelli neri), all'arrivo lo sguardo è sul letto (`start` in villa.json);
- divanetti della piscina e lettini rivolti al mare; bagno con wc e bidet sospesi;
- **elenco verticale degli ambienti** sempre visibile a sinistra (con salto diretto alla stanza);
- aggiunte "stile Xelha" scelte: anteprima WhatsApp (Open Graph, `SITE_URL=https://… npm run build`),
  suono d'ambiente (mare, cicale/grilli, accordi), **casa tagliata** (`--view section`),
  **video di arrivo** dal mare al soggiorno (`--view flight`, solo tramonto e notte).
- Pubblicazione: Alessia carica lo **ZIP di dist/** lei stessa (render/out/villa-pedramar-sito.zip).

**Render:** `python3 scripts/renders.py` converte tutto per il web (giro 1600/1024 WebP, panorami WebP 4096 e
6000, video MP4 con ffmpeg, sezioni, ritagli, og.jpg). Il passaggio in pietra non è stato rifatto (invariato).

**Pod:** 4090 SECURE 0,89 $/h (il cloud COMMUNITY non ha mai avuto 4090 libere). Credito ~3,1 $ all'avvio
della seconda tornata. Il Pod si termina da solo dopo 45 min di inattività (farm_server.py).

**Lezioni (per non ripetere errori):**
- Il container del Pod ha **31 GB di RAM**: al massimo due processi Blender con tutta la villa insieme (~9 GB l'uno),
  altrimenti SIGKILL (rc -9). Usare `coda.py` per mettere in fila i render.
- Mai chiamare uno script `queue.py` (o con il nome di un modulo standard): `bpy` lo importa al posto di quello vero.
- Spegnere il Pod appena finiscono i render: una sessione può interrompersi per ore (6 h perse a vuoto il 1/11).
- Nodo Mix di Blender 5: usare `lib.sock()` (le prese "A"/"B"/"Result" hanno nomi doppi Float/Color).
- Se si cambia qualcosa visibile dall'esterno, il giro va rifatto tutto (altrimenti i fotogrammi vecchi e nuovi
  si alternano e si vede uno sfarfallio).
