#!/bin/sh
# Cut the raw viewer shots in build/r4 into the transparent assets the R4 mockups use.
# Run after capture.cjs, capture-options.cjs and capture-preview.cjs: sh design/proposals/home-r4/src/process.sh
set -eu
root=$(cd "$(dirname "$0")/../../../.." && pwd)
raw="$root/build/r4" out="$root/design/proposals/home-r4/assets"
mkdir -p "$out"
# flood the flat viewer background from the padded corner, then shave its 1 px halo
cut() { # in out bg
  magick "$1" -bordercolor "$3" -border 12 -alpha set -fuzz 0.6% -fill none -draw "color 0,0 floodfill" \
    -channel A -morphology Erode Diamond:1 +channel -trim +repage -strip "$2"
}
for f in "$raw"/standby-snes.png "$raw"/standby-gameboy.png "$raw"/standby-snes-talavera.png; do
  n=$(basename "$f" .png); magick "$f" -fuzz 2% -trim +repage "$out/.t.png"; cut "$out/.t.png" "$out/hero-${n#standby-}.png" "#eef0f3"
  magick "$out/hero-${n#standby-}.png" -resize 1800x\> "$out/hero-${n#standby-}.png"
done
for theme in snes gameboy; do
  for v in flan36 flan42 flan46 flan54; do
    # the left half alone: the added column and row read at tile size
    magick "$raw/size-$theme-$v.png" -fuzz 2% -trim +repage -crop 50%x100%+0+0 +repage "$out/.t.png"; cut "$out/.t.png" "$out/size-$theme-$v.png" "#eef0f3"
    magick "$out/size-$theme-$v.png" -resize 240x "$out/size-$theme-$v.png"
  done
  # case: the pinky foot and thumb notch of the left half, where the four styles differ
  for s in rim solid terrace level; do
    magick "$raw/case-$theme-$s.png" -fuzz 2% -trim +repage -crop '%[fx:w*0.21]x%[fx:h*0.40]+%[fx:w*0.02]+%[fx:h*0.37]' +repage "$out/.t.png"
    cut "$out/.t.png" "$out/case-$theme-$s.png" "#eef0f3"; magick "$out/case-$theme-$s.png" -resize 300x "$out/case-$theme-$s.png"
  done
  # keycaps: two columns of caps on their switches, seen from the side, bottoms aligned
  for k in original normal saddle; do
    magick "$raw/keys-$theme-$k.png" -fuzz 2% -trim +repage -gravity south -chop 0x360 -gravity northwest \
      -crop '%[fx:w*0.36]x%[fx:h]+%[fx:w*0.02]+0' +repage "$out/.t.png"
    cut "$out/.t.png" "$out/keys-$theme-$k.png" "#eef0f3"; magick "$out/keys-$theme-$k.png" -resize 300x "$out/keys-$theme-$k.png"
  done
done
# frames: the display bay of the left half, seen from above, in the theme's colors
for f in "$raw"/top-*.png; do
  n=$(basename "$f" .png)
  magick "$f" -fuzz 2% -trim +repage -crop 50%x100%+0+0 +repage -fuzz 2% -trim +repage \
    -crop '%[fx:w*0.190]x%[fx:h*0.650]+%[fx:w*0.806]+%[fx:h*0.083]' +repage -resize 200x -strip "$out/frame-${n#top-}.png"
done
rm -f "$out"/frame-talavera.png "$out"/frame-gameboy.png "$out"/frame-snes.png "$out"/frame-phone.png "$out"/frame-ipod.png "$out"/frame-hanafuda.png
rm -f "$out/.t.png"
ls "$out"
