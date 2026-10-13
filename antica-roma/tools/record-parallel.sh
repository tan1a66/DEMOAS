#!/usr/bin/env bash
# Registra il video in N segmenti paralleli e li unisce senza ricodifica.
#   tools/record-parallel.sh out.mp4 [fps=60] [segments=3] [durata_stimata_s=90]
set -euo pipefail
OUT=${1:-../video/antica-roma-demo.mp4}; FPS=${2:-60}; N=${3:-3}; DUR=${4:-90}
DIR=$(cd "$(dirname "$0")" && pwd); TMP=$(mktemp -d)
STEP=$(( (DUR + N - 1) / N ))
pids=()
for i in $(seq 0 $((N-1))); do
  FROM=$((i*STEP)); TO=$(( i==N-1 ? 100000 : (i+1)*STEP ))
  node "$DIR/record.cjs" "$TMP/seg$i.mp4" --fps "$FPS" --from "$FROM" --to "$TO" > "$TMP/log$i.txt" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
for i in $(seq 0 $((N-1))); do tail -2 "$TMP/log$i.txt"; echo "file '$TMP/seg$i.mp4'" >> "$TMP/list.txt"; done
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
rm -rf "$TMP"
