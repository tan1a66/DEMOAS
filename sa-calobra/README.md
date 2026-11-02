# Sa Calobra — demo immersiva per Nomads Cycling Club (Alessia Studio)

Una sola scena: la MA-2141 dal Coll dels Reis al porto di Sa Calobra, si scende e si risale con lo scroll.

## Stato
- [x] Fase 1 — dati geografici reali (strada OSM, rilievo, punti chiave) → `docs/checkpoint1.png`
- [ ] Fase 2 — scena 3D
- [ ] Fase 3 — camera, scroll e storia
- [ ] Fase 4 — loader
- [ ] Fase 5 — rifinitura e pubblicazione

## Dati (Fase 1)
```bash
scripts/fetch_sources.sh /percorso/cache          # OSM + IGN (le tile AWS le scarica lo script python)
python3 -I scripts/build_data.py --osm /percorso/cache/osm/map.osm --cache /percorso/cache/tiles \
        --dem aws                                  # oppure: --dem ign --ign /percorso/cache/ign
python3 -I scripts/preview.py docs/checkpoint1.png /percorso/cache/tiles/_preview_aws.npz "AWS"
```
Richiede Python 3 con `numpy` e `Pillow`.

| File | Contenuto |
|---|---|
| `data/road.geojson` | MA-2141 originale OSM (lon/lat), tratti uniti e ordinati dalla cima al mare, con tipo di segmento (strada/ponte/galleria) |
| `data/keypoints.json` | `TOP` (Coll dels Reis, nodo OSM 1123226364), `CORBATA` (ponte del Nus de sa Corbata, way 25073139), `PORT` (terminal traghetti, nodo 3571097607) |
| `public/data/terrain.png` | heightmap 16 bit, griglia 8 m, sede stradale scavata (fascia piana 8 m + raccordo 18 m) |
| `public/data/terrain.json` | metadati: estensione in metri, quote min/max, origine lat/lon, sorgente |
| `public/data/road.json` | strada in coordinate locali `[x, y, z]` ogni 2 m, lisciata, con ponti/galleria e indici dei punti chiave |

Coordinate locali (come Three.js): origine al centro dell'area, `x` = est, `y` = quota, `z` = sud (metri).

Fonti: © OpenStreetMap contributors (ODbL) · AWS Terrain Tiles (Mapzen/Terrarium) · opzionale IGN MDT05 © Instituto Geográfico Nacional (CC-BY 4.0).
