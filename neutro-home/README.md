# Neutro Home · La Trenza — demo 3D (Alessia Studio)

Una mostra senza parole, pensata per iPhone in verticale: solo i pezzi, i loro colori e la luce
di Mérida (sole di pomeriggio filtrato dalle chiome delle palme, che si muovono appena).
1. **Entrata:** su muro chiaro nasce il filo: scende lungo la coda della treccia già appesa e si
   apre in moltissimi fili; la camera sale lungo i fili fino al gancio, dove diventano treccia, e
   va verso il sole (la luce brucia fino al bianco). Dalla luce esce l'ombra della treccia intera,
   lunghissima, con il nodo: entrano le forbici, taglio, il pezzo in più cade. Poi la camera si
   allontana e la treccia è al suo posto.
2. **Trenza Maya:** si tirano le onde, le code e le nappe; otto colori che scorrono da una nappa all'altra.
3. **Makech** e **famiglia Xux:** il pezzo resta al suo posto e si fa girare col dito (360°, con
   inerzia): le frange restano indietro e si aprono; passandoci sopra si spostano. Anche loro cambiano
   colore (la tinta scende lungo i fili).
4. **La sala (di sera):** sul muro l'arazzo a frange (sole dorato, onde rosa, fascia verde acqua,
   bande a gradini) sotto un faretto che ne proietta l'ombra; ai lati due lampade da terra di treccia
   gigante, con paralume di filo, nappa aperta sul pavimento e la treccia che continua lunga sul
   pavimento fino alla sua nappa. Il dito apre le frange dell'arazzo, un tocco le fa ondeggiare; un
   tocco su una lampada la accende o la spegne; i colori cambiano le due lampade (la tinta sale dal
   pavimento al paralume).
5. **Fine:** in fondo alla galleria, sul muro, WORK IN PROGRESS dipinto con lo spray fucsia e la
   firma ALESSIA.STUDIO, sotto un faretto che si muove appena.
La casa è la galleria di un'hacienda restaurata: portico ad archi sul patio (si intravede appena,
nella luce), soffitto alto con travi, pavimento in cementine. Ogni pezzo cambia colore da solo ogni
due secondi circa; se il visitante sceglie un colore, quel pezzo resta del colore scelto.
Luce e camera: la sera avanza con lo scorrimento (pomeriggio alla treccia, luce dorata alla Makech,
tramonto alle Xux, sera nella sala: il sole si abbassa, le ombre si allungano, le lampade si accendono); fasci di sole
e pulviscolo nell'aria; camera "a mano" che respira e accompagna il passo; passando, la camera gira
attorno alla Makech e la Makech ruota con lo scorrimento (le frange si aprono e restano indietro).
Nessun testo: logo (senza link), colori, segni di avanzamento e una freccia per proseguire.
Niente fermate: lo scorrimento (dito, rotella, frecce) muove la camera in modo continuo, con inerzia;
vicino a un pezzo lo si può toccare. Stesso dito per scorrere e toccare, decide il gesto:
gesto rapido = scorre (anche sopra un pezzo); dito appoggiato un attimo o movimento lento = prende il
pezzo (anello sotto il dito, la pagina non scorre); sulle lampade il gesto orizzontale le fa girare;
tocco breve = il pezzo reagisce. Anche l'entrata avanza solo scorrendo (e torna indietro).

```bash
cd neutro-home
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
```

Un solo file HTML autonomo (si apre con doppio clic, senza server):

```bash
npm run build:preview   # → dist-preview/index.html
```

Parametri utili nell'URL: `?skip` salta l'entrata (stesso comportamento di `prefers-reduced-motion`).

## Deploy su Vercel
Importare il repository e impostare **Root Directory = `neutro-home`** (framework: Vite).
`vercel.json` contiene già build, output e cache degli asset.

