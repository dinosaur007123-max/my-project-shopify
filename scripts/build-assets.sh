#!/usr/bin/env bash
# Downloads the Higgsfield-generated media for the MIRA theme and converts it
# into web-ready theme assets (WebP stills, a WebP frame sequence for the
# scroll film, and a compressed MP4), then zips the theme for upload.
#
# Requires: curl, ffmpeg, python3 + Pillow, zip.
# Usage:    scripts/build-assets.sh [output.zip]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_ZIP="${1:-$ROOT/dist/mira-theme.zip}"
RAW="$ROOT/.media-raw"
ASSETS="$ROOT/assets"
CDN="https://d8j0ntlcm91z4.cloudfront.net/user_3IKAryZa3vKrHFkWUBXEXvjuUj0"

mkdir -p "$RAW" "$(dirname "$OUT_ZIP")"

# name|remote file
MEDIA=(
  "bottle-hero.png|hf_20261002_175509_1db26ebd-41ca-442e-bbc6-68c40b71f692.png"
  "scene-bottle.png|hf_20261002_175513_8d11511a-c622-4b65-affb-9ff265a6b834.png"
  "bottle-oud.png|hf_20261002_175510_91e0ff3e-2075-454b-bc20-1fc8cb0b6d99.png"
  "bottle-rose.png|hf_20261002_175511_932543f0-4e8a-4e04-befc-60ec126fc2f6.png"
  "bottle-saffron.png|hf_20261002_175515_515dc967-0ba0-4951-b97e-9040208f1209.png"
  "note-oud.png|hf_20261002_175516_392860fa-ee66-4188-92d6-6c6df4ca1f2d.png"
  "note-saffron.png|hf_20261002_175515_7f3845f2-73e4-48d0-a381-cfd46b0b307f.png"
  "note-rose.png|hf_20261002_175517_16b1a065-a760-42ac-adda-1c1a1ec21ef6.png"
  "note-amber.png|hf_20261002_175512_e7f1d469-826a-4e6a-a560-2116c17273a4.png"
  "desert.png|hf_20261002_175516_f8dfd721-8d3f-4c85-90cf-a15786ee266c.png"
  "atelier.png|hf_20261002_175515_48b9e2c6-8f6f-4c59-9d0e-8b04b771c671.png"
  "lotus.png|hf_20261002_175517_0b78f0a9-ca9d-4a7f-81a7-4d2d987b0a4d.png"
  "orbit.mp4|hf_20261002_175653_53be397e-d9b9-47bd-bbde-a33792aa8f35.mp4"
  "liquid-gold.mp4|hf_20261002_175535_4ee4ffb1-cc8a-4894-8906-b37e90275637.mp4"
)

echo "→ Downloading media"
for entry in "${MEDIA[@]}"; do
  name="${entry%%|*}"; remote="${entry##*|}"
  [ -s "$RAW/$name" ] || curl -sSfL -o "$RAW/$name" "$CDN/$remote" &
done
wait

echo "→ Converting stills"
python3 - "$RAW" "$ASSETS" <<'PY'
import sys
from pathlib import Path
from PIL import Image

raw, assets = Path(sys.argv[1]), Path(sys.argv[2])

def cutout(name, max_h=1400):
    im = Image.open(raw / f"{name}.png").convert("RGBA")
    alpha = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    box = alpha.getbbox()
    if box:
        pad = 24
        box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, im.width), min(box[3] + pad, im.height))
        im = im.crop(box)
    if im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    im.save(assets / f"{name}.webp", "WEBP", quality=88, method=6)

def photo(name, max_w, q=80):
    im = Image.open(raw / f"{name}.png").convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(assets / f"{name}.webp", "WEBP", quality=q, method=6)

for n in ["bottle-hero", "bottle-oud", "bottle-rose", "bottle-saffron"]:
    cutout(n)
for n in ["note-oud", "note-saffron", "note-rose", "note-amber", "atelier"]:
    photo(n, 1100)
photo("scene-bottle", 1800)
photo("desert", 2400, 78)

# Lotus line art: keep the ivory lines, make the black ground transparent.
lotus = Image.open(raw / "lotus.png").convert("L")
lotus = lotus.resize((1400, 1400), Image.LANCZOS)
rgba = Image.new("RGBA", lotus.size, (239, 229, 209, 0))
rgba.putalpha(lotus.point(lambda v: min(255, int(v * 1.3))))
rgba.save(assets / "lotus.webp", "WEBP", quality=82, method=6)
print("stills ok")
PY

echo "→ Extracting scroll-film frames"
rm -f "$ASSETS"/film-*.webp
ffmpeg -loglevel error -y -i "$RAW/orbit.mp4" \
  -vf "fps=15,scale=1600:-2:flags=lanczos" -frames:v 120 \
  -c:v libwebp -quality 72 -compression_level 6 "$ASSETS/film-%03d.webp"

echo "→ Encoding liquid-gold video"
ffmpeg -loglevel error -y -i "$RAW/liquid-gold.mp4" -an \
  -vf "scale=1600:-2:flags=lanczos" -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 26 -preset slow -movflags +faststart "$ASSETS/liquid-gold.mp4"
ffmpeg -loglevel error -y -ss 2 -i "$RAW/liquid-gold.mp4" -frames:v 1 \
  -vf "scale=1600:-2" -c:v libwebp -quality 75 "$ASSETS/liquid-gold-poster.webp"

echo "→ Packaging theme"
rm -f "$OUT_ZIP"
(cd "$ROOT" && zip -qr "$OUT_ZIP" assets config layout locales sections snippets templates)
ls -la "$OUT_ZIP"
du -sh "$ASSETS"
