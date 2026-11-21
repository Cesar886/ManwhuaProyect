#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/icons

for size in 192 512; do
  safe_size=$((size * 4 / 5))
  convert public/logo.png \
    -resize "${size}x${size}" \
    -background '#0F0F14' -gravity center -extent "${size}x${size}" \
    "public/icons/icon-${size}.png"

  convert public/logo.png \
    -resize "${safe_size}x${safe_size}" \
    -background '#0F0F14' -gravity center -extent "${size}x${size}" \
    "public/icons/icon-maskable-${size}.png"
done

convert public/logo.png \
  -resize 180x180 \
  -background '#0F0F14' -gravity center -extent 180x180 \
  public/icons/apple-touch-icon.png
