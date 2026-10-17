# PICHETA — demo esperienza web 3D (proposta Alessia Studio)

Demo del nuovo sito di **Picheta** (cucina yucateca contemporanea "de autores", Pasaje Picheta,
Calle 61 #501, Mérida) come viaggio immersivo:

**Il cerchio (intro) → La casa in 3D: entrada → salón → reservado → escalera → terraza → vista**

Tutti i testi visibili sono in spagnolo (`src/content/es.js`).

```bash
cd picheta
npm install
npm run dev        # http://localhost:5173
npm run build      # build statica in dist/ (percorsi relativi: funziona in qualsiasi cartella o dominio)
npm run preview    # serve dist/ in locale
```

### Pubblicare su Netlify
- **Senza Git (più veloce):** `npm run build` e trascinare la cartella `dist/` su
  https://app.netlify.com/drop (oppure lo zip `picheta-netlify.zip` già pronto).
- **Da Git:** nuovo sito da questo repository, *Base directory* = `picheta`; build e cartella da
  pubblicare sono già in `netlify.toml`.
Le rotte usano l'hash (`/#salon`, `/#menu`), quindi non servono regole di redirect.

### Parametri utili nell'URL
| URL | Cosa fa |
|---|---|
| `#entrada`, `#salon`, `#reservado`, `#escalera`, `#terraza`, `#vista` | Entra direttamente in una sala della casa |
| `#historia`, `#autores`, `#menu`, `#reserva`, `#concurso`, `#eventos` | Apre la sezione sopra la sua sala (link condivisibili; il tasto "indietro" del telefono chiude la sezione) |
| `?q=low` / `?q=mid` / `?q=high` | Forza il livello di qualità (particelle, densità delle sale, bloom, risoluzione) |
| `?static` | Versione senza WebGL (la stessa che vede chi non ha WebGL2) |
| `?capture` | Orologio manuale per registrare video fotogramma per fotogramma (`window.__picheta.step(n, fps)`) |

## Il percorso
1. **Il cerchio** (`src/scenes/intro/`): una linea di caricamento e subito la pagina che chiede di
   disegnare. Il logo, campionato dal PNG, entra in due anelli di gesso che si uniscono con un colpo di
   tamburo; "Dibuja un círculo para entrar" con la guida animata (bottone "Entrar" dopo 4 s, anche Invio).
   Disegnato il cerchio, il logo esplode verso lo spettatore e la polvere di gesso diventa la casa.
2. **La casa** (`src/scenes/casa/`): sei sale **ricostruite in 3D dalle foto reali** del ristorante.
   Ogni foto ha la sua mappa di profondità (Depth Anything V2): la sala diventa geometria vera con la luce
   e i materiali reali, e la camera ci si muove dentro (parallasse col mouse o col giroscopio, sguardo
   trascinando). Si avanza con la rotella, scorrendo in su sul telefono, con "Seguir" o con l'indice a
   destra; tra una sala e l'altra la camera avanza, la sala si scioglie in polvere e la successiva si
   forma con la stessa polvere. Nella scala la camera sale i gradini verso la luce della terrazza.
3. **Punti di luce → sezioni** (`src/ui/Panel.js`, `src/ui/sections.js`): pannelli sopra la sala sfocata.
   Historia (una frase per schermata con incisioni originali), Autores, Menú (carte 3D da sfogliare),
   Reserva (CTA OpenTable/WhatsApp, indirizzo, orari), Concurso ed Eventos (layout pronti).

| Sala (foto) | Punto di luce | Sezione |
|---|---|---|
| La entrada — la scultura dei due cerchi sulla pietra | la scultura | HISTORIA |
| El salón — la volta di corde, le banquette verdi | la firma "Picheta" sul muro · un tavolo apparecchiato | AUTORES · MENÚ |
| El reservado — il tavolo rotondo | il tavolo | EVENTOS |
| La escalera | i gradini | (sale alla terrazza) |
| La terraza — il bancone, la Cattedrale al tramonto | la barra | CONCURSO GASTRONÓMICO |
| La vista — la Cattedrale di San Ildefonso | i tavoli davanti alla Cattedrale | RESERVA UNA MESA |
| (menu testuale e footer) | | INICIO · FACTURACIÓN |

## Le foto della casa
Sono in `public/assets/casa/` (`<sala>.webp` + `<sala>-depth.png`); sale, ordine, inquadrature e punti
di luce in `src/scenes/casa/rooms.js` (coordinate 0..1 sulla foto).

Per **aggiungere o sostituire una sala** con una foto nuova (meglio l'originale ad alta risoluzione,
senza il velo scuro dei social; lo script comunque lo toglie):

```bash
pip install onnxruntime pillow numpy
# modello Depth Anything V2 (licenza Apache-2.0):
#   https://github.com/fabio-sim/Depth-Anything-ONNX/releases  → depth_anything_v2_vitb.onnx
python3 scripts/preparar-fotos.py --modelo depth_anything_v2_vitb.onnx \
    --salida public/assets/casa  salon=foto-salon.jpg terraza=foto-terraza.jpg
```

Poi in `rooms.js`: `fov` (campo verticale stimato della foto), `near`/`far` (distanza in metri di ciò
che è più vicino e più lontano), `look` (punto al centro dello schermo), `spots` (punti di luce),
`overscan` (sale scure: in orizzontale si apre più della foto e i lati sfumano nel buio).

Le foto delle sezioni Menú e Autores (`public/assets/fotos/`) sono **immagini provvisorie generate con
IA**: sostituirle con le foto dei piatti e i ritratti dei cuochi (`CONFIG.assets.photos`).

## Da confermare con il cliente
- `src/config.js` → `links`: Instagram, pagina di Facturación, link OpenTable, numero WhatsApp
- `src/content/es.js`: orari (Lun–Sáb 17:00–00:00 · Dom 14:30–21:00), testo completo della storia,
  nomi e ritratti degli autores, menù reale (i piatti attuali sono esempi di cucina yucateca),
  contenuti di Concurso ed Eventos, didascalie delle sale

## Struttura
- `src/main.js`: ingresso leggero (font, stili, testi); carica la parte 3D solo se c'è WebGL2
- `src/experience.js`: avvio di motore, scene, interfaccia e rotte (deep link → la casa direttamente)
- `src/core/`: `Engine` (renderer, camera, loop, DPR adattivo, modalità capture), `PostFX` (bloom,
  vignetta, aberrazione minima, grana, sfocatura dietro i pannelli), `Director` (state manager con
  caricamento lazy delle scene), `Router` (hash + tasto indietro), `Pointer`, `Gyro`, `Sound`
- `src/scenes/intro/`: il logo di particelle (simulazione GPU), il gesto del cerchio, l'esplosione
- `src/scenes/casa/`: `rooms.js` (le sale), `Room.js` (ricostruzione 3D di una foto: superficie, fondo
  che riempie dietro le sagome, polvere per le transizioni), `CasaScene.js` (camera, navigazione,
  transizioni, punti di luce, didascalie)
- `src/ui/`: precarga, barra + menu testuale, pannelli e sezioni, etichette 3D, cursore, versione statica
- `scripts/preparar-fotos.py`: foto reali → WebP + mappa di profondità

## Prestazioni
- Livelli `high / mid / low` (`src/core/quality.js`): iPhone → mid, Android medio → low.
- DPR massimo 2 (1,5 su mobile) e riduzione automatica se il frame rate scende sotto ~45 fps.
- Sale: maglia 240 / 190 / 140 celle di larghezza e 110k / 70k / 42k particelle; si caricano due sale
  durante l'intro e le altre in sottofondo, in ordine. Tutta la casa pesa ~2 MB.
- Audio tutto sintetizzato (nessun file).

## Audio (opzionale, spento di default)
Tamburo grave all'unione dei cerchi e al disegno; nelle sale un brusio basso con bicchieri lontani; in
terrazza il murmure della piazza, le campane della Cattedrale e gli zanates.
