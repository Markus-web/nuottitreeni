#!/usr/bin/env bash
# App icons from the SVG sources in src/assets/icons/: PNG sizes for browsers, home screens
# and the web app manifest, plus favicon.ico. Needs rsvg-convert (librsvg) and ImageMagick.
# Usage: bash scripts/build-icons.sh   (outputs are committed)
set -euo pipefail
cd "$(dirname "$0")/../src/assets/icons"
for size in 32 180 192 512; do
	rsvg-convert -w "$size" -h "$size" icon.svg -o "icon-$size.png"
done
rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-maskable-512.png
rsvg-convert -w 16 -h 16 icon.svg -o /tmp/nt-icon-16.png
magick /tmp/nt-icon-16.png icon-32.png favicon.ico
rm -f /tmp/nt-icon-16.png
ls -la
