# PICHETA — demo esperienza web 3D (proposta Alessia Studio)

Demo del nuovo sito di **Picheta** (cucina yucateca contemporanea "de autores", Pasaje Picheta,
Calle 61 #501, Mérida) come viaggio immersivo:

**Intro → Inmersión → Llegada → Terraza (hub) → Secciones**

Tutti i testi visibili sono in spagnolo (`src/content/es.js`).

```bash
cd picheta
npm install
npm run dev        # http://localhost:5173
npm run build      # build statica in dist/ (percorsi relativi: funziona in qualsiasi cartella o dominio)
npm run preview    # serve dist/ in locale
```

### Parametri utili nell'URL
| URL | Cosa fa |
|---|---|
| `#historia`, `#autores`, `#menu`, `#reserva`, `#concurso`, `#eventos` | Apre direttamente la sezione sopra la terrazza (link condivisibili; il tasto "indietro" del telefono chiude la sezione) |
| `#terraza` | Parte direttamente dalla terrazza |
| `?q=low` / `?q=mid` / `?q=high` | Forza il livello di qualità (particelle, ombre, bloom, risoluzione) |
| `?static` | Versione senza WebGL (la stessa che vede chi non ha WebGL2) |
| `?capture` | Orologio manuale per registrare video fotogramma per fotogramma (`window.__picheta.step(n, fps)`) |

## Le scene
1. **Intro** (`src/scenes/intro/`): il logo campionato dai pixel chiari del PNG, separato nei due anelli
   (sinistra/destra), unione con colpo di tamburo, repulsione del cursore/dito simulata in GPU, scia,
   gesto "Dibuja un círculo para entrar" (330°, raggio regolare) con guida animata attorno al logo e il
   terzo cerchio che si materializza; bottone "Entrar" dopo 5 s (anche Invio); esplosione-portale.
2. **Inmersión** (`src/scenes/inmersion/`): le particelle atterrano sul doppio cerchio spray della foto
   (match cut), la mappa si rivela, rilievo dalla luminanza, discesa della camera, strade che si accendono
   verso la Plaza Grande, punto pulsante su Calle 61 — Pasaje Picheta. Scroll, tap, swipe o Invio: tuffo.
3. **Llegada** (`src/scenes/llegada/`): "Una discreta entrada…", portone che si apre, pasaje ad archi,
   scala verso la luce (7,6 s; si salta con un tap o "Saltar").
4. **Terraza** (`src/scenes/terraza/`): tramonto (primo e unico colore d'accento), Cattedrale, Plaza
   Grande, Palacio Municipal; si guarda intorno trascinando (240°) o col giroscopio; gli oggetti respirano,
   mostrano l'etichetta al passaggio del cursore / primo tap e al tocco la camera si avvicina e si apre la
   sezione. Su mobile, dopo 6 s senza tocchi: "Toca los objetos para descubrir Picheta".
5. **Secciones** (`src/ui/Panel.js`, `src/ui/sections.js`): pannelli sopra la terrazza sfocata e scurita.
   Historia (una frase per schermata con incisioni originali), Autores (ritratti B/N con grana che si
   colorano al passaggio), Menú (carte 3D da sfogliare), Reserva (CTA OpenTable/WhatsApp, indirizzo, orari),
   Concurso ed Eventos (layout pronti con segnaposto).

| Oggetto nella terrazza | Sezione |
|---|---|
| Busto di Picheta (shader "incisione su legno") | HISTORIA |
| Coltelli, grembiule col logo ricamato, tagliere | AUTORES |
| Piatto fumante sul tavolo | MENÚ |
| Tavolo con la vista migliore, candela, due sedie | RESERVA UNA MESA |
| Coppa sul bancone del bar | CONCURSO GASTRONÓMICO |
| Tunkul con ghirlanda di luci | EVENTOS |
| I due cerchi del logo dipinti sul pavimento | INICIO |
| (link nel footer e nel menu) | FACTURACIÓN |

## Sostituire gli asset
Tutti in `public/assets/`; i percorsi sono in `src/config.js` (`CONFIG.assets`).

| File | Note |
|---|---|
| `logo-picheta.png` | Logo ufficiale (i due cerchi a gesso). Basta un PNG con tratto chiaro su fondo scuro o trasparente (se è scuro su chiaro viene invertito). L'intro campiona i pixel e separa da sola i due anelli. |
| `merida-mapa.jpg` | **Ora è un segnaposto** generato da `scripts/placeholder-map.py`. Sostituirlo con la foto vera e, se le posizioni cambiano, misurare sulla nuova foto (coordinate 0..1, x a destra, y in basso) i valori di `CONFIG.map`: centro e raggio del doppio cerchio (`circle`), griglia delle strade (`grid`: un incrocio, passo, rotazione), `plaza`, `catedral`, `picheta`. Le particelle atterrano sui pixel chiari del cerchio della foto, quindi il match cut funziona da solo. |
| `busto-picheta.glb` | Opzionale: impostare `CONFIG.assets.bust = asset('busto-picheta.glb')`. Viene scalato all'altezza del busto provvisorio e riceve lo shader a incisione. |
| `terraza-360.jpg` | Opzionale: panoramica equirettangolare della terrazza (`CONFIG.assets.panorama`). Se c'è, sostituisce cielo e piazza 3D; gli oggetti interattivi restano davanti. |
| `fotos/*.webp` | Foto delle sezioni. **Sono le immagini generate per la demo precedente (Higgsfield)**: sostituirle con le foto reali (entrata, sala, terrazza, piatti, chef) mantenendo i nomi o cambiando `CONFIG.assets.photos`. |

Gli **oggetti della terrazza** sono moduli indipendenti in `src/scenes/terraza/objects.js`
(`buildBusto`, `buildCuchillos`, `buildPlato`, `buildMesaVista`, `buildTrofeo`, `buildTunkul`,
`buildLogoPiso`): ognuno restituisce `{ group, hit, anchor, focus }`. Per usare un GLB vero basta
caricarlo dentro `group` al posto della geometria provvisoria; posizione e rotazione sono in `PLACEMENT`.

## Da confermare con il cliente
- `src/config.js` → `links`: Instagram, pagina di Facturación, link OpenTable, numero WhatsApp
- `src/content/es.js`: orari (Lun–Sáb 17:00–00:00 · Dom 14:30–21:00), testo completo della storia,
  nomi e ritratti degli autores, menù reale (i piatti attuali sono esempi di cucina yucateca),
  contenuti di Concurso ed Eventos

## Struttura
- `src/main.js`: ingresso leggero (font, stili, testi); carica la parte 3D solo se c'è WebGL2
- `src/experience.js`: avvio di motore, scene, interfaccia e rotte (deep link → terrazza direttamente)
- `src/core/`: `Engine` (renderer, camera, loop, DPR adattivo, modalità capture), `PostFX` (bloom,
  vignetta, aberrazione minima, grana, sfocatura dietro i pannelli), `Director` (state manager con
  caricamento lazy delle scene), `Router` (hash + tasto indietro), `Pointer`, `Gyro`, `Sound`
- `src/scenes/*`: una cartella per scena; ogni scena espone `init · enter · exit · update · resize`
- `src/ui/`: preloader, barra + menu testuale, pannelli e sezioni, etichette 3D, cursore, versione statica
- `src/gl/`: GLSL condivisi e texture procedurali (pietra, pasta yucateca, legno, facciate)

## Prestazioni
- Livelli `high / mid / low` (`src/core/quality.js`): iPhone → mid, Android medio → low.
- DPR massimo 2 (1,5 su mobile) e riduzione automatica se il frame rate scende sotto ~45 fps.
- Particelle 40k / 24k / 14k, ombre solo da mid in su, scene caricate al bisogno (la terrazza si
  precarica durante la mappa e la scala).
- Texture procedurali (nessun download) + foto WebP; audio tutto sintetizzato (nessun file).

## Audio (opzionale, spento di default)
Tamburo grave all'unione dei cerchi e nei momenti chiave; vento sulla mappa e nella scala; sulla
terrazza brusio della piazza, campane lontane della Cattedrale e zanate.
