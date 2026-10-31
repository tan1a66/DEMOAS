# Villa Pedramar — demo Alessia Studio

Esperienza web immersiva su una villa reale (progetto Gatti/Piu, Terra Mala, Sardegna):
fuori un plastico 3D costruito dai disegni, dentro le fotografie reali con profondità (parallasse 3D).
Testi in spagnolo (predefinito) e italiano. Uso privato: il sito è `noindex`.

```bash
npm install
npm run dev            # http://localhost:5173
```

Parametri utili nell'indirizzo:
- `?scene=cocina` apre direttamente una scena (id in `src/data/villa.json`)
- `?lang=it` lingua iniziale
- `?debug=1` modalità debug: clic sulla foto = passo copiato negli appunti, Maiusc+clic = finitura copiata, tasto D = mappa di profondità; sul plastico clic = coordinate in metri `[x, y, z]`
- `?ao=0` plastico senza occlusione ambientale (per GPU lente)

## Dati
`src/data/villa.json` è l'unica fonte: livelli, scene, passi, scala, finiture, percorso suggerito, testi, contatti.
- `x`/`y` in percentuale della foto; `crop` = ritaglio `[x, y, w, h]` normalizzato per il pannello della finitura
- `image` senza estensione: il sito carica `_mobile.jpg` (max 2560 px) o `_full.jpg` (massima disponibile)
- `center` = punto della foto da inquadrare quando lo schermo è più stretto della foto (telefono in verticale)
- `route` = percorso suggerito (il passo successivo è evidenziato in oro)
- Plastico (metri; x da mare a strada, z da nord a sud, y quota; 0 = facciata sul mare, lato nord, pavimento del livello mare):
  `levels[].outline/walls/voids`, `parts` (solai, sbalzi, torre in pietra…), `stairs3d`, `railings`, `pergola`, `leds`, `spots`,
  `site` (terreno a strati, terrazza, deck, piscina, passi, arredi, alberi). `scenes[].map` = punto della stanza sul plastico,
  `boom` = traiettoria del volo verso la vetrata del soggiorno

## Immagini
- `public/source/`: originali e disegni (non vengono pubblicati: la build li esclude). Inventario: `src/data/inventory.md`
- `npm run images` → `public/scenes/` e `public/crops/` dalle sorgenti indicate nel JSON
- `npm run depth` → `public/depth/<id>.png` con Depth Anything V2 Small (Apache 2.0). Richiede l'ambiente Python:
  ```bash
  python3 -m venv /home/user/.venv-depth
  /home/user/.venv-depth/bin/pip install -r scripts/requirements.txt
  ```
  e l'accesso a `huggingface.co` per scaricare i pesi la prima volta.

## Stato
- [x] Fase 1: immagini, inventario, lettura dei disegni, scene e navigazione
- [x] Fase 2: mappe di profondità, visore con parallasse, passi, finiture, debug
- [x] Fase 3: plastico 3D dai disegni, orbita, punti delle stanze, sequenza "Entrar" → BOOM, pulsante "Maqueta"
- [ ] Fase 4: sequenza della scala nel plastico in sezione
- [ ] Fase 5: intro, finale, CTA, loader
- [ ] Fase 6: rifinitura, prestazioni, deploy su Vercel
