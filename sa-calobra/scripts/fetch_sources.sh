#!/usr/bin/env bash
# Scarica le fonti grezze in una cartella di cache (fuori dal progetto):
#   - estratto OpenStreetMap (API v0.6; Overpass non era raggiungibile, i dati sono gli stessi)
#   - MDT05 dell'IGN (WCS INSPIRE, 5 m) in 4 blocchi GeoTIFF — solo per la variante --dem ign
# Le tile AWS Terrain le scarica direttamente build_data.py.
# Uso: scripts/fetch_sources.sh <cartella-cache>
set -euo pipefail
CACHE="${1:?cartella di cache}"
UA="AlessiaStudio-SaCalobra-demo/1.0"
mkdir -p "$CACHE/osm" "$CACHE/ign" "$CACHE/tiles"

curl -sS -A "$UA" -o "$CACHE/osm/map.osm" \
  "https://api.openstreetmap.org/api/0.6/map?bbox=2.790,39.820,2.830,39.860"

WCS="https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=Elevacion4258_5&FORMAT=image/tiff"
for la in 39.810 39.845; do
  for lo in 2.770 2.805; do
    la2=$(awk "BEGIN{printf \"%.3f\", $la+0.035}"); lo2=$(awk "BEGIN{printf \"%.3f\", $lo+0.035}")
    out="$CACHE/ign/ign5_${la}_${lo}.tif"
    for t in 1 2 3 4; do
      curl -sS -m 180 -o "$out" "$WCS&SUBSET=Lat($la,$la2)&SUBSET=Long($lo,$lo2)" && break
      sleep $((2 ** t))
    done
  done
done
echo "ok: $CACHE"
