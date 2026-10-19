#!/usr/bin/env python3
"""Colour proposals for the three-quarter tecla-flan mark: custard faces lit from the left, a caramel
top with its gloss, darker caramel running down the front, optional plate, and square tiles for
favicons. Same geometry as the one-colour mark (tools/branding/flankey.iso_regions).

Writes design/proposals/logo-color-r1/: one SVG per variant, PNGs at favicon sizes, and the
review sheet's data. python3 tools/branding/color_marks.py   (needs shapely; rsvg-convert)
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import json, math, subprocess, sys

from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from branding.flankey import iso_regions, Q        # noqa: E402

OUT = ROOT / "design/proposals/logo-color-r1"

# a baked flan: pale lit custard, a warmer shaded face, glossy amber caramel, darker where it runs
INK = {"custard_lit": "#F9D774", "custard": "#F0B94A", "custard_deep": "#DE9C34",
       "caramel_top": "#A9531C", "caramel": "#86390F", "caramel_dark": "#5A240A", "gloss": "#DC9452",
       "outline": "#48210B", "cream": "#FFF4DA", "plate": "#FFFFFF", "plate_rim": "#E7DDCA", "plate_shade": "#F1E9DA"}

def regions(small=False):
    g = iso_regions(small)
    sil, top, car = g["silhouette"], g["top"], g["caramel"]
    x_edge = g["edge"].coords[0][0]                         # the front corner is vertical
    faces = sil.difference(top)
    left = faces.intersection(box(-50, -50, x_edge, 150))
    right = faces.intersection(box(x_edge, -50, 150, 150))
    car_top = car.intersection(top)
    drips = car.difference(top)
    # gloss: a crescent along the back-left of the caramel pool
    inner = top.buffer(-3.2, quad_segs=Q)
    gloss = inner.difference(affinity.translate(inner, 2.6, 2.1)).intersection(car_top).buffer(-0.35, quad_segs=Q).buffer(0.35, quad_segs=Q)
    # a small highlight on the longest drip
    return {**g, "left": left, "right": right, "car_top": car_top, "drips": drips, "gloss": gloss}

def plate(g):
    """A round plate under the cap, in the same projection: rim, top and the cap's shadow on it."""
    ring = lambda r, z: Polygon([g["project"](r * math.cos(a), r * math.sin(a), z).coords[0]
                                 for a in [i * 2 * math.pi / 180 for i in range(180)]])
    rim, face, shadow = ring(13.6, -1.2), ring(13.6, -0.2), ring(10.4, -0.1)
    return [(rim, INK["plate_rim"]), (face, INK["plate"]), (shadow.difference(g["silhouette"]), INK["plate_shade"])]

def flan_layers(g, outline=False, flat=False):
    if flat:
        layers = [(g["silhouette"], INK["custard"]), (g["caramel"], INK["caramel"])]
    else:
        layers = [(g["left"], INK["custard_lit"]), (g["right"], INK["custard"]), (g["drips"], INK["caramel"]),
                  (g["car_top"], INK["caramel_top"]), (g["gloss"], INK["gloss"])]
    if outline:
        layers += [(g["outline"], INK["outline"]), (g["front"], INK["outline"])]
    return layers

def tile(layers, background, size=100, radius=22, fill=.74):
    """The mark centred on a rounded square, as an app icon or favicon."""
    allg = unary_union([geom for geom, _ in layers])
    x0, y0, x1, y1 = allg.bounds
    s = size * fill / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + (y1 - y0) * .02      # optical centre: a touch low
    place = lambda geom: affinity.translate(affinity.scale(geom, s, s, origin=(cx, cy)), size / 2 - cx, size / 2 - cy)
    bg = box(0, 0, size, size).buffer(-radius, quad_segs=Q).buffer(radius, quad_segs=Q)
    return [(bg, background)] + [(place(geom), color) for geom, color in layers], (0, 0, size, size)

def d(geom):
    out = []
    for p in getattr(geom, "geoms", [geom]):
        if p.geom_type != "Polygon" or p.is_empty:
            continue
        for r in [p.exterior] + list(p.interiors):
            out.append("M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in r.coords) + "Z")
    return " ".join(out)

def svg(layers, title, view=None):
    if view is None:
        x0, y0, x1, y1 = unary_union([geom for geom, _ in layers]).bounds
        pad = .6
        view = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
    else:
        view = (view[0], view[1], view[2] - view[0], view[3] - view[1])
    paths = "\n".join(f'<path fill="{c}" fill-rule="evenodd" d="{d(geom)}"/>' for geom, c in layers if not geom.is_empty)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view[0]:.3f} {view[1]:.3f} {view[2]:.3f} {view[3]:.3f}">\n'
            f'<title>{title}</title>\n{paths}\n</svg>\n')

VARIANTS = [
    ("caramelo", "Caramelo", "Natilla con luz y sombra, caramelo con brillo arriba y más oscuro donde escurre. Sin contorno."),
    ("contorno", "Con contorno", "La misma, con el contorno café de la marca original. Se lee mejor sobre fondos claros."),
    ("plato", "En su plato", "Servido: un plato blanco en la misma perspectiva, con la sombra del flan."),
    ("dos-tintas", "Dos tintas", "Solo natilla y caramelo, sin sombras. La más clara a 16 px y para imprimir."),
    ("azulejo-crema", "Azulejo crema", "La marca sobre un cuadrado redondeado color crema: se ve en pestañas claras y oscuras."),
    ("azulejo-caramelo", "Azulejo caramelo", "Sobre caramelo oscuro: la natilla resalta y funciona como ícono de app."),
]

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    g = regions()
    small = regions(small=True)
    sets = {
        "caramelo": (flan_layers(g), None),
        "contorno": (flan_layers(g, outline=True), None),
        "plato": (plate(g) + flan_layers(g), None),
        "dos-tintas": (flan_layers(g, flat=True), None),
        "azulejo-crema": tile(flan_layers(small), INK["cream"]),
        "azulejo-caramelo": tile(flan_layers(small), INK["caramel_dark"], fill=.72),
    }
    meta = []
    for key, name, note in VARIANTS:
        layers, view = sets[key]
        f = OUT / f"{key}.svg"
        f.write_text(svg(layers, f"Flan — {name}", view))
        for px in (16, 32, 64, 256):
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "--keep-aspect-ratio", str(f), "-o", str(OUT / f"{key}-{px}.png")], check=True)
        meta.append({"id": key, "name": name, "note": note})
    # the current one-colour mark at the same sizes, for the comparison
    for px in (16, 32):
        subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "--keep-aspect-ratio", str(ROOT / "docs/branding/flan/flan-mark.svg"),
                        "-o", str(OUT / f"actual-{px}.png")], check=True)
    (OUT / "variants.json").write_text(json.dumps({"palette": INK, "variants": meta}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", len(meta), "variants to", OUT.relative_to(ROOT))

if __name__ == "__main__":
    build()
