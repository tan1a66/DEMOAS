# Enekén Studio — demo 3D (proposta Alessia Studio)

Demo di sito per Enekén Studio (@nkn.studio), Mérida · CDMX. Vite + Three.js + GSAP ScrollTrigger + Lenis.
**Per ora solo uso locale/presentazione: il deploy su Vercel si fa quando lo decide Alessia.**

```bash
cd eneken
npm install
npm run dev            # http://localhost:5173
npm run build:preview  # un solo file: dist-preview/index.html (si apre con doppio clic)
```

Parametri utili nell'URL:
- `?p=0.6` salta a un punto della sequenza (0 = scultura, 1 = vista sul divano)
- `?fast` intro accelerata · `?debug` fps e oggetti in console · `?capture` orologio manuale (registrazione video)

## Stato
- [x] **1. Caricamento** — logo in inchiostro su crema; la linea di base è la barra (avanza con il caricamento reale)
- [x] **2. Logo → scultura di legno** — il segno piatto prende volume e diventa un pezzo massiccio di legno oliato,
      come le sculture di Miguel Tapia (venatura, facette morbide di sgorbia). Solo il logo sul fondo carta: nessuna stanza, nessuna ombra.
- [x] **3. Entrata nella casa** — la camera sorvola la scultura, guarda in basso, nella carta si apre un cerchio su Casa Skoura
      vista dal drone; il drone scende a spirale e si ferma ad altezza d'occhio guardando il divano, con la casa dietro
- [x] Casa Skoura ricostruita dalla foto cenitale e dal video in pieno sole: facciata a capanna con vano in acciaio e vetro,
      finestra quadrata, interno con lanterna, frammenti di pietra calcarea, tavolo di chukum, divano con luci, sgabello di tre tondi,
      carrizo sui muri, alberi dietro la casa, cielo
- [x] Toccando l'acqua si creano increspature vere (simulazione d'onda in GPU)
- [ ] Porte / navigazione (Nosotros, Proyectos, Taller, Contacto) e foto dei progetti
- [ ] Stanze: Proyectos (ODA, Skoura), Nosotros, Taller, Contacto

## Struttura
- `src/logo-data.js` — il logo ricalcato: 7 forme separate (punto, gambo, 4 foglie, linea di base).
  Generato con `tools/trace_logo.py` dallo screenshot del profilo. Quando arriva il vettoriale originale basta sostituire i `d`.
- `src/gl/logo3d.js` — scena 2: scultura dal campo di distanza di ogni tratto (`sdf.js`), ingrossata e profonda; sgabello
- `src/gl/sky.js` — cielo con nuvole
- `src/gl/courtyard.js` — Casa Skoura (misure dalla foto cenitale: piscina Ø 2,4 m come scala)
- `src/gl/water.js` — onde (GPU), superficie con rifrazione del vaso, riflesso del cielo, gocce
- `src/gl/plants.js` — piante tropicali instanziate · `src/gl/textures.js` — texture Poly Haven + gobo disegnati a mano
- `src/gl/director.js` — regia: intro e percorso della camera (Catmull-Rom tra punti di passaggio) guidato dallo scroll
- `src/gl/core.js` — renderer, qualità mobile/desktop, patch dei materiali (ombre di palma, chukum triplanare, caustiche, grana)

## Fonti e licenze
- Texture: Poly Haven (CC0) — `clay_plaster`, `clean_pebbles`, `rough_wood`; cielo `kloofendal_48d_partly_cloudy_puresky`
  (ridotto a 512 px e senza il disco solare con `tools/hdr_half.py`: il sole è una luce con ombre)
- Font: Cormorant e Archivo (SIL OFL), inclusi nel progetto
- Colori campionati dalle foto di Enekén e dal video di Casa Skoura in pieno sole
