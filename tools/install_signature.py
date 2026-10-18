#!/usr/bin/env python3
"""Install the Flan signature on the back of both routed revI boards.

Removes any installed "silkscreen-art" (a back pattern) and an earlier "flan-signature",
checks that what remains is the routed board byte for byte, places the lockup, rule, edition
lines and the maker's credit (tools/silkscreen/signature.flan_plate), checks them against pads,
holes, edges and legends, and records validation/revI-signature.json. Patterns become
per-edition packages (tools/export_editions.py); the canonical boards carry only the
signature. Then rerun check_routed_pcb.py and export_fabrication.py.

--variant flan42 signs hardware/flan42 the same way (validation/flan42-signature.json),
after checking that the lockup and credit still lie in the board's free back area.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, sys

from shapely.geometry import MultiPolygon, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen.geo import Board, polys                      # noqa: E402
from silkscreen.prims import dehole                          # noqa: E402
from silkscreen.space import free_area, rects                # noqa: E402
from silkscreen import signature                             # noqa: E402
from branding.lockup import FONT, font_file                  # noqa: E402
from prepare_silkscreen_r1 import KICAD_PY, check, min_counter, kpy, sha   # noqa: E402

HW = ROOT / "hardware/revI"
BUILD = ROOT / "build/signature"
HELPERS = ROOT / "tools/silkscreen"
# routed boards (tools/check_routed_pcb.py baseline lineage) before any back-silkscreen art
ROUTED = {"left": "38c58eb3590e2dbb3abae645d75c264904683427476dbf514bda69849b4431a8",
          "right": "362f58bad47711258a11dfa2d7dcf165b7345b12d5144d3c7fa9b998b0288f43"}
MIN_STROKE = 0.17
# Flan family boards (build_variant_pcb.py + route_variant_keys.py), routed, before any art
VARIANTS = {"flan42": {"left": "0daac0ed6ac5f9c88983d8ecd1b6281b027e47e985c55ab290e6c1d3427cf5a0",
                       "right": "5e83953bc24d6cf054df2ae6a2c703cb322888304d6fc4380567336c5d4015bd"}}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    ap.add_argument("--variant", default="flan36", choices=["flan36", *VARIANTS])
    a = ap.parse_args()
    family = a.variant != "flan36"
    hw = ROOT / "hardware" / a.variant if family else HW
    build = ROOT / "build" / f"signature-{a.variant}" if family else BUILD
    routed = VARIANTS[a.variant] if family else ROUTED
    font = font_file(ROOT)
    assert font.is_file() and sha(font) == FONT["sha256"], f"pinned font missing: fetch {FONT['file']} from {FONT['source']} into build/fonts/"
    build.mkdir(parents=True, exist_ok=True)
    plan, receipt = {}, {"schema": "flan36-signature-1", "layer": "B.SilkS", "group": "flan-signature",
                         "font": FONT, "physical_acceptance": False, "halves": {}}
    for half in ("left", "right"):                 # validate both halves before writing either
        pcb = hw / f"{a.variant}-{half}.kicad_pcb"
        base = build / f"base-{half}.kicad_pcb"
        kpy([HELPERS / "kicad_strip_art.py", pcb, base, "silkscreen-art", "flan-signature"], a.kicad_python)
        assert sha(base) == routed[half], f"{half}: removing installed art did not restore the routed board"
        kpy([HELPERS / "kicad_extract.py", base, build / f"geo-{half}.json"], a.kicad_python)
        b = Board(half, build)
        shapes, texts, zones = signature.flan_plate(half, font)
        if family:   # the lockup and credit must still sit in free back area on the variant
            free = free_area(b, "B")
            found = [list(r) for r in rects(free, top=2)]
            for z in zones:
                assert z.difference(free).area < 1e-6, (half, z.bounds, "not free on " + a.variant)
        spec = build / f"texts-{half}.json"
        spec.write_text(json.dumps(texts))
        kpy([HELPERS / "kicad_text.py", spec, build / f"texts-{half}-out.json"], a.kicad_python)
        text_g = unary_union([polys(v) for v in json.loads((build / f"texts-{half}-out.json").read_text()).values()])
        full = shapes.union(text_g)
        e = check(b, "B", full)
        lost = shapes.difference(shapes.buffer(-MIN_STROKE / 2, quad_segs=8).buffer(MIN_STROKE / 2, quad_segs=8))
        e["largest_thin_piece_mm2"] = round(max([q.area for q in getattr(lost, "geoms", [lost])] or [0]), 4)
        e["min_counter_mm"] = min_counter(shapes)
        bad = e["keepout_overlap_mm2"] or e["existing_silk_overlap_mm2"] or e["outside_edge_clearance_mm2"] \
            or e["largest_thin_piece_mm2"] > 0.01 or e["min_counter_mm"] < 0.25
        assert not bad, f"{half}: signature fails print checks {e}"
        art = build / f"art-{half}.json"
        art.write_text(json.dumps({"F": mapping(MultiPolygon()), "B": mapping(MultiPolygon(dehole(shapes))), "texts": texts}))
        plan[half] = (pcb, sha(pcb), art, e, [list(z.bounds) for z in zones])
        if family:
            plan[half] += (found,)
    for half, (pcb, before, art, e, zones, *found) in plan.items():
        base = build / f"base-{half}.kicad_pcb"
        kpy([HELPERS / "kicad_inject.py", base, art, pcb, "flan-signature"], a.kicad_python)
        receipt["halves"][half] = {"pcb_before_sha256": before, "routed_base_sha256": routed[half],
                                   "pcb_after_sha256": sha(pcb), "art_sha256": sha(art), "checks": e, "zones": zones}
        if family:
            receipt["halves"][half]["free_back_rectangles"] = found[0]
    if family:
        receipt = {"schema": "flan-variant-signature-1", "variant": a.variant, **{k: v for k, v in receipt.items() if k != "schema"},
                   "placement": "revI plate and credit rectangles; both art zones checked inside this board's free back area"}
    (ROOT / ("validation/revI-signature.json" if not family else f"validation/{a.variant}-signature.json")).write_text(json.dumps(receipt, indent=2) + "\n")
    print("signature installed on both halves:", json.dumps({h: v["checks"] for h, v in receipt["halves"].items()}))

if __name__ == "__main__":
    main()
