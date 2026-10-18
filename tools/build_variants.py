#!/usr/bin/env python3
"""Flan family: key layouts, matrices and preliminary case outlines for every variant.

Flan36 is the built base: 3 × 5 + 3 keys per half. The family adds
- the outer pinky column that Flan36 left out of Piantor, at its pinned source centres
  (K00/K10/K20, sources/piantor/), and
- a number row one 17 mm pitch above each column's top key, keeping the column stagger
  (K41–K45, plus K40 above the outer column; refs follow the matrix: row 4, column c).
Every Flan36 key, the thumbs and the electronics bay keep their exact positions, so a
saved Flan36 design maps onto any variant key for key. Outlines use the revI rule
(tools/outline.py); for Flan36 it reproduces the revI control vertices exactly.

Writes design/variants.json and docs/images/variants/ (one drawing per variant and the
family sheet). Layout and 2D outline only: PCB, case solids, firmware and viewer come later
(docs/variants.md). Run with the silkscreen or CAD Python (Shapely).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import json, math, sys

from shapely import affinity
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from check_layout import read_sexpr, verify                   # noqa: E402
from outline import control_outline, rounded, MARGIN, FLANK_X, BAY_TOP, BAY_BOTTOM   # noqa: E402

PITCH_Y = 17.0                     # Choc row pitch, as between Flan36's rows
SOURCE_OFFSET = {"left": (-62, -41), "right": (-47.24, -41)}  # Piantor board -> Flan coordinates (check_layout.py)
MIRROR_X = 160                     # right half = 160 - x of the left half
CAP = (17.5, 16.5)                 # KLP Lamé footprint used for spacing checks (mm)
CUT = 14.0
BAY = box(111, BAY_TOP, FLANK_X, BAY_BOTTOM)   # display frame / electronics bay
VARIANTS = {
    "flan36": {"title": "Flan36", "outer_column": False, "number_row": False, "status": "built: routed PCB, case, firmware, viewer"},
    "flan42": {"title": "Flan42", "outer_column": True, "number_row": False, "status": "routed PCB (hardware/flan42); case, firmware, viewer next"},
    "flan46": {"title": "Flan46", "outer_column": False, "number_row": True, "status": "layout and outline"},
    "flan54": {"title": "Flan54", "outer_column": True, "number_row": True, "status": "layout and outline"},
}
# GPIOs (pro_micro numbering) free on each nice!nano after rows, columns and the nice!view
FREE_PINS = {"left": [15, 18, 19, 20, 21], "right": [2, 3, 4, 5, 6]}

def piantor_outer(side):
    """K00/K10/K20 centres from the pinned Piantor board, in Flan coordinates."""
    board = read_sexpr((ROOT / f"sources/piantor/{side}.kicad_pcb").read_text())
    tx, ty = SOURCE_OFFSET[side]
    out = {}
    for node in board:
        if not isinstance(node, list) or node[0] != "footprint":
            continue
        ref = next((x[2] for x in node if isinstance(x, list) and x[:2] == ["fp_text", "reference"]), "")
        if ref in ("K00", "K10", "K20"):
            at = next(x for x in node if isinstance(x, list) and x[0] == "at")
            out[ref] = {"ref": ref, "source_x": float(at[1]), "source_y": float(at[2]), "x": float(at[1]) + tx,
                        "y": float(at[2]) + ty, "angle": 0.0, "row": int(ref[1]), "col": 0,
                        "source": "piantor", "source_footprint_angle": float(at[3]) if len(at) > 3 else 0.0}
    assert sorted(out) == ["K00", "K10", "K20"], side
    return [out[r] for r in ("K00", "K10", "K20")]

def variant_keys(base, side, spec):
    keys = [dict(k, source="flan36") for k in base]
    if spec["outer_column"]:
        keys += piantor_outer(side)
    if spec["number_row"]:
        tops = {k["col"]: k for k in keys if k["row"] == 0}
        keys += [{"ref": f"K4{c}", "x": tops[c]["x"], "y": tops[c]["y"] - PITCH_Y, "angle": 0.0, "row": 4, "col": c,
                  "source": "number row: one pitch above " + tops[c]["ref"]} for c in sorted(tops)]
    order = {4: 0, 0: 1, 1: 2, 2: 3, 3: 4}                          # top to bottom, thumbs last
    return sorted(keys, key=lambda k: (order[k["row"]], k["col"] if side == "left" else -k["col"]))   # reading order

def footprint(k, size):
    w, h = size
    return affinity.rotate(box(k["x"] - w / 2, k["y"] - h / 2, k["x"] + w / 2, k["y"] + h / 2), -k["angle"], origin=(k["x"], k["y"]))

def gaps(keys):
    """Smallest cap-to-cap, cut-to-cut and cap-to-bay distances, per new key and overall."""
    caps = {k["ref"]: footprint(k, CAP) for k in keys}
    cuts = {k["ref"]: footprint(k, (CUT, CUT)) for k in keys}
    out = {}
    for k in keys:
        r = k["ref"]
        others = [q for q in keys if q["ref"] != r]
        out[r] = {"cap_mm": round(min(caps[r].distance(caps[q["ref"]]) for q in others), 3),
                  "cut_mm": round(min(cuts[r].distance(cuts[q["ref"]]) for q in others), 3),
                  "bay_mm": round(caps[r].distance(BAY), 3)}
    return out

def transform(left, right):
    """ZMK matrix transform: physical rows top to bottom, left half then right half."""
    lines = []
    for row in (4, 0, 1, 2, 3):
        l = [f"RC({k['row']},{k['col']})" for k in left if k["row"] == row]
        r = [f"RC({k['row']},{k['col'] + 6})" for k in right if k["row"] == row]
        if l:
            lines.append(" ".join(l + r))
    return lines

def firmware_transform():
    """The map rows of the shipped Flan36 shield, to check transform() against."""
    text = (ROOT / "firmware/config/boards/shields/flan36/flan36.dtsi").read_text()
    body = text[text.index("map = <") + len("map = <"):text.index(">;", text.index("map = <"))]
    return [" ".join(line.split()) for line in body.strip().splitlines()]

def svg_variant(keys, outline, title, scale=3.0, pad=10.0):
    """One left half and its mirrored right half, as one drawing (front view)."""
    halves = {"left": (keys["left"], outline), "right": (keys["right"], [[MIRROR_X - x, y] for x, y in outline])}
    shift = {"left": 0.0, "right": FLANK_X - (MIRROR_X - FLANK_X) + 25.0}   # 25 mm between the two bay flanks
    allpts = [(x + shift[h], y) for h, (_, o) in halves.items() for x, y in o]
    x0, y0 = min(p[0] for p in allpts) - pad, min(p[1] for p in allpts) - pad - 8
    x1, y1 = max(p[0] for p in allpts) + pad, max(p[1] for p in allpts) + pad
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {x1 - x0:.2f} {y1 - y0:.2f}" width="{(x1 - x0) * scale:.0f}" height="{(y1 - y0) * scale:.0f}" role="img">',
           f'<title>{title}</title><rect x="{x0:.2f}" y="{y0:.2f}" width="{x1 - x0:.2f}" height="{y1 - y0:.2f}" fill="#f6f5f1"/>',
           f'<text x="{x0 + pad:.2f}" y="{y0 + pad + 2:.2f}" font-family="Helvetica, Arial, sans-serif" font-size="7" font-weight="600" fill="#1f2a2c">{title}</text>',
           f'<text x="{x1 - pad:.2f}" y="{y0 + pad + 2:.2f}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="4" fill="#5b6566">{len(keys["left"]) * 2} keys · {len(keys["left"]) - 3} + 3 per half</text>']
    for h, (ks, o) in halves.items():
        dx = shift[h]
        out.append(f'<path d="M{" L".join(f"{x + dx:.2f},{y:.2f}" for x, y in o)}Z" fill="#e3ddcd" stroke="#b9b09a" stroke-width="0.35"/>')
        bx0, by0, bx1, by1 = BAY.bounds if h == "left" else (MIRROR_X - BAY.bounds[2], BAY.bounds[1], MIRROR_X - BAY.bounds[0], BAY.bounds[3])
        out.append(f'<rect x="{bx0 + dx:.2f}" y="{by0:.2f}" width="{bx1 - bx0:.2f}" height="{by1 - by0:.2f}" rx="1.2" fill="#3d5a63"/>')
        for k in ks:
            fill = {"flan36": "#fbfaf6", "piantor": "#f3c9a5"}.get(k["source"], "#cfe3da")
            if k["row"] == 3:
                fill = "#8fb2c0"
            w, hh = CAP
            out.append(f'<g transform="translate({k["x"] + dx:.3f} {k["y"]:.3f}) rotate({-k["angle"]:.3f})">'
                       f'<rect x="{-w / 2}" y="{-hh / 2}" width="{w}" height="{hh}" rx="2.2" fill="{fill}" stroke="#7d7564" stroke-width="0.3"/>'
                       f'<text y="1.3" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="3.4" fill="#4a4f50">{k["ref"]}</text></g>')
    out.append("</svg>")
    return "\n".join(out), (x1 - x0) * scale, (y1 - y0) * scale

def main():
    verify()                                               # Flan36 keys still match the pinned Piantor sources
    layout = json.loads((ROOT / "design/layout.json").read_text())
    profiles = json.loads((ROOT / "design/revI-profiles.json").read_text())
    out_dir = ROOT / "docs/images/variants"
    out_dir.mkdir(parents=True, exist_ok=True)
    base_gaps = gaps(layout["halves"]["left"])
    fingers = [k["ref"] for k in layout["halves"]["left"] if k["row"] != 3]   # new keys are finger keys; K32 already tucks under the bay
    floor = {f: min(base_gaps[r][f] for r in fingers) for f in ("cap_mm", "cut_mm", "bay_mm")}
    assert floor["bay_mm"] > 0
    registry = {"schema": "flan-variants-1", "base": "flan36", "units": "mm",
                "rules": {"number_row_pitch_mm": PITCH_Y, "outer_column": "Piantor K00/K10/K20 source centres",
                          "refs": "K<matrix row><column>; row 4 is the number row, column 0 the outer pinky column",
                          "outline": "tools/outline.py (revI rule, margin %.2f mm)" % MARGIN,
                          "spacing_floor_from_flan36": floor},
                "free_gpios": FREE_PINS, "variants": {}}
    sheet = []
    for vid, spec in VARIANTS.items():
        keys = {s: variant_keys(layout["halves"][s], s, spec) for s in ("left", "right")}
        # right half mirrors the left exactly, including the Piantor outer column
        L = {k["ref"]: k for k in keys["left"]}
        for k in keys["right"]:
            m = L[k["ref"]]
            assert math.isclose(k["x"], MIRROR_X - m["x"], abs_tol=1e-9) and k["y"] == m["y"] and math.isclose(k["angle"], -m["angle"], abs_tol=1e-9), (vid, k["ref"])
        # Flan36 keys never move
        for s in ("left", "right"):
            mine = {k["ref"]: k for k in keys[s]}
            assert all(mine[k["ref"]] == dict(k, source="flan36") for k in layout["halves"][s]), (vid, s)
        controls, radii = control_outline(keys["left"])
        if vid == "flan36":
            assert controls == profiles["left"]["control_vertices"], "outline rule no longer reproduces revI"
            assert transform(keys["left"], keys["right"]) == firmware_transform(), "matrix transform differs from the Flan36 shield"
        outline, _ = rounded(controls, radii)
        shell = Polygon(outline)
        assert shell.is_valid, vid
        g = gaps(keys["left"])
        for k in keys["left"]:
            cut = footprint(k, (CUT, CUT))
            assert shell.covers(cut), (vid, k["ref"], "switch cut outside the case")
            assert cut.distance(shell.exterior) >= MARGIN - 1e-6 or k["ref"] in base_gaps, (vid, k["ref"], "rim under 4.75 mm")
            if k["source"] != "flan36":
                for f in ("cap_mm", "cut_mm", "bay_mm"):
                    assert g[k["ref"]][f] >= floor[f] - 1e-6, (vid, k["ref"], f, g[k["ref"]][f], floor[f])
        x0, y0, x1, y1 = shell.bounds
        added = [k["ref"] for k in keys["left"] if k["source"] != "flan36"]
        registry["variants"][vid] = {
            "title": spec["title"], "status": spec["status"],
            "keys_per_half": len(keys["left"]), "keys_total": 2 * len(keys["left"]),
            "grid_per_half": f"{4 if spec['number_row'] else 3} × {6 if spec['outer_column'] else 5} + 3",
            "outer_column": spec["outer_column"], "number_row": spec["number_row"], "added_per_half": added,
            "matrix": {"rows": 5 if spec["number_row"] else 4, "cols": 6,
                       "row_gpio_needed": spec["number_row"], "transform": transform(keys["left"], keys["right"])},
            "case_size_mm": [round(x1 - x0, 2), round(y1 - y0, 2)],
            "outline": {"control_vertices": controls, "radii": radii},
            "spacing": {r: g[r] for r in added},
            "keys": keys,
        }
        drawing = svg_variant(keys, outline, f"{spec['title']} · {registry['variants'][vid]['grid_per_half']} per half")
        (out_dir / f"{vid}.svg").write_text(drawing[0] + "\n")
        sheet.append(drawing)
        print(vid, registry["variants"][vid]["keys_total"], "keys", "case", registry["variants"][vid]["case_size_mm"], "mm/half")
    # the family on one sheet: each drawing nested at its own height
    width, y, body = max(w for _, w, _ in sheet), 0.0, []
    for text, w, h in sheet:
        body.append(text.replace("<svg ", f'<svg x="{(width - w) / 2:.0f}" y="{y:.0f}" ', 1))
        y += h
    (out_dir / "family.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" height="{y:.0f}" viewBox="0 0 {width:.0f} {y:.0f}" role="img"><title>The Flan family</title><rect width="100%" height="100%" fill="#f6f5f1"/>\n'
                                        + "\n".join(body) + "\n</svg>\n")
    (ROOT / "design/variants.json").write_text(json.dumps(registry, indent=1, ensure_ascii=False) + "\n")
    print("PASS: Flan36 outline reproduced; new keys keep Flan36's own cap, cut and bay spacing; halves mirror exactly")

if __name__ == "__main__":
    main()
