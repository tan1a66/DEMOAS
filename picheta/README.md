# PICHETA — demo esperienza web 3D (proposta Alessia Studio)

Demo del nuovo sito di **Picheta** (cucina yucateca contemporanea "de autores", Pasaje Picheta,
Calle 61 #501, Mérida) come viaggio immersivo: Intro → Inmersión → Llegada → Terraza (hub) → Secciones.
Tutti i testi visibili sono in spagnolo.

```bash
cd picheta
npm install
npm run dev        # http://localhost:5173
npm run build      # build statica in dist/ (percorsi relativi: funziona in qualsiasi cartella)
```

Parametri utili nell'URL:
- `?q=low|mid|high` forza il livello di qualità (particelle, bloom, risoluzione)
- `?static` mostra la versione senza WebGL
- `?capture` orologio manuale per registrare video fotogramma per fotogramma (`window.__picheta.step(n, fps)`)
- `#historia`, `#autores`, `#menu`, `#reserva`, `#concurso`, `#eventos` aprono direttamente la sezione

## Stato
- [x] Struttura: motore (Three.js + postprocessing), state manager delle scene con caricamento lazy,
      rotte con hash e tasto "indietro", preloader, menu testuale di backup, pannelli sezione (Lenis),
      audio opzionale sintetizzato, versione statica senza WebGL, qualità adattiva
- [x] **Scena 1 — Intro**: i due cerchi di particelle (GPU), entrata da sinistra/destra, unione con il
      colpo di tamburo, repulsione del cursore/dito, scia, gesto "Dibuja un círculo para entrar",
      bottone "Entrar" dopo 5 s (anche Invio), esplosione-portale verso lo spettatore
- [ ] Scena 2 — Inmersión (mappa di Mérida nel doppio cerchio): ora c'è solo un segnaposto
- [ ] Scena 3 — Llegada
- [ ] Scena 4 — Terraza (hub con gli oggetti)
- [ ] Sezioni definitive, rifinitura finale

## Sostituire gli asset
Tutti in `public/assets/`.

| File | Note |
|---|---|
| `logo-picheta.png` | Logo ufficiale (i due cerchi a gesso). Per sostituirlo basta un PNG con tratto chiaro su fondo scuro (o trasparente); se è scuro su chiaro viene invertito da solo. La intro campiona i pixel chiari e separa da sola i due anelli (quello più a sinistra entra da sinistra). Nessuna modifica al codice. |
| `merida-mapa.jpg` | Scena 2 (prossima consegna). |
| `busto-picheta.glb` | Scena 4 (prossima consegna). |

## Struttura
- `src/main.js`: ingresso leggero (font, stili, testi); carica la parte 3D solo se c'è WebGL2
- `src/experience.js`: avvio di motore, scene, interfaccia e rotte
- `src/config.js`: link (Instagram, fatturazione: **da confermare**), soglie del gesto, livelli di qualità
- `src/content/es.js`: tutti i testi visibili (orari **da confermare** col ristorante)
- `src/core/`: `Engine` (renderer, camera, loop, DPR adattivo), `PostFX` (bloom, vignetta,
  aberrazione minima, grana), `Director` (state manager delle scene), `Router` (hash), `Pointer`, `Sound`
- `src/scenes/intro/`: `IntroScene` (coreografia e gesto), `LogoParticles` (particelle + simulazione GPGPU),
  `logoSampler` (lettura del PNG e separazione dei due anelli), `CircleGesture`, `Stone` (fondo di pietra),
  `Atmosphere` (polvere, scia, "firma" del terzo cerchio, onda del tamburo)
- `src/scenes/inmersion/`: segnaposto della Scena 2
- `src/ui/`: preloader, barra + menu, pannelli sezione, cursore, versione statica

## Regolazioni rapide
- Gesto del cerchio: `CONFIG.intro.minAngleDeg` (330°), `maxRadiusDeviation` (0.3), ritardi del suggerimento
  (1,5 s) e del bottone "Entrar" (5 s)
- Numero di particelle per livello: `CONFIG.quality`
- Tempi della coreografia: `IntroScene.enter()` (entrata e unione) e `IntroScene.leave()` (portale)
