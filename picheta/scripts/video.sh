#!/usr/bin/env bash
# Prepara el vídeo oficial de la terraza (picheta.mx/Picheta-TERRAZA.mp4, 11,8 s, 1920×1080) para la web.
#   bash scripts/video.sh <master.mp4> <carpeta-de-originales>
# - Bucle aéreo de Mérida (4,25 s → 8,95 s), sin audio, H.264: 1280 px (móvil) y 1920 px (escritorio).
# - Fotogramas fijos: la barra de noche (1,2 s) y la vista aérea (póster del bucle), que images.py convierte a AVIF/JPEG.
set -euo pipefail
SRC="$1"; ORIG="$2"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/video"
mkdir -p "$OUT"
ffmpeg -v error -y -ss 4.25 -t 4.7 -i "$SRC" -an -vf "scale=1920:-2" -c:v libx264 -preset slow -crf 26 -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/merida-aereo-1920.mp4"
ffmpeg -v error -y -ss 4.25 -t 4.7 -i "$SRC" -an -vf "scale=1280:-2" -c:v libx264 -preset slow -crf 27 -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/merida-aereo-1280.mp4"
ffmpeg -v error -y -ss 1.2 -i "$SRC" -frames:v 1 -update 1 "$ORIG/video-barra-noche.png"
ffmpeg -v error -y -ss 4.25 -i "$SRC" -frames:v 1 -update 1 "$ORIG/video-aereo.png"
ls -la "$OUT"
