# URBAZ — demo 3D (proposta Alessia Studio)

Demo di redesign del sito di URBAZ come esperienza 3D (Vite + Three.js + GSAP).
**Solo per uso locale/presentazione: non pubblicare e non fare deploy.**

```bash
npm install
npm run dev        # http://localhost:5173  (aggiungere ?auto per far partire l'intro senza click)
```

## Struttura
- `src/data/projects.json`: progetti, con la fonte di ogni campo (`fuentes`) e i dati dei portali di terzi separati (`referencias_terceros`)
- `src/data/places.json`: città, percorso approssimativo del Tren Maya, punti chiave (Fase 2)
- `src/data/yucatan.geo.json`: confini Natural Earth 1:10m (pubblico dominio), generati con `npm run geo`
- `src/config.js`: tasso MXN/USD indicativo, numero WhatsApp segnaposto (**da sostituire**), qualità desktop/mobile
- `src/i18n/`: testi dell'interfaccia. Il sito è solo in spagnolo (`es.js`); `en.js` resta pronto: basta `showLangToggle: true` in `config.js`
- `src/data/travel.js`: minuti in auto **stimati** (da verificare); i tempi reali vanno in `TRAVEL_OVERRIDES`
- `src/scene/buildings.js`: volumi stilizzati per progetto (forma indicativa del tipo, non modelli reali)
- Valori ammessi per `estado` in projects.json: `preventa`, `construccion`, `entrega`
- `src/scene/`: terra, mare (shader), cielo, nuvole, marker, linee luminose, camera

## Stato
- [x] Fase 1: contenuti, intro, scelta città, percorsi animati
- [x] Fase 2: progetti 3D, hover, click, cerchi di distanza
- [x] Fase 3: pagina progetto, ricerca, WhatsApp, MXN/USD, rifinitura mobile
