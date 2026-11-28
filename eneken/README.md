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
- `?p=0.5` salta a un punto dello scroll (0 = Nosotros, 0.5 = Visión, 1 = Contacto) · `?k=0.3` congela l'entrata
- `?fast` intro accelerata · `?debug` fps e oggetti in console · `?capture` orologio manuale (registrazione video)

## Stato
- [x] **Caricamento** — logo in inchiostro su crema; la linea di base è la barra (avanza con il caricamento reale)
- [x] **Entrata** — la carta si apre in un cerchio su Casa Skoura vista dal drone (inquadratura sempre dentro i muri:
      i vicini non si vedono mai); il drone scende fino alla prima tappa
- [x] **Tappe con lo scroll** — Nosotros (il divano con la casa nord dietro), Visión (dall'alto del muro ovest, il pit
      e l'acqua), Contacto (dietro lo schienale, verso la casa sud); navigazione in alto, ES/EN
- [x] Casa Skoura ricostruita dalle foto; toccando l'acqua si creano increspature vere
- [ ] Proyectos (ODA, Skoura) e Taller

## Struttura
- `src/logo-data.js` — il logo ricalcato: 7 forme separate (punto, gambo, 4 foglie, linea di base).
  Generato con `tools/trace_logo.py` dallo screenshot del profilo. Quando arriva il vettoriale originale basta sostituire i `d`.
- `src/gl/stool.js` — lo sgabello di tre tondi di legno
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
