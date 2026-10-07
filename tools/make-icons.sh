#!/usr/bin/env bash
# Generate placeholder PWA icons with ImageMagick.
# Replace these with real artwork later; keep the same filenames.

set -euo pipefail
cd "$(dirname "$0")/.."

BG="#101828"
ACCENT="#ffc94d"

command -v magick >/dev/null || { echo "ImageMagick not found"; exit 1; }

mkdir -p icons

draw() {
  local size="$1" out="$2" pad="${3:-0}" maskable="${4:-}"
  local inset=$((size / 5))
  if [[ -n "$maskable" ]]; then
    # Full-bleed background, art inside the 40% safe zone.
    magick -size "${size}x${size}" xc:"$BG" \
      -fill "$ACCENT" -stroke "$BG" -strokewidth "$((size / 64))" \
      -draw "circle $((size / 2)),$((size / 2)) $((size / 2)),$((size / 8))" \
      "icons/$out"
  else
    magick -size "${size}x${size}" xc:"$BG" \
      -fill "$ACCENT" \
      -draw "polygon $((size / 2)),$((size / 5)) $((size / 4)),$((size * 3 / 4)) $((size * 3 / 4)),$((size * 3 / 4))" \
      "icons/$out"
  fi
}

draw 192 icon-192.png
draw 512 icon-512.png
draw 512 icon-maskable-512.png maskable
draw 64 icon-64.png

magick icons/icon-192.png -resize 180x180 icons/apple-touch-icon.png

echo "icons/"