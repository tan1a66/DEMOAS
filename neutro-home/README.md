# Neutro Home · La Trenza — demo 3D (Alessia Studio)

Una sola schermata, pensata per iPhone in verticale: un filo scende, si apre in moltissimi
fili sottili, i fili si raggruppano in tre capi grossi che si intrecciano (le punte restano
fili sciolti), e la treccia cade su tre ganci di cedro. Il visitatore trascina le onde (le code si
accorciano), cambia colore e chiede la treccia così com'è via DM Instagram.
Tutti i testi dell'interfaccia sono in spagnolo.

```bash
cd neutro-home
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
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
- Ombra morbida sul muro: luce direzionale con VSM.
- `src/config.js` — misure, limiti, colori, link.

## Scelte da confermare con il cliente
- **Lunghezza:** si usa 2,40 m come nel brief (`MEASURE.realLength`, fattore di scala unico per
  tutte le misure). La scheda prodotto su neutro.com.mx indica 6 m e 13 cm di spessore.
- **Ganci:** il prodotto include tre ganci in cedro naturale; ho usato quelli (il brief diceva
  ottone/legno scuro).
- **Materiale:** sul sito la Trenza Maya è in cotone o nylon; i testi non citano l'henequén.
- **Colori:** i sei esadecimali del brief sono in `src/config.js`, ancora da confrontare con le foto.
- **CTA:** il bottone copia il messaggio e apre `ig.me/m/neutro_home` nello stesso tocco
  (su iOS l'app si apre solo se il link parte dal gesto dell'utente). L'avviso "Mensaje copiado"
  resta visibile quando si torna alla pagina.

## Da fare su iPhone reale
Fluidità, tocco col pollice, nessuno scroll della pagina durante il trascinamento, apertura del DM,
colori e materiale confrontati con le foto. Le prove automatiche qui sono state fatte con Chromium
headless (rendering software), non su un iPhone.
