#!/usr/bin/env bash
# Prépare une vidéo d'accueil depuis une capture du jeu.
#   - supprime la piste audio (le fichier n'a plus de son du tout) ;
#   - recadre pour retirer le compteur de FPS et le filigrane RedM ;
#   - fond la fin dans le début : la boucle ne montre aucune coupure.
# Usage : bash scripts/art/hero-video.sh <video.mp4> [dossier de sortie]
set -euo pipefail

SRC="$1"
OUT="${2:-public/video}"
FADE=1.2
mkdir -p "$OUT"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
OFFSET=$(python -c "print(round($DUR - 2 * $FADE, 3))")

filter="[0:v]crop=1856:1044:32:36,fps=30,format=yuv420p,split=2[a][b];\
[a]trim=start=$FADE,setpts=PTS-STARTPTS[main];\
[b]trim=end=$FADE,setpts=PTS-STARTPTS[head];\
[main][head]xfade=transition=fade:duration=$FADE:offset=$OFFSET,format=yuv420p,split=2[hd][mob];\
[hd]scale=1920:1080:flags=lanczos[hd1];\
[mob]scale=960:540:flags=lanczos[mob1]"

ffmpeg -v error -y -i "$SRC" -filter_complex "$filter" \
  -map '[hd1]' -an -c:v libx264 -preset slow -crf 22 -profile:v high -level 4.1 \
  -x264-params aq-mode=3 -movflags +faststart "$OUT/hero-1920.mp4" \
  -map '[mob1]' -an -c:v libx264 -preset slow -crf 25 -profile:v high -level 4.0 \
  -x264-params aq-mode=3 -movflags +faststart "$OUT/hero-960.mp4"

# Image affichée avant la lecture, et à la place de la vidéo si le visiteur limite les animations.
ffmpeg -v error -y -i "$OUT/hero-1920.mp4" -frames:v 1 -c:v libwebp -quality 82 "$OUT/hero-poster.webp"
