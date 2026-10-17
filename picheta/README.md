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
| `#historia`, `#autores`, `#menu`, `#reserva`, `#concurso`, `#eventos` | La camera va fino all'oggetto della sezione e il pannello si apre accanto (link condivisibili; il tasto "indietro" del telefono chiude la sezione) |
| `?q=low` / `?q=mid` / `?q=high` | Forza il livello di qualità (ombre, luci, AO, risoluzione) |
| `?static` | Versione senza WebGL (la stessa che vede chi non ha WebGL2) |
| `?capture` | Orologio manuale per registrare video fotogramma per fotogramma (`window.__picheta.step(n, fps)`) |

## Il percorso
1. **Il cerchio** (`src/scenes/intro/`): una linea di caricamento e subito la pagina che chiede di
   disegnare. Il logo, campionato dal PNG, entra in due anelli di gesso che si uniscono con un colpo di
   tamburo; "Dibuja un círculo para entrar" con la guida animata (bottone "Entrar" dopo 4 s, anche Invio).
   Disegnato il cerchio, il logo esplode verso lo spettatore e dal buio emergono i due cerchi della
   scultura, in controluce sulla pietra: la camera si allontana e si è dentro Picheta.
2. **La casa** (`src/scenes/mundo/`): Picheta **modellata in 3D**, un unico edificio percorribile
   ispirato alle foto reali (le foto non compaiono: servono da riferimento per misure, materiali e luce).
   - *La entrada*: muro di pietra con la scultura dei due cerchi retroilluminata, la cava dei vini,
     soffitto di corde.
   - *El salón*: la volta di corde con la luce calda nascosta sulle cornici, la banquette verde, i
     tavoli lunghi apparecchiati, le sedie blu trapuntate, i quadri, il sole del tramonto che entra
     dalle finestre e disegna strisce sul pavimento.
   - *El reservado*: muro di pietra con nicchie illuminate, il tavolo rotondo con otto sedie, le
     lampade a cupola nere con l'interno arancio.
   - *La escalera*: gradini di travertino, soffitto inclinato di corde, corrimano con la linea di luce.
   - *La terraza* e *la vista*: pedana di legno, il muro antico con la firma "Picheta" e la ghirlanda
     di lampadine, la barra nera sotto la pergola, i tavoli di marmo, le palme, il cielo del tramonto
     e la Cattedrale di San Ildefonso.

   Si cammina liberamente: **trascinare** per guardare, **rotella / frecce / WASD** per avanzare,
   **clic o tocco sul pavimento** per andare lì (se c'è un muro in mezzo si passa dalle porte).
   **"Seguir"** e l'indice a destra fanno il percorso guidato, con un movimento di camera da film che
   attraversa davvero porte e scala. Didascalie e URL seguono la sala in cui ci si trova.
3. **Sezioni dentro il 3D** (`src/ui/Panel.js`, `src/ui/sections.js`): quando ci si ferma vicino a un
   oggetto compare il suo punto di luce; toccandolo la camera si avvicina all'oggetto e la sezione si
   apre in un pannello laterale (dal basso sul telefono) con la casa sempre visibile accanto. Historia
   (una frase per schermata con incisioni originali), Autores, Menú (carte 3D da sfogliare), Reserva
   (CTA OpenTable/WhatsApp, indirizzo, orari), Concurso ed Eventos.

| Spazio | Punto di luce (oggetto) | Sezione |
|---|---|---|
| La entrada | la scultura dei due cerchi | HISTORIA |
| El salón | un quadro · un tavolo apparecchiato | AUTORES · MENÚ |
| El reservado | il tavolo rotondo | EVENTOS |
| La terraza | la barra | CONCURSO GASTRONÓMICO |
| La vista | il tavolo davanti alla Cattedrale | RESERVA UNA MESA |
| (menu testuale e footer) | | INICIO · FACTURACIÓN |

## Come è costruita la casa
- `spaces.js`: le soste delle sale (posizione e sguardo della camera) e i punti di luce delle sezioni.
- `salon.js`, `entrada.js`, `reservado.js`, `escalera.js`, `terraza.js`: geometria, arredi e luci di
  ogni spazio, in metri, nelle loro posizioni reali (porte e scala collegano gli spazi).
- `materials.js` + `textures.js`: materiali fisici con texture procedurali (intonaco, pietra con la
  palette della parete vera, corda, legno, trapuntato, travertino, maioliche, marmo, rattan).
- `MundoScene.js`: il sole unico (ombre che seguono la zona), cielo e riflessi diversi dentro e fuori,
  le luci accese solo vicino a dove ci si trova (tutte le combinazioni compilate al caricamento), il
  percorso guidato, le sezioni, le didascalie.
- `Walker.js`: la camera a piedi (pavimenti, rampa della scala, ostacoli, inerzia, leggero passo).
- `public/assets/mundo/`: i due quadri (raddrizzati dalle foto), la Cattedrale ritagliata dal cielo e
  la foto di copertina della versione senza WebGL.

Le foto delle sezioni Menú e Autores (`public/assets/fotos/`) sono **immagini provvisorie generate con
IA**: sostituirle con le foto dei piatti e i ritratti dei cuochi (`CONFIG.assets.photos`).

## Da confermare con il cliente
- `src/config.js` → `links`: Instagram, pagina di Facturación, link OpenTable, numero WhatsApp
- `src/content/es.js`: orari (Lun–Sáb 17:00–00:00 · Dom 14:30–21:00), testo completo della storia,
  nomi e ritratti degli autores, menù reale (i piatti attuali sono esempi di cucina yucateca),
  contenuti di Concurso ed Eventos, didascalie delle sale
- Misure e arredi della casa sono ricostruiti dalle foto: con una pianta del locale si possono
  rendere esatti (`src/scenes/mundo/*.js`, coordinate in metri)

## Struttura
- `src/main.js`: ingresso leggero (font, stili, testi); carica la parte 3D solo se c'è WebGL2
- `src/experience.js`: avvio di motore, scene, interfaccia e rotte (deep link → la casa direttamente)
- `src/core/`: `Engine` (renderer, camera, loop, DPR adattivo, modalità capture), `PostFX` (ambient
  occlusion N8AO, bloom, tone mapping AgX, vignetta, grana), `Director` (state manager con
  caricamento lazy delle scene), `Router` (hash + tasto indietro), `Pointer`, `Gyro`, `Sound`
- `src/scenes/intro/`: il logo di particelle (simulazione GPU), il gesto del cerchio, l'esplosione
- `src/scenes/mundo/`: la casa in 3D (vedi sopra)
- `src/ui/`: precarga, barra + menu testuale, pannelli e sezioni, etichette 3D, cursore, versione statica

## Prestazioni
- Livelli `high / mid / low` (`src/core/quality.js`): iPhone → mid, Android medio → low.
- DPR massimo 2 (1,5 su mobile) e riduzione automatica se il frame rate scende sotto ~45 fps.
- La casa: luci accese solo nella zona in cui ci si trova e in quelle visibili dalle porte; ombre del
  sole 2048 / 1536 / 1024; AO a metà risoluzione su mid e low. Nessun modello da scaricare: geometria
  e texture sono generate nel browser; gli asset della casa pesano ~0,3 MB.
- Audio tutto sintetizzato (nessun file).

## Audio (opzionale, spento di default)
Tamburo grave all'unione dei cerchi e al disegno; nelle sale un brusio basso con bicchieri lontani; in
terrazza il murmure della piazza, le campane della Cattedrale e gli zanates.