## Come è fatta
- `src/model/hanging.js` — modello "che sembra fisico": due catenarie (Newton) tra i ganci,
  archi di appoggio sui ganci, due code. `codaSx + onda1 + onda2 + codaDx (+ appoggi) = L_tot`.
  Il parametro lungo la treccia è "materiale": quando un'onda si allunga l'intreccio scorre sui ganci.
- `src/model/rig.js` — molle smorzate: profondità delle onde, oscillazione di code e nappe,
  caduta iniziale, limiti con resistenza elastica (nessuna simulazione di corda: sempre stabile).
- `src/scene/braid.js` + `src/gl/fiberMaterial.js` — la CPU calcola solo gli assi dei 3 capi
  (sfasati di 0, 2π/3, 4π/3 con il movimento a "8"); il vertex shader costruisce i tubi ovali,
  le normali e l'occlusione finta. Niente lavoro quando la treccia è ferma (render on demand).
- Materiale: `MeshPhysicalMaterial` con sheen, normal map di fibre parallele e variazione di tono
  generate proceduralmente sulla GPU (`src/gl/textures.js`), occlusione negli incavi, leggera
  variazione di colore tra i capi. Il cambio colore "scorre" da una nappa all'altra (~0,85 s).
- `src/scene/threads.js` — entrata: 162–198 fili che seguono gli assi dei tre capi (stessa
  texture di dati). Prima si aprono a coda di cavallo, poi si raggruppano in tre capi grossi.
  Dentro la treccia i capi sono compatti; sotto la treccia restano dello stesso volume ma
  "sciolti": anima sottile, fili ondulati che si staccano poco a poco e si aprono verso le punte.
- `src/scene/tassel.js` — nappe: collo avvolto + centinaia di fili; oscillazione nel vertex shader.
- `src/scene/room.js` — la casa (muri a calce, tre archi, travi, finestra); `src/journey.js` — percorso
  della camera (Catmull-Rom con punti di passaggio negli archi) e fermate.
- `src/scene/tapestry.js` — l'arazzo: migliaia di fili in strati (sole, rosa, verde acqua, bande),
  spostati dal dito e dalle onde nel vertex shader; `src/scene/floorLamp.js` — le lampade di treccia
  (la stessa trenza in GPU, più grossa, in colonna e sul pavimento, con la borla della Trenza Maya).
- `src/scene/fringe.js` — frange toccabili (Makech, Xux): migliaia di fili, spostati dal dito,
  dall'oscillazione e dal giro (piatto rotante con inerzia) nel vertex shader. `makech.js`, `xux.js`.
- `src/stops.js` — i pezzi della mostra; `src/gl/sunlight.js` — luce filtrata dalle foglie.
- Ombra morbida sul muro: luce direzionale con VSM.
- `src/config.js` — misure, limiti, colori, link.

## Crediti
- Palme del patio: "Palm Tree Realistic" di 00amza (https://sketchfab.com/00amza), licenza CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/). Texture ridotta per il web in `src/assets/palm.glb`.
  La licenza chiede di citare l'autore dove la demo viene pubblicata.

## Scelte da confermare con il cliente
- **Lunghezza:** si usa 2,40 m come nel brief (`MEASURE.realLength`, fattore di scala unico per
  tutte le misure). La scheda prodotto su neutro.com.mx indica 6 m e 13 cm di spessore.
- **Ganci:** il prodotto include tre ganci in cedro naturale; ho usato quelli (il brief diceva
  ottone/legno scuro).
- **Materiale:** sul sito la Trenza Maya è in cotone o nylon; i testi non citano l'henequén.
- **Colori:** i sei esadecimali del brief sono in `src/config.js`, ancora da confrontare con le foto.

## Da fare su iPhone reale
Fluidità, tocco col pollice, nessuno scroll della pagina durante il trascinamento, apertura del DM,
colori e materiale confrontati con le foto. Le prove automatiche qui sono state fatte con Chromium
headless (rendering software), non su un iPhone.
