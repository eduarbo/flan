#!/usr/bin/env python3
"""Naming study R1: logo masters, variant-family diagrams and a review page.

Writes font-free SVG masters in millimetres (black, closed paths) and the family diagrams to
design/proposals/naming-r1/. With --page PATH it also writes the review page. No repository
identity changes: the current name stays until one is chosen.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, sys

from shapely import affinity
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from branding.lettering import word        # noqa: E402
from branding.marks import MARKS            # noqa: E402

OUT = ROOT / "design/proposals/naming-r1"
NAMES = json.loads((ROOT / "design/naming-r1.json").read_text())

def path_d(g, nd=3):
    out = []
    for p in getattr(g, "geoms", [g]):
        if p.geom_type != "Polygon":
            continue
        for r in [p.exterior] + list(p.interiors):
            out.append("M" + " L".join(f"{x:.{nd}f},{y:.{nd}f}" for x, y in r.coords) + "Z")
    return " ".join(out)

def flip(g, height):
    """y-up unit geometry -> y-down, scaled to `height` (mm or px), origin at its top-left."""
    g = affinity.scale(g, height, -height, origin=(0, 0))
    x0, y0, _, _ = g.bounds
    return affinity.translate(g, -x0, -y0)

def lockup(mark, text, mark_h=1.0, x_h=0.40, gap=0.32):
    """Mark beside the wordmark, the wordmark's x-height centred on the mark (y-down result)."""
    m = affinity.scale(MARKS[mark](), mark_h, mark_h, origin=(0, 0))
    mb = m.bounds
    w = affinity.scale(word(text), x_h, x_h, origin=(0, 0))
    w = affinity.translate(w, mb[2] + gap * mark_h - w.bounds[0], (mb[1] + mb[3]) / 2 - x_h / 2)
    return flip(unary_union([m, w]), 1.0)

def svg_file(g, title, height_mm):
    x0, y0, x1, y1 = g.bounds
    s = height_mm / (y1 - y0)
    g = affinity.translate(affinity.scale(g, s, s, origin=(x0, y0)), -x0, -y0)
    w, h = g.bounds[2], g.bounds[3]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.3f}mm" height="{h:.3f}mm" viewBox="0 0 {w:.3f} {h:.3f}">\n'
            f'<title>{title}</title>\n<path d="{path_d(g, 4)}" fill="#000" fill-rule="evenodd"/>\n</svg>\n')

# ---------------------------------------------------------------------------- the variant family
def key_poses():
    geo = {h: json.loads((ROOT / f"build/silkscreen-r3/geo-{h}.json").read_text()) for h in ("left", "right")}
    poses = {}
    for h, g in geo.items():
        poses[h] = [(f["ref"], f["x"], f["y"], f["rot"]) for f in g["footprints"] if f["lib"].startswith("Kailh")]
    return poses

def family(variant):
    """Key rectangles for both halves as worn; added keys flagged. variant in 36/42/46/54."""
    poses = key_poses()
    keys = []
    for h, dx in (("left", 0.0), ("right", 122.0)):
        fingers = [(x, y) for ref, x, y, r in poses[h] if not ref.startswith("K3")]
        thumbs = [(x, y, r) for ref, x, y, r in poses[h] if ref.startswith("K3")]
        cols = sorted({x for x, _ in fingers})
        outer = cols[0] if h == "left" else cols[-1]
        step = -18 if h == "left" else 18
        for x, y in fingers:
            keys.append((x + dx, y, 0, False))
        for x, y, r in thumbs:
            keys.append((x + dx, y, r, False))
        extra = []
        if variant in (42, 54):
            extra += [(outer + step, y) for x, y in fingers if x == outer]
        if variant in (46, 54):
            for c in cols + ([outer + step] if variant == 54 else []):
                ref_c = outer if c == outer + step else c
                top = min(y for x, y in fingers if x == ref_c)
                extra.append((c, top - 17))
        keys += [(x + dx, y, 0, True) for x, y in extra]
    return keys

def family_svg(variant, fg, accent, scale=1.0):
    shapes_old, shapes_new = [], []
    for x, y, r, new in family(variant):
        k = box(x - 6.9, y - 6.4, x + 6.9, y + 6.4).buffer(1.3, quad_segs=6)
        k = affinity.rotate(k, -r, origin=(x, y))
        (shapes_new if new else shapes_old).append(k)
    old, new = unary_union(shapes_old), unary_union(shapes_new) if shapes_new else None
    allg = unary_union([old] + ([new] if new else []))
    x0, y0, x1, y1 = allg.bounds
    pad = 3
    t = lambda g: affinity.translate(g, -x0 + pad, -y0 + pad)
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    body = f'<path d="{path_d(t(old), 2)}" fill="{fg}"/>'
    if new:
        body += f'<path d="{path_d(t(new), 2)}" fill="{accent}"/>'
    return f'<svg viewBox="0 0 {w:.1f} {h:.1f}" xmlns="http://www.w3.org/2000/svg" role="img">{body}</svg>', w, h

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--page", type=Path, help="also write the review page here")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for n in NAMES["candidates"]:
        for m in n["marks"]:
            (OUT / f"{m}.svg").write_text(svg_file(flip(MARKS[m](), 1.0), f"{n['name']} — {m} mark", 10.0))
            (OUT / f"{m}-lockup.svg").write_text(svg_file(lockup(m, n["slug"]), f"{n['name']} — {m} lockup", 8.0))
    for v in (36, 42, 46, 54):
        s, _, _ = family_svg(v, "#1d2a24", "#c2410c")
        (OUT / f"family-{v}.svg").write_text(s.replace('<svg ', '<svg width="160mm" ', 1) + "\n")
    print("wrote", len(list(OUT.glob("*.svg"))), "SVG masters to", OUT.relative_to(ROOT))
    if a.page:
        from naming_page import page      # sibling module: page template
        a.page.write_text(page(NAMES, MARKS, word, lockup, flip, path_d, family_svg))
        print("wrote page", a.page)

if __name__ == "__main__":
    main()
