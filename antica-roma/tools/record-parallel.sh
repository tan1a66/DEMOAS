#!/usr/bin/env bash
# Registra il video demo in segmenti paralleli tagliati nei punti "sicuri" della regia (f.mark('safe'))
# e li unisce senza ricodifica. Ogni segmento avanza rapidamente fino al suo inizio, poi cattura.
#   tools/record-parallel.sh out.mp4 [fps=60] [processi=3]
set -euo pipefail
OUT=${1:-../video/antica-roma-demo.mp4}; FPS=${2:-60}; P=${3:-3}
DIR=$(cd "$(dirname "$0")" && pwd); TMP=$(mktemp -d)
echo "prova a vuoto per trovare i punti di taglio…"
node "$DIR/record.cjs" /dev/null --dry --fps "$FPS" > "$TMP/dry.txt" 2>&1
mapfile -t MARKS < <(awk '/^MARK safe/{print $3}' "$TMP/dry.txt")
BOUNDS=(0 "${MARKS[@]}" 100000)
N=$(( ${#BOUNDS[@]} - 1 ))
echo "segmenti: $N  (tagli: ${MARKS[*]})"
running=0
for i in $(seq 0 $((N-1))); do
  node "$DIR/record.cjs" "$TMP/seg$i.mp4" --fps "$FPS" --from "${BOUNDS[$i]}" --to "${BOUNDS[$((i+1))]}" > "$TMP/log$i.txt" 2>&1 &
  running=$((running+1))
  if [ "$running" -ge "$P" ]; then wait -n; running=$((running-1)); fi
done
wait
for i in $(seq 0 $((N-1))); do grep -E "^frames|error|Error" "$TMP/log$i.txt" | tail -2; echo "file '$TMP/seg$i.mp4'" >> "$TMP/list.txt"; done
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
rm -rf "$TMP"
