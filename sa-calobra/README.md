# Sa Calobra — demo immersiva per Nomads Cycling Club (Alessia Studio)

Una sola scena: la MA-2141 dal Coll dels Reis al porto di Sa Calobra, si scende e si risale con lo scroll.

## Stato
- [x] Fase 1 — dati geografici reali (strada OSM, rilievo, punti chiave) → `docs/checkpoint1.png`
- [x] Fase 2 — scena 3D (terreno, strada, mare, cielo, pini, post) → `docs/checkpoint2.jpg`
- [x] Fase 3 — camera, scroll e storia (GSAP + ScrollTrigger + Lenis) → `docs/checkpoint3.jpg`
- [ ] Fase 4 — loader
- [ ] Fase 5 — rifinitura e pubblicazione

## Sviluppo
```bash
npm install
npm run dev                       # http://127.0.0.1:5174
```
Parametri di sviluppo nell'URL:
- `?debug` contatore FPS / draw call / triangoli (e risoluzione adattiva)
- `?view=serpentina|meta|porto|nus|tramonto` punti di vista di prova
- `?orbit` per girare liberamente con il mouse/dito
- `?set=sky.exposure:1.2,fog.density:0.0002` prova valori di `src/config.js` senza modificarlo

Screenshot di verifica (Playwright, iPhone 15): `node scripts/shot.mjs "http://127.0.0.1:5174/?view=porto&shot" out.png`

Video dell'intera storia, fotogramma per fotogramma (il browser headless non ha GPU):
```bash
node scripts/capture.mjs "http://127.0.0.1:5174/" fotogrammi/ 720 1
ffmpeg -framerate 24 -i fotogrammi/%05d.png -c:v libx264 -pix_fmt yuv420p video.mp4
```
Prova dello scroll reale e del trascinamento: `node scripts/scrolltest.mjs "http://127.0.0.1:5174/" out.png`

## Regia (Fase 3)
- `src/story/story.js` — la timeline: apertura (drone), discesa, sosta al porto, salita, sosta al Nus, cima, finale
- `src/camera/rig.js` — la camera su `CatmullRomCurve3` lisciate (discesa e salita), sempre 30–80 m sopra la strada, e le inquadrature fisse
- `src/ui/look.js` — soste a 360°: trascinamento con inerzia (orizzontale su touch, libero col mouse) e giroscopio
- `src/ui/audio.js` — vento e ruota libera generati con Web Audio (icona in alto a destra)
- In `config.js`: `camera` (quote, lisciatura, inquadrature `poses`, limiti dello sguardo) e `story` (lunghezza di ogni sezione in schermate)

## Dati (Fase 1)
```bash
scripts/fetch_sources.sh /percorso/cache          # OSM + IGN (le tile AWS le scarica lo script python)
python3 -I scripts/build_data.py --osm /percorso/cache/osm/map.osm --cache /percorso/cache/tiles \
        --ign /percorso/cache/ign                  # rilievo IGN (predefinito); --dem aws per le sole tile AWS
python3 -I scripts/preview.py docs/checkpoint1.png /percorso/cache/tiles/_preview_aws.npz "AWS"
```
Richiede Python 3 con `numpy` e `Pillow`.

| File | Contenuto |
|---|---|
| `data/road.geojson` | MA-2141 originale OSM (lon/lat), tratti uniti e ordinati dalla cima al mare, con tipo di segmento (strada/ponte/galleria) |
| `data/keypoints.json` | `TOP` (Coll dels Reis, nodo OSM 1123226364), `CORBATA` (ponte del Nus de sa Corbata, way 25073139), `PORT` (terminal traghetti, nodo 3571097607) |
| `public/data/terrain_hi.png` | heightmap 16 bit, corridoio della strada a 4 m, sede stradale scavata (fascia piana 8 m + raccordo 18 m) |
| `public/data/terrain_base.png` | heightmap 16 bit, tutta l'area (5,1 × 6,4 km) a 8 m |
| `public/data/terrain_far.png` | orizzonte lontano (26 km) a 100 m, tile AWS |
| `public/data/terrain.json` | metadati: estensione in metri, quote min/max, origine lat/lon, sorgente |
| `public/data/road.json` | strada in coordinate locali `[x, y, z]` ogni 2 m, lisciata, con ponti/galleria e indici dei punti chiave |

Coordinate locali (come Three.js): origine al centro dell'area, `x` = est, `y` = quota, `z` = sud (metri).

Fonti: © OpenStreetMap contributors (ODbL) · AWS Terrain Tiles (Mapzen/Terrarium) · opzionale IGN MDT05 © Instituto Geográfico Nacional (CC-BY 4.0).
