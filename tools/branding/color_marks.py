#!/usr/bin/env python3
"""Colour proposals for the three-quarter tecla-flan mark: custard faces lit from the left, a caramel
top with its gloss, darker caramel running down the front, optional plate, and square tiles for
favicons. Same geometry as the one-colour mark (tools/branding/flankey.iso_regions).

R1 (--r1) writes design/proposals/logo-color-r1/; R2 (default) writes the favicon tester's icons to
docs/proposals/favicon/icons/. python3 tools/branding/color_marks.py   (needs shapely; rsvg-convert)
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

# ---------------------------------------------------------------------------- R2
# R1 read as clip art (saturated, glossy, busy drips). R2 returns to the selected "Caramel" concept:
# pastel custard, milky caramel, few large drips, no gloss. Strokes lighten on dark browser chrome.
R2_INK = {"custard_lit": "#F8DA97", "custard": "#EFCB7F", "caramel": "#A8652E", "caramel_ink": "#8A5428",
          "caramel_mono": "#9A5420", "dark_stroke": "#E9B871", "dark_mono": "#F3CF86"}
R2 = [
    ("natilla", "Natilla", "Natilla suave y caramelo de leche, dos gotas grandes, sin contorno."),
    ("natilla-borde", "Natilla con borde", "La misma con un contorno caramelo; en modo oscuro el borde se aclara."),
    ("marca-color", "La marca, a color", "La marca actual con sus cuatro gotas, rellena de natilla y con contorno caramelo."),
    ("tinta-caramelo", "Tinta caramelo", "La marca actual en una sola tinta caramelo; en modo oscuro pasa a natilla."),
]

def svg_classes(layers, title, dark=None):
    """A square SVG (centred), with optional classes recoloured under prefers-color-scheme: dark."""
    x0, y0, x1, y1 = unary_union([geom for geom, _, _ in layers]).bounds
    w, h = x1 - x0, y1 - y0; side = max(w, h); pad = side * .03
    vx, vy = x0 - (side - w) / 2 - pad, y0 - (side - h) / 2 - pad
    style = f"<style>@media (prefers-color-scheme: dark) {{ {dark} }}</style>\n" if dark else ""
    paths = "\n".join(f'<path{f" class={chr(34)}{cls}{chr(34)}" if cls else ""} fill="{c}" fill-rule="evenodd" d="{d(geom)}"/>'
                      for geom, c, cls in layers if not geom.is_empty)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.3f} {vy:.3f} {side + 2 * pad:.3f} {side + 2 * pad:.3f}">\n'
            f'<title>{title}</title>\n{style}{paths}\n</svg>\n')

def build_r2(out):
    out.mkdir(parents=True, exist_ok=True)
    k = R2_INK
    two = regions(small=True)                                   # two large drips: clearest at 16 px
    full = regions()                                            # today's mark: four drips
    stroke = lambda g, w: [(g["silhouette"].exterior.buffer(w / 2, quad_segs=Q), k["caramel_ink"], "o"),
                           (g["edge"].difference(g["caramel"]).buffer(w / 2, quad_segs=Q), k["caramel_ink"], "o")]
    from branding.flankey import iso
    sets = {
        "natilla": ([(two["left"], k["custard_lit"], ""), (two["right"], k["custard"], ""), (two["caramel"], k["caramel"], "")], None),
        "natilla-borde": ([(two["left"], k["custard_lit"], ""), (two["right"], k["custard"], ""), (two["caramel"], k["caramel"], "")]
                          + stroke(two, 3.4), f".o {{ fill: {k['dark_stroke']}; }}"),
        "marca-color": ([(full["left"], k["custard_lit"], ""), (full["right"], k["custard"], ""), (full["caramel"], k["caramel"], "")]
                        + [(full["outline"], k["caramel_ink"], "o"), (full["front"], k["caramel_ink"], "o")], f".o {{ fill: {k['dark_stroke']}; }}"),
        "tinta-caramelo": ([(iso(), k["caramel_mono"], "m")], f".m {{ fill: {k['dark_mono']}; }}"),
    }
    meta = []
    for key, name, note in R2:
        layers, dark = sets[key]
        f = out / f"{key}.svg"
        f.write_text(svg_classes(layers, f"Flan — {name}", dark))
        for px in (16, 32, 180):
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(f), "-o", str(out / f"{key}-{px}.png")], check=True)
        # the dark-chrome look as its own file, for previews that cannot switch the scheme
        # and both looks as fixed files, for previews that must not follow the page's own scheme
        if dark:
            text = f.read_text()
            (out / f"{key}-dark.svg").write_text(text.replace("@media (prefers-color-scheme: dark) {", "").replace("; } }</style>", "; }</style>"))
            (out / f"{key}-light.svg").write_text(text.replace(f"<style>@media (prefers-color-scheme: dark) {{ {dark} }}</style>\n", ""))
        meta.append({"id": key, "name": name, "note": note, "dark": bool(dark)})
    (out / "variants.json").write_text(json.dumps({"palette": k, "variants": meta}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", len(meta), "R2 marks to", out.relative_to(ROOT))

if __name__ == "__main__":
    if "--r1" in sys.argv:
        build()
    else:
        build_r2(ROOT / "docs/proposals/favicon/icons")
