# Neutro Home · La Trenza — demo 3D (Alessia Studio)

Un viaggio in una casa di Mérida, pensato per iPhone in verticale.
1. **Entrata:** su muro chiaro un filo scende lungo la coda della treccia già appesa, si apre in
   moltissimi fili, diventa tre capi grossi che si intrecciano (lento), zoom sul dettaglio; la camera
   si allontana e la treccia è già al suo posto.
2. **La treccia si tocca:** si tirano le onde e anche le code e le nappe (la treccia scorre sui
   ganci, le code oscillano). Sei colori che scorrono da una nappa all'altra.
3. **Il viaggio:** scorrendo (o con "Continúa el viaje") la camera passa sotto gli archi e scopre un
   pezzo alla volta: lampada **Makech**, famiglia **Xux**, l'angolo della **storia** con i coni di filo.
   Le frange si toccano (il dito le sposta, poi oscillano) e si muovono anche al passaggio della camera.
4. **È una mostra:** ogni pezzo ha la sua cartella (Nº, nome, materiale, colori della casa) di lato,
   senza fondi, e un link alla sua scheda su neutro.com.mx; alla fine "Entrar a la tienda".
   Navigazione: "Nuestra historia", "Catálogo" (pannello con i loro pezzi), "Continúa el viaje".
   Anche Makech e Xux cambiano colore: la tinta scende lungo i fili.
Tutti i testi dell'interfaccia sono in spagnolo.

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
- `src/scene/room.js` — la casa (muri a calce, archi, travi, finestra); `src/journey.js` — percorso
  della camera (Catmull-Rom con punti di passaggio negli archi) e fermate.
- `src/scene/fringe.js` — frange toccabili (Makech, Xux): migliaia di fili, spostati dal dito e
  dall'oscillazione nel vertex shader. `makech.js`, `xux.js`, `studio.js` — i pezzi.
- `src/stops.js` — testi delle fermate e del catalogo; foto in `src/assets/catalogo/` (dal loro sito).
- Ombra morbida sul muro: luce direzionale con VSM.
- `src/config.js` — misure, limiti, colori, link.

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
