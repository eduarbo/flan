#!/usr/bin/env python3
"""Colour proposals for the three-quarter tecla-flan mark: custard faces lit from the left, a caramel
top with its gloss, darker caramel running down the front, optional plate, and square tiles for
favicons. Same geometry as the one-colour mark (tools/branding/flankey.iso_regions).

R1 (--r1) writes design/proposals/logo-color-r1/; R2 (--r2), R3 (--r3) and R4 (default) write the
favicon tester's icons to docs/proposals/favicon/icons/. python3 tools/branding/color_marks.py   (needs shapely; rsvg-convert)
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

# ---------------------------------------------------------------------------- R3
# Eduardo kept "La marca, a color" and asked for variants that read more as a keycap, or in another
# drawing style. Same palette and outline; the cap's proportions, top and stand change.
R3 = [
    ("r3-choc", "Choc", "Proporciones de tecla low-profile Choc: más ancha y más baja, gotas cortas."),
    ("r3-choc-dish", "Choc con dish", "La Choc con su cara cóncava y la barra de homing de la F y la J."),
    ("r3-dish", "Con dish", "La marca de hoy con dish y barra de homing en el caramelo."),
    ("r3-switch", "En su switch", "La tecla Choc montada sobre su switch: se lee como tecla de teclado aun a 16 px."),
    ("r3-sticker", "Sticker", "La marca a color con un halo recortado, como estampa; destaca en pestañas oscuras."),
    ("r3-linea", "Línea", "Otro trazo: una línea fina dibuja la tecla y el borde del caramelo, con rellenos claros."),
    ("r3-patitas", "Patitas", "De frente, el flan parado sobre los dos stems rojos de un switch Choc."),
]
R3_INK = {**R2_INK, "dish": "#965627", "homing": "#C68446", "housing_top": "#E2E5DD", "housing": "#C9CDC4",
          "housing_shade": "#B7BBB2", "stem": "#C8484A", "halo": "#FFFDF8", "halo_edge": "#E6DCCB", "caramel_soft": "#D9A066"}
CHOC = dict(H=4.4, top_half=7.7, top_r=2.2, bottom_half=8.8, bottom_r=1.5, band=1.0,
            drips=[(-0.62, 1.0, 3.0), (-0.22, 0.8, 2.0), (0.30, 0.95, 3.4), (0.70, 0.75, 2.2)])

def build_r3(out):
    from branding.flankey import cap, caramel, open_
    from shapely.geometry import LineString
    k, w = R3_INK, 2.8
    stroke = lambda geom, width=w: geom.buffer(width / 2, quad_segs=Q)
    def faces(g):
        x = g["edge"].coords[0][0]; f = g["silhouette"].difference(g["top"])
        return f.intersection(box(-99, -99, x, 199)), f.intersection(box(x, -99, 199, 199))
    def coloured(g):
        left, right = faces(g)
        fill = [(left, k["custard_lit"], ""), (right, k["custard"], ""), (g["caramel"], k["caramel"], "")]
        lines = [(stroke(g["silhouette"].exterior), k["caramel_ink"], "o"),
                 (stroke(g["edge"].difference(g["caramel"])), k["caramel_ink"], "o")]
        return fill, lines
    def dish(g, half, r, H, inset):
        a, b = g["project"](half - inset - 1.3, -1.3, H - .25).coords[0], g["project"](half - inset - 1.3, 1.3, H - .25).coords[0]
        return [(g["ring"](half - inset, max(r - .6, .6), H - .25), k["dish"], ""),
                (LineString([a, b]).buffer(1.0, quad_segs=Q, cap_style="round"), k["homing"], "")]
    def switch(g, gap=3.2, half=7.2, r=1.4, depth=3.4):
        top, bot = g["ring"](half, r, -gap), g["ring"](half, r, -gap - depth)
        body = unary_union([top, bot]).convex_hull; x = g["edge"].coords[0][0]; f = body.difference(top)
        return [(top, k["housing_top"], ""), (f.intersection(box(-99, -99, x, 199)), k["housing"], ""),
                (f.intersection(box(x, -99, 199, 199)), k["housing_shade"], ""),
                (stroke(body.exterior), k["caramel_ink"], "o"), (stroke(top.exterior, w * .7).intersection(body.buffer(-.1)), k["caramel_ink"], "o")]
    base, choc = iso_regions(), iso_regions(**CHOC)
    sets = {}
    fill, lines = coloured(choc); sets["r3-choc"] = fill + lines
    sets["r3-choc-dish"] = fill + dish(choc, 7.7, 2.2, 4.4, 1.7) + lines
    sets["r3-switch"] = switch(choc) + fill + dish(choc, 7.7, 2.2, 4.4, 1.7) + lines
    fill, lines = coloured(base)
    sets["r3-dish"] = fill + dish(base, 7.2, 2.6, 8.6, 1.9) + lines
    halo = base["silhouette"].buffer(4.6, quad_segs=Q)
    sets["r3-sticker"] = [(halo.buffer(.9, quad_segs=Q), k["halo_edge"], ""), (halo, k["halo"], "")] + fill + lines
    fine = 2.2
    edge = base["caramel"].boundary.difference(base["silhouette"].exterior.buffer(fine * .3))
    sets["r3-linea"] = [(base["silhouette"], k["custard_lit"], ""), (base["caramel"], k["caramel_soft"], ""),
                        (stroke(base["silhouette"].exterior, fine), k["caramel_ink"], "o"),
                        (edge.buffer(fine / 2, quad_segs=Q, cap_style="round"), k["caramel_ink"], "o"),
                        (stroke(base["edge"].difference(base["caramel"]), fine), k["caramel_ink"], "o")]
    body = cap(bottom=66.0, top=33.0); glaze = caramel(body, 43.0, [(29, 3.2, 53), (45, 2.5, 48.5), (63, 3.9, 58)])
    stems = [open_(box(x - 2.8, 60, x + 2.8, 74), 2.2).difference(body) for x in (40.0, 60.0)]
    sets["r3-patitas"] = ([(body, k["custard_lit"], ""), (glaze, k["caramel"], "")] + [(st, k["stem"], "") for st in stems]
                          + [(stroke(body.exterior), k["caramel_ink"], "o")] + [(stroke(st.exterior).difference(body), k["caramel_ink"], "o") for st in stems])
    dark = f".o {{ fill: {k['dark_stroke']}; }}"
    meta = []
    for key, name, note in R3:
        f = out / f"{key}.svg"; text = svg_classes(sets[key], f"Flan — {name}", dark); f.write_text(text)
        (out / f"{key}-dark.svg").write_text(text.replace("@media (prefers-color-scheme: dark) {", "").replace("; } }</style>", "; }</style>"))
        (out / f"{key}-light.svg").write_text(text.replace(f"<style>@media (prefers-color-scheme: dark) {{ {dark} }}</style>\n", ""))
        for px in (16, 32, 180):
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(f), "-o", str(out / f"{key}-{px}.png")], check=True)
        meta.append({"id": key, "name": name, "note": note, "dark": True})
    (out / "variants-r3.json").write_text(json.dumps({"palette": k, "variants": meta}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", len(meta), "R3 marks to", out.relative_to(ROOT))

# ---------------------------------------------------------------------------- R4
# R3 read as one design tweaked seven times. R4 changes the concept, not the detail: a different
# silhouette and drawing style each, in the same custard and caramel.
R4 = [
    ("r4-arriba", "Desde arriba", "La tecla vista desde arriba: el caramelo cubre la cara y escurre por los cuatro lados."),
    ("r4-tecla-f", "Tecla F", "La leyenda «f» en caramelo, con una gota en el travesaño y la barra de homing de la F."),
    ("r4-perfil", "De perfil", "Una tecla esculpida de lado, con el caramelo sobre su dish y el stem rojo de un Choc."),
    ("r4-pixel", "Pixel", "Dibujada píxel a píxel a 16 × 16: nítida justo al tamaño del favicon."),
    ("r4-geometrico", "Geométrico", "Solo dos formas: la natilla y el caramelo con una gota grande. Sin contorno."),
]
PIXEL = ["................", "....OOOOOOOO....", "...OHHCCCCCCO...", "..OHCCCCCCCCCO..", "..OCCCCCCCCCCO..", ".OCCCCCCCCCCCCO.",
         ".OCCCCCCCCCCCCO.", "OCCCCCCCCCCCCCCO", "OYCCYYCYYCCYCSSO", "OYCCYYCYYCCYYSSO", "OYYCYYYYYCCYYSSO", "OYYYYYYYYCYYYSSO",
         "OYYYYYYYYYYYYSSO", "OYYYYYYYYYYYYSSO", ".OOOOOOOOOOOOOO.", "................"]

def build_r4(out):
    from branding.flankey import rounded, open_, close
    from branding.outline_text import outline
    from shapely.geometry import LineString
    k = {**R3_INK, "side": "#E9BC68", "homing": "#D7A65C", "geo_custard": "#F6D27E", "geo_caramel": "#8E4E22", "pixel_gloss": "#C98545"}
    ink = lambda g, w=3.0: g.buffer(w / 2, quad_segs=Q)
    rr = lambda x0, y0, x1, y1, r: box(x0, y0, x1, y1).buffer(-r, quad_segs=Q).buffer(r, quad_segs=Q)
    drop = lambda a, b, r: unary_union([Point(*a).buffer(r * .78, quad_segs=Q), Point(*b).buffer(r, quad_segs=Q)]).convex_hull
    sets = {}
    # from above: the sloped sides frame the top face; caramel pools there and runs down each side
    outer, top = rr(6, 6, 94, 94, 15), rr(17, 17, 83, 83, 10)
    tongues = []
    for side in range(4):
        for along, length, r in ((.3, 6.5, 2.6), (.62, 9.5, 3.0)):
            a, e = 17 + 66 * along, 82
            p0, p1 = {0: ((a, e), (a, e + length)), 1: ((e, 100 - a), (e + length, 100 - a)),
                      2: ((100 - a, 100 - e), (100 - a, 100 - e - length)), 3: ((100 - e, a), (100 - e - length, a))}[side]
            tongues.append(drop(p0, p1, r))
    pool = close(unary_union([top.buffer(-1.5, quad_segs=Q)] + tongues), 2.0)
    sets["r4-arriba"] = [(outer, k["side"], ""), (top, k["custard_lit"], ""), (pool, k["caramel"], ""), (ink(outer.exterior), k["caramel_ink"], "o")]
    # the F key: Fraunces "f" in caramel, a drip from the crossbar, the homing bar
    f, _ = outline("f", ROOT / "build/fonts/Fraunces[SOFT,WONK,opsz,wght].ttf", {"wght": 560, "opsz": 144, "SOFT": 100})
    f = affinity.scale(f, 1, -1, origin=(0, 0)); fx0, fy0, fx1, fy1 = f.bounds; sc = 50 / (fy1 - fy0)
    f = affinity.translate(affinity.scale(f, sc, sc, origin=(fx0, fy0)), 50 - (fx1 - fx0) * sc / 2 - fx0, 22 - fy0)
    fb = f.bounds; h = fb[3] - fb[1]
    def reach(y):
        g = f.intersection(LineString([(0, y), (100, y)]))
        pts = list(g.coords) if g.geom_type == "LineString" else [p for gg in getattr(g, "geoms", []) for p in gg.coords]
        return max((p[0] for p in pts), default=0)
    bar_y = max((fb[1] + h * i / 100 for i in range(28, 55)), key=reach); bar_x = reach(bar_y)
    legend = close(unary_union([f, drop((bar_x - 3, bar_y + 1), (bar_x - 3, bar_y + 11), 2.9)]), 1.0)
    sets["r4-tecla-f"] = [(outer, k["side"], ""), (top.buffer(4, quad_segs=Q), k["custard_lit"], ""), (legend, k["caramel"], ""),
                          (LineString([(42, 80), (58, 80)]).buffer(2.0, quad_segs=Q), k["homing"], ""), (ink(outer.exterior), k["caramel_ink"], "o")]
    # in profile: a sculpted cap with a slanted dish, caramel along it and down the face, on its stem
    body = open_(rounded([(12, 74), (88, 74), (82, 30), (18, 42)], [2.4, 2.4, 5, 5]).difference(Point(50, -118).buffer(152, quad_segs=360)), 1.2)
    bx0, by0, bx1, by1 = body.bounds
    glaze = body.intersection(body.boundary.intersection(box(bx0 + 4, 0, bx1 - 4, by0 + 20)).buffer(7.5, quad_segs=Q))
    glaze = close(unary_union([glaze] + [drop((x, 40), (x, dep), r) for x, dep, r in ((24, 60, 3.4), (44, 52, 2.6), (66, 57, 3.2))]), 1.2).intersection(body)
    stem = rr(44, 70, 56, 86, 2.2).difference(body)
    sets["r4-perfil"] = [(body, k["custard_lit"], ""), (glaze, k["caramel"], ""), (stem, k["stem"], ""),
                         (ink(body.exterior), k["caramel_ink"], "o"), (ink(stem.exterior).difference(body), k["caramel_ink"], "o")]
    # pixel art, one unit per pixel
    colors = {"O": (k["caramel_ink"], "o"), "C": (k["caramel"], ""), "H": (k["pixel_gloss"], ""), "Y": (k["custard_lit"], ""), "S": (k["side"], "")}
    cells = {}
    for y, row in enumerate(PIXEL):
        for x, ch in enumerate(row):
            if ch in colors:
                cells.setdefault(ch, []).append(box(x, y, x + 1, y + 1))
    sets["r4-pixel"] = [(unary_union(v), *colors[ch]) for ch, v in cells.items()]
    # two shapes
    tz = rounded([(10, 80), (90, 80), (76, 34), (24, 34)], [5, 5, 7, 7])
    capc = close(unary_union([tz.intersection(box(0, 0, 100, 48)), drop((62, 46), (62, 62), 7.2)]), 2.6).intersection(tz)
    sets["r4-geometrico"] = [(tz, k["geo_custard"], ""), (capc, k["geo_caramel"], "")]
    dark = f".o {{ fill: {k['dark_stroke']}; }}"
    meta = []
    for key, name, note in R4:
        layers = sets[key]; has_dark = any(cls for _, _, cls in layers)
        text = svg_classes(layers, f"Flan — {name}", dark if has_dark else None)
        if key == "r4-pixel":   # the 16-unit grid, square, with no padding and crisp edges
            text = text.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="', '<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="', 1)
            text = text[:text.index('viewBox="') + 9] + "0 0 16 16" + text[text.index('"', text.index('viewBox="') + 9):]
        (out / f"{key}.svg").write_text(text)
        if has_dark:
            (out / f"{key}-dark.svg").write_text(text.replace("@media (prefers-color-scheme: dark) {", "").replace("; } }</style>", "; }</style>"))
            (out / f"{key}-light.svg").write_text(text.replace(f"<style>@media (prefers-color-scheme: dark) {{ {dark} }}</style>\n", ""))
        for px in (16, 32, 180):
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(out / f"{key}.svg"), "-o", str(out / f"{key}-{px}.png")], check=True)
        meta.append({"id": key, "name": name, "note": note, "dark": has_dark})
    (out / "variants-r4.json").write_text(json.dumps({"palette": k, "variants": meta}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", len(meta), "R4 marks to", out.relative_to(ROOT))

if __name__ == "__main__":
    out = ROOT / "docs/proposals/favicon/icons"
    if "--r1" in sys.argv:
        build()
    elif "--r2" in sys.argv:
        build_r2(out)
    elif "--r3" in sys.argv:
        build_r3(out)
    else:
        build_r4(out)
