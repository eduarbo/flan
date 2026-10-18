#!/usr/bin/env python3
"""PCB outline and fasteners of a Flan family variant, from its generated case outline.

Applies revI's board rule (tools/build_revI_profiles.py) to design/variants.json →
variants.<id>.outline: local tangent rounds (tools/outline.py rounded()), a 1.65 mm inset
and the 2.05 mm notch on the LCD flank, plus revI's two internal 2.05 mm cutouts. For
Flan36 the rule must reproduce revI's pcb_outline exactly, or nothing is written.

Fasteners: revI's five M2 holes stay. Every edge point left of the bay (which the display
frame holds) must lie within the larger of two distances of a fastener: Flan36's worst
key-side distance (41.65 mm, x < 60), and the distance at the Flan36 edge point it extends
(the same point, or one moved back by a column or row pitch). Candidates are revI's holes
moved one column outward, one row up, or both; the smallest set that passes is added, with
fixed references (H6 = H1 outward, H7 = H2 up, H8 = H1 outward and up). Flan42 gets H6,
Flan46 H7, Flan54 all three.

Writes design/<id>-profiles.json (left half; right = 160 - x). Run with the silkscreen
Python (tools/requirements-silkscreen.txt, Shapely 2.2.0).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, itertools, json, math, sys

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from outline import rounded                                      # noqa: E402

INSET = 1.65                       # revI: pcb_outline = case shell inset by 1.65 mm
NOTCH = ((133, 52.8), 2.05)        # revI: notch on the LCD flank
COLUMN_PITCH = 18.0
ROW_PITCH = 17.0
KEY_SIDE_X = 60                    # Flan36's worst finger-side distance is measured here
BAY_X = 111                        # the display frame holds everything right of this
STEP = 0.05
MIRROR_X = 160
SHIFTS = {"o": (-COLUMN_PITCH, 0.0), "u": (0.0, -ROW_PITCH), "ou": (-COLUMN_PITCH, -ROW_PITCH)}
NAMES = {"H1o": "H6", "H2u": "H7", "H1ou": "H8"}   # fixed references; others follow from H9

coords = lambda p: [list(v) for v in p.exterior.coords][:-1]

def pcb_outline(outline):
    outer, _ = rounded(outline["control_vertices"], outline["radii"])
    shell = Polygon(outer)
    assert shell.is_valid
    board = shell.buffer(-INSET, join_style=2).difference(Point(*NOTCH[0]).buffer(NOTCH[1], quad_segs=32))
    return outer, shell, coords(board)

def edge(shell, xmax):
    ring = shell.exterior
    return [(q.x, q.y) for q in (ring.interpolate(i * STEP) for i in range(int(ring.length / STEP))) if q.x < xmax]

def nearest(p, holes):
    return min(math.dist(p, h) for h in holes)

def allowances(shell, shell36, holes, floor):
    """Each edge point's allowed fastener distance: max(floor, the distance at the Flan36
    edge point it extends: the same point, or one moved back by a column or row pitch)."""
    ring36 = shell36.exterior
    out = []
    for p in edge(shell, BAY_X):
        allowed = floor
        for dx, dy in [(0.0, 0.0)] + [(-sx, -sy) for sx, sy in SHIFTS.values()]:
            c = (p[0] + dx, p[1] + dy)
            if ring36.distance(Point(c)) < 0.02:
                allowed = max(allowed, nearest(c, holes))
        out.append((p, allowed))
    return out

def choose(shell, shell36, holes):
    """Smallest set of shifted revI holes that keeps every edge point within its allowance."""
    floor = max(nearest(p, holes.values()) for p in edge(shell36, KEY_SIDE_X))
    limits = allowances(shell, shell36, holes.values(), floor)
    inner = shell.buffer(-3)
    cands = [(src + s, (h[0] + dx, h[1] + dy)) for src, h in holes.items() for s, (dx, dy) in SHIFTS.items()
             if inner.contains(Point(h[0] + dx, h[1] + dy)) and h[0] + dx < BAY_X]
    excess = lambda extra: max(nearest(p, [*holes.values(), *extra]) - a for p, a in limits)
    for n in range(len(cands) + 1):
        best = min(itertools.combinations(cands, n), key=lambda c: excess([xy for _, xy in c]), default=None)
        if best is not None and excess([xy for _, xy in best]) <= 1e-6:
            return floor, excess([]), list(best)
    raise AssertionError("no fastener set satisfies the rule")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", default="flan42")
    a = ap.parse_args()
    registry = json.loads((ROOT / "design/variants.json").read_text())["variants"]
    spec = registry[a.variant]
    revI = json.loads((ROOT / "design/revI-profiles.json").read_text())["left"]
    mounts = json.loads((ROOT / "design/revI-mounts.json").read_text())["left"]
    _, shell36, base = pcb_outline(registry["flan36"]["outline"])
    assert base == revI["pcb_outline"], "the PCB rule no longer reproduces revI's pcb_outline"
    outer, shell, board = pcb_outline(spec["outline"])
    holes = {m["id"]: tuple(m["xy"]) for m in mounts}
    floor, without, chosen = choose(shell, shell36, holes)
    others = iter(range(9, 99))
    added = []
    for key, xy in sorted(chosen, key=lambda c: NAMES.get(c[0], "H99")):
        src, shift = key[:2], key[2:]
        added.append({"id": NAMES.get(key) or f"H{next(others)}", "xy": [round(xy[0], 6), round(xy[1], 6)],
                      "from": src, "offset_mm": list(SHIFTS[shift]), "footprint": "MountingHole:MountingHole_2.2mm_M2"})
    left = {"control_vertices": spec["outline"]["control_vertices"], "radii": spec["outline"]["radii"],
            "outer": outer, "pcb_outline": board, "pcb_cutouts": revI["pcb_cutouts"], "added_mounts": added}
    reflect = lambda p: [MIRROR_X - p[0], p[1]]
    right = {"control_vertices": [reflect(p) for p in left["control_vertices"]], "radii": left["radii"],
             "outer": [reflect(p) for p in outer], "pcb_outline": [reflect(p) for p in board],
             "pcb_cutouts": [[reflect(p) for p in loop] for loop in revI["pcb_cutouts"]],
             "added_mounts": [dict(h, xy=reflect(h["xy"]), offset_mm=[-h["offset_mm"][0], h["offset_mm"][1]]) for h in added]}
    out = {"schema": "flan-variant-profiles-1", "variant": a.variant, "units": "mm",
           "rule": "revI: rounded case outline inset 1.65 mm, minus the 2.05 mm LCD-flank notch; revI cutouts",
           "fasteners": {"kept": sorted(holes), "added": [h["id"] for h in added],
                         "rule": "edge points left of the bay within max(Flan36's worst key-side distance, the "
                                 "distance at the Flan36 edge point they extend) of a fastener; smallest set of revI "
                                 "holes moved a column outward, a row up or both",
                         "flan36_worst_key_side_mm": round(floor, 2),
                         "worst_excess_without_added_mm": round(without, 2)},
           "left": left, "right": right}
    path = ROOT / f"design/{a.variant}-profiles.json"
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(f"{a.variant}: {len(board)} outline points, fasteners {out['fasteners']}")

if __name__ == "__main__":
    main()
