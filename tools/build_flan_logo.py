#!/usr/bin/env python3
"""Build the Flan logo kit: lockup and mark, display and PCB constructions, as outlines.

The mark is the three-quarter tecla-flan (tools/branding/flankey.iso); the wordmark is
"flan" in Fraunces (OFL) converted to outlines with HarfBuzz (tools/branding/lockup.py).
Writes docs/branding/flan/ (SVG kit + zip) and docs/images/branding/flan-lockup.png.
Needs the pinned font in build/fonts/ (see tools/branding/lockup.FONT).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import hashlib, json, subprocess, sys, zipfile

from shapely import affinity

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from branding.lockup import lockup, font_file, FONT       # noqa: E402
from branding.flankey import iso                           # noqa: E402

OUT = ROOT / "docs/branding/flan"
PNG = ROOT / "docs/images/branding/flan-lockup.png"

def path_d(g):
    return " ".join("M" + " L".join(f"{x:.4f},{y:.4f}" for x, y in r.coords) + "Z"
                    for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" for r in [p.exterior] + list(p.interiors))

def svg(g, width_mm, title, color="#000"):
    x0, y0, x1, y1 = g.bounds
    s = width_mm / (x1 - x0)
    g = affinity.translate(affinity.scale(g, s, s, origin=(x0, y0)), -x0, -y0)
    w, h = g.bounds[2], g.bounds[3]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.3f}mm" height="{h:.3f}mm" viewBox="0 0 {w:.4f} {h:.4f}">\n'
            f'<title>{title}</title>\n<path d="{path_d(g)}" fill="{color}" fill-rule="evenodd"/>\n</svg>\n')

def main():
    font = font_file(ROOT)
    assert hashlib.sha256(font.read_bytes()).hexdigest() == FONT["sha256"], "pinned Fraunces missing from build/fonts/"
    OUT.mkdir(parents=True, exist_ok=True)
    display, dm = lockup(font)
    pcb, pm = lockup(font, small=True)
    files = {
        "flan-lockup.svg": svg(display, 60, "Flan — lockup"),
        "flan-lockup-white.svg": svg(display, 60, "Flan — lockup, white", "#fff"),
        "flan-mark.svg": svg(iso(), 20, "Flan — mark"),
        "flan-mark-white.svg": svg(iso(), 20, "Flan — mark, white", "#fff"),
        "flan-lockup-pcb.svg": svg(pcb, 15.05, "Flan — lockup, silkscreen construction (as on the revI boards)"),
        "flan-mark-pcb.svg": svg(iso(small=True), 6, "Flan — mark, silkscreen construction"),
    }
    for name, text in files.items():
        (OUT / name).write_text(text)
    kit = OUT / "flan-logo-svg-kit.zip"
    with zipfile.ZipFile(kit, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, (2026, 10, 17, 0, 0, 0))        # fixed date: reproducible bytes
            z.writestr(info, files[name], zipfile.ZIP_DEFLATED)
    PNG.parent.mkdir(parents=True, exist_ok=True)
    preview = OUT / "flan-lockup.svg"
    subprocess.run(["rsvg-convert", "-w", "1200", "-b", "#f6f5f1", preview, "-o", PNG], check=True)
    record = {"schema": "flan-logo-1", "mark": "flankey.iso", "wordmark": {"text": "flan", "font": FONT,
              "display": {"wght": dm["wght"], "opsz": 144, "SOFT": 100, "glyphs": dm["glyphs"]},
              "pcb": {"wght": pm["wght"], "opsz": 144, "SOFT": 100, "note": "heavier weight so no hairline falls below 0.17 mm at 4.6 mm em"}},
              "files": {n: hashlib.sha256(t.encode()).hexdigest() for n, t in files.items()},
              "kit_sha256": hashlib.sha256(kit.read_bytes()).hexdigest()}
    (ROOT / "design/branding-flan.json").write_text(json.dumps(record, indent=2) + "\n")
    print("wrote", len(files), "SVGs, kit and preview")

if __name__ == "__main__":
    main()
