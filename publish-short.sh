#!/usr/bin/env bash
set -euo pipefail

# Publica exclusivamente un MP4 final vertical, ya editado y subtitulado.
# Uso: ./publish-short.sh archivo_final.mp4 "Título" "Descripción" "tag1,tag2"
VIDEO="${1:-}"
TITLE="${2:-}"
DESCRIPTION="${3:-}"
TAGS="${4:-}"
if [ -z "$VIDEO" ] || [ -z "$TITLE" ]; then
  echo 'Uso: ./publish-short.sh video_final.mp4 "Título" ["Descripción"] ["tag1,tag2"]'
  exit 2
fi
case "$VIDEO" in *_final.mp4) ;; *) echo "Bloqueado: solo se permiten archivos *_final.mp4"; exit 3;; esac
[ -s "$VIDEO" ] || { echo "No existe o está vacío: $VIDEO"; exit 3; }
command -v ffprobe >/dev/null || { echo "Falta ffprobe"; exit 3; }
DIMS="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$VIDEO")"
DURATION="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")"
WIDTH="${DIMS%x*}"
HEIGHT="${DIMS#*x}"
[ "${WIDTH:-0}" = "1080" ] && [ "${HEIGHT:-0}" = "1920" ] || {
  echo "Bloqueado: se esperaba vídeo 1080x1920; detectado: $DIMS"; exit 4;
}
awk -v d="${DURATION:-0}" 'BEGIN { if (d <= 0 || d > 180) exit 1 }' || {
  echo "Bloqueado: la duración debe ser >0 y <=180 segundos (Short)."; exit 4;
}
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN_OK: $VIDEO | $DIMS | ${DURATION}s"
  echo "Título: $TITLE"
  echo "Descripción: ${DESCRIPTION:-<por defecto>}"
  echo "Etiquetas: ${TAGS:-<ninguna>}"
  exit 0
fi
ARGS=("$VIDEO" "$TITLE" --confirm-rights)
[ -z "$DESCRIPTION" ] || ARGS+=(--description "$DESCRIPTION")
[ -z "$TAGS" ] || ARGS+=(--tags "$TAGS")
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node youtube-upload.mjs "${ARGS[@]}"
