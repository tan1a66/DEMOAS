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
- `src/config.js`: tasso MXN/USD indicativo, numero WhatsApp segnaposto, qualità desktop/mobile
- `src/i18n/`: testi dell'interfaccia (`es.js`, `en.js`)
- `src/scene/`: terra, mare (shader), cielo, nuvole, marker, linee luminose, camera

## Stato
- [x] Fase 1: contenuti, intro, scelta città, percorsi animati
- [ ] Fase 2: progetti 3D, hover, click, cerchi di distanza
- [ ] Fase 3: pagina progetto, ricerca, WhatsApp, MXN/USD, rifinitura mobile
