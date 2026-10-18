#!/usr/bin/env python3
"""PCB outline and fasteners of a Flan family variant, from its generated case outline.

Applies revI's board rule (tools/build_revI_profiles.py) to design/variants.json →
variants.<id>.outline: local tangent rounds (tools/outline.py rounded()), a 1.65 mm inset
and the 2.05 mm notch on the LCD flank, plus revI's two internal 2.05 mm cutouts. For
Flan36 the rule must reproduce revI's pcb_outline exactly, or nothing is written.

Fasteners: revI's five M2 holes stay. A variant adds a hole only where its outline reaches
farther from every fastener than Flan36's worst edge point on the key side (x < 60, away
from the bay, which the display frame holds). The outer pinky column gets H6: H1 moved one
column pitch outward, which restores Flan36's worst distance exactly.

Writes design/<id>-profiles.json (left half; right = 160 - x). Run with the silkscreen
Python (tools/requirements-silkscreen.txt, Shapely 2.2.0).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, math, sys

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from outline import rounded                                      # noqa: E402

INSET = 1.65                       # revI: pcb_outline = case shell inset by 1.65 mm
NOTCH = ((133, 52.8), 2.05)        # revI: notch on the LCD flank
COLUMN_PITCH = 18.0
KEY_SIDE_X = 60                    # fastener check: the finger side of the left half
MIRROR_X = 160

coords = lambda p: [list(v) for v in p.exterior.coords][:-1]

def pcb_outline(outline):
    outer, _ = rounded(outline["control_vertices"], outline["radii"])
    shell = Polygon(outer)
    assert shell.is_valid
    board = shell.buffer(-INSET, join_style=2).difference(Point(*NOTCH[0]).buffer(NOTCH[1], quad_segs=32))
    return outer, shell, coords(board)

def worst_distance(shell, holes, step=0.05):
    """Largest distance from a key-side edge point to its nearest fastener."""
    ring = shell.exterior
    pts = [ring.interpolate(i * step) for i in range(int(ring.length / step))]
    pts = [q for q in pts if q.x < KEY_SIDE_X]
    return max(min(math.dist((q.x, q.y), h) for h in holes) for q in pts)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", default="flan42")
    a = ap.parse_args()
    registry = json.loads((ROOT / "design/variants.json").read_text())["variants"]
    spec = registry[a.variant]
    if spec["number_row"]:
        raise SystemExit(f"{a.variant}: number-row fasteners are not defined yet")
    revI = json.loads((ROOT / "design/revI-profiles.json").read_text())["left"]
    mounts = json.loads((ROOT / "design/revI-mounts.json").read_text())["left"]
    _, shell36, base = pcb_outline(registry["flan36"]["outline"])
    assert base == revI["pcb_outline"], "the PCB rule no longer reproduces revI's pcb_outline"
    outer, shell, board = pcb_outline(spec["outline"])
    holes = {m["id"]: tuple(m["xy"]) for m in mounts}
    floor = worst_distance(shell36, list(holes.values()))
    added = []
    if spec["outer_column"]:
        h1 = holes["H1"]
        added.append({"id": "H6", "xy": [round(h1[0] - COLUMN_PITCH, 6), h1[1]], "from": "H1",
                      "offset_mm": [-COLUMN_PITCH, 0.0], "footprint": "MountingHole:MountingHole_2.2mm_M2"})
    without = worst_distance(shell, list(holes.values()))
    with_new = worst_distance(shell, list(holes.values()) + [tuple(h["xy"]) for h in added])
    assert with_new <= floor + 1e-6, (a.variant, with_new, floor)
    left = {"control_vertices": spec["outline"]["control_vertices"], "radii": spec["outline"]["radii"],
            "outer": outer, "pcb_outline": board, "pcb_cutouts": revI["pcb_cutouts"], "added_mounts": added}
    reflect = lambda p: [MIRROR_X - p[0], p[1]]
    right = {"control_vertices": [reflect(p) for p in left["control_vertices"]], "radii": left["radii"],
             "outer": [reflect(p) for p in outer], "pcb_outline": [reflect(p) for p in board],
             "pcb_cutouts": [[reflect(p) for p in loop] for loop in revI["pcb_cutouts"]],
             "added_mounts": [dict(h, xy=reflect(h["xy"]), offset_mm=[-h["offset_mm"][0], 0.0]) for h in added]}
    out = {"schema": "flan-variant-profiles-1", "variant": a.variant, "units": "mm",
           "rule": "revI: rounded case outline inset 1.65 mm, minus the 2.05 mm LCD-flank notch; revI cutouts",
           "fasteners": {"kept": sorted(holes), "added": [h["id"] for h in added],
                         "rule": "worst key-side edge distance to a fastener must not exceed Flan36's",
                         "flan36_worst_mm": round(floor, 2), "without_added_mm": round(without, 2),
                         "with_added_mm": round(with_new, 2)},
           "left": left, "right": right}
    path = ROOT / f"design/{a.variant}-profiles.json"
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(f"{a.variant}: {len(board)} outline points, fasteners {out['fasteners']}")

if __name__ == "__main__":
    main()
