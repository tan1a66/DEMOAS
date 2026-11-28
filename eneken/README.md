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
- `?p=0.5` salta a un punto dello scroll (0 = Nosotros, 0.5 = Visión, 1 = Contacto) · `?k=0.3` congela l'entrata (0.3 = il castello sulle nuvole)
- `?fast` intro accelerata · `?debug` fps e oggetti in console · `?capture` orologio manuale (registrazione video)

## Stato
Ispirazione di esperienza: ORVAE (Undream Studio, Awwwards) — un mondo di architetture sopra le nuvole con capitoli.
Qui il mondo è fatto con le opere di Enekén:
- [x] **Caricamento** — logo in inchiostro su crema; la linea di base è la barra
- [x] **Entrata** — la carta si apre sulla cittadella sospesa sul banco di nuvole; il drone scende ai piedi della grande
      scala che sale dalle nuvole, la risale, attraversa la terrazza e entra nello studio
- [x] **Plaza 01 · Estudio** — il padiglione a capanna è lo studio: tavolo con i plastici rosso e bianco, le tavole del
      taller alle pareti (foto reali), il disco, la sfera e i totem di legno di Miguel Tapia
- [x] **Plaza 02 · Nuestra historia** — sulla terrazza aperta: il salotto di Casa Skoura e la piscina; il manifesto
- [x] **Plaza 03 · Contacto** — oltre l'arco sul bordo, la scala larga, la piazza con l'arco a ogiva di ODA nella vasca
      che riflette e la scala curva: il disco di legno di Miguel nel muro; mailto info@nkn.mx, Instagram
- [x] Cielo fotografico (Poly Haven, CC0), banco di nuvole volumetrico a strati, piante e alberi veri (Poly Haven, CC0)
- [x] Tappe raggiungibili toccando le porte (segnaposto), con lo scroll o dal menu; ES/EN

## Struttura
- `src/logo-data.js` — il logo ricalcato: 7 forme separate (punto, gambo, 4 foglie, linea di base).
  Generato con `tools/trace_logo.py` dallo screenshot del profilo. Quando arriva il vettoriale originale basta sostituire i `d`.
- `src/gl/stool.js` — lo sgabello di tre tondi di legno
- `src/gl/sky.js` — cielo con nuvole
- `src/gl/courtyard.js` — Casa Skoura (misure dalla foto cenitale: piscina Ø 2,4 m come scala), porta est
- `src/gl/world.js` — il castello: basamenti, scale, piazze 2 e 3, torri, isole lontane, mare di nuvole
- `src/gl/plants3d.js` — piante e alberi veri (Poly Haven: anthurium, calathea, felce, pachira; CC0) · `tools/gltf2glb.py` li impacchetta in .glb
- `src/gl/water.js` — onde (GPU), superficie con rifrazione del vaso, riflesso del cielo, gocce
- `src/gl/plants.js` — piante tropicali instanziate · `src/gl/textures.js` — texture Poly Haven + gobo disegnati a mano
- `src/gl/director.js` — regia: intro e percorso della camera (Catmull-Rom tra punti di passaggio) guidato dallo scroll
- `src/gl/core.js` — renderer, qualità mobile/desktop, patch dei materiali (ombre di palma, chukum triplanare, caustiche, grana)

## Fonti e licenze
- Texture: Poly Haven (CC0) — `clay_plaster`, `clean_pebbles`, `rough_wood`; cielo `kloofendal_48d_partly_cloudy_puresky`
  (ridotto a 512 px e senza il disco solare con `tools/hdr_half.py`: il sole è una luce con ombre)
- Font: Cormorant e Archivo (SIL OFL), inclusi nel progetto
- Colori campionati dalle foto di Enekén e dal video di Casa Skoura in pieno sole
