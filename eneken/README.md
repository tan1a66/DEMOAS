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
- `?p=0.6` salta a un punto della sequenza (0 = scultura, 1 = pit dall'alto)
- `?fast` intro accelerata · `?debug` fps e oggetti in console · `?capture` orologio manuale (registrazione video)

## Stato
- [x] **1. Caricamento** — logo in inchiostro su crema; la linea di base è la barra (avanza con il caricamento reale)
- [x] **2. Logo → legno** — il segno piatto prende volume, diventa legno intagliato (venature, segni di sgorbia),
      la stanza si scurisce, luce radente da una finestra con ombre di palma, pulviscolo nel fascio, ombra lunga sul muro
- [x] **3. Caduta** — la sfera si stacca, cade nel buio, il cerchio d'acqua si accende, splash (onde vere + gocce),
      il drone sale e la sfera diventa lo sgabello (tre tondi di legno) al centro del pit
- [x] Pit di Casa Skoura ricostruito da `skoura_fosa_cenital.jpg` e dal video in pieno sole
- [x] Toccando l'acqua si creano increspature vere (simulazione d'onda in GPU)
- [ ] 4/5. Foto dei progetti sotto l'acqua, planta viva con le porte (Nosotros, Proyectos, Taller, Contacto)
- [ ] Stanze: Proyectos (ODA, Skoura), Nosotros, Taller, Contacto

## Struttura
- `src/logo-data.js` — il logo ricalcato: 7 forme separate (punto, gambo, 4 foglie, linea di base).
  Generato con `tools/trace_logo.py` dallo screenshot del profilo. Quando arriva il vettoriale originale basta sostituire i `d`.
- `src/gl/sculpture.js` — scena 2: rilievo scolpito dal campo di distanza di ogni tratto (`sdf.js`), sfera, stanza, luce, polvere
- `src/gl/courtyard.js` — Casa Skoura (misure dalla foto cenitale: piscina Ø 2,4 m come scala)
- `src/gl/water.js` — onde (GPU), superficie con rifrazione del vaso, riflesso del cielo, gocce
- `src/gl/plants.js` — piante tropicali instanziate · `src/gl/textures.js` — texture Poly Haven + gobo disegnati a mano
- `src/gl/director.js` — regia: intro e camera guidata dallo scroll
- `src/gl/core.js` — renderer, qualità mobile/desktop, patch dei materiali (ombre di palma, chukum triplanare, caustiche, grana)

## Fonti e licenze
- Texture: Poly Haven (CC0) — `clay_plaster`, `clean_pebbles`, `rough_wood`; cielo `kloofendal_48d_partly_cloudy_puresky`
  (ridotto a 512 px e senza il disco solare con `tools/hdr_half.py`: il sole è una luce con ombre)
- Font: Cormorant e Archivo (SIL OFL), inclusi nel progetto
- Colori campionati dalle foto di Enekén e dal video di Casa Skoura in pieno sole
