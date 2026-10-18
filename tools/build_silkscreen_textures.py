#!/usr/bin/env python3
"""Rasterize each fabrication package's back silkscreen into a viewer texture.

Reads B_Silkscreen and Edge.Cuts straight from the committed Gerber ZIPs listed in
design/pcb-options.json, so the viewer shows exactly what would be ordered. Each texture
is an 8-bit grayscale mask (white = ink) covering the board rectangle in KiCad coordinates:
column 0 is the outline's minimum x, row 0 its minimum y. It also draws a small thumbnail
per edition: both halves seen from below, controllers adjacent, board shape from the KiCad
outline, as a two-channel mask (red = board, green = ink) that the viewer colours. Writes build/silkscreen-textures/ (PNGs + manifest.json) for build_viewer_revI.py.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import base64, hashlib, json, subprocess, sys, tempfile, zipfile

from gerbonara import GerberFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
OUT = ROOT / "build/silkscreen-textures"
KICAD_PY = "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3"
THUMB_H = 150                 # px; both halves side by side
PX_PER_MM = 10
EDGE_HALF_STROKE = 0.025      # KiCad Edge.Cuts are drawn 0.05 mm wide

def layer(z, suffix):
    name = next(n for n in z.namelist() if n.endswith(suffix))
    with tempfile.NamedTemporaryFile(suffix=suffix) as f:
        f.write(z.read(name)); f.flush()
        return GerberFile.open(f.name)

def outline(half):
    """KiCad outline polygon (with cutouts) of the canonical board, in KiCad millimetres."""
    from silkscreen.geo import polys
    geo = OUT / f"outline-{half}.json"
    subprocess.run([KICAD_PY, ROOT / "tools/silkscreen/kicad_extract.py", ROOT / f"hardware/revI/flan36-{half}.kicad_pcb", geo],
                   check=True, capture_output=True)
    return polys(json.loads(geo.read_text())["outline"])

def thumbnail(edition, textures, bounds, shapes):
    """Two SVGs of both halves from below (right half on the left, mirrored, as the editions
    sheet): the board shape and the ink. The viewer colours them with the chosen mask."""
    gap = 12.0
    board, ink, x = [], [], 0.0
    for half in ("right", "left"):
        x0, y0, x1, y1 = bounds[half]
        w, h = x1 - x0, y1 - y0
        d = " ".join("M" + " L".join(f"{px - x0:.2f},{py - y0:.2f}" for px, py in r.coords) + "Z"
                     for p in getattr(shapes[half], "geoms", [shapes[half]]) for r in [p.exterior] + list(p.interiors))
        img = base64.b64encode(textures[half]).decode()
        flip = f'transform="translate({x + w:.2f},0) scale(-1,1)"'
        board.append(f'<path {flip} d="{d}" fill="#fff" fill-rule="evenodd"/>')
        ink.append(f'<g {flip}><clipPath id="c-{half}"><path d="{d}" clip-rule="evenodd"/></clipPath>'
                   f'<image clip-path="url(#c-{half})" href="data:image/png;base64,{img}" width="{w:.2f}" height="{h:.2f}" preserveAspectRatio="none"/></g>')
        x += w + gap
    hmax = max(b[3] - b[1] for b in bounds.values())
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 {x - gap + 6:.2f} {hmax + 6:.2f}"><rect x="-3" y="-3" width="{x - gap + 6:.2f}" height="{hmax + 6:.2f}" fill="#000"/>'
    return head + "".join(board) + "</svg>", head + "".join(ink) + "</svg>"

def main():
    editions = json.loads((ROOT / "design/pcb-options.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"schema": "flan36-silkscreen-textures-1", "px_per_mm": PX_PER_MM, "textures": {}, "bounds": {}, "thumbnails": {}}
    shapes = {h: outline(h) for h in ("left", "right")}
    for e in editions["editions"]:
        pngs = {}
        for half, package in e["packages"].items():
            zpath = ROOT / package
            with zipfile.ZipFile(zpath) as z:
                silk, edge = layer(z, "B_Silkscreen.gbo"), layer(z, "Edge_Cuts.gm1")
            (gx0, gy0), (gx1, gy1) = edge.bounding_box(unit="mm")
            gx0, gy0, gx1, gy1 = gx0 + EDGE_HALF_STROKE, gy0 + EDGE_HALF_STROKE, gx1 - EDGE_HALF_STROKE, gy1 - EDGE_HALF_STROKE
            bounds = [round(gx0, 4), round(-gy1, 4), round(gx1, 4), round(-gy0, 4)]      # KiCad x0, y0, x1, y1
            assert manifest["bounds"].setdefault(half, bounds) == bounds, (e["id"], half, "outline differs between packages")
            svg = str(silk.to_svg(force_bounds=((gx0, gy0), (gx1, gy1)), fg="white", bg="black"))
            w, h = round((gx1 - gx0) * PX_PER_MM), round((gy1 - gy0) * PX_PER_MM)
            png = subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-b", "black"], input=svg.encode(),
                                 capture_output=True, check=True).stdout
            gray = subprocess.run(["magick", "png:-", "-colorspace", "Gray", "-depth", "8", "-strip",
                                   "-define", "png:compression-level=9", "-define", "png:color-type=0", "png:-"],
                                  input=png, capture_output=True, check=True).stdout
            target = OUT / f"{e['id']}-{half}.png"
            target.write_bytes(gray)
            pngs[half] = gray
            manifest["textures"].setdefault(e["id"], {})[half] = {
                "path": str(target.relative_to(ROOT)), "sha256": hashlib.sha256(gray).hexdigest(),
                "bytes": len(gray), "size_px": [w, h],
                "source": {"package": package, "sha256": hashlib.sha256(zpath.read_bytes()).hexdigest()}}
            print(e["id"], half, f"{len(gray) / 1024:.0f} KiB", f"{w}×{h}")
        layers = []
        for svg in thumbnail(e["id"], pngs, manifest["bounds"], shapes):
            layers.append(subprocess.run(["rsvg-convert", "-h", str(THUMB_H * 2)], input=svg.encode(), capture_output=True, check=True).stdout)
        tmp = [OUT / f".{e['id']}-board.png", OUT / f".{e['id']}-ink.png"]
        for t, data in zip(tmp, layers):
            t.write_bytes(data)
        target = OUT / f"{e['id']}-thumb.webp"
        subprocess.run(["magick", tmp[0], "-colorspace", "Gray", tmp[1], "-colorspace", "Gray", "(", "+clone", "-evaluate", "set", "0", ")",
                        "-combine", "-strip", "-define", "webp:lossless=true", target], check=True, capture_output=True)
        for t in tmp:
            t.unlink()
        thumb = target.read_bytes()
        manifest["thumbnails"][e["id"]] = {"path": str(target.relative_to(ROOT)), "sha256": hashlib.sha256(thumb).hexdigest(), "bytes": len(thumb)}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    total = sum(t["bytes"] for v in manifest["textures"].values() for t in v.values())
    thumbs = sum(t["bytes"] for t in manifest["thumbnails"].values())
    print(f"textures {total / 1024 / 1024:.2f} MiB, thumbnails {thumbs / 1024:.0f} KiB")

if __name__ == "__main__":
    main()
